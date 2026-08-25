# Re-ID by_track Caching & Matching Optimization Plan (Modularized)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a dynamic Re-ID state machine (Unknown/Candidate/Locked) with quality-based filters (blur/size), similarity-based smart cache eviction, and normalized mean embedding matching. Modularize components to follow SOLID principles. Configure detector parameter control through a local `bytetrack.yaml`.

**Architecture:**
- **ImageQualityFilter (`reid/core/filters.py`)**: Dedicated filter class performing resolution and blur checks, making it easily pluggable and toggleable.
- **TrackState State Machine (`reid/core/tracker.py`)**: Individual tracks self-determine whether they should trigger re-matching and handle their own state transitions based on matched similarity.
- **Smart Eviction (`reid/core/tracker.py`)**: Caches observations and preserves the most recent 3 frames unconditionally, while evicting the lowest-similarity frame among the remaining 7 historical slots.
- **Normalized Mean Matching (`reid/core/tracker.py`)**: Computes the L2-normalized average vector of cached embeddings for matching queries.

**Tech Stack:** Python, NumPy, OpenCV, Ultralytics YOLO, PyTest

---

### Task 1: Update Configuration
**Files:**
- Modify: `config.yaml`
- Modify: `reid/core/config.py`
- Modify: `tests/test_tracking.py`

- [ ] **Step 1: Write config loader tests for new attributes**
  In `tests/test_tracking.py`, add assertions to `test_config_properties()` to verify the defaults for candidate/lock thresholds, intervals, and filter limits.
  ```python
  # Modify tests/test_tracking.py around line 9-18
  def test_config_properties():
      config = Config()
      assert hasattr(config, "dev")
      assert hasattr(config, "track")
      assert hasattr(config, "tracker")
      assert config.dev is True
      assert config.track is True
      assert config.tracker == "bytetrack.yaml"
      
      # Assert Re-ID specific thresholds and intervals
      assert config.threshold_candidate == 0.70
      assert config.threshold_lock == 0.85
      assert config.threshold_hysteresis == 0.55
      assert config.candidate_interval == 10
      assert config.lock_interval == 60
      
      # Assert quality filters
      assert config.min_bbox_width == 32
      assert config.min_bbox_height == 32
      assert config.blur_threshold == 10.0
  ```

- [ ] **Step 2: Add attributes to `reid/core/config.py`**
  Modify [Config](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/core/config.py#L8) to define the new variables.
  ```python
  # In reid/core/config.py, add under # Re-ID Settings:
      # Re-ID Settings
      matcher_type: str = "faiss"  # "faiss" or "knn"
      threshold: float = 0.7
      k: int = 2
      
      # Tracking & Hysteresis Settings
      threshold_candidate: float = 0.70
      threshold_lock: float = 0.85
      threshold_hysteresis: float = 0.55
      candidate_interval: int = 10
      lock_interval: int = 60
      
      # Image Quality Filters
      min_bbox_width: int = 32
      min_bbox_height: int = 32
      blur_threshold: float = 10.0
  ```

- [ ] **Step 3: Update `config.yaml`**
  Add configuration keys to `config.yaml`.
  ```yaml
  # In config.yaml, append under threshold: 0.7 and k: 2:
  threshold_candidate: 0.70
  threshold_lock: 0.85
  threshold_hysteresis: 0.55
  candidate_interval: 10
  lock_interval: 60
  min_bbox_width: 32
  min_bbox_height: 32
  blur_threshold: 10.0
  ```

- [ ] **Step 4: Run tests to verify config loads successfully**
  Run: `pytest tests/test_tracking.py::test_config_properties -v`
  Expected: PASS

---

### Task 2: Create Local `bytetrack.yaml`
**Files:**
- Create: `bytetrack.yaml`

- [ ] **Step 1: Write tracking config**
  Create `bytetrack.yaml` at the root directory of the workspace.
  ```yaml
  tracker_type: bytetrack
  track_high_thresh: 0.5
  track_low_thresh: 0.1
  new_track_thresh: 0.6
  track_buffer: 30
  match_thresh: 0.8
  fuse_score: True
  ```

---

### Task 3: Fix Existing YOLO Tracking Unit Test
**Files:**
- Modify: `tests/test_tracking.py`

- [ ] **Step 1: Edit `test_yolo_predictor_tracking` to set target class to cat (15)**
  Change `mock_box.cls = [0]` to `mock_box.cls = [15]` and `mock_box_no_track.cls = [0]` to `mock_box_no_track.cls = [15]`.
  ```python
  # In tests/test_tracking.py:71:
      mock_box.cls = [15]

  # In tests/test_tracking.py:106:
      mock_box_no_track.cls = [15]
  ```

- [ ] **Step 2: Run pytest on tracking predictor test**
  Run: `pytest tests/test_tracking.py::test_yolo_predictor_tracking -v`
  Expected: PASS

---

### Task 4: Implement ImageQualityFilter
**Files:**
- Create: `reid/core/filters.py`

- [ ] **Step 1: Create ImageQualityFilter**
  Write the quality filter logic using cv2.Laplacian and resolution checking.
  ```python
  import cv2
  import numpy as np

  class ImageQualityFilter:
      """Applies size and blur checking on a cropped region."""
      def __init__(self, min_w: int = 32, min_h: int = 32, blur_th: float = 10.0) -> None:
          self.min_w = min_w
          self.min_h = min_h
          self.blur_th = blur_th

      def is_valid(self, crop: np.ndarray) -> bool:
          """Return True if crop passes all quality filters, else False."""
          if crop is None or crop.size == 0:
              return False
          
          # Size check
          h, w = crop.shape[:2]
          if w < self.min_w or h < self.min_h:
              return False
              
          # Blur check (Laplacian variance)
          if self.blur_th > 0.0:
              gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
              variance = cv2.Laplacian(gray, cv2.CV_64F).var()
              if variance < self.blur_th:
                  return False
                  
          return True
  ```

---

### Task 5: Refactor Tracker State, State Machine, and Smart Eviction
**Files:**
- Modify: `reid/core/tracker.py`

- [ ] **Step 1: Rewrite `TrackState` in `reid/core/tracker.py`**
  Modify [TrackState](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/core/tracker.py#L5) to support `observations`, `should_match`, `update_state`, and normalized mean embedding computation.
  ```python
  # Replace TrackState implementation in reid/core/tracker.py:
  class TrackState:
      """Manages the state and history of an individual tracked object."""
      def __init__(self, track_id: int):
          self.track_id = track_id
          self.observations = []  # List of dicts: {"embedding": np.ndarray, "similarity": float, "frame_idx": int}
          self.match_result = None
          self.frame_count = 0
          self.state = "Unknown"  # "Unknown", "Candidate", "Locked"
          self.last_match_frame = -9999
          
      def should_match(self, candidate_interval: int, lock_interval: int) -> bool:
          """Determine if a re-matching step is required."""
          if self.state == "Unknown":
              return True
          elif self.state == "Candidate":
              return (self.frame_count - self.last_match_frame) >= candidate_interval
          elif self.state == "Locked":
              return (self.frame_count - self.last_match_frame) >= lock_interval
          return True

      def update_state(self, similarity: float, th_candidate: float, th_lock: float, th_hysteresis: float):
          """Perform state transition based on similarity thresholds."""
          old_state = self.state
          if similarity >= th_lock:
              self.state = "Locked"
          elif similarity >= th_candidate:
              self.state = "Candidate"
          else:
              self.state = "Unknown"
              
          # Hysteresis unlock
          if old_state == "Locked" and similarity < th_hysteresis:
              self.state = "Unknown"

      def add_observation(self, embedding: np.ndarray, match_res: MatchResult, is_match_run: bool = True):
          sim = match_res.similarity if match_res is not None else 0.0
          new_obs = {
              "embedding": embedding,
              "similarity": sim,
              "frame_idx": self.frame_count
          }
          
          if len(self.observations) < 10:
              self.observations.append(new_obs)
          else:
              # smart eviction: keep last 3 entries unconditionally (FIFO)
              # evict the entry with the lowest similarity from the remaining 7 entries
              hist_entries = self.observations[:-3]
              min_idx = min(range(len(hist_entries)), key=lambda i: hist_entries[i]["similarity"])
              if sim > hist_entries[min_idx]["similarity"]:
                  self.observations.pop(min_idx)
                  self.observations.append(new_obs)
          
          self.match_result = match_res
          if is_match_run:
              self.last_match_frame = self.frame_count
          self.frame_count += 1

      def get_mean_embedding(self) -> np.ndarray:
          if not self.observations:
              return np.zeros(1, dtype=np.float32)
          embeddings = [obs["embedding"] for obs in self.observations]
          mean_emb = np.mean(embeddings, axis=0)
          norm = np.linalg.norm(mean_emb)
          if norm > 1e-6:
              mean_emb = mean_emb / norm
          return mean_emb
  ```

- [ ] **Step 2: Update `TrackStateManager` to return mean embedding**
  Modify [TrackStateManager.get_match](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/core/tracker.py#L27) to return `state.get_mean_embedding()` instead of `state.embeddings[-1]`.
  ```python
  # Replace get_match in TrackStateManager:
      def get_match(self, track_id: int) -> Optional[Tuple[np.ndarray, MatchResult]]:
          """Return cached mean embedding and MatchResult if present. Updates LRU order."""
          if track_id in self.tracks and self.tracks[track_id].match_result is not None:
              state = self.tracks[track_id]
              self.tracks.pop(track_id)
              self.tracks[track_id] = state
              return state.get_mean_embedding(), state.match_result
          return None
  ```

- [ ] **Step 3: Run existing tracking state manager test**
  Run: `pytest tests/test_tracking.py::test_track_state_manager -v`
  Expected: PASS

---

### Task 6: Integrate Modular State Machine & Quality Filters in ReIdPredictor
**Files:**
- Modify: `reid/pipeline.py`

- [ ] **Step 1: Update ReIdPredictor initialization and inference logic**
  Instantiate `ImageQualityFilter` in `ReIdPredictor.__init__`. Modify `ReIdPredictor.inference` to use the modular filters and track state helpers.
  ```python
  # In reid/predict.py:
  # Add imports at the top:
  from reid.core.filters import ImageQualityFilter
  import cv2
  
  # Update ReIdPredictor.__init__ under super().__init__(config):
          self.quality_filter = ImageQualityFilter(
              min_w=getattr(self.cfg, "min_bbox_width", 32),
              min_h=getattr(self.cfg, "min_bbox_height", 32),
              blur_th=getattr(self.cfg, "blur_threshold", 10.0)
          )
          self.th_candidate = getattr(self.cfg, "threshold_candidate", 0.70)
          self.th_lock = getattr(self.cfg, "threshold_lock", 0.85)
          self.th_hysteresis = getattr(self.cfg, "threshold_hysteresis", 0.55)
          self.candidate_interval = getattr(self.cfg, "candidate_interval", 10)
          self.lock_interval = getattr(self.cfg, "lock_interval", 60)
          
  # Replace inference in ReIdPredictor:
      def inference(self, im: Any) -> Results:
          """Detect bounding boxes, crop and filter by quality, then apply state-machine Re-ID."""
          results = self.detector_predictor(im)
          img_pixels = results.orig_img
          
          all_embeddings = []
          for box in results.boxes:
              track_id = box.track_id
              crop = box.crop(img_pixels)
              
              # 1. Quality Filter check
              if not self.quality_filter.is_valid(crop):
                  # Fallback: reuse cached match if exists, else Unknown
                  cached = self.track_state_manager.tracks.get(track_id) if track_id is not None else None
                  if cached is not None and cached.match_result is not None:
                      results.match_results.append(cached.match_result)
                      all_embeddings.append(cached.get_mean_embedding())
                  else:
                      results.match_results.append(MatchResult(cat_id="Unknown", similarity=0.0, is_known=False))
                      all_embeddings.append(np.zeros(self.extractor_dim, dtype=np.float32))
                  continue
              
              # 2. State Machine scheduling check
              run_matching = True
              state_obj = None
              if track_id is not None:
                  if track_id not in self.track_state_manager.tracks:
                      self.track_state_manager.tracks[track_id] = TrackState(track_id)
                  state_obj = self.track_state_manager.tracks[track_id]
                  run_matching = state_obj.should_match(self.candidate_interval, self.lock_interval)
              
              if not run_matching and state_obj is not None and state_obj.match_result is not None:
                  # Cache hit: Retrieve mean embedding and reuse match result
                  self.track_state_manager.get_match(track_id)
                  results.match_results.append(state_obj.match_result)
                  all_embeddings.append(state_obj.get_mean_embedding())
                  state_obj.frame_count += 1
                  continue
                  
              # Cache miss or forced re-matching frame: extract new crop features
              embedding = self.extractor_predictor(crop)
              
              # Aggregate mean embedding (current embedding + history) for matching query
              historical_embs = [obs["embedding"] for obs in state_obj.observations] if state_obj else []
              all_embs = historical_embs + [embedding]
              mean_emb = np.mean(all_embs, axis=0)
              norm = np.linalg.norm(mean_emb)
              if norm > 1e-6:
                  mean_emb = mean_emb / norm
              
              # Run matching
              match_res = self.matcher.match(mean_emb)
              
              # Handle state transitions
              if state_obj is not None:
                  state_obj.update_state(match_res.similarity, self.th_candidate, self.th_lock, self.th_hysteresis)
                  state_obj.add_observation(embedding, match_res, is_match_run=True)
              
              results.match_results.append(match_res)
              all_embeddings.append(mean_emb)
              
          if all_embeddings:
              results.embeddings = np.vstack(all_embeddings)
              
          return results
  ```

- [ ] **Step 2: Run ReIdPredictor tests to verify compatibility**
  Run: `pytest tests/test_tracking.py::test_reid_predictor_caching -v`
  Expected: PASS

---

### Task 7: Add Tests for State Machine and Quality Filtering
**Files:**
- Modify: `tests/test_tracking.py`

- [ ] **Step 1: Write comprehensive test verifying state machine, quality checks, and eviction**
  Append these test cases to `tests/test_tracking.py`.
  ```python
  def test_quality_filtering():
      import numpy as np
      from reid.models.reid.predict import ReIdPredictor
      from reid.core.types import Results, BBox, MatchResult
      from reid.core.config import Config
      from unittest.mock import MagicMock
      
      # Mock dependencies
      detector = MagicMock()
      extractor = MagicMock()
      matcher = MagicMock()
      
      extractor.store.get_all.return_value = (np.array([]), [])
      extractor.cfg.imgsz = 384
      extractor.predict.return_value = np.ones(512)
      
      cfg = Config()
      cfg.track = True
      cfg.min_bbox_width = 30
      cfg.min_bbox_height = 30
      cfg.blur_threshold = 5.0
      
      predictor = ReIdPredictor(detector, extractor, matcher, cfg)
      
      # Test 1: Tiny box size filter (20x20)
      box = BBox(x1=0, y1=0, x2=20, y2=20, track_id=8)
      orig_img = np.zeros((100, 100, 3), dtype=np.uint8)
      results = Results(orig_img=orig_img, path="", boxes=[box])
      detector.predict.return_value = results
      
      res = predictor.inference(orig_img)
      assert res.match_results[0].cat_id == "Unknown"
      assert res.match_results[0].similarity == 0.0
      assert extractor.predict.call_count == 1 # only init call
      
      # Test 2: Blurry box (Laplacian var ~ 0)
      blurry_box = BBox(x1=0, y1=0, x2=50, y2=50, track_id=9)
      results_blur = Results(orig_img=orig_img, path="", boxes=[blurry_box])
      detector.predict.return_value = results_blur
      
      res_blur = predictor.inference(orig_img)
      assert res_blur.match_results[0].cat_id == "Unknown"
      assert res_blur.match_results[0].similarity == 0.0
      assert extractor.predict.call_count == 1

  def test_state_machine_transitions():
      from reid.models.reid.predict import ReIdPredictor
      from reid.core.types import Results, BBox, MatchResult
      from reid.core.config import Config
      from unittest.mock import MagicMock
      import numpy as np
      
      detector = MagicMock()
      extractor = MagicMock()
      matcher = MagicMock()
      
      extractor.store.get_all.return_value = (np.array([]), [])
      extractor.cfg.imgsz = 384
      extractor.predict.return_value = np.ones(512)
      
      cfg = Config()
      cfg.track = True
      cfg.threshold_candidate = 0.70
      cfg.threshold_lock = 0.85
      cfg.threshold_hysteresis = 0.55
      cfg.candidate_interval = 2
      cfg.lock_interval = 5
      cfg.blur_threshold = 0.0 # disable blur check for test
      
      predictor = ReIdPredictor(detector, extractor, matcher, cfg)
      
      # Frame 1: Match with sim=0.60 (stays Unknown)
      box = BBox(x1=0, y1=0, x2=50, y2=50, track_id=12)
      img = np.zeros((100, 100, 3), dtype=np.uint8)
      detector.predict.return_value = Results(orig_img=img, path="", boxes=[box])
      matcher.match.return_value = MatchResult(cat_id="Nabi", similarity=0.60)
      
      predictor.inference(img)
      track_state = predictor.track_state_manager.tracks[12]
      assert track_state.state == "Unknown"
      
      # Frame 2: Match with sim=0.75 (transitions to Candidate)
      matcher.match.return_value = MatchResult(cat_id="Nabi", similarity=0.75)
      predictor.inference(img)
      assert track_state.state == "Candidate"
      
      # Frame 3: Candidate cache hit (does not match, candidate_interval is 2)
      matcher.match.reset_mock()
      predictor.inference(img)
      matcher.match.assert_not_called()
      
      # Frame 4: Forced re-match on Candidate (sim=0.90 -> transitions to Locked)
      matcher.match.return_value = MatchResult(cat_id="Nabi", similarity=0.90)
      predictor.inference(img)
      assert track_state.state == "Locked"
      
      # Frame 5: Locked cache hit
      matcher.match.reset_mock()
      predictor.inference(img)
      matcher.match.assert_not_called()

  def test_smart_eviction():
      from reid.core.tracker import TrackState
      from reid.core.types import MatchResult
      import numpy as np
      
      state = TrackState(track_id=1)
      # Fill observations with index 0..9
      # Set first 7 similarities low (0.5), last 3 similarity higher (0.8) to simulate recent ones
      for i in range(10):
          sim = 0.8 if i >= 7 else 0.5
          state.add_observation(np.ones(512) * i, MatchResult(cat_id="A", similarity=sim))
          
      assert len(state.observations) == 10
      
      # Insert new observation with similarity 0.7
      # It should evict one of the 0..6 entries (lowest similarity = 0.5), keeping the recent 3
      new_emb = np.ones(512) * 99
      state.add_observation(new_emb, MatchResult(cat_id="A", similarity=0.7))
      
      assert len(state.observations) == 10
      # Verify one entry of similarity 0.5 was evicted, and 0.7 is added
      similarities = [obs["similarity"] for obs in state.observations]
      assert 0.7 in similarities
      assert similarities.count(0.5) == 6
      assert similarities.count(0.8) == 3
  ```

- [ ] **Step 2: Run all unit tests to verify full implementation**
  Run: `pytest`
  Expected: PASS
