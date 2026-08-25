# Spec: Re-ID by_track Feature Refactoring and Optimization

- **Date**: 2026-06-23
- **Topic**: Refactoring and optimizing the tracking-based (`by_track`) cat Re-ID cache and matching mechanism.
- **Status**: Proposed / Under Review

---

## 1. Problem Statement

1. **Initial Recognition Failure (Permanent Unknown)**: When a cat first enters the frame, the initial crops may be blurry or angled poorly, causing the similarity score to fall below the classification threshold. This yields an `Unknown` classification. Currently, this `Unknown` result is cached indefinitely for that `track_id`, blocking subsequent high-quality frames from correcting it.
2. **Underutilized Cache**: [TrackState](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/core/tracker.py#L5) stores up to 10 embeddings, but the pipeline only retrieves the single latest embedding (`state.embeddings[-1]`) and returns the cached [MatchResult](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/core/types.py) directly on cache hit.
3. **Pure FIFO Cache Eviction**: Bounding box features are pushed to the cache chronologically. If a cat is tracked for a long time, high-quality template embeddings may be evicted in favor of recent low-quality/blurry crops.
4. **Untuned Detection Tracker**: The system references `bytetrack.yaml` from YOLO defaults, but parameters such as low-detection thresholds and track buffer sizes are not managed locally or tuned for cat-specific motion.

---

## 2. Proposed Architecture & Design

### A. Configurable Thresholds & Settings
The following parameters will be added to [config.yaml](file:///home/jhj/project_ws/lumipet_ws/re-id_test/config.yaml) and mapped to [Config](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/core/config.py#L8):
```yaml
# Tracking & Hysteresis Settings
threshold_candidate: 0.70    # Minimum similarity to match as a Candidate cat
threshold_lock: 0.85         # Similarity threshold to lock the identity
threshold_hysteresis: 0.55   # Minimum similarity required to keep the Lock
candidate_interval: 10       # Frame interval to retry matching while in Candidate state
lock_interval: 60            # Frame interval to re-verify identity while in Locked state

# Image Quality Filters
min_bbox_width: 32           # Minimum width of the bounding box to extract embedding
min_bbox_height: 32          # Minimum height of the bounding box to extract embedding
blur_threshold: 10.0         # Minimum Laplacian variance score (lower means blurry, 0.0 to disable)
```

### B. YOLO Tracker External Configuration (`bytetrack.yaml`)
We will create a local [bytetrack.yaml](file:///home/jhj/project_ws/lumipet_ws/re-id_test/bytetrack.yaml) in the workspace root. By default, Ultralytics YOLO prioritizes local files relative to the working directory. This file will allow direct tuning of the tracker parameters:
```yaml
tracker_type: bytetrack
track_high_thresh: 0.5       # Detections with conf > 0.5 are used for 1st association
track_low_thresh: 0.1        # Detections with conf between 0.1 and 0.5 are used for 2nd association
new_track_thresh: 0.6        # Conf threshold to initialize a new track
track_buffer: 30             # Number of frames to preserve a lost track
match_thresh: 0.8            # IoU threshold for matching detections to tracks
fuse_score: True
```

### C. Image Quality & Size Filters (`ImageQualityFilter`)
To support clean code (SOLID Single Responsibility Principle) and easy performance toggling, image validation is modularized into `reid/core/filters.py`:
1. **Size check**:
   - If crop width $< \text{min\_bbox\_width}$ or height $< \text{min\_bbox\_height}$, filter returns `False`.
2. **Sharpness (Blur) check**:
   - Compute the Laplacian variance on the grayscale cropped patch:
     $$\sigma^2 = \text{Variance}(\text{Laplacian}(\text{Grayscale}(\text{crop})))$$
   - If $\sigma^2 < \text{blur\_threshold}$, filter returns `False`.
3. **Fallback Action**:
   - If `ImageQualityFilter.is_valid(crop)` returns `False`, we do not extract embeddings or update the cache. We reuse the cached match if available, or return `Unknown`.

### D. Track State Machine (Decentralized Transitions)
State transitions and query scheduling are managed dynamically inside [TrackState](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/core/tracker.py#L5):
1. `should_match(candidate_interval, lock_interval) -> bool`:
   - Returns `True` if:
     - `state == "Unknown"`
     - `state == "Candidate"` and interval elapsed.
     - `state == "Locked"` and lock interval elapsed.
2. `update_state(similarity, th_candidate, th_lock, th_hysteresis)`:
   - Updates `state` based on thresholds.
   - If state was `Locked` but similarity falls below `threshold_hysteresis`, resets to `Unknown`.

### E. Smart Cache Replacement (Eviction by Similarity)
Within [TrackState](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/core/tracker.py#L5), we store observations containing both the embedding and its similarity score.
- When the cache is full (10 entries) and a new frame's embedding is processed:
  - Find the cached observation with the **lowest similarity score**.
  - If the new embedding has a **higher similarity score** than the lowest in cache, evict the lowest-score entry and insert the new one.
  - Otherwise, discard the new embedding to keep the cache filled with high-quality representations.
- **Ensuring Recency**: To prevent template drift, the most recent **3 frames** are always preserved using FIFO. The similarity-based eviction applies only to the remaining **7 historical slots**.

### F. Normalized Mean Embedding Matching
Instead of matching against a single frame's features, we aggregate the cached representations:
1. When matching is triggered, compute the mean vector of all embeddings stored in the [TrackState](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/core/tracker.py#L5):
   $$\mathbf{v}_{\text{mean}} = \frac{1}{M} \sum_{i=1}^M \mathbf{v}_i$$
2. Normalize the mean vector to unit length ($L_2$ normalization):
   $$\mathbf{v}_{\text{norm}} = \frac{\mathbf{v}_{\text{mean}}}{\|\mathbf{v}_{\text{mean}}\|_2}$$
3. Perform the database matching using $\mathbf{v}_{\text{norm}}$ against the FAISS/KNN matcher.

---

## 3. Component Diffs & Implementation Plan

### 1. `config.yaml` & `reid/core/config.py`
Add the new thresholds, intervals, and filter settings with default values.

### 2. `bytetrack.yaml` (New file)
Create the local tracking config file in the root workspace.

### 3. `reid/core/filters.py` (New file)
Create `ImageQualityFilter` encapsulating width, height, and Laplacian blur checks.

### 4. `reid/core/tracker.py`
- Modify [TrackState](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/core/tracker.py#L5) to store observations as a list of dicts.
- Implement `should_match`, `update_state`, and `get_mean_embedding`.
- Implement smart eviction logic:
  - Keep the last 3 entries unconditionally (FIFO).
  - Among the other 7, evict the one with the lowest similarity if the incoming similarity is higher.

### 5. `reid/pipeline.py`
- Import and initialize `ImageQualityFilter`.
- Modify [ReIdPredictor.inference](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/pipeline.py#L45) to utilize the filter and `TrackState` methods for clean, decoupled execution.

---

## 4. Verification & Testing

1. **Unit Tests**:
   - Update `tests/test_tracking.py` to fix the class-filtering assertion failure in `test_yolo_predictor_tracking`.
   - Add new tests in `tests/test_tracking.py` to verify:
     - `ImageQualityFilter` (rejecting blurry/small images).
     - Smart cache replacement (evicting lowest similarity score, keeping last 3).
     - State transitions (`Unknown` $\rightarrow$ `Candidate` $\rightarrow$ `Locked`).
     - Hysteresis lock release when similarity drops below `threshold_hysteresis`.
     - Calculation of normalized mean embedding.
2. **Integration Verification**:
   - Run `pytest` to ensure all tests pass.
