# SQLite Database Refactoring & Batch Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transition the Lumipet Re-ID system storage from NPZ to SQLite, implement MD5-based deduplication, enable fast batch registration, and add CLI tools for DB list/delete/migrate.

**Architecture:** We will replace `EmbeddingStore` internals with an SQLite engine while retaining its original public API for other pipeline components. We will add a utility to compute image hashes, update the bulk registration loop to extract features in batches using `predict_batch`, and integrate database management actions into `cli.py`.

**Tech Stack:** Python 3.10+, sqlite3, numpy, torch, hashlib

---

### Task 1: Image Hashing Utility

**Files:**
- Create: `reid/utils/hashing.py`
- Test: `tests/test_hashing.py`

- [ ] **Step 1: Write a failing test for image hashing**

Create `tests/test_hashing.py`:
```python
import tempfile
import os
from reid.utils.hashing import calculate_md5

def test_calculate_md5():
    with tempfile.NamedTemporaryFile("wb", delete=False) as f:
        f.write(b"test cat image data")
        temp_path = f.name
        
    try:
        expected_md5 = "e12c1ad30df4545d62ad6117eb8a2e1d"
        assert calculate_md5(temp_path) == expected_md5
    finally:
        os.remove(temp_path)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest tests/test_hashing.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'reid.utils.hashing'"

- [ ] **Step 3: Write minimal implementation**

Create `reid/utils/hashing.py`:
```python
import hashlib
from pathlib import Path
from typing import Union

def calculate_md5(file_path: Union[str, Path]) -> str:
    """Calculate MD5 checksum of a file."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()
```

Update `reid/utils/__init__.py` to expose it:
```python
from .hashing import calculate_md5
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest tests/test_hashing.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add reid/utils/hashing.py reid/utils/__init__.py tests/test_hashing.py
git commit -m "feat(utils): add md5 hashing utility"
```

---

### Task 2: SQLite Connection and Schema Initialization

**Files:**
- Modify: `reid/models/extractor/embedding.py`
- Test: `tests/test_database.py`

- [ ] **Step 1: Write a failing test for SQLite database initialization**

Create `tests/test_database.py`:
```python
import os
import tempfile
import sqlite3
import numpy as np
from reid.models.extractor.embedding import EmbeddingStore

def test_db_initialization():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db_path = f.name
    
    try:
        store = EmbeddingStore(temp_db_path)
        # Check connection is active and tables exist
        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='embeddings';")
        row = cursor.fetchone()
        assert row is not None
        assert row[0] == "embeddings"
        conn.close()
    finally:
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest tests/test_database.py -v`
Expected: FAIL (AssertionError or sqlite3 schema check fail because `EmbeddingStore` currently only reads `.npz`)

- [ ] **Step 3: Refactor class initialization and schema creation**

Modify `reid/models/extractor/embedding.py` to use SQLite connection:
```python
import sqlite3
from pathlib import Path
from typing import Tuple, List, Optional, Dict, Any
import numpy as np

class EmbeddingStore:
    """
    Manages loading, saving, and adding embeddings to the database.
    Stored as a SQLite database.
    """
    def __init__(self, db_path: str = "embeddings/db.db"):
        path = Path(db_path)
        # Automatic mapping of .npz to .db extension
        if path.suffix == ".npz":
            path = path.with_suffix(".db")
            
        self.db_path = path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.create_tables()

    def create_tables(self):
        """Create tables and indexes if they do not exist."""
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS embeddings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT NOT NULL,
                embedding BLOB NOT NULL,
                image_path TEXT,
                image_hash TEXT UNIQUE,
                model_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_embeddings_label ON embeddings(label);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings(image_hash);")
        self.conn.commit()

    def close(self):
        """Close connection."""
        if hasattr(self, "conn") and self.conn:
            self.conn.close()
            
    # Mock / empty definitions of remaining old methods to compile
    def add(self, embedding: np.ndarray, label: str): pass
    def save(self): pass
    def load(self): pass
    def get_all(self) -> Tuple[np.ndarray, List[str]]: return np.empty((0, 0)), []
    def clear(self): pass
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest tests/test_database.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add reid/models/extractor/embedding.py tests/test_database.py
git commit -m "feat(extractor): initialize sqlite database and create tables"
```

---

### Task 3: Core SQLite DB Operations in `EmbeddingStore`

**Files:**
- Modify: `reid/models/extractor/embedding.py`
- Test: `tests/test_database.py`

- [ ] **Step 1: Write failing tests for SQLite CRUD operations**

Modify `tests/test_database.py` to add CRUD testing:
```python
def test_db_crud_operations():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db_path = f.name
        
    try:
        store = EmbeddingStore(temp_db_path)
        
        # 1. Test insertion and retrieval
        emb1 = np.ones((1, 128), dtype=np.float32)
        store.add(emb1, "Cheesecake", image_path="cat1.jpg", image_hash="hash1", model_name="test_model")
        
        embs, labels = store.get_all(model_name="test_model")
        assert embs.shape == (1, 128)
        assert labels == ["Cheesecake"]
        
        # 2. Test duplicate hash handling
        store.add(emb1, "Cheesecake", image_path="cat1.jpg", image_hash="hash1", model_name="test_model")
        # Should gracefully ignore insertion (duplicate hash) and total count remains 1
        embs, labels = store.get_all(model_name="test_model")
        assert len(labels) == 1
        
        # 3. Test list_labels
        emb2 = np.ones((1, 128), dtype=np.float32) * 2
        store.add(emb2, "Nabi", image_path="cat2.jpg", image_hash="hash2", model_name="test_model")
        counts = store.list_labels()
        assert counts == {"Cheesecake": 1, "Nabi": 1}
        
        # 4. Test delete_label
        deleted = store.delete_label("Cheesecake")
        assert deleted == 1
        counts_after = store.list_labels()
        assert "Cheesecake" not in counts_after
        
        # 5. Test clear
        store.clear()
        assert len(store.list_labels()) == 0
        
    finally:
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest tests/test_database.py::test_db_crud_operations -v`
Expected: FAIL

- [ ] **Step 3: Implement SQLite Operations with blob serialization**

Modify `reid/models/extractor/embedding.py`:
```python
    def add(self, embedding: np.ndarray, label: str, image_path: Optional[str] = None, image_hash: Optional[str] = None, model_name: str = "") -> None:
        """Add a single embedding and label to the store."""
        if embedding.ndim == 2:
            embedding = embedding.flatten()
        embedding_bytes = embedding.astype(np.float32).tobytes()
        
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO embeddings (label, embedding, image_path, image_hash, model_name) VALUES (?, ?, ?, ?, ?)",
                (label, embedding_bytes, image_path, image_hash, model_name)
            )
            self.conn.commit()
        except sqlite3.IntegrityError:
            # Hash already exists, ignore
            pass

    def add_batch(self, embeddings: np.ndarray, labels: List[str], image_paths: List[str], image_hashes: List[str], model_name: str) -> None:
        """Insert multiple embeddings in a single transaction."""
        cursor = self.conn.cursor()
        data = []
        for i in range(len(labels)):
            emb = embeddings[i]
            if emb.ndim == 2:
                emb = emb.flatten()
            embedding_bytes = emb.astype(np.float32).tobytes()
            data.append((labels[i], embedding_bytes, image_paths[i], image_hashes[i], model_name))
            
        try:
            cursor.executemany(
                "INSERT OR IGNORE INTO embeddings (label, embedding, image_path, image_hash, model_name) VALUES (?, ?, ?, ?, ?)",
                data
            )
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e

    def get_all(self, model_name: Optional[str] = None) -> Tuple[np.ndarray, List[str]]:
        """Return all embeddings and labels matching model_name."""
        cursor = self.conn.cursor()
        if model_name:
            # Check for different model embeddings
            cursor.execute("SELECT DISTINCT model_name FROM embeddings WHERE model_name != ?", (model_name,))
            diff_models = [row[0] for row in cursor.fetchall()]
            if diff_models:
                print(f"Warning: Database contains embeddings from a different model(s): {diff_models}. "
                      f"Please run 'reid migrate' to regenerate features.")
            
            cursor.execute("SELECT embedding, label FROM embeddings WHERE model_name = ?", (model_name,))
        else:
            cursor.execute("SELECT embedding, label FROM embeddings")
            
        rows = cursor.fetchall()
        if not rows:
            return np.empty((0, 0), dtype=np.float32), []
            
        embeddings_list = []
        labels = []
        for row in rows:
            emb_arr = np.frombuffer(row[0], dtype=np.float32)
            embeddings_list.append(emb_arr)
            labels.append(row[1])
            
        return np.vstack(embeddings_list), labels

    def list_labels(self) -> Dict[str, int]:
        """Return label counts."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT label, COUNT(id) FROM embeddings GROUP BY label")
        return {row[0]: row[1] for row in cursor.fetchall()}

    def delete_label(self, label: str) -> int:
        """Delete entries matching label."""
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM embeddings WHERE label = ?", (label,))
        self.conn.commit()
        return cursor.rowcount

    def clear(self) -> None:
        """Clear database."""
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM embeddings")
        self.conn.commit()

    # Legacy/compatibility methods
    def save(self):
        pass # Not needed for SQLite as auto-commits are used

    def load(self):
        pass # Initialized in constructor
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest tests/test_database.py::test_db_crud_operations -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add reid/models/extractor/embedding.py tests/test_database.py
git commit -m "feat(extractor): implement database queries and CRUD operations"
```

---

### Task 4: Refactor `ExtractorModel` to use Batch Registration & Deduplication

**Files:**
- Modify: `reid/models/extractor/model.py`
- Test: `tests/test_database.py`

- [ ] **Step 1: Write integration test for batch registration**

Add to `tests/test_database.py`:
```python
def test_extractor_model_batch_registration():
    from unittest.mock import MagicMock
    from reid.models.extractor.model import ExtractorModel
    from reid.core.config import Config
    
    cfg = Config()
    cfg.imgsz = 224
    cfg.batch_size = 2
    
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db_path = f.name
        
    cfg.db_path = temp_db_path
    
    # Mock original _load_model and _get_predictor
    class MockExtractorModel(ExtractorModel):
        def _load_model(self, model_path: str) -> None:
            self.model = MagicMock()
        def _get_trainer(self): pass
        def _get_validator(self): pass
        
    try:
        model = MockExtractorModel(db_path=temp_db_path, cfg=cfg)
        
        # Mock predictor batch inference
        mock_predictor = MagicMock()
        mock_predictor.predict_batch.side_effect = lambda im_list: np.ones((len(im_list), 128), dtype=np.float32)
        model._get_predictor = MagicMock(return_value=mock_predictor)
        
        # Create temp source directory for bulk registration
        with tempfile.TemporaryDirectory() as src_dir:
            nabi_dir = os.path.join(src_dir, "Nabi")
            os.makedirs(nabi_dir)
            
            # Write 3 dummy image files
            for i in range(3):
                with open(os.path.join(nabi_dir, f"img_{i}.jpg"), "wb") as f:
                    f.write(f"fake_data_{i}".encode())
                    
            model.register(src_dir, label="Unknown")
            
        # Verify 3 embeddings were added to DB
        embs, labels = model.store.get_all(model_name=cfg.model_name)
        assert len(labels) == 3
        assert labels.count("Nabi") == 3
        assert embs.shape == (3, 128)
        
    finally:
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest tests/test_database.py::test_extractor_model_batch_registration -v`
Expected: FAIL (either due to file scanning or sequential registration logic in `model.py`)

- [ ] **Step 3: Implement batch registration with deduplication**

Modify `reid/models/extractor/model.py` (lines 57-91):
```python
    def register(self, source: str, label: str, verbose: Optional[bool] = None) -> None:
        """Extract features and save to embedding store using batch prediction and hash deduplication."""
        from reid.utils import calculate_md5
        
        if not os.path.exists(source):
            print(f"Error: Register source {source} does not exist.")
            return

        image_files = [] # list of (filepath, label)
        
        if os.path.isdir(source):
            print(f"Scanning directory for registration: {source}")
            labels = [d for d in os.listdir(source) if os.path.isdir(os.path.join(source, d))]
            for s_label in labels:
                label_dir = os.path.join(source, s_label)
                for root, _, files in os.walk(label_dir):
                    for f in files:
                        if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                            image_files.append((os.path.join(root, f), s_label))
        else:
            image_files.append((source, label))

        # Check existing hashes in store to prevent duplicates
        cursor = self.store.conn.cursor()
        cursor.execute("SELECT image_hash FROM embeddings")
        existing_hashes = {row[0] for row in cursor.fetchall() if row[0] is not None}
        
        # Calculate hashes and filter
        valid_registrations = []
        for img_path, img_label in image_files:
            try:
                img_hash = calculate_md5(img_path)
                if img_hash not in existing_hashes:
                    valid_registrations.append((img_path, img_label, img_hash))
            except Exception as e:
                print(f"Error reading {img_path}: {e}")

        if not valid_registrations:
            print("No new unique images to register.")
            return

        print(f"Registering {len(valid_registrations)} new unique image(s) in batches...")
        batch_size = getattr(self.cfg, "batch_size", 16)
        predictor = self._get_predictor()
        
        for idx in tqdm(range(0, len(valid_registrations), batch_size)):
            chunk = valid_registrations[idx:idx + batch_size]
            chunk_paths = [item[0] for item in chunk]
            chunk_labels = [item[1] for item in chunk]
            chunk_hashes = [item[2] for item in chunk]
            
            # Predict in batch
            try:
                embeddings = predictor.predict_batch(chunk_paths)
                self.store.add_batch(
                    embeddings=embeddings,
                    labels=chunk_labels,
                    image_paths=chunk_paths,
                    image_hashes=chunk_hashes,
                    model_name=self.cfg.model_name
                )
            except Exception as e:
                print(f"Failed extracting batch {chunk_paths}: {e}")
                
        print("Registration completed successfully.")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest tests/test_database.py::test_extractor_model_batch_registration -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add reid/models/extractor/model.py tests/test_database.py
git commit -m "refactor(extractor): implement high-performance batch registration with hash deduplication"
```

---

### Task 5: Integration of CLI Commands (List, Delete, Migrate)

**Files:**
- Modify: `reid/cli.py`
- Test: `tests/test_database.py`

- [ ] **Step 1: Write integration tests for CLI actions**

Add tests to `tests/test_database.py`:
```python
def test_cli_commands_integration():
    from unittest.mock import patch, MagicMock
    import sys
    from reid.cli import main
    from reid.core.config import Config
    
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_db_path = f.name
        
    try:
        # 1. Test "list" mode
        test_args = ["reid", "list", f"db_path={temp_db_path}"]
        with patch.object(sys, "argv", test_args), patch("builtins.print") as mock_print:
            main()
            printed = "".join([call[0][0] for call in mock_print.call_args_list])
            assert "Registered Cats Summary" in printed
            
        # 2. Test "delete" mode
        test_args_delete = ["reid", "delete", "label=Cheesecake", f"db_path={temp_db_path}"]
        with patch.object(sys, "argv", test_args_delete), patch("builtins.print") as mock_print:
            main()
            printed = "".join([call[0][0] for call in mock_print.call_args_list])
            assert "Deleted Cheesecake" in printed
            
    finally:
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/bin/pytest tests/test_database.py::test_cli_commands_integration -v`
Expected: FAIL (printed messages match "Unknown mode: list")

- [ ] **Step 3: Modify `reid/cli.py` to route new operations**

Modify `reid/cli.py`:
```python
import sys
from pathlib import Path

from reid.core.config import get_config
from reid.container import build_detector, build_extractor, build_matcher
from reid.models import ReIdModel

def main() -> None:
    # 1. Load config and handle CLI overrides (key=value)
    cfg = get_config()
    
    # 2. Set positional mode if provided
    if len(sys.argv) > 1 and "=" not in sys.argv[1]:
        cfg.mode = sys.argv[1]
    
    # 3. Convert digit source to int
    if isinstance(cfg.source, str) and cfg.source.isdigit():
        cfg.source = int(cfg.source)

    # 4. Handle DB operations that don't need full pipeline models
    if cfg.mode == "list":
        extractor = build_extractor(cfg)
        labels_summary = extractor.store.list_labels()
        print("\n=== Registered Cats Summary ===")
        if not labels_summary:
            print("No cats registered in the database.")
        else:
            for label, count in labels_summary.items():
                print(f" - {label}: {count} embedding(s)")
        print("===============================\n")
        return

    elif cfg.mode == "delete":
        # Extract label argument from CLI overrides
        label_to_delete = None
        for arg in sys.argv[2:]:
            if arg.startswith("label="):
                label_to_delete = arg.split("=", 1)[1]
                break
        if not label_to_delete:
            print("Error: Please specify the label to delete, e.g., 'reid delete label=Nabi'")
            return
            
        extractor = build_extractor(cfg)
        count = extractor.store.delete_label(label_to_delete)
        print(f"Deleted {count} embedding(s) for label: {label_to_delete}")
        return

    elif cfg.mode == "migrate":
        extractor = build_extractor(cfg)
        cursor = extractor.store.conn.cursor()
        cursor.execute("SELECT label, image_path FROM embeddings")
        rows = cursor.fetchall()
        if not rows:
            print("No records found in database to migrate.")
            return

        print(f"Found {len(rows)} records. Verifying original files on disk...")
        valid_files = []
        for label, img_path in rows:
            if img_path and os.path.exists(img_path):
                valid_files.append((img_path, label))
            else:
                print(f"Warning: Original file missing, skipping: {img_path}")

        if not valid_files:
            print("Error: No original images exist on disk. Migration aborted.")
            return

        print(f"Migrating {len(valid_files)} embeddings using active model: {cfg.model_name}")
        
        # Clear database and re-register
        extractor.store.clear()
        predictor = extractor._get_predictor()
        batch_size = getattr(cfg, "batch_size", 16)
        
        from reid.utils import calculate_md5
        from tqdm import tqdm
        
        for idx in tqdm(range(0, len(valid_files), batch_size)):
            chunk = valid_files[idx:idx + batch_size]
            chunk_paths = [item[0] for item in chunk]
            chunk_labels = [item[1] for item in chunk]
            chunk_hashes = [calculate_md5(p) for p in chunk_paths]
            
            try:
                embeddings = predictor.predict_batch(chunk_paths)
                extractor.store.add_batch(
                    embeddings=embeddings,
                    labels=chunk_labels,
                    image_paths=chunk_paths,
                    image_hashes=chunk_hashes,
                    model_name=cfg.model_name
                )
            except Exception as e:
                print(f"Failed migrating batch {chunk_paths}: {e}")
                
        print("Migration completed successfully.")
        return

    # 5. Build components for inference modes
    detector = build_detector(cfg)
    extractor = build_extractor(cfg)
    matcher = build_matcher(cfg)
    
    # 6. Assemble Pipeline
    pipeline = ReIdModel(detector, extractor, matcher, cfg=cfg)

    if cfg.mode == "predict":
        pipeline.predict(source=cfg.source)
        
    elif cfg.mode == "register":
        extractor.register(source=str(cfg.source), label=cfg.label)

    elif cfg.mode == "train":
        extractor.train()

    elif cfg.mode == "val":
        extractor.val(pipeline=pipeline)
    
    else:
        print(f"Unknown mode: {cfg.mode}")
        print("Available modes: predict, register, list, delete, migrate, train, val")

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/bin/pytest tests/test_database.py::test_cli_commands_integration -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add reid/cli.py tests/test_database.py
git commit -m "feat(cli): integrate list, delete, and migrate CLI commands"
```

---

### Verification and Sanity Run

- [ ] **Step 1: Run all tests to make sure everything passes**

Run: `./.venv/bin/pytest`
Expected: 100% PASS (including all existing and newly added database/batching tests)
