# FAISS CPU Scaling, YOLO FP16/ONNX, and Results.plot() Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement CPU-based multi-index scaling (`IndexFlatIP`, `IndexIVFFlat`, `IndexHNSWFlat`) in `FaissMatcher`, enable FP16/ONNX inference in `YoloPredictor`, and fully implement `Results.plot()` for OpenCV BGR visualization.

**Architecture:** Extend `FaissMatcher` with CPU index selection logic and automatic vector count fallbacks. Add `yolo_fp16` and ONNX model loading in `YoloPredictor`. Complete `Results.plot()` in `reid/core/types.py` with standalone OpenCV bounding box and label text rendering.

**Tech Stack:** Python 3.10+, FAISS (CPU), PyTorch, OpenCV, Ultralytics YOLOv8, Pytest.

*(Note per user request: Git commits will be held and executed step-by-step after all implementation tasks and verification are complete).*

---

### File Structure & Responsibilities

- Modify: `reid/cfg/default.yaml` - Add default configuration parameters for FAISS matcher index types and detector FP16 options.
- Modify: `reid/core/config.py` - Add dataclass field definitions for `matcher_index_type`, `faiss_nlist`, `faiss_nprobe`, `faiss_hnsw_m`, `faiss_min_ivf_vectors`, and `yolo_fp16`.
- Modify: `reid/models/matcher/faiss.py` - Implement multi-index CPU FAISS matching with automatic fallback logic.
- Modify: `reid/models/yolo/detect/predict.py` - Add FP16 (`half=True`) handling and optional ONNX model initialization.
- Modify: `reid/core/types.py` - Implement `Results.plot()` for visual annotation and return `np.ndarray`.
- Create: `tests/test_faiss_matcher.py` - Unit tests for FAISS index selection, fallbacks, and matching precision.
- Create: `tests/test_results_plot.py` - Unit tests for `Results.plot()` image annotation generation.

---

### Task 1: Add Configuration Options

**Files:**
- Modify: `reid/cfg/default.yaml`
- Modify: `reid/core/config.py`
- Test: `tests/test_config.py`

- [ ] **Step 1: Write the test for new config fields**

```python
import pytest
from reid.core.config import ReidConfig

def test_new_config_defaults():
    cfg = ReidConfig()
    assert cfg.matcher_index_type == "flat"
    assert cfg.faiss_nlist == 32
    assert cfg.faiss_nprobe == 4
    assert cfg.faiss_hnsw_m == 32
    assert cfg.faiss_min_ivf_vectors == 100
    assert cfg.yolo_fp16 is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: pytest `tests/test_config.py`
Expected: FAIL with `AttributeError: 'ReidConfig' object has no attribute 'matcher_index_type'`

- [ ] **Step 3: Implement config updates**

In `reid/cfg/default.yaml`:
```yaml
# Matcher Index Parameters
matcher_index_type: "flat"  # Options: "flat", "ivfflat", "hnsw"
faiss_nlist: 32
faiss_nprobe: 4
faiss_hnsw_m: 32
faiss_min_ivf_vectors: 100

# Detector FP16
yolo_fp16: False
```

In `reid/core/config.py`:
Add fields to `ReidConfig`:
```python
    matcher_index_type: str = "flat"
    faiss_nlist: int = 32
    faiss_nprobe: int = 4
    faiss_hnsw_m: int = 32
    faiss_min_ivf_vectors: int = 100
    yolo_fp16: bool = False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_config.py`
Expected: PASS

---

### Task 2: Implement CPU Multi-Index FAISS Matcher

**Files:**
- Modify: `reid/models/matcher/faiss.py`
- Create: `tests/test_faiss_matcher.py`

- [ ] **Step 1: Write unit tests for FAISS CPU multi-index strategy**

Write `tests/test_faiss_matcher.py`:
```python
import pytest
import numpy as np
from reid.models.matcher.faiss import FaissMatcher
from reid.core.config import ReidConfig

def test_faiss_matcher_flat():
    matcher = FaissMatcher(threshold=0.5)
    embeddings = np.random.randn(20, 128).astype(np.float32)
    embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)
    labels = [f"cat_{i%5}" for i in range(20)]
    
    matcher.fit(embeddings, labels)
    res = matcher.match(embeddings[0])
    assert res.is_known is True
    assert res.cat_id == "cat_0"

def test_faiss_matcher_ivfflat():
    cfg = ReidConfig(matcher_index_type="ivfflat", faiss_min_ivf_vectors=10, faiss_nlist=4)
    matcher = FaissMatcher(threshold=0.5)
    matcher.cfg = cfg
    
    embeddings = np.random.randn(50, 128).astype(np.float32)
    embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)
    labels = [f"cat_{i%5}" for i in range(50)]
    
    matcher.fit(embeddings, labels)
    res = matcher.match(embeddings[0])
    assert res.is_known is True
    assert res.cat_id == "cat_0"

def test_faiss_matcher_hnsw():
    cfg = ReidConfig(matcher_index_type="hnsw", faiss_hnsw_m=16)
    matcher = FaissMatcher(threshold=0.5)
    matcher.cfg = cfg
    
    embeddings = np.random.randn(30, 128).astype(np.float32)
    embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)
    labels = [f"cat_{i%5}" for i in range(30)]
    
    matcher.fit(embeddings, labels)
    res = matcher.match(embeddings[0])
    assert res.is_known is True
    assert res.cat_id == "cat_0"

def test_faiss_matcher_ivf_fallback():
    # If vectors count < faiss_min_ivf_vectors, should fallback to FlatIP
    cfg = ReidConfig(matcher_index_type="ivfflat", faiss_min_ivf_vectors=100)
    matcher = FaissMatcher(threshold=0.5)
    matcher.cfg = cfg
    
    embeddings = np.random.randn(20, 128).astype(np.float32)
    embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)
    labels = [f"cat_{i%5}" for i in range(20)]
    
    matcher.fit(embeddings, labels)
    assert matcher.actual_index_type == "flat"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_faiss_matcher.py`
Expected: FAIL due to missing attributes or unhandled `matcher_index_type`

- [ ] **Step 3: Implement multi-index FAISS logic in `reid/models/matcher/faiss.py`**

Replace `reid/models/matcher/faiss.py` with:
```python
import numpy as np
import faiss
from typing import List, Optional
from reid.models.matcher.model import BaseMatcher
from reid.core.types import MatchResult

class FaissMatcher(BaseMatcher):
    """
    High-performance CPU Matcher using FAISS supporting FlatIP, IVFFlat, and HNSWFlat.
    """
    def __init__(self, threshold: float = 0.7):
        super().__init__(threshold)
        self.index = None
        self.is_fitted = False
        self.actual_index_type = "flat"

    def fit(self, embeddings: np.ndarray, labels: List[str]):
        if len(embeddings) == 0:
            self.is_fitted = False
            return

        d = embeddings.shape[1]
        embeddings_f32 = np.ascontiguousarray(embeddings.astype('float32'))
        
        index_type = getattr(self.cfg, "matcher_index_type", "flat").lower()
        min_ivf_vecs = getattr(self.cfg, "faiss_min_ivf_vectors", 100)
        num_vecs = len(embeddings_f32)
        
        # Decide actual index type with safety fallbacks
        if index_type == "ivfflat" and num_vecs < min_ivf_vecs:
            actual_type = "flat"
        else:
            actual_type = index_type
        self.actual_index_type = actual_type

        if actual_type == "ivfflat":
            nlist = getattr(self.cfg, "faiss_nlist", 32)
            nlist = min(nlist, max(1, num_vecs // 4))
            quantizer = faiss.IndexFlatIP(d)
            self.index = faiss.IndexIVFFlat(quantizer, d, nlist, faiss.METRIC_INNER_PRODUCT)
            self.index.train(embeddings_f32)
            self.index.add(embeddings_f32)
            nprobe = getattr(self.cfg, "faiss_nprobe", 4)
            self.index.nprobe = min(nprobe, nlist)

        elif actual_type == "hnsw":
            hnsw_m = getattr(self.cfg, "faiss_hnsw_m", 32)
            self.index = faiss.IndexHNSWFlat(d, hnsw_m, faiss.METRIC_INNER_PRODUCT)
            self.index.add(embeddings_f32)

        else:  # "flat" fallback
            self.index = faiss.IndexFlatIP(d)
            self.index.add(embeddings_f32)

        self.labels = labels
        self.is_fitted = True

    def match(self, query_embedding: np.ndarray) -> MatchResult:
        if not self.is_fitted or self.index is None:
            return MatchResult(cat_id="Unknown", similarity=0.0, is_known=False)

        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)

        query_f32 = np.ascontiguousarray(query_embedding.astype('float32'))

        K = int(getattr(self.cfg, "k", 5))
        K = min(K, len(self.labels))
        if K <= 0:
            K = 1

        similarities, indices = self.index.search(query_f32, K)

        votes = {}
        for i in range(K):
            idx = indices[0][i]
            if idx < 0 or idx >= len(self.labels):
                continue
            sim = float(similarities[0][i])
            label: str = self.labels[idx]

            if label not in votes:
                votes[label] = {"count": 0, "sum_sim": 0.0}
            votes[label]["count"] += 1
            votes[label]["sum_sim"] += sim

        if not votes:
            return MatchResult(cat_id="Unknown", similarity=0.0, is_known=False)

        best_label = "Unknown"
        best_score = -1.0
        best_avg_sim = 0.0

        for label, info in votes.items():
            avg_sim = info["sum_sim"] / info["count"]
            score = info["sum_sim"]
            if score > best_score:
                best_score = score
                best_label = label
                best_avg_sim = avg_sim

        is_known = best_avg_sim >= self.threshold
        cat_id = best_label if is_known else "Unknown"

        return MatchResult(cat_id=cat_id, similarity=float(best_avg_sim), is_known=is_known)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_faiss_matcher.py`
Expected: PASS

---

### Task 3: Add FP16 & ONNX Detector Integration

**Files:**
- Modify: `reid/models/yolo/detect/predict.py`
- Test: `tests/test_yolo_predict.py`

- [ ] **Step 1: Write test for YOLO FP16 / ONNX config handling**

Write `tests/test_yolo_predict.py`:
```python
import pytest
from reid.core.config import ReidConfig
from reid.models.yolo.detect.predict import YoloPredictor

def test_yolo_predictor_config_init():
    cfg = ReidConfig(yolo_fp16=True, use_onnx=False)
    predictor = YoloPredictor(config=cfg)
    assert getattr(predictor.cfg, "yolo_fp16", False) is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_yolo_predict.py`
Expected: FAIL if `YoloPredictor` does not accept `config` properly or crashes

- [ ] **Step 3: Update `YoloPredictor` in `reid/models/yolo/detect/predict.py`**

In `reid/models/yolo/detect/predict.py`:
```python
from typing import Any, List, Optional
import torch
from reid.engine.predictor import BasePredictor
from reid.core.types import Results, BBox
from reid.utils import get_cfg_path

class YoloPredictor(BasePredictor):
    """
    YOLOv8 Predictor following the BasePredictor interface with FP16 and ONNX support.
    """
    def preprocess(self, im: Any) -> Any:
        return im

    def inference(self, im: Any) -> Any:
        device = getattr(self, "device", "cpu")
        use_fp16 = getattr(self.cfg, "yolo_fp16", False) or getattr(self.cfg, "fp16", False)
        half = use_fp16 and ("cuda" in str(device))

        if self.cfg.track:
            tracker = get_cfg_path(self.cfg.tracker)
            self.cfg.tracker = str(tracker) if tracker else "bytetrack.yaml"
            return self.model.track(
                im,
                conf=self.cfg.conf,
                iou=self.cfg.iou,
                persist=True,
                tracker=self.cfg.tracker,
                device=device,
                half=half,
                verbose=False
            )
        else:
            return self.model(im, conf=self.cfg.conf, iou=self.cfg.iou, device=device, half=half, verbose=False)

    def postprocess(self, preds: Any, img: Any, orig_img: Any, target_id: Optional[List[int]] = [15]) -> Optional[Results]:
        ultra_res = preds[0]
        results = Results(orig_img=ultra_res.orig_img, path=ultra_res.path)

        cpu_boxes = ultra_res.boxes.cpu() if hasattr(ultra_res.boxes, 'cpu') else ultra_res.boxes

        for box in cpu_boxes:
            if box.cls not in target_id:
                continue
            b = box.xyxy[0].numpy() if hasattr(box.xyxy[0], 'numpy') else box.xyxy[0]
            track_id = int(box.id[0].item()) if box.id is not None else None
            bbox = BBox(
                x1=float(b[0]), y1=float(b[1]),
                x2=float(b[2]), y2=float(b[3]),
                conf=float(box.conf[0]),
                cls=int(box.cls[0]),
                track_id=track_id
            )
            results.boxes.append(bbox)

        return results
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_yolo_predict.py`
Expected: PASS

---

### Task 4: Complete `Results.plot()` Visualization Method

**Files:**
- Modify: `reid/core/types.py`
- Create: `tests/test_results_plot.py`

- [ ] **Step 1: Write test for `Results.plot()`**

Write `tests/test_results_plot.py`:
```python
import pytest
import numpy as np
from reid.core.types import Results, BBox, MatchResult

def test_results_plot():
    dummy_img = np.zeros((480, 640, 3), dtype=np.uint8)
    res = Results(orig_img=dummy_img, path="test.jpg")
    res.boxes.append(BBox(x1=50, y1=50, x2=200, y2=200, conf=0.9, cls=15, track_id=1))
    res.match_results.append(MatchResult(cat_id="Nabi", similarity=0.88, is_known=True))
    
    annotated = res.plot(show_conf=True, show_similarity=True)
    assert isinstance(annotated, np.ndarray)
    assert annotated.shape == (480, 640, 3)
    assert not np.array_equal(annotated, dummy_img)  # Verified drawn elements exist

def test_results_plot_no_orig_img():
    res = Results(orig_img=None, path="test.jpg")
    with pytest.raises(ValueError, match="Results object has no orig_img to plot"):
        res.plot()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_results_plot.py`
Expected: FAIL because `Results.plot()` currently has `pass` and returns `None`

- [ ] **Step 3: Implement `Results.plot()` in `reid/core/types.py`**

In `reid/core/types.py`:
Add imports for OpenCV and color hashing:
```python
import cv2
import zlib
from typing import List, Optional, Union, Tuple
```

Implement `Results.plot()`:
```python
    def plot(
        self,
        show_conf: bool = True,
        show_similarity: bool = True,
        line_thickness: Optional[int] = None,
        font_scale: Optional[float] = None
    ) -> np.ndarray:
        """
        Draw bounding boxes, cat IDs, similarity scores, and confidence on orig_img.
        Returns annotated OpenCV BGR numpy image array.
        """
        if self.orig_img is None:
            raise ValueError("Results object has no orig_img to plot.")

        img = self.orig_img.copy()
        h, w = img.shape[:2]

        # Dynamic sizing
        thickness = line_thickness or max(1, int(round(min(h, w) * 0.003)))
        f_scale = font_scale or max(0.4, min(h, w) * 0.0007)

        for idx, box in enumerate(self.boxes):
            match_res = self.match_results[idx] if idx < len(self.match_results) else None
            cat_id = match_res.cat_id if match_res else "Unknown"
            is_known = match_res.is_known if match_res else False

            # Assign color based on Cat ID hash (or gray for unknown)
            if is_known and cat_id != "Unknown":
                color_hash = zlib.adler32(cat_id.encode("utf-8"))
                color = (
                    int((color_hash & 0xFF0000) >> 16),
                    int((color_hash & 0x00FF00) >> 8),
                    int(color_hash & 0x0000FF)
                )
            else:
                color = (128, 128, 128)  # Gray for Unknown

            x1, y1, x2, y2 = int(box.x1), int(box.y1), int(box.x2), int(box.y2)

            # Draw bounding box
            cv2.rectangle(img, (x1, y1), (x2, y2), color, thickness)

            # Construct text label
            label_parts = [cat_id]
            if match_res and show_similarity and match_res.similarity > 0:
                label_parts.append(f"Sim:{match_res.similarity:.2f}")
            if show_conf and box.conf is not None:
                label_parts.append(f"Conf:{box.conf:.2f}")

            label_text = " | ".join(label_parts)

            # Text background rectangle
            (text_w, text_h), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, f_scale, 1)
            text_y1 = max(0, y1 - text_h - baseline - 4)
            text_y2 = y1 if y1 - text_h - baseline - 4 >= 0 else y1 + text_h + baseline + 4

            cv2.rectangle(img, (x1, text_y1), (x1 + text_w + 6, text_y2), color, -1)
            cv2.putText(
                img,
                label_text,
                (x1 + 3, text_y2 - baseline - 2),
                cv2.FONT_HERSHEY_SIMPLEX,
                f_scale,
                (255, 255, 255),
                1,
                cv2.LINE_AA
            )

        return img
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_results_plot.py`
Expected: PASS

---

### Task 5: Integration Verification

- [ ] **Step 1: Run all unit tests**

Run: `pytest tests/ -v`
Expected: ALL PASS

- [ ] **Step 2: Verify CLI sanity execution**

Run: `python3 -m reid.cli list`
Expected: Output summary without error.
