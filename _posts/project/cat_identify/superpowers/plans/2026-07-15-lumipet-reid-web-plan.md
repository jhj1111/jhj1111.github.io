# Lumipet Re-ID Web Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web service (FastAPI backend + React frontend) that allows users to upload video/image files, run the Lumipet Re-ID pipeline in a non-blocking background queue, poll the task progress, and visualize the BBox and cat identification overlay on the web screen.

**Architecture:** Use a monorepo setup for backend and frontend. The backend runs model inference on a separate threadpool using FastAPI's `BackgroundTasks`, updating progress via a core callback. The frontend uses React Query to poll task status and draws matching boxes onto a `<canvas>` overlaid on a standard HTML5 `<video>` player.

**Tech Stack:** FastAPI, Pydantic v2, Ruff, PyTorch, React (Vite, TS), TailwindCSS, TanStack Query, Axios, openapi-typescript-codegen.

---

## Workspace Directory Mapping
```plaintext
/home/jhj/project_ws/lumipet_ws/
├── lumipet-reid/                   # (Existing) AI Core Repository
└── lumipet-reid-web/               # (New) Web Monorepo
    ├── backend/
    └── frontend/
```

---

### Task 1: Re-ID Core Compatibility Modifications

**Files:**
- Modify: `lumipet-reid/reid/core/config.py:90-125`
- Modify: `lumipet-reid/reid/cfg/default.yaml:47-53`
- Modify: `lumipet-reid/reid/engine/predictor.py:47-200`
- Test: Run local CLI to verify no regressions.

- [ ] **Step 1: Update config.yaml default values**
  Modify `lumipet-reid/reid/cfg/default.yaml` to include `save_path: null` under device and run settings.
  ```yaml
  # Device & Run Settings
  dev: False
  show: True
  track: True
  tracker: "cfg/trackers/fasttrack.yaml"
  device: "cuda"
  fp16: True
  save_path: null
  ```

- [ ] **Step 2: Modify Config.load to allow bypassing CLI arguments**
  Modify `Config.load` in `lumipet-reid/reid/core/config.py` to accept an optional `args` parameter.
  ```python
  @classmethod
  def load(cls, yaml_path: Union[str, Path], args: Optional[List[str]] = None) -> "Config":
      config = cls()
      
      # 1. Load from YAML if exists
      if yaml_path and Path(yaml_path).exists():
          with open(yaml_path, "r") as f:
              yaml_data = yaml.safe_load(f)
              if yaml_data:
                  for k, v in yaml_data.items():
                      if hasattr(config, k):
                          setattr(config, k, v)
      
      # 2. Override with CLI arguments if args is not explicitly overridden
      target_args = sys.argv[1:] if args is None else args
      cli_args = cls._parse_cli(target_args)
      for k, v in cli_args.items():
          if hasattr(config, k):
              default_val = getattr(config, k)
              try:
                  if isinstance(default_val, bool):
                      setattr(config, k, str(v).lower() in ("true", "1", "yes"))
                  elif default_val is None:
                      setattr(config, k, v)
                  else:
                      setattr(config, k, type(default_val)(v))
              except (ValueError, TypeError):
                  setattr(config, k, v)
          else:
              setattr(config, k, v)
              
      from reid.utils.checks import select_device
      config.device = select_device(config.device)
      return config
  ```

- [ ] **Step 3: Update get_config signature**
  Modify `get_config` in `lumipet-reid/reid/core/config.py` to forward `args` to `Config.load`.
  ```python
  def get_config(yaml_path: Union[str, Path, None] = None, args: Optional[List[str]] = None) -> Config:
      global _config
      yaml_path = get_cfg_path(yaml_path)
      if _config is None:
          _config = Config.load(yaml_path=yaml_path, args=args)
      return _config
  ```

- [ ] **Step 4: Modify predictor.py to support dynamic save_path and frame callback**
  Modify the `predict` method of `BasePredictor` in `lumipet-reid/reid/engine/predictor.py`.
  ```python
  def predict(self, source: Union[str, Path, int], save_path: Optional[Union[str, Path]] = None, on_frame: Optional[Any] = None) -> Any:
      import os
      self.video_writer = None
      self.fps_ema = None
      if self.profiler:
          self.profiler.history = []
          self.profiler.current_frame = {stage: 0.0 for stage in self.profiler.stages}
          self.profiler.current_frame["total"] = 0.0

      source_str = str(source)
      if isinstance(source, int):
          source_name = f"webcam_{source}"
      else:
          source_name = os.path.splitext(os.path.basename(source_str))[0]
      timestamp = time.strftime("%Y%m%d_%H%M%S")

      if hasattr(self, "reset"):
          self.reset()

      is_image_file = False
      if isinstance(source, (str, Path)):
          source_str = str(source)
          if os.path.isfile(source_str) and source_str.lower().endswith(('.png', '.jpg', '.jpeg')):
              is_image_file = True

      if self.cfg.show:
          cv2.namedWindow("Lumipet Re-ID", cv2.WINDOW_NORMAL)
          cv2.resizeWindow("Lumipet Re-ID", 1280, 720)

      # Handle image case
      if not isinstance(source, (str, Path, int)) or is_image_file:
          if is_image_file:
              frame = cv2.imread(str(source))
              if frame is None:
                  raise ValueError(f"Could not read image file: {source}")
          else:
              frame = source

          res = self.predict_once(frame)
          do_save = self.cfg.save or (save_path is not None)
          if hasattr(res, 'boxes') and (self.cfg.show or do_save):
              annotated_frame = self.draw_overlay(res)
              if self.cfg.show and is_image_file:
                  cv2.imshow("Lumipet Re-ID", annotated_frame)
                  cv2.waitKey(1)
              if do_save:
                  out_img_path = save_path or getattr(self.cfg, "save_path", "output_result.png") or "output_result.png"
                  cv2.imwrite(str(out_img_path), annotated_frame)
          if on_frame is not None:
              on_frame(1, 1, res)
          return res

      self.loader = StreamLoader(source)
      do_save = self.cfg.save or (save_path is not None)
      if do_save:
          fps = self.loader.get_fps()
          w, h = self.loader.get_size()
          out_video_path = save_path or getattr(self.cfg, "save_path", "output.mp4") or "output.mp4"
          self.video_writer = cv2.VideoWriter(
              str(out_video_path), cv2.VideoWriter_fourcc(*'mp4v'), fps, (w, h)
          )

      paused = False
      results_list = []
      results_list_break = False

      try:
          total_len = self.loader.get_len()
          for idx, (path, frame) in enumerate(self.loader):
              start_time = time.perf_counter()
              res = self.predict_once(frame)
              if res is not None:
                  results_list.append(res)
              
              annotated_frame = None
              if hasattr(res, 'boxes'):
                  annotated_frame = self.draw_overlay(res)
              
              total_time_ms = (time.perf_counter() - start_time) * 1000.0
              self.profiler.commit_frame(total_time_ms)
              
              if annotated_frame is not None:
                  current_fps = 1000.0 / max(total_time_ms, 1e-3)
                  if self.fps_ema is None:
                      self.fps_ema = current_fps
                  else:
                      self.fps_ema = 0.9 * self.fps_ema + 0.1 * current_fps
                  
                  if self.cfg.show:
                      cv2.putText(annotated_frame, f"FPS: {self.fps_ema:.1f}", (10, 30),
                                  cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                      cv2.imshow("Lumipet Re-ID", annotated_frame)
                      key = cv2.waitKey(1) & 0xFF
                      if key == ord('q'):
                          break
                  if self.video_writer:
                      self.video_writer.write(annotated_frame)
              
              if on_frame is not None:
                  on_frame(idx + 1, total_len, res)
      finally:
          if self.video_writer:
              self.video_writer.release()
              self.video_writer = None
          if self.cfg.show:
              cv2.destroyAllWindows()
      return results_list
  ```

- [ ] **Step 5: Run CLI script to verify it still works**
  Run: `.venv/bin/python -m reid.cli list`
  Expected output: Show registered cats list successfully.

---

### Task 2: Setup Web Monorepo Workspace (Phase 0)

**Files:**
- Create: `lumipet-reid-web/backend/pyproject.toml`
- Create: `lumipet-reid-web/backend/requirements.txt`
- Move: `/home/jhj/project_ws/lumipet_ws/AGENTS.md` -> `lumipet-reid-web/AGENTS.md`
- Move: `/home/jhj/project_ws/lumipet_ws/.gitignore` -> `lumipet-reid-web/.gitignore`

- [ ] **Step 1: Create Monorepo Root folder & move configuration files**
  Create directories:
  `mkdir -p /home/jhj/project_ws/lumipet_ws/lumipet-reid-web/backend/src`
  `mkdir -p /home/jhj/project_ws/lumipet_ws/lumipet-reid-web/frontend`
  Move placeholder files:
  `mv /home/jhj/project_ws/lumipet_ws/AGENTS.md /home/jhj/project_ws/lumipet_ws/lumipet-reid-web/AGENTS.md`
  `mv /home/jhj/project_ws/lumipet_ws/.gitignore /home/jhj/project_ws/lumipet_ws/lumipet-reid-web/.gitignore`

- [ ] **Step 2: Create backend pyproject.toml (Ruff Config)**
  Write content to `lumipet-reid-web/backend/pyproject.toml`:
  ```toml
  [project]
  name = "lumipet-reid-web-backend"
  version = "1.0.0"
  requires-python = ">=3.10"

  [tool.ruff]
  line-length = 88
  target-version = "py310"

  [tool.ruff.lint]
  select = ["E", "F", "I", "UP", "B", "C4", "RUF"]
  ignore = []
  ```

- [ ] **Step 3: Create backend requirements.txt**
  Write content to `lumipet-reid-web/backend/requirements.txt`:
  ```text
  fastapi>=0.115
  uvicorn[standard]
  pydantic>=2.7
  pydantic-settings>=2.4
  python-multipart
  httpx>=0.27
  pytest
  pytest-asyncio
  ```

- [ ] **Step 4: Create virtual environment and install requirements**
  Run:
  `python3 -m venv /home/jhj/project_ws/lumipet_ws/lumipet-reid-web/backend/.venv`
  `/home/jhj/project_ws/lumipet_ws/lumipet-reid-web/backend/.venv/bin/pip install -r /home/jhj/project_ws/lumipet_ws/lumipet-reid-web/backend/requirements.txt`
  `/home/jhj/project_ws/lumipet_ws/lumipet-reid-web/backend/.venv/bin/pip install -e /home/jhj/project_ws/lumipet_ws/lumipet-reid`

---

### Task 3: Backend AI Core Engine Loader & Inference Wrapper (Phase 1)

**Files:**
- Create: `lumipet-reid-web/backend/src/ai/config.py`
- Create: `lumipet-reid-web/backend/src/ai/engine.py`
- Create: `lumipet-reid-web/backend/src/ai/inference.py`

- [ ] **Step 1: Write backend/src/ai/config.py**
  Create pure python settings for the AI layer:
  ```python
  import os
  from pathlib import Path

  AI_CONFIG_PATH = Path("/home/jhj/project_ws/lumipet_ws/lumipet-reid/config.yaml")
  ```

- [ ] **Step 2: Write backend/src/ai/engine.py (Model Singleton Loader)**
  Implement the model loading inside a separate engine that interacts with `lumipet-reid` core container:
  ```python
  from typing import Optional
  from reid.core.config import get_config
  from reid.container import build_detector, build_extractor, build_matcher
  from reid.models.reid.predict import ReIdPredictor
  from src.ai.config import AI_CONFIG_PATH

  class AIEngine:
      _predictor: Optional[ReIdPredictor] = None

      @classmethod
      def load_model(cls) -> ReIdPredictor:
          if cls._predictor is None:
              # Initialize config with empty args to avoid CLI sys.argv pollution
              cfg = get_config(yaml_path=AI_CONFIG_PATH, args=[])
              cfg.show = False  # Keep headless for web environment
              
              detector = build_detector(cfg)
              extractor = build_extractor(cfg)
              matcher = build_matcher(cfg)
              cls._predictor = ReIdPredictor(detector, extractor, matcher, cfg)
          return cls._predictor

      @classmethod
      def get_predictor(cls) -> ReIdPredictor:
          if cls._predictor is None:
              raise RuntimeError("AI model has not been loaded. Call load_model() first.")
          return cls._predictor
  ```

- [ ] **Step 3: Write backend/src/ai/inference.py (Inference Wrapper)**
  Create pure functions that execute the model on the threadpool:
  ```python
  from typing import Any, Union, Optional
  from pathlib import Path
  from src.ai.engine import AIEngine

  def run_reid_predict(
      source: Union[str, Path, int],
      save_path: Optional[Union[str, Path]] = None,
      on_frame: Optional[Any] = None
  ) -> Any:
      predictor = AIEngine.get_predictor()
      # Explicitly disable show and pass save_path & on_frame callback
      predictor.cfg.show = False
      return predictor.predict(source, save_path=save_path, on_frame=on_frame)
  ```

---

### Task 4: Backend Task Manager Service & Media Upload Router (Phase 1)

**Files:**
- Create: `lumipet-reid-web/backend/src/core/config.py`
- Create: `lumipet-reid-web/backend/src/media/schemas.py`
- Create: `lumipet-reid-web/backend/src/media/service.py`
- Create: `lumipet-reid-web/backend/src/media/router.py`
- Create: `lumipet-reid-web/backend/src/reid/schemas.py`
- Create: `lumipet-reid-web/backend/src/reid/service.py`
- Create: `lumipet-reid-web/backend/src/reid/router.py`
- Create: `lumipet-reid-web/backend/src/main.py`
- Create: `lumipet-reid-web/backend/tests/test_endpoints.py`

- [ ] **Step 1: Create global config settings in src/core/config.py**
  ```python
  from pydantic_settings import BaseSettings
  import os

  class Settings(BaseSettings):
      UPLOAD_DIR: str = "/home/jhj/project_ws/lumipet_ws/lumipet-reid-web/backend/data/uploads"
      RESULTS_DIR: str = "/home/jhj/project_ws/lumipet_ws/lumipet-reid-web/backend/data/results"
      
      class Config:
          env_prefix = "LUMIPET_"

  settings = Settings()
  os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
  os.makedirs(settings.RESULTS_DIR, exist_ok=True)
  ```

- [ ] **Step 2: Create media domain schemas & service**
  Write content to `lumipet-reid-web/backend/src/media/schemas.py`:
  ```python
  from pydantic import BaseModel

  class UploadResponse(BaseModel):
      media_id: str
      filename: str
      filepath: str
  ```
  Write content to `lumipet-reid-web/backend/src/media/service.py`:
  ```python
  import uuid
  import shutil
  import os
  from fastapi import UploadFile
  from src.core.config import settings

  def save_upload_file(file: UploadFile) -> str:
      media_id = str(uuid.uuid4())
      file_ext = os.path.splitext(file.filename)[1]
      target_filename = f"{media_id}{file_ext}"
      target_path = os.path.join(settings.UPLOAD_DIR, target_filename)
      with open(target_path, "wb") as f:
          shutil.copyfileobj(file.file, f)
      return media_id, target_filename, target_path
  ```

- [ ] **Step 3: Create media router**
  Write content to `lumipet-reid-web/backend/src/media/router.py`:
  ```python
  from fastapi import APIRouter, UploadFile, File
  from src.media.schemas import UploadResponse
  from src.media import service as media_service

  router = APIRouter(prefix="/media", tags=["media"])

  @router.post("/upload", response_model=UploadResponse)
  async def upload_file(file: UploadFile = File(...)):
      media_id, filename, filepath = media_service.save_upload_file(file)
      return UploadResponse(media_id=media_id, filename=filename, filepath=filepath)
  ```

- [ ] **Step 4: Create Re-ID schemas**
  Write content to `lumipet-reid-web/backend/src/reid/schemas.py`:
  ```python
  from pydantic import BaseModel
  from typing import Optional, List, Any

  class PredictRequest(BaseModel):
      media_id: str

  class PredictResponse(BaseModel):
      task_id: str
      status: str

  class CatResponse(BaseModel):
      label: str
      count: int

  class TaskStatusSchema(BaseModel):
      task_id: str
      status: str
      progress: float
      processed_frames: int
      total_frames: int
      result: Optional[List[Any]] = None
      output_video_url: Optional[str] = None
      error: Optional[str] = None
  ```

- [ ] **Step 5: Create Re-ID service (In-Memory Task Manager & Background Runner)**
  Write content to `lumipet-reid-web/backend/src/reid/service.py`:
  ```python
  import uuid
  import os
  import asyncio
  from typing import Dict, Optional, List
  from fastapi import BackgroundTasks
  from src.core.config import settings
  from src.reid.schemas import TaskStatusSchema
  from src.ai import inference as ai_inference

  # Global in-memory task database
  tasks_db: Dict[str, TaskStatusSchema] = {}

  def get_task(task_id: str) -> Optional[TaskStatusSchema]:
      return tasks_db.get(task_id)

  def run_pipeline_task(task_id: str, media_path: str):
      tasks_db[task_id].status = "RUNNING"
      
      file_ext = os.path.splitext(media_path)[1]
      output_filename = f"{task_id}_output{file_ext}"
      save_path = os.path.join(settings.RESULTS_DIR, output_filename)

      def on_frame_callback(current: int, total: int, res: Any):
          total = max(total, 1)
          tasks_db[task_id].processed_frames = current
          tasks_db[task_id].total_frames = total
          tasks_db[task_id].progress = round((current / total) * 100.0, 1)

      try:
          loop = asyncio.new_event_loop()
          asyncio.set_event_loop(loop)
          
          # Call AI core predictor synchronously inside this thread
          results = ai_inference.run_reid_predict(
              source=media_path,
              save_path=save_path,
              on_frame=on_frame_callback
          )
          
          # Map Results to JSON serializable objects
          serializable_results = []
          for r in (results if isinstance(results, list) else [results]):
              boxes_list = []
              for box in getattr(r, "boxes", []):
                  boxes_list.append({
                      "x1": float(box.x1),
                      "y1": float(box.y1),
                      "x2": float(box.x2),
                      "y2": float(box.y2),
                      "conf": float(box.conf),
                      "cls": int(box.cls),
                      "track_id": box.track_id
                  })
              matches_list = []
              for match in getattr(r, "match_results", []):
                  matches_list.append({
                      "cat_id": match.cat_id,
                      "similarity": float(match.similarity),
                      "is_known": bool(match.is_known)
                  })
              serializable_results.append({
                  "boxes": boxes_list,
                  "match_results": matches_list
              })

          tasks_db[task_id].status = "COMPLETED"
          tasks_db[task_id].progress = 100.0
          tasks_db[task_id].result = serializable_results
          tasks_db[task_id].output_video_url = f"/static/results/{output_filename}"

      except Exception as e:
          tasks_db[task_id].status = "FAILED"
          tasks_db[task_id].error = str(e)

  def start_predict_task(media_id: str, background_tasks: BackgroundTasks) -> str:
      task_id = str(uuid.uuid4())
      
      # Find the uploaded media file
      media_file = None
      for f in os.listdir(settings.UPLOAD_DIR):
          if f.startswith(media_id):
              media_file = os.path.join(settings.UPLOAD_DIR, f)
              break
              
      if not media_file:
          raise ValueError(f"Media file not found for ID: {media_id}")

      # Initialize task status
      tasks_db[task_id] = TaskStatusSchema(
          task_id=task_id,
          status="PENDING",
          progress=0.0,
          processed_frames=0,
          total_frames=0
      )

      # Offload CPU/GPU inference loop to BackgroundTasks (runs in standard threadpool)
      background_tasks.add_task(run_pipeline_task, task_id, media_file)
      return task_id
  ```

- [ ] **Step 6: Create Re-ID router**
  Write content to `lumipet-reid-web/backend/src/reid/router.py`:
  ```python
  from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
  from typing import List
  from src.reid.schemas import PredictRequest, PredictResponse, TaskStatusSchema, CatResponse
  from src.reid import service as reid_service

  router = APIRouter(prefix="/reid", tags=["reid"])

  @router.post("/predict", response_model=PredictResponse)
  async def predict(request: PredictRequest, background_tasks: BackgroundTasks):
      try:
          task_id = reid_service.start_predict_task(request.media_id, background_tasks)
          return PredictResponse(task_id=task_id, status="PENDING")
      except ValueError as e:
          raise HTTPException(status_code=400, detail=str(e))

  @router.get("/tasks/{task_id}", response_model=TaskStatusSchema)
  async def get_task_status(task_id: str):
      task = reid_service.get_task(task_id)
      if not task:
          raise HTTPException(status_code=404, detail="Task not found")
      return task

  @router.get("/cats", response_model=List[CatResponse])
  async def list_cats():
      # Fetch from lumipet-reid extractor store
      from src.ai.engine import AIEngine
      predictor = AIEngine.get_predictor()
      labels_summary = predictor.extractor.store.list_labels()
      return [CatResponse(label=k, count=v) for k, v in labels_summary.items()]
  ```

- [ ] **Step 7: Create backend main.py**
  Write content to `lumipet-reid-web/backend/src/main.py`:
  ```python
  from fastapi import FastAPI
  from fastapi.middleware.cors import CORSMiddleware
  from fastapi.staticfiles import StaticFiles
  from contextlib import asynccontextmanager
  from src.ai.engine import AIEngine
  from src.media.router import router as media_router
  from src.reid.router import router as reid_router
  from src.core.config import settings

  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # Load models singleton into VRAM on startup
      print("Loading AI Models into memory...")
      AIEngine.load_model()
      print("AI Models successfully loaded.")
      yield
      # Shutdown actions (if any)
      print("Shutting down API server.")

  app = FastAPI(title="Lumipet Re-ID Web Service", lifespan=lifespan)

  # Configure CORS
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )

  # Mount static folder for uploaded files and results
  app.mount("/static/results", StaticFiles(directory=settings.RESULTS_DIR), name="results")

  # Include Routers
  app.include_router(media_router)
  app.include_router(reid_router)
  ```

- [ ] **Step 8: Run uvicorn server locally and test manually**
  Run:
  `/home/jhj/project_ws/lumipet_ws/lumipet-reid-web/backend/.venv/bin/uvicorn src.main:app --host 127.0.0.1 --port 8000` (WaitMsBeforeAsync=5000)
  Verify `http://127.0.0.1:8000/docs` works and lists all routes.

- [ ] **Step 9: Write mock tests for endpoints**
  Write content to `lumipet-reid-web/backend/tests/test_endpoints.py`:
  ```python
  import pytest
  from httpx import AsyncClient, ASGITransport
  from src.main import app
  from src.reid import service as reid_service

  @pytest.mark.asyncio
  async def test_upload_and_poll():
      # Mock the background tasks runner database
      reid_service.tasks_db["test-task"] = {
          "task_id": "test-task",
          "status": "COMPLETED",
          "progress": 100.0,
          "processed_frames": 10,
          "total_frames": 10,
          "result": []
      }
      
      transport = ASGITransport(app=app)
      async with AsyncClient(transport=transport, base_url="http://test") as client:
          # Query task
          resp = await client.get("/reid/tasks/test-task")
          assert resp.status_code == 200
          data = resp.json()
          assert data["status"] == "COMPLETED"
  ```
  Run: `/home/jhj/project_ws/lumipet_ws/lumipet-reid-web/backend/.venv/bin/pytest /home/jhj/project_ws/lumipet_ws/lumipet-reid-web/backend/tests/`
  Expected: Test passes.

---

### Task 5: Frontend Project Setup & OpenAPI Client Type Generation (Phase 2)

**Files:**
- Create: `lumipet-reid-web/frontend/package.json`
- Create: `lumipet-reid-web/frontend/tsconfig.json`
- Create: `lumipet-reid-web/frontend/vite.config.ts`
- Create: `lumipet-reid-web/frontend/index.html`

- [ ] **Step 1: Create frontend/package.json**
  Write content to `lumipet-reid-web/frontend/package.json`:
  ```json
  {
    "name": "lumipet-reid-web-frontend",
    "private": true,
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc && vite build",
      "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
      "preview": "vite preview",
      "generate-client": "openapi-typescript-codegen --input http://127.0.0.1:8000/openapi.json --output ./src/lib/api-client --client axios"
    },
    "dependencies": {
      "@tanstack/react-query": "^5.0.0",
      "axios": "^1.6.0",
      "lucide-react": "^0.300.0",
      "react": "^18.2.0",
      "react-dom": "^18.2.0",
      "zustand": "^4.4.0"
    },
    "devDependencies": {
      "@types/react": "^18.2.0",
      "@types/react-dom": "^18.2.0",
      "@vitejs/plugin-react": "^4.2.0",
      "openapi-typescript-codegen": "^0.25.0",
      "typescript": "^5.2.0",
      "vite": "^5.0.0"
    }
  }
  ```

- [ ] **Step 2: Create frontend tsconfig.json & vite.config.ts**
  Write basic config content for TS and Vite.
  Write content to `lumipet-reid-web/frontend/vite.config.ts`:
  ```typescript
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'

  export default defineConfig({
    plugins: [react()],
    server: {
      port: 3000,
    }
  })
  ```
  Write content to `lumipet-reid-web/frontend/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "useDefineForClassFields": true,
      "lib": ["DOM", "DOM.Iterable", "ES2020"],
      "module": "ESNext",
      "skipLibCheck": true,
      "moduleResolution": "node",
      "allowImportingTsExtensions": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "noEmit": true,
      "jsx": "react-jsx",
      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true
    },
    "include": ["src"]
  }
  ```

- [ ] **Step 3: Initialize frontend packages**
  Run:
  `cd /home/jhj/project_ws/lumipet_ws/lumipet-reid-web/frontend && npm install`

- [ ] **Step 4: Generate TS Client**
  Start backend in background, then run generator command:
  `npm run generate-client`
  Verify that `frontend/src/lib/api-client/` contains all the generated TS Axios services and types matching backend schemas.

---

### Task 6: Frontend Features Implementation (Phase 2)

**Files:**
- Create: `lumipet-reid-web/frontend/src/App.tsx`
- Create: `lumipet-reid-web/frontend/src/features/video-input/UploadWidget.tsx`
- Create: `lumipet-reid-web/frontend/src/features/viewer/OverlayViewer.tsx`
- Create: `lumipet-reid-web/frontend/src/features/db-management/CatsPanel.tsx`

- [ ] **Step 1: Write UploadWidget.tsx**
  Implement the file upload widget supporting drag-and-drop and progress bar.
  ```tsx
  import React, { useState } from 'react';
  import axios from 'axios';

  interface UploadWidgetProps {
    onUploadSuccess: (mediaId: string, filename: string) => void;
  }

  export const UploadWidget: React.FC<UploadWidgetProps> = ({ onUploadSuccess }) => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];

      const formData = new FormData();
      formData.append('file', file);
      setUploading(true);
      setProgress(0);

      try {
        const resp = await axios.post('http://127.0.0.1:8000/media/upload', formData, {
          onUploadProgress: (progressEvent) => {
            const percent = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setProgress(percent);
          },
        });
        onUploadSuccess(resp.data.media_id, file.name);
      } catch (err) {
        alert('Upload failed: ' + err);
      } finally {
        setUploading(false);
      }
    };

    return (
      <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center bg-slate-900/50">
        <input type="file" onChange={handleFileChange} id="upload-input" className="hidden" />
        <label htmlFor="upload-input" className="cursor-pointer text-indigo-400 hover:text-indigo-300 font-semibold">
          Click here to upload Video or Image
        </label>
        {uploading && <div className="mt-4 text-sm text-slate-400">Uploading... {progress}%</div>}
      </div>
    );
  };
  ```

- [ ] **Step 2: Write OverlayViewer.tsx**
  Implement canvas rendering overlay over HTML5 video:
  ```tsx
  import React, { useRef, useEffect } from 'react';

  interface BBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    conf: number;
    track_id: number | null;
  }

  interface FrameResult {
    boxes: BBox[];
    match_results: Array<{ cat_id: string; similarity: number; is_known: boolean }>;
  }

  interface OverlayViewerProps {
    videoUrl: string;
    results: FrameResult[];
  }

  export const OverlayViewer: React.FC<OverlayViewerProps> = ({ videoUrl, results }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animationFrameId: number;

      const draw = () => {
        if (!video.videoWidth) {
          animationFrameId = requestAnimationFrame(draw);
          return;
        }

        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const currentFrameIndex = Math.floor(video.currentTime * 24); // Assume 24 fps
        const currentResult = results[currentFrameIndex];

        if (currentResult && currentResult.boxes) {
          const scaleX = canvas.width / video.videoWidth;
          const scaleY = canvas.height / video.videoHeight;

          currentResult.boxes.forEach((box, i) => {
            const rx = box.x1 * scaleX;
            const ry = box.y1 * scaleY;
            const rw = (box.x2 - box.x1) * scaleX;
            const rh = (box.y2 - box.y1) * scaleY;

            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 3;
            ctx.strokeRect(rx, ry, rw, rh);

            const match = currentResult.match_results[i];
            const label = match ? `${match.cat_id} (${Math.round(match.similarity * 100)}%)` : `Unknown`;

            ctx.fillStyle = '#6366f1';
            ctx.font = '14px Outfit, Inter, sans-serif';
            ctx.fillText(label, rx, ry > 20 ? ry - 5 : ry + 15);
          });
        }

        animationFrameId = requestAnimationFrame(draw);
      };

      video.addEventListener('play', () => {
        draw();
      });

      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    }, [results]);

    return (
      <div className="relative inline-block w-full max-w-4xl rounded-2xl overflow-hidden border border-slate-800">
        <video ref={videoRef} src={`http://127.0.0.1:8000${videoUrl}`} controls className="w-full h-auto block" />
        <canvas ref={canvasRef} className="absolute top-0 left-0 pointer-events-none w-full h-full" />
      </div>
    );
  };
  ```

- [ ] **Step 3: Write CatsPanel.tsx**
  Implement simple DB management display list:
  ```tsx
  import React, { useEffect, useState } from 'react';
  import axios from 'axios';

  export const CatsPanel: React.FC = () => {
    const [cats, setCats] = useState<Array<{ label: string; count: number }>>([]);

    const fetchCats = async () => {
      try {
        const resp = await axios.get('http://127.0.0.1:8000/reid/cats');
        setCats(resp.data);
      } catch (err) {
        console.error(err);
      }
    };

    useEffect(() => {
      fetchCats();
    }, []);

    return (
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
        <h2 className="text-xl font-bold text-slate-100 mb-4">Registered Cat Database</h2>
        <div className="space-y-3">
          {cats.map((c) => (
            <div key={c.label} className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl">
              <span className="font-semibold text-slate-200">{c.label}</span>
              <span className="text-sm text-indigo-400">{c.count} embedding(s)</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  ```

- [ ] **Step 4: Update App.tsx**
  Integrate components: Connect React Query polling to display real-time progress, then render the `OverlayViewer` when done.
  Write code to `lumipet-reid-web/frontend/src/App.tsx`.

---

### Task 7: E2E Integration & Build Verification (Phase 3)

- [ ] **Step 1: Check compile and production build on Frontend**
  Run:
  `cd /home/jhj/project_ws/lumipet_ws/lumipet-reid-web/frontend && npm run build`
  Expected: Successful compilation without TS errors.

- [ ] **Step 2: Run Ruff Linter check on Backend**
  Run:
  `cd /home/jhj/project_ws/lumipet_ws/lumipet-reid-web/backend && .venv/bin/ruff check`
  Expected: Clean status or auto-fixes.
