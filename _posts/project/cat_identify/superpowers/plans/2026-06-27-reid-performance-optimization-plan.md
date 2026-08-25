# Re-ID Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accelerate cat Re-ID inference via GPU batch feature extraction, FP16 precision, and fix memory leak, while profiling latency across all pipeline stages.

**Architecture:** We implement a `PipelineProfiler` context manager to capture and dump execution times to console summaries and source-specific CSV logs. We refactor the `ExtractorPredictor` to support batch inference and rewrite the `ReIdPredictor` inference loop as a two-pass queue-and-batch system. We also integrate proper LRU track registration into `ReIdPredictor` to prevent track cache memory leaks.

**Tech Stack:** PyTorch (FP16/AMP, batch tensor operators), OpenCV, NumPy, Python standard libraries.

---

### Task 1: Add Configuration Settings

**Files:**
- Modify: `config.yaml`
- Modify: `reid/core/config.py`
- Modify: `tests/test_tracking.py`

- [ ] **Step 1: Write the failing test**
  Modify [tests/test_tracking.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/tests/test_tracking.py) to assert the presence of `fp16` in Config:
  ```python
  # Add to test_config_properties in tests/test_tracking.py:
  assert hasattr(config, "fp16")
  assert config.fp16 is True
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `./.venv/bin/python -m pytest tests/test_tracking.py::test_config_properties -v`
  Expected: FAIL with AttributeError or AssertionError for `fp16`.

- [ ] **Step 3: Write minimal implementation**
  Add `fp16: True` to [config.yaml](file:///home/jhj/project_ws/lumipet_ws/re-id_test/config.yaml):
  ```yaml
  # Device & Run Settings
  dev: True
  fp16: True
  ```
  And update `reid/core/config.py` default attributes:
  ```python
  # In reid/core/config.py, inside Config class:
  self.fp16 = True
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `./.venv/bin/python -m pytest tests/test_tracking.py::test_config_properties -v`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add config.yaml reid/core/config.py tests/test_tracking.py
  git commit -m "feat(config): add fp16 configuration parameter"
  ```

---

### Task 2: Implement PipelineProfiler

**Files:**
- Create: `reid/utils/profiler.py`
- Create: `tests/test_optimization.py`

- [ ] **Step 1: Write the failing test**
  Create `tests/test_optimization.py` with a simple test verifying profiler creation and output:
  ```python
  import os
  import shutil
  import numpy as np
  from reid.utils.profiler import PipelineProfiler

  def test_profiler_timing_and_saving():
      profiler = PipelineProfiler(enabled=True)
      with profiler.profile("detection"):
          pass
      profiler.commit_frame()
      
      summary_str = profiler.get_summary_string()
      assert "detection" in summary_str
      
      output_dir = "results/test_source"
      if os.path.exists(output_dir):
          shutil.rmtree("results")
      
      profiler.save_csv("test_source", "test_run")
      csv_path = os.path.join(output_dir, "test_run.csv")
      assert os.path.exists(csv_path)
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `./.venv/bin/python -m pytest tests/test_optimization.py -v`
  Expected: FAIL (ModuleNotFoundError: No module named 'reid.utils.profiler')

- [ ] **Step 3: Write minimal implementation**
  Create [reid/utils/profiler.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/utils/profiler.py):
  ```python
  import os
  import time
  import numpy as np
  from contextlib import contextmanager

  class PipelineProfiler:
      def __init__(self, enabled: bool = True) -> None:
          self.enabled = enabled
          self.stages = ["detection", "quality_filter", "extractor", "matcher", "rendering"]
          self.current_frame = {stage: 0.0 for stage in self.stages}
          self.current_frame["total"] = 0.0
          self.history = []
          self.active_stage = None
          self.stage_start = 0.0

      @contextmanager
      def profile(self, stage: str):
          if not self.enabled or stage not in self.stages:
              yield
              return
          start = time.perf_counter()
          try:
              yield
          finally:
              elapsed = (time.perf_counter() - start) * 1000.0  # ms
              self.current_frame[stage] = elapsed

      def commit_frame(self, total_time_ms: float = 0.0) -> None:
          if not self.enabled:
              return
          if total_time_ms > 0.0:
              self.current_frame["total"] = total_time_ms
          else:
              self.current_frame["total"] = sum(self.current_frame[s] for s in self.stages)
          self.history.append(dict(self.current_frame))
          self.current_frame = {stage: 0.0 for stage in self.stages}
          self.current_frame["total"] = 0.0

      def get_summary_string(self) -> str:
          if not self.history:
              return "No profiling history recorded."
          
          summary = []
          summary.append("=" * 20 + " Re-ID Profiler Summary " + "=" * 20)
          summary.append(f"{'Stage':<18} | {'Avg Time (ms)':<13} | {'Std Dev (ms)':<12} | {'Ratio (%)':<9}")
          summary.append("-" * 64)
          
          totals = [frame["total"] for frame in self.history]
          mean_total = np.mean(totals)
          
          for stage in self.stages:
              times = [frame[stage] for frame in self.history]
              mean_val = np.mean(times)
              std_val = np.std(times)
              ratio = (mean_val / mean_total * 100.0) if mean_total > 0.0 else 0.0
              summary.append(f"{stage:<18} | {mean_val:<13.2f} | {std_val:<12.2f} | {ratio:<9.1f}%")
              
          summary.append("-" * 64)
          mean_fps = 1000.0 / mean_total if mean_total > 0.0 else 0.0
          summary.append(f"Total Frames: {len(self.history):<5} | Mean Frame Time: {mean_total:.2f} ms | Mean FPS: {mean_fps:.1f}")
          summary.append("=" * 64)
          return "\n".join(summary)

      def save_csv(self, source_name: str, timestamp: str) -> None:
          if not self.enabled or not self.history:
              return
          
          # Clean source name
          clean_source = source_name.replace(" ", "_").replace(".", "_").replace("/", "_").replace("\\", "_")
          out_dir = os.path.join("results", clean_source)
          os.makedirs(out_dir, exist_ok=True)
          
          csv_path = os.path.join(out_dir, f"{timestamp}.csv")
          headers = self.stages + ["total"]
          
          with open(csv_path, "w") as f:
              f.write(",".join(headers) + "\n")
              for frame in self.history:
                  row = [f"{frame[h]:.4f}" for h in headers]
                  f.write(",".join(row) + "\n")
          print(f"Profiling logs saved to: {csv_path}")
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `./.venv/bin/python -m pytest tests/test_optimization.py::test_profiler_timing_and_saving -v`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add reid/utils/profiler.py tests/test_optimization.py
  git commit -m "feat(profiler): add PipelineProfiler class and unit test"
  ```

---

### Task 3: Integrate Profiler into BasePredictor

**Files:**
- Modify: `reid/engine/predictor.py`

- [ ] **Step 1: Write the failing test**
  Add a test to verify `predictor.profiler` exists after calling prediction:
  ```python
  # Add to tests/test_optimization.py
  def test_base_predictor_profiler_integration():
      from reid.models.yolo.detect.predict import YoloPredictor
      from reid.core.config import Config
      import numpy as np
      
      cfg = Config()
      cfg.show = False
      cfg.save = False
      predictor = YoloPredictor(cfg)
      
      assert hasattr(predictor, "profiler")
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `./.venv/bin/python -m pytest tests/test_optimization.py::test_base_predictor_profiler_integration -v`
  Expected: FAIL with AssertionError for `predictor.profiler`.

- [ ] **Step 3: Write minimal implementation**
  Update [reid/engine/predictor.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/engine/predictor.py):
  1. Add imports and initialize `self.profiler` in `__init__`:
     ```python
     # reid/engine/predictor.py (around line 7)
     from reid.utils.profiler import PipelineProfiler
     ```
     Inside `__init__` (around line 24):
     ```python
     self.profiler = PipelineProfiler(enabled=getattr(self.cfg, "dev", True))
     ```
  2. Implement source parsing and profiler save trigger inside `predict` method:
     ```python
     # Inside predict() method of BasePredictor
     # Around the end of the predict method, in a finally block of the stream loader:
     # Wait, let's wrap the loader loop inside a try-finally block in predict():
     ```
     Let's rewrite the prediction stream loop in `predict()` to wrap everything in `try: ... finally: ...` and trigger saving:
     ```python
     # Inside predict():
     # Define source_name and timestamp at start
     source_str = str(source)
     if isinstance(source, int):
         source_name = f"webcam_{source}"
     else:
         source_name = os.path.splitext(os.path.basename(source_str))[0]
     timestamp = time.strftime("%Y%m%d_%H%M%S")
     
     # At the end of the predict method:
     finally:
         if self.video_writer:
             self.video_writer.release()
         if self.cfg.show:
             cv2.destroyAllWindows()
         
         # Print and save profiler stats
         if self.profiler.enabled:
             print(self.profiler.get_summary_string())
             self.profiler.save_csv(source_name, timestamp)
     ```
     Also, in the frame loop, measure the total frame time and call `self.profiler.commit_frame(total_time_ms)`:
     ```python
     # Inside the StreamLoader frame loop:
     for path, frame in self.loader:
         start_time = time.perf_counter()
         res = self.predict_once(frame)
         # ... 
         total_time_ms = (time.perf_counter() - start_time) * 1000.0
         self.profiler.commit_frame(total_time_ms)
     ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `./.venv/bin/python -m pytest tests/test_optimization.py::test_base_predictor_profiler_integration -v`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add reid/engine/predictor.py
  git commit -m "feat(predictor): integrate profiler into BasePredictor loop"
  ```

---

### Task 4: Add Batch Features to Extractor

**Files:**
- Modify: `reid/models/extractor/predict.py`
- Modify: `reid/models/extractor/model.py`

- [ ] **Step 1: Write the failing test**
  Add a test to verify extractor `predict_batch`:
  ```python
  # Add to tests/test_optimization.py
  def test_extractor_predict_batch():
      from reid.models.extractor.model import ExtractorModel
      import numpy as np
      
      model = ExtractorModel()
      predictor = model._get_predictor()
      
      # Try processing 2 crops in a batch
      crops = [np.zeros((100, 100, 3), dtype=np.uint8), np.zeros((100, 100, 3), dtype=np.uint8)]
      embs = predictor.predict_batch(crops)
      
      assert embs.ndim == 2
      assert embs.shape[0] == 2
      assert embs.shape[1] == model.predictor.extractor_dim
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `./.venv/bin/python -m pytest tests/test_optimization.py::test_extractor_predict_batch -v`
  Expected: FAIL with AttributeError for `predict_batch`.

- [ ] **Step 3: Write minimal implementation**
  1. Modify [reid/models/extractor/predict.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/extractor/predict.py):
     ```python
     # Inside ExtractorPredictor
     def preprocess_batch(self, im_list: list) -> torch.Tensor:
         tensors = []
         for im in im_list:
             if isinstance(im, np.ndarray):
                 im = Image.fromarray(im)
             tensors.append(self.transform(im))
         batch_tensor = torch.stack(tensors).to(self.device)
         if getattr(self.cfg, "fp16", False) and "cuda" in str(self.device):
             batch_tensor = batch_tensor.half()
         return batch_tensor

     def postprocess_batch(self, preds: torch.Tensor) -> np.ndarray:
         return preds.cpu().numpy()

     def predict_batch(self, im_list: list) -> np.ndarray:
         if not im_list:
             return np.empty((0, self.model.output_dim), dtype=np.float32)
         im_prepped = self.preprocess_batch(im_list)
         preds = self.inference(im_prepped)
         return self.postprocess_batch(preds)
     ```
  2. Modify [reid/models/extractor/model.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/extractor/model.py):
     ```python
     # Inside ExtractorModel._load_model() in sub-classes (e.g. mega_descriptor or wildlife)
     # Convert model to half if fp16 is enabled
     # Let's inspect model.py or subclasses to see where models are loaded.
     ```
     Wait, where are the subclasses of `ExtractorModel`? Let's check `reid/models/extractor/mega_descriptor/model.py`.
     Let's define a general `.half()` conversion in `_get_predictor()` inside `ExtractorModel`:
     ```python
     # In reid/models/extractor/model.py, update _get_predictor:
     def _get_predictor(self) -> ExtractorPredictor:
         predictor = ExtractorPredictor(self.cfg)
         if getattr(self.cfg, "fp16", False) and "cuda" in str(self.cfg.device):
             if hasattr(self.model, "half"):
                 self.model.half()
         predictor.setup_model(self.model)
         return predictor
     ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `./.venv/bin/python -m pytest tests/test_optimization.py::test_extractor_predict_batch -v`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add reid/models/extractor/predict.py reid/models/extractor/model.py
  git commit -m "feat(extractor): add batch inference and fp16 weights support"
  ```

---

### Task 5: Refactor ReIdPredictor for Batching, Profiling, and LRU Cache

**Files:**
- Modify: `reid/models/reid/predict.py`

- [ ] **Step 1: Write the failing test**
  Add a test to verify ReIdPredictor caching, matching, and LRU eviction interaction:
  ```python
  # Add to tests/test_optimization.py
  def test_reid_predictor_eviction_integration():
      from reid.models.reid.predict import ReIdPredictor
      from reid.core.config import Config
      from reid.core.types import BBox, Results
      from unittest.mock import MagicMock
      
      detector = MagicMock()
      extractor = MagicMock()
      matcher = MagicMock()
      
      extractor.store.get_all.return_value = (np.array([]), [])
      extractor.cfg.imgsz = 384
      extractor.predict.return_value = np.ones(512)
      
      cfg = Config()
      cfg.track = True
      cfg.dev = True
      
      predictor = ReIdPredictor(detector, extractor, matcher, cfg)
      # Trigger track creations
      for i in range(1005):
          box = BBox(x1=0, y1=0, x2=50, y2=50, track_id=i)
          results = Results(orig_img=np.zeros((100, 100, 3), dtype=np.uint8), path="", boxes=[box])
          detector.predict.return_value = results
          predictor.inference(np.zeros((100, 100, 3), dtype=np.uint8))
          
      # Enforced LRU eviction should cap track manager size
      assert len(predictor.track_state_manager.tracks) <= 1000
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `./.venv/bin/python -m pytest tests/test_optimization.py::test_reid_predictor_eviction_integration -v`
  Expected: FAIL because track manager size exceeds 1000 (since it currently bypasses manager limits).

- [ ] **Step 3: Write minimal implementation**
  Rewrite `inference` in [reid/models/reid/predict.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/reid/predict.py):
  ```python
      def inference(self, im: Any) -> Results:
          """Detect bounding boxes, crop and filter by quality, then apply state-machine Re-ID in batch."""
          # Setup timing pointers
          profiler = self.profiler if hasattr(self, "profiler") else None
          
          if profiler:
              profiler.active_stage = "detection"
              start_det = time.perf_counter()
              
          results = self.detector_predictor(im)
          
          if profiler:
              profiler.current_frame["detection"] = (time.perf_counter() - start_det) * 1000.0
              
          img_pixels = results.orig_img
          all_embeddings = []
          
          # Initialize placeholders
          results.match_results = [None] * len(results.boxes)
          all_embeddings = [None] * len(results.boxes)
          
          # Pass 1: Collect crops needing extraction
          needs_extraction = []  # List of dict: {"box_idx": idx, "track_id": track_id, "crop": crop, "state_obj": state_obj}
          
          for idx, box in enumerate(results.boxes):
              track_id = box.track_id
              crop = box.crop(img_pixels)
              
              # 1. Quality Filter check
              if profiler:
                  start_filt = time.perf_counter()
              is_valid = self.quality_filter.is_valid(crop)
              if profiler:
                  profiler.current_frame["quality_filter"] += (time.perf_counter() - start_filt) * 1000.0
                  
              if not is_valid:
                  cached = self.track_state_manager.tracks.get(track_id) if track_id is not None else None
                  if cached is not None and cached.match_result is not None:
                      results.match_results[idx] = cached.match_result
                      all_embeddings[idx] = cached.get_mean_embedding()
                  else:
                      results.match_results[idx] = MatchResult(cat_id="Unknown", similarity=0.0, is_known=False)
                      all_embeddings[idx] = np.zeros(self.extractor_dim, dtype=np.float32)
                  continue
              
              # 2. State Machine scheduling check
              run_matching = True
              state_obj = None
              if track_id is not None:
                  if track_id not in self.track_state_manager.tracks:
                      # Safe registration to trigger LRU eviction inside update_track
                      self.track_state_manager.update_track(
                          track_id, 
                          np.zeros(self.extractor_dim, dtype=np.float32), 
                          MatchResult(cat_id="Unknown", similarity=0.0)
                      )
                  state_obj = self.track_state_manager.tracks[track_id]
                  run_matching = state_obj.should_match(self.candidate_interval, self.lock_interval, self.unknown_interval)
              
              if not run_matching and state_obj is not None and state_obj.match_result is not None:
                  # Cache hit: Retrieve mean embedding and reuse match result
                  self.track_state_manager.get_match(track_id)
                  results.match_results[idx] = state_obj.match_result
                  all_embeddings[idx] = state_obj.get_mean_embedding()
                  state_obj.frame_count += 1
                  continue
                  
              # Cache miss or forced re-matching frame: queue for extraction
              needs_extraction.append({
                  "box_idx": idx,
                  "track_id": track_id,
                  "crop": crop,
                  "state_obj": state_obj
              })
              
          # Pass 2: Batch extract and match
          if needs_extraction:
              crops = [item["crop"] for item in needs_extraction]
              
              if profiler:
                  start_ext = time.perf_counter()
              # Extract embeddings in a single batch forward pass
              embeddings = self.extractor_predictor.predict_batch(crops)
              if profiler:
                  profiler.current_frame["extractor"] = (time.perf_counter() - start_ext) * 1000.0
                  
              for i, item in enumerate(needs_extraction):
                  idx = item["box_idx"]
                  track_id = item["track_id"]
                  state_obj = item["state_obj"]
                  embedding = embeddings[i]
                  
                  # Aggregate mean embedding for matching query
                  historical_embs = [obs["embedding"] for obs in state_obj.observations] if state_obj else []
                  all_embs = historical_embs + [embedding]
                  mean_emb = np.mean(all_embs, axis=0)
                  norm = np.linalg.norm(mean_emb)
                  if norm > 1e-6:
                      mean_emb = mean_emb / norm
                      
                  if profiler:
                      start_match = time.perf_counter()
                  # Match vector against DB
                  match_res = self.matcher.match(mean_emb)
                  if profiler:
                      profiler.current_frame["matcher"] += (time.perf_counter() - start_match) * 1000.0
                      
                  # Handle state transitions
                  if state_obj is not None:
                      state_obj.update_state(match_res.similarity, self.th_candidate, self.th_lock, self.th_hysteresis)
                      state_obj.add_observation(embedding, match_res, is_match_run=True)
                      
                  results.match_results[idx] = match_res
                  all_embeddings[idx] = mean_emb
                  
          if all_embeddings:
              results.embeddings = np.vstack(all_embeddings)
              
          return results
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `./.venv/bin/python -m pytest tests/test_optimization.py -v`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add reid/models/reid/predict.py
  git commit -m "refactor(reid): optimize pipeline with two-pass batching, safe LRU cache, and profiler"
  ```

---

### Task 6: Final Verification & Cleanup

**Files:**
- Modify: `tests/test_optimization.py`

- [ ] **Step 1: Write the failing test**
  Add a comprehensive integration verification test in `tests/test_optimization.py`:
  ```python
  # Add to tests/test_optimization.py
  def test_full_reid_pipeline_batch_run():
      from reid.models.reid.predict import ReIdPredictor
      from reid.core.config import Config
      from reid.core.types import BBox, Results, MatchResult
      from unittest.mock import MagicMock
      
      detector = MagicMock()
      extractor = MagicMock()
      matcher = MagicMock()
      
      extractor.store.get_all.return_value = (np.array([]), [])
      extractor.cfg.imgsz = 384
      extractor.predict.return_value = np.ones(512)
      extractor.predict_batch = MagicMock(return_value=np.ones((2, 512)))
      matcher.match.return_value = MatchResult(cat_id="Cheesecake", similarity=0.90)
      
      cfg = Config()
      cfg.track = True
      cfg.dev = True
      cfg.fp16 = True
      
      predictor = ReIdPredictor(detector, extractor, matcher, cfg)
      
      # 2 boxes requiring feature extraction
      box1 = BBox(x1=0, y1=0, x2=50, y2=50, track_id=1)
      box2 = BBox(x1=10, y1=10, x2=60, y2=60, track_id=2)
      results = Results(orig_img=np.zeros((100, 100, 3), dtype=np.uint8), path="", boxes=[box1, box2])
      detector.predict.return_value = results
      
      res = predictor.inference(np.zeros((100, 100, 3), dtype=np.uint8))
      
      # Extractor predict_batch should be called exactly once
      extractor.predict_batch.assert_called_once()
      assert len(res.match_results) == 2
      assert res.match_results[0].cat_id == "Cheesecake"
      assert res.match_results[1].cat_id == "Cheesecake"
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `./.venv/bin/python -m pytest tests/test_optimization.py::test_full_reid_pipeline_batch_run -v`
  Expected: FAIL if anything is wrong in integration.

- [ ] **Step 3: Write minimal implementation**
  Confirm the entire codebase and test suite pass with:
  Run: `./.venv/bin/python -m pytest -v`

- [ ] **Step 4: Run test to verify it passes**
  Run: `./.venv/bin/python -m pytest -v`
  Expected: All tests pass.

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add tests/test_optimization.py
  git commit -m "test(opt): add comprehensive integration test for batched pipeline"
  ```
