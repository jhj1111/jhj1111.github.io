# Lumipet Re-ID Logging System Design Spec

**Date:** 2026-07-19  
**Status:** Approved  
**Scope:** Replace ad-hoc `print()` statements with a structured, Ultralytics-style singleton `LOGGER`.

---

## 1. Overview
The goal is to transition `lumipet-reid` from raw `print()` statements to a unified, configurable logging system. The design is inspired by Ultralytics (`ultralytics.utils.LOGGER`) to provide clean terminal coloring, configurable verbosity/log levels, optional file logging, and structured model loading diagnostics.

---

## 2. Architecture & Components

### 2.1 Logger Module (`reid/utils/logger.py`)
- **Singleton Logger (`LOGGER`)**: Global `logging.Logger` instance named `"lumipet-reid"`.
- **`ColoredFormatter`**: Custom `logging.Formatter` providing ANSI color coding for terminal output:
  - `DEBUG`: Gray/Cyan prefix (`DEBUG`)
  - `INFO`: Standard clear text / Green accent (`[ReID] INFO`)
  - `WARNING`: Yellow text with icon (`WARNING ⚠️`)
  - `ERROR`: Red bold text with icon (`ERROR ❌`)
- **`set_logging(name="lumipet-reid", verbose="INFO", log_file=None)`**:
  - Dynamically updates the log level and handlers on `LOGGER`.
  - Supports optional file logging (`FileHandler`) with non-colored ISO timestamps (`YYYY-MM-DD HH:MM:SS`).

### 2.2 Log Level Hierarchy & `verbose` Configuration
Standard logging hierarchy applies (a level outputs all messages at or above its priority):
- `DEBUG` (10) ➔ Outputs `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`
- `INFO` (20) ➔ Outputs `INFO`, `WARNING`, `ERROR`, `CRITICAL`
- `WARNING` (30) ➔ Outputs `WARNING`, `ERROR`, `CRITICAL`
- `ERROR` (40) ➔ Outputs `ERROR`, `CRITICAL`

`verbose` mapping logic in `set_logging()`:
- `True` or `"INFO"` (default) ➔ `logging.INFO`
- `False` or `"WARNING"` ➔ `logging.WARNING` (Quiet mode)
- `"DEBUG"` ➔ `logging.DEBUG` (Detailed debugging)
- `"ERROR"` ➔ `logging.ERROR` (Errors only)

---

## 3. Configuration Updates (`config.yaml` & `reid/cfg/default.yaml`)

Add the following fields to both configuration files under `# Device & Run Settings`:

```yaml
# Logging Settings
verbose: "INFO"      # Logging level: "INFO", "DEBUG", "WARNING", "ERROR", or boolean (True/False)
log_file: None       # Optional file path to save logs (e.g. "logs/reid.log")
```

---

## 4. Model Weight Loading Logging Specification

When model weights are loaded (PyTorch checkpoints, ONNX, or TensorRT), structured logs will be emitted:

- **`LOGGER.info` (Summary Level)**:
  - Format: `[ReID] INFO 🚀 <Component> loaded: '<ModelName/Weights>' (Device: <device>, Precision: <precision>, Format: <format>)`
  - Examples:
    - `[ReID] INFO 🚀 Extractor loaded: 'wildlife_tools_step2_hybrid_08.pth' (Device: cuda, Precision: fp16, Format: PyTorch)`
    - `[ReID] INFO ⚡ Extractor ONNX loaded: 'wildlife_tools_step2_hybrid_08.onnx' (Provider: CUDAExecutionProvider)`
- **`LOGGER.debug` (Detailed Level)**:
  - Detailed state dict information (number of loaded keys, projection layers, missing/unexpected keys count).

---

## 5. Migration Targets (`print` -> `LOGGER`)

The following files will be refactored to replace `print()` with appropriate `LOGGER` calls:

1. `reid/cli.py`: CLI summary, delete/migrate status, error messages.
2. `reid/engine/predictor.py` & `trainer.py`: Profiler summary, weights saving notifications.
3. `reid/models/extractor/predict.py`: ONNX export and simplification progress.
4. `reid/models/extractor/wildlife/model.py` & `mega_descriptor/model.py`: Weight loading logs.
5. `reid/models/extractor/val.py`: Validation gallery building and accuracy reporting.
6. `reid/models/extractor/embedding.py`: Database mismatch warnings.
7. `reid/utils/checks.py`: CUDA fallback warning.
8. `reid/data/loader.py`: Dataset missing warning.
