# Logging System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw `print()` statements throughout `lumipet-reid` with an Ultralytics-style singleton `LOGGER` supporting colorized terminal output, configurable verbosity/levels, and optional file logging.

**Architecture:** A singleton `LOGGER` (`logging.Logger` named `"lumipet-reid"`) will be provided by `reid/utils/logger.py`. A `ColoredFormatter` handles terminal ANSI coloring and `set_logging()` dynamically maps configuration settings (`verbose` as bool/str and `log_file`) to logger levels and handlers. All `print()` calls across CLI, models, engines, and utilities will be replaced with `LOGGER`.

**Tech Stack:** Python Standard Library (`logging`, `ctypes`, `site`, `pathlib`), Pytest

---

## File Structure Map

- **Create**:
  - `reid/utils/logger.py`: Implements `ColoredFormatter`, `set_logging()`, and exports global `LOGGER`.
  - `tests/test_logger.py`: Unit tests for `LOGGER`, `set_logging()`, level parsing, and file handler.
- **Modify**:
  - `reid/utils/__init__.py`: Export `LOGGER` and `set_logging`.
  - `config.yaml`: Add `verbose` and `log_file` entries.
  - `reid/cfg/default.yaml`: Add `verbose` and `log_file` entries.
  - `reid/core/config.py`: Parse `verbose` and `log_file`, trigger `set_logging()`.
  - `reid/cli.py`: Initialize logger with config, replace `print()` with `LOGGER`.
  - `reid/models/extractor/wildlife/model.py`: Structured weight loading logs with `LOGGER`.
  - `reid/models/extractor/mega_descriptor/model.py`: Structured weight loading logs with `LOGGER`.
  - `reid/models/extractor/predict.py`: Replace `print()` in ONNX export and prediction with `LOGGER`.
  - `reid/engine/predictor.py`: Replace `print()` in profiler summary and save info with `LOGGER`.
  - `reid/engine/trainer.py`: Replace `print()` in validation and weights saving with `LOGGER`.
  - `reid/models/extractor/val.py`: Replace `print()` in gallery building and accuracy reporting with `LOGGER`.
  - `reid/models/extractor/embedding.py`: Replace `print()` with `LOGGER`.
  - `reid/utils/checks.py`: Replace `print()` with `LOGGER`.
  - `reid/data/loader.py`: Replace `print()` with `LOGGER`.

---

### Task 1: Create Logger Module (`reid/utils/logger.py`) and Unit Tests

**Files:**
- Create: `reid/utils/logger.py`
- Create: `tests/test_logger.py`
- Modify: `reid/utils/__init__.py`

- [ ] **Step 1: Write failing unit test for logger**

```python
# tests/test_logger.py
import logging
import os
from reid.utils.logger import LOGGER, set_logging

def test_logger_instance():
    assert isinstance(LOGGER, logging.Logger)
    assert LOGGER.name == "lumipet-reid"

def test_set_logging_levels():
    set_logging(verbose="DEBUG")
    assert LOGGER.level == logging.DEBUG
    
    set_logging(verbose="INFO")
    assert LOGGER.level == logging.INFO
    
    set_logging(verbose="WARNING")
    assert LOGGER.level == logging.WARNING
    
    set_logging(verbose=True)
    assert LOGGER.level == logging.INFO
    
    set_logging(verbose=False)
    assert LOGGER.level == logging.WARNING

def test_set_logging_file_handler(tmp_path):
    log_file = tmp_path / "test.log"
    set_logging(verbose="INFO", log_file=str(log_file))
    LOGGER.info("Test log line")
    
    assert log_file.exists()
    content = log_file.read_text()
    assert "Test log line" in content
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_logger.py`  
Expected: FAIL (ModuleNotFoundError: No module named 'reid.utils.logger')

- [ ] **Step 3: Implement `reid/utils/logger.py`**

```python
# reid/utils/logger.py
import logging
import sys
from pathlib import Path
from typing import Union, Optional

class ColoredFormatter(logging.Formatter):
    """Custom formatter providing ANSI color codes for terminal output."""
    COLORS = {
        logging.DEBUG: "\033[36m",      # Cyan
        logging.INFO: "\033[0m",        # Reset / White
        logging.WARNING: "\033[33m",   # Yellow
        logging.ERROR: "\033[31m",     # Red
        logging.CRITICAL: "\033[1;31m" # Bold Red
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelno, self.RESET)
        prefix = "[ReID] "
        if record.levelno == logging.WARNING:
            prefix += "WARNING ⚠️ "
        elif record.levelno == logging.ERROR:
            prefix += "ERROR ❌ "
        elif record.levelno == logging.CRITICAL:
            prefix += "CRITICAL 💥 "
        elif record.levelno == logging.DEBUG:
            prefix += "DEBUG "

        msg = super().format(record)
        return f"{color}{prefix}{msg}{self.RESET}"


LOGGER = logging.getLogger("lumipet-reid")
LOGGER.propagate = False

_console_handler: Optional[logging.Handler] = None
_file_handler: Optional[logging.Handler] = None


def set_logging(
    name: str = "lumipet-reid",
    verbose: Union[bool, str] = "INFO",
    log_file: Optional[Union[str, Path]] = None
) -> None:
    global _console_handler, _file_handler

    # 1. Parse level
    if isinstance(verbose, bool):
        level = logging.INFO if verbose else logging.WARNING
    elif isinstance(verbose, str):
        v_upper = verbose.upper()
        if v_upper == "TRUE":
            level = logging.INFO
        elif v_upper == "FALSE":
            level = logging.WARNING
        else:
            level = getattr(logging, v_upper, logging.INFO)
    else:
        level = logging.INFO

    LOGGER.setLevel(level)

    # 2. Console Handler
    if _console_handler is None:
        _console_handler = logging.StreamHandler(sys.stdout)
        _console_handler.setFormatter(ColoredFormatter("%(message)s"))
        LOGGER.addHandler(_console_handler)
    _console_handler.setLevel(level)

    # 3. File Handler
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        if _file_handler is not None:
            LOGGER.removeHandler(_file_handler)
        _file_handler = logging.FileHandler(str(log_path), encoding="utf-8")
        file_formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        _file_handler.setFormatter(file_formatter)
        _file_handler.setLevel(level)
        LOGGER.addHandler(_file_handler)
```

- [ ] **Step 4: Update `reid/utils/__init__.py` to export `LOGGER` and `set_logging`**

```python
# reid/utils/__init__.py
from pathlib import Path
from typing import Union, Optional
from .hashing import calculate_md5
from .checks import setup_cuda_libs
from .logger import LOGGER, set_logging
```

- [ ] **Step 5: Run unit tests to verify PASS**

Run: `.venv/bin/pytest tests/test_logger.py`  
Expected: PASS

---

### Task 2: Update Configuration Files (`config.yaml` & `reid/cfg/default.yaml`) and Config Loader

**Files:**
- Modify: `config.yaml`
- Modify: `reid/cfg/default.yaml`
- Modify: `reid/core/config.py`

- [ ] **Step 1: Add logging settings to `config.yaml`**

Under `# Device & Run Settings`:
```yaml
# Logging Settings
verbose: "INFO"
log_file: null
```

- [ ] **Step 2: Add logging settings to `reid/cfg/default.yaml`**

Under `# Device & Run Settings`:
```yaml
verbose: "INFO"
log_file: null
```

- [ ] **Step 3: Update `reid/core/config.py` to trigger `set_logging()`**

In `reid/core/config.py`, ensure `verbose` and `log_file` fields are loaded into config dataclass/dict and call `set_logging(verbose=cfg.verbose, log_file=cfg.log_file)` during initialization.

- [ ] **Step 4: Verify config loading in python**

Run: `.venv/bin/python -c "from reid.core.config import get_config; cfg = get_config(); print(cfg.verbose)"`  
Expected: `INFO`

---

### Task 3: Refactor Model Weight Loading & Predictor/Trainer Logs

**Files:**
- Modify: `reid/models/extractor/wildlife/model.py`
- Modify: `reid/models/extractor/mega_descriptor/model.py`
- Modify: `reid/models/extractor/predict.py`
- Modify: `reid/engine/predictor.py`
- Modify: `reid/engine/trainer.py`
- Modify: `reid/models/extractor/val.py`

- [ ] **Step 1: Update Wildlife Extractor Weight Loading (`reid/models/extractor/wildlife/model.py`)**

Replace `print(f"Loading weights from {weights}")` with:
```python
LOGGER.info(f"🚀 Extractor loaded: '{Path(weights).name}' (Device: {self.cfg.device}, Format: PyTorch)")
```
Replace error prints with `LOGGER.error()`.

- [ ] **Step 2: Update MegaDescriptor Extractor Weight Loading (`reid/models/extractor/mega_descriptor/model.py`)**

Replace `print()` statements with structured `LOGGER.info()` and `LOGGER.debug()` calls describing backbone, projection, and raw state_dict loading.

- [ ] **Step 3: Update Extractor Predictor ONNX Export & Runtime (`reid/models/extractor/predict.py`)**

Replace `print()` statements in `setup_model()` and `export()` with `LOGGER.info()`, `LOGGER.warning()`, and `LOGGER.error()`.

- [ ] **Step 4: Update Engine Predictor & Trainer (`reid/engine/predictor.py` & `reid/engine/trainer.py`)**

Replace profiler summary `print()` and weights saving `print()` with `LOGGER.info()`.

- [ ] **Step 5: Update Validation Module (`reid/models/extractor/val.py`)**

Replace validation gallery building and accuracy reporting `print()` calls with `LOGGER.info()`.

---

### Task 4: Refactor CLI & Remaining Utilities (`print` -> `LOGGER`)

**Files:**
- Modify: `reid/cli.py`
- Modify: `reid/utils/checks.py`
- Modify: `reid/data/loader.py`
- Modify: `reid/models/extractor/embedding.py`

- [ ] **Step 1: Initialize logger in `reid/cli.py`**

In `reid/cli.py` `main()`:
```python
def main() -> None:
    from reid.utils import setup_cuda_libs, set_logging, LOGGER
    setup_cuda_libs()

    cfg = get_config()
    set_logging(verbose=getattr(cfg, "verbose", "INFO"), log_file=getattr(cfg, "log_file", None))
```

Replace all remaining `print()` statements in `cli.py` (e.g. list, delete, migrate summaries) with `LOGGER.info()`, `LOGGER.warning()`, `LOGGER.error()`.

- [ ] **Step 2: Update `reid/utils/checks.py`**

Replace CUDA fallback warning `print()` with `LOGGER.warning()`.

- [ ] **Step 3: Update `reid/data/loader.py` and `reid/models/extractor/embedding.py`**

Replace missing dataset warning and DB embedding model mismatch warnings with `LOGGER.warning()`.

---

### Task 5: End-to-End Verification & Final Code Check

- [ ] **Step 1: Run unit test suite**

Run: `.venv/bin/pytest tests/test_logger.py`  
Expected: PASS

- [ ] **Step 2: Run end-to-end `reid predict` command**

Run: `.venv/bin/reid predict source=datasets/cream_heroes/lulu_03.mp4`  
Expected: Complete prediction execution with clean `[ReID] INFO` colorized logs and profiler output.

- [ ] **Step 3: Grouped Git Commits (After full verification)**

Execute git commits grouped by work item (e.g. `feat: add logger utility and unit tests`, `refactor: replace print statements with LOGGER across models and CLI`).
