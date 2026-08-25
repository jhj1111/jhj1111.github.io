# Spec: SQLite-based Database Refactoring & Batch Registration

- **Date**: 2026-06-28
- **Author**: Antigravity (AI Coding Assistant)
- **Status**: Draft (Pending User Review)

---

## 1. Overview & Goals

The current Lumipet Re-ID system stores embeddings and labels in a single compressed NumPy `.npz` file. While simple, it has several limitations:
1. **Inefficient Feature Extraction**: The `register` process handles images sequentially one by one, failing to utilize batch inference (`predict_batch`), which causes significant latency in bulk registration.
2. **Missing Metadata**: Image file paths and MD5 hashes are not saved, which prevents deduplication, selective editing/deletions, and model-based feature migrations.
3. **No Concurrency Safety**: `.npz` files are read and rewritten entirely, leading to race conditions if accessed by concurrent web requests.
4. **Messy State Management**: Loaded features inside `EmbeddingStore` are in a mixed list-of-arrays state, making internal APIs brittle.

This design transitions the storage to a **SQLite database**, introduces **MD5-based deduplication**, implements **high-performance batch registration**, and adds **DB management utilities** (listing, deleting specific labels, and migrating features when model weights/backbones change).

---

## 2. Database Schema (SQLite)

We will use Python's built-in `sqlite3` engine. The database file will default to `embeddings/db.db` (and automatically map `*.npz` paths to `*.db` to preserve config backward compatibility).

### 2.1 Table: `embeddings`

```sql
CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,              -- Name of the individual cat
    embedding BLOB NOT NULL,          -- Serialized float32 NumPy array of shape (D,)
    image_path TEXT,                  -- Relative path of the registered original image
    image_hash TEXT UNIQUE,           -- MD5 hash of the original image to prevent duplication
    model_name TEXT NOT NULL,         -- Backbone/extraction model name used (e.g. 'hf-hub:BVRA/MegaDescriptor-L-384')
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_embeddings_label ON embeddings(label);
CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings(image_hash);
```

---

## 3. Component Interfaces

### 3.1 `EmbeddingStore` ([reid/models/extractor/embedding.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/extractor/embedding.py))

We will rewrite `EmbeddingStore` to match SQLite backend while preserving standard methods to ensure zero breakage of existing pipeline components.

```python
class EmbeddingStore:
    def __init__(self, db_path: str = "embeddings/db.db"):
        # Resolves db_path. Suffix is changed to '.db' if '.npz' is specified.
        ...
        
    def add(self, embedding: np.ndarray, label: str, image_path: Optional[str] = None, image_hash: Optional[str] = None, model_name: str = "") -> None:
        """Add a single embedding and label to SQLite."""
        ...
        
    def add_batch(self, embeddings: np.ndarray, labels: List[str], image_paths: List[str], image_hashes: List[str], model_name: str) -> None:
        """Insert multiple embeddings in a single transaction (high performance)."""
        ...
        
    def get_all(self, model_name: Optional[str] = None) -> Tuple[np.ndarray, List[str]]:
        """
        Return all embeddings and labels matching the current model_name.
        Raises warning or error if database contains embeddings from a different model.
        """
        ...
        
    def list_labels(self) -> Dict[str, int]:
        """Return unique labels and count of their registered embeddings."""
        ...
        
    def delete_label(self, label: str) -> int:
        """Delete all database rows matching the specified label. Returns number of rows deleted."""
        ...
        
    def clear(self) -> None:
        """Truncate the table."""
        ...
```

---

## 4. Pipeline Flows

### 4.1 Batch Registration Flow

The registration method in `ExtractorModel` will be refactored to perform batch inference and deduplication:

1. **Scan and Check**:
   - MD5 hashes of all images in the source directory are computed.
   - We query existing hashes in SQLite using `SELECT image_hash FROM embeddings` and filter out any images that are already registered.
2. **Batch Extraction**:
   - Remaining new images are chunked into batches of size `cfg.batch_size` (default 16).
   - For each batch, `predict_batch` is called to perform GPU/CPU inference in a single forward pass.
3. **Database Write**:
   - Extracted embeddings, labels, file paths, and hashes are committed in bulk using `add_batch()`.

---

## 5. CLI commands

We will introduce new commands in [reid/cli.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/cli.py):

* **`reid list`**: 
  Queries `EmbeddingStore` for registered individuals and outputs a clean count summary.
* **`reid delete label=<cat_name>`**: 
  Cleans out all rows related to `<cat_name>` from the SQLite database.
* **`reid migrate`**:
  Queries all registered image paths from the database. Re-runs batch extraction using the active model/weights, and updates database records with the new model name and new embeddings.

---

## 6. Testing & Verification

1. **Unit Tests**:
   - We will write new tests in `tests/test_database.py` verifying SQLite schema initialization, serialization/deserialization, transaction speed, deduplication constraints, listing, and label deletions.
2. **Integration Tests**:
   - Verify that `predict` pipeline initializes correctly with `get_all()` from the SQLite DB.
   - Run a mock `register` command and verify that batching works and database grows correctly.
