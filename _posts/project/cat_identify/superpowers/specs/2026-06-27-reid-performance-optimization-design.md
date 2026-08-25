# Spec: Re-ID Pipeline Profiler and Feature Extraction Optimization (Batching & FP16)

- **Date**: 2026-06-27
- **Topic**: Adding pipeline stage profiling, multi-crop batch feature extraction, and FP16 inference for performance optimization.
- **Status**: Proposed / Under Review

---

## 1. Problem Statement

1. **Blind Bottlenecks**: The current code only measures the overall frame FPS. There is no stage-level latency measurement, making it difficult to pinpoint exactly where CPU or GPU time is wasted (e.g., YOLO detection, image filtering, embedding extraction, database matching, or video frame rendering).
2. **Sequential Inference Overhead**: In [ReIdPredictor.inference](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/reid/predict.py#L58), if multiple cat crops pass the quality filter and trigger a cache miss/rematch, the pipeline calls `self.extractor_predictor(crop)` inside a sequential loop. This executes PyTorch preprocessing and inference separately for each crop, introducing severe Python loop and GPU kernel launch overheads.
3. **Memory Leaks in Track Cache**: In [ReIdPredictor.inference](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/reid/predict.py#L84), new tracks are added by bypassing the manager and assigning directly to `self.track_state_manager.tracks[track_id] = TrackState(track_id)`. This prevents the LRU eviction mechanism in [TrackStateManager](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/core/tracker.py#L73) from triggering, allowing the memory footprint to grow without limit over long runs.

---

## 2. Proposed Architecture & Design

### A. Pipeline Stage Profiler (`PipelineProfiler`)
We will create a helper module [reid/utils/profiler.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/utils/profiler.py).
It will manage high-precision performance timers for the following sections:
- `detection`: YOLO detection and ByteTrack association.
- `quality_filter`: Size and Laplacian variance blur checking.
- `extractor`: PyTorch feature extraction (embedding generation).
- `matcher`: Cosine similarity calculation against FAISS/KNN database.
- `rendering`: Drawing overlays, FPS overlay, and OpenCV window handling.
- `total`: Complete end-to-end frame processing time.

**Key Features**:
1. **Context Manager**: Supports measuring blocks via `with profiler.profile("stage_name"):`.
2. **ASCII Summary Table**: When the video loop finishes, prints a structured latency summary:
   - Average duration per stage (ms)
   - Standard deviation (ms)
   - Percentage of total frame time (%)
3. **Structured CSV Appending**: If `dev: True`, writes frame-by-frame performance data to a file structured as `results/<source_name>/<timestamp>.csv`.
   - The `<source_name>` will be derived from the input video path (e.g. `cream_heroes`) or webcam index (`webcam_0`).
   - The `<timestamp>` will be formatted as `YYYYMMDD_HHMMSS`.

### B. Batch Feature Extraction
To fully utilize the parallel compute capability of the GPU, we will update the feature extractor to accept a list of crops and process them in a single batch forward pass.

1. **`ExtractorPredictor` Modifications** (in [reid/models/extractor/predict.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/extractor/predict.py)):
   - Implement `preprocess_batch(self, im_list: list) -> torch.Tensor`: Converts a list of NumPy/PIL images, applies transformations, stacks them into a single 4D tensor `[N, 3, H, W]`, and pushes it to `self.device`.
   - Implement `postprocess_batch(self, preds: torch.Tensor) -> np.ndarray`: Converts model prediction tensor of shape `[N, D]` to a 2D numpy array of shape `[N, D]`.
   - Implement `predict_batch(self, im_list: list) -> np.ndarray`: Orchestrates the pre-inference-post batch flow.
2. **`ReIdPredictor` Pipeline Update** (in [reid/models/reid/predict.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/reid/predict.py)):
   - We transition the inference loop to a **two-pass collection/execution flow**:
     - **Pass 1 (Collect)**: Loop over the frame's bounding boxes. Evaluate the quality filter and cache checks. If a rematch or cache miss occurs, add the crop and tracking metadata (box index, track ID) to a `needs_extraction` list. If a cache hit or filter rejection occurs, fill the result immediately.
     - **Pass 2 (Execute)**: If `needs_extraction` is not empty, run `self.extractor_predictor.predict_batch` for all collected crops. Iterate through the generated embeddings, perform matcher search, update the individual `TrackState` objects, and store the output.

### C. FP16 Inference
- Add `fp16: True` flag in [config.yaml](file:///home/jhj/project_ws/lumipet_ws/re-id_test/config.yaml) and load it into configuration.
- In [reid/models/extractor/model.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/extractor/model.py), if `fp16` is enabled and the device is `cuda`, run `self.model.half()` during model loading to convert all weights to half-precision.
- During batch preprocessing, convert the input tensor to `.half()` to match model weights.

### D. Safe Track Memory Management
- Replace direct assignments of `self.track_state_manager.tracks[track_id] = TrackState(track_id)` in [predict.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/reid/predict.py) with calls to a method that registers the track safely and runs LRU eviction (e.g. updating `self.track_state_manager.update_track` behavior to initialize a track state if not present and enforce the `max_tracks` ceiling).

---

## 3. Component Details & Changes

### 1. `config.yaml` & `reid/core/config.py`
- Add `fp16: True` parameter.

### 2. `reid/utils/profiler.py` (New file)
- Implements `PipelineProfiler` with context manager `profile(stage)`, `commit_frame()`, `print_summary()`, and `save_csv(source_name)`.

### 3. `reid/models/extractor/predict.py`
- Add `preprocess_batch`, `postprocess_batch`, and `predict_batch` methods.
- Support `half()` input conversion when `fp16: True`.

### 4. `reid/models/extractor/model.py`
- Check `self.cfg.fp16` and convert `self.model` to `half()` if on CUDA device.

### 5. `reid/models/reid/predict.py`
- Import and integrate `PipelineProfiler`.
- Implement two-pass batch collection and execution.
- Interact with `TrackStateManager` safely to avoid track memory leaks.

### 6. `reid/engine/predictor.py`
- Setup and teardown `PipelineProfiler` instance around the stream processing loop.
- Trigger summary print and CSV logging inside `finally:` block of `predict()`.

---

## 4. Verification & Testing

1. **Unit Tests**:
   - Create a new test file `tests/test_optimization.py` or expand `tests/test_tracking.py` to cover:
     - `PipelineProfiler` (verifying times are accumulated and CSV matches format).
     - Extractor batching (comparing output embedding shape of single vs batched inputs).
     - Track manager LRU eviction (pushing tracks beyond 1000 and verifying eviction).
     - FP16 conversion verification.
2. **Integration Verification**:
   - Run the Re-ID pipeline on validation/predict source, confirming that processing FPS increases and timing files are generated correctly under `results/`.
