# Extractor 단일화 구현 계획

> **실행 방식:** `superpowers:executing-plans`로 태스크 단위 순차 실행. 각 단계는 체크박스(`- [ ]`)로 추적한다.
> **커밋:** `dev/workflow.md` §0.3에 따라 **태스크마다 커밋하지 않는다.** 모든 태스크 완료 후 변경 요약을 보고하고, 사용자의 요청을 받으면 논리 단위로 나누어 순차 커밋한다.

**Goal:** `wildlife`와 `mega_descriptor` 두 특징 추출기 구현을 `mega_descriptor` 이름 하나로 통합하고, projection layer 경로와 버그 2건을 제거한다.

**Architecture:** 이름은 `mega_descriptor`를 유지하되 구현 내용은 검증된 `wildlife` 쪽(raw timm 백본 + ArcFace)을 채택한다. `extractor/model.py`(공통 등록 파이프라인) + `mega_descriptor/`(백본 어댑터) 2계층 구조는 그대로 둔다. 학습 로직 자체는 손대지 않는 동작 동등 리팩터이며, 학습 개선은 2차 작업에서 진행한다.

**Tech Stack:** Python 3.10+, PyTorch, timm, wildlife-tools(`ArcFaceLoss`), pytest 9.1.1

**Spec:** `dev/specs/2026-08-20-extractor-merge.md`

## Global Constraints

- 통합 후 클래스명은 `MegaDesExtractorModel` / `MegaDesExtractorTrainer` 이다.
- 임베딩 차원은 백본 출력 그대로 사용한다. 차원 축소 projection을 두지 않는다.
- 학습 로직(목적함수·옵티마이저·검증·저장 방식)은 **변경하지 않는다.** augmentation, scheduler, accumulation, AMP, resume, 로깅은 이번 범위 밖이다.
- 기존 체크포인트(raw state_dict 327키)와 기존 DB(1536차원)는 그대로 동작해야 한다. 재등록을 요구하면 안 된다.
- 기본 가중치 경로는 `weights/mega_descriptor.pth`, ONNX는 `weights/mega_descriptor.onnx`, TensorRT는 `weights/mega_descriptor.engine`.
- `Config.extractor_type`은 필드로 남기되 동작 분기에 사용하지 않는다. 기본값은 `"mega_descriptor"`.
- 전체 테스트는 착수 시점과 완료 시점 모두 그린이어야 한다.
- 테스트 실행 명령은 `.venv/bin/python -m pytest` 를 사용한다.

## File Structure

| 파일 | 책임 | 이번 작업에서 |
|---|---|---|
| `reid/models/extractor/model.py` | `ExtractorModel` — 등록 파이프라인, 품질 게이트, 배치 임베딩 저장 | 변경 없음 |
| `reid/models/extractor/mega_descriptor/model.py` | 백본 어댑터 — timm 백본 로딩, 임베딩 차원 산출, 가중치 로드 | **내용 대체** |
| `reid/models/extractor/mega_descriptor/train.py` | ArcFace 파인튜닝 trainer | **내용 대체** |
| `reid/models/extractor/mega_descriptor/__init__.py` | 두 클래스 export | 변경 없음 |
| `reid/models/extractor/wildlife/` | (구) 백본 어댑터 + trainer | **삭제** |
| `reid/models/extractor/predict.py` | 추론·배치 추출·ONNX export | 메타데이터 폴백 문자열 1줄 |
| `reid/models/extractor/val.py` | 검증 | 변경 없음 |
| `reid/models/extractor/embedding.py` | SQLite 임베딩 저장소 | 변경 없음 |
| `reid/container.py` | DI 빌더 | 분기 제거 |
| `reid/core/config.py` | Config 데이터클래스 | 기본값 4건 |
| `reid/cfg/default.yaml` | 기본 설정 | 기본값 4건 |
| `tests/test_extractor.py` | 추출기 회귀 + 통합 플로우 테스트 | **신규 생성** (기존 `test_wildlife.py` 흡수) |

---

## Task 1: 버그 2건 회귀 테스트 (RED)

**Files:**
- Create: `tests/test_extractor.py`

**Interfaces:**
- Consumes: `reid.core.config.Config`, `reid.models.extractor.mega_descriptor.model.MegaDesExtractorModel`
- Produces: `TINY_MODEL` 상수와 `_tiny_cfg(tmp_path)` 헬퍼 — Task 3에서 재사용한다

**배경:** 현재 `reid/models/extractor/mega_descriptor/model.py`에 버그 2건이 있다.
- `:24` — `super().__init__()`에 `cfg`를 넘기지 않아 전달받은 cfg 인스턴스를 버리고 전역 싱글턴을 재조회한다.
- `:25` — `self.embedding_size = 1536`이 `super().__init__()` 뒤에 실행되어 `_load_model`이 산출한 실제 차원을 덮어쓴다.

Task 2에서 구현을 교체하면 두 버그가 사라진다. 이 테스트는 그것을 고정한다.

- [ ] **Step 1: 그린 베이스라인 확인**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건 (현재 59개 수집). 여기서 이미 실패가 있으면 **중단하고 보고**한다 — 기존 실패를 이번 작업의 결과와 섞지 않는다.

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/test_extractor.py` 생성:

```python
import timm
import torch

from reid.core.config import Config
from reid.models.extractor.mega_descriptor.model import MegaDesExtractorModel

# Swin-Tiny 기반 소형 백본. 대형 L-384 대신 사용해 테스트를 가볍게 유지한다.
TINY_MODEL = "hf-hub:BVRA/MegaDescriptor-T-224"


def _tiny_cfg(tmp_path):
    """저장소를 오염시키지 않는 임시 경로 기반 설정."""
    cfg = Config()
    cfg.model_name = TINY_MODEL
    cfg.extractor_weights = str(tmp_path / "missing.pth")  # 존재하지 않음 = pretrained 백본 사용
    cfg.db_path = str(tmp_path / "test.db")
    cfg.device = "cpu"
    return cfg


def test_extractor_uses_provided_cfg_instance(tmp_path):
    """생성자에 넘긴 cfg 인스턴스를 그대로 보관해야 한다 (전역 싱글턴 재조회 금지)."""
    cfg = _tiny_cfg(tmp_path)
    model = MegaDesExtractorModel(model_name=TINY_MODEL, cfg=cfg)
    assert model.cfg is cfg


def test_embedding_size_matches_backbone_output_dim(tmp_path):
    """embedding_size는 백본의 실제 출력 차원이어야 한다 (하드코딩 금지)."""
    cfg = _tiny_cfg(tmp_path)
    model = MegaDesExtractorModel(model_name=TINY_MODEL, cfg=cfg)

    reference = timm.create_model(TINY_MODEL, pretrained=True, num_classes=0)
    imgsz = reference.default_cfg["input_size"][1]
    reference.eval()
    with torch.no_grad():
        expected_dim = reference(torch.zeros(1, 3, imgsz, imgsz)).shape[1]

    assert model.embedding_size == expected_dim
```

- [ ] **Step 3: 테스트가 의도한 이유로 실패하는지 확인**

Run: `.venv/bin/python -m pytest tests/test_extractor.py -v`
Expected: 2건 모두 FAIL.
- `test_extractor_uses_provided_cfg_instance` — `assert model.cfg is cfg`에서 실패 (현재는 전역 Config 인스턴스가 들어 있음)
- `test_embedding_size_matches_backbone_output_dim` — `assert 1536 == 768`에서 실패

다른 이유(임포트 에러, 텐서 shape 에러 등)로 실패하면 테스트가 잘못된 것이다. 원인을 고치고 다시 확인한다.

---

## Task 2: 백본 어댑터와 trainer 내용 대체 (GREEN)

**Files:**
- Modify: `reid/models/extractor/mega_descriptor/model.py` (전체 대체)
- Modify: `reid/models/extractor/mega_descriptor/train.py` (전체 대체)
- Test: `tests/test_extractor.py`

**Interfaces:**
- Consumes: `reid.models.extractor.model.ExtractorModel`, `reid.engine.trainer.BaseTrainer`, `reid.data.loader.CatDataLoader`, `wildlife_tools.train.objective.ArcFaceLoss`
- Produces:
  - `MegaDesExtractorModel(model_path: Optional[str], model_name: Optional[str], cfg) -> ExtractorModel` — 속성 `embedding_size: int`, `model: nn.Module`(raw timm 백본)
  - `MegaDesExtractorTrainer(cfg, model_instance: MegaDesExtractorModel) -> BaseTrainer`

두 파일은 함께 바뀌어야 한다. `model.py`만 교체하면 `_get_trainer()`가 projection을 참조하는 옛 trainer를 반환해 깨진 중간 상태가 된다.

- [ ] **Step 1: `mega_descriptor/model.py` 전체 대체**

```python
import os
from pathlib import Path
from typing import Optional

import timm
import torch

from reid.models.extractor.model import ExtractorModel
from reid.utils.logger import LOGGER


class MegaDesExtractorModel(ExtractorModel):
    """
    Feature Extractor Model wrapper for MegaDescriptor and native timm backbones.
    """
    def __init__(
            self,
            model_path: Optional[str] = None,
            model_name: Optional[str] = None,
            cfg=None
        ) -> None:
        from reid.core.config import get_config
        cfg_inst = cfg or get_config()
        m_path = model_path or cfg_inst.extractor_weights
        m_name = model_name or cfg_inst.model_name

        self.embedding_size = 0
        super().__init__(model_path=m_path, model_name=m_name, cfg=cfg_inst)

    def _load_model(self, weights: str) -> None:
        """Load raw timm backbone and infer feature dimension dynamically."""
        self.model = timm.create_model(self.model_name, pretrained=True, num_classes=0)

        # Adjust imgsz dynamically based on model's default expected input size
        if hasattr(self.model, 'default_cfg') and 'input_size' in self.model.default_cfg:
            model_imgsz = self.model.default_cfg['input_size'][1]
            if self.cfg.imgsz != model_imgsz:
                LOGGER.info(f"Adjusting configuration imgsz from {self.cfg.imgsz} to {model_imgsz} to match model requirements.")
                self.cfg.imgsz = model_imgsz

        # Infer embedding size dynamically using dummy input
        self.model.eval()
        with torch.no_grad():
            dummy = torch.zeros(1, 3, self.cfg.imgsz, self.cfg.imgsz)
            self.embedding_size = self.model(dummy).shape[1]

        if weights and os.path.exists(weights):
            try:
                state_dict = torch.load(weights, weights_only=True, map_location=self.cfg.device)
                self.model.load_state_dict(state_dict)
                LOGGER.info(f"🚀 Extractor loaded: '{Path(weights).name}' (Device: {self.cfg.device}, Dim: {self.embedding_size}, Format: PyTorch)")
            except Exception as e:
                LOGGER.error(f"Failed loading weights from '{weights}': {e}")

    def _get_trainer(self) -> "MegaDesExtractorTrainer":
        """Return the training wrapper."""
        from reid.models.extractor.mega_descriptor.train import MegaDesExtractorTrainer
        return MegaDesExtractorTrainer(self.cfg, model_instance=self)

    def _get_validator(self) -> "ExtractorValidator":
        """Return the validation wrapper."""
        from reid.models.extractor.val import ExtractorValidator
        return ExtractorValidator(self.cfg)
```

핵심 차이 3가지: `super().__init__()`에 `cfg=cfg_inst` 전달 / `embedding_size`를 `_load_model` 안에서만 설정 / `CombinedModel`·projection·`has_custom_weights`·3중 체크포인트 분기 전부 제거.

- [ ] **Step 2: `mega_descriptor/train.py` 전체 대체**

```python
from typing import Optional, Any
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from reid.engine.trainer import BaseTrainer
from reid.data.loader import CatDataLoader
from wildlife_tools.train.objective import ArcFaceLoss

class MegaDesExtractorTrainer(BaseTrainer):
    """
    Trainer implementation for MegaDesExtractorModel fine-tuning using ArcFace loss.
    """
    def __init__(self, cfg: Optional[Any] = None, model_instance: Optional[Any] = None) -> None:
        super().__init__(cfg)
        self.model_instance = model_instance

    def get_model(self) -> nn.Module:
        """Return model backbone for training."""
        return self.model_instance.model

    def get_dataloader(self) -> tuple:
        """Build and return data loaders from dataset_path."""
        loader = CatDataLoader(self.cfg.dataset_path, imgsz=self.cfg.imgsz)
        return loader.get_loaders(batch_size=self.cfg.batch_size, test_size=self.cfg.test_size)

    def setup(self) -> None:
        """Initialize ArcFaceLoss and AdamW optimizer."""
        super().setup()
        num_classes = len(self.train_loader.dataset.label_to_idx)
        embedding_size = self.model_instance.embedding_size

        # Initialize ArcFaceLoss
        self.criterion = ArcFaceLoss(
            num_classes=num_classes,
            embedding_size=embedding_size,
            margin=getattr(self.cfg, "arcface_margin", 0.5),
            scale=getattr(self.cfg, "arcface_scale", 64.0)
        ).to(self.device)

        # Optimize model parameters and loss parameters (trainable W weights)
        self.optimizer = optim.AdamW(
            list(self.model.parameters()) + list(self.criterion.parameters()),
            lr=self.cfg.lr
        )

    def compute_loss(self, model_outputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        """Compute ArcFace angular margin loss."""
        return self.criterion(model_outputs, targets)

    def pre_epoch_hook(self) -> None:
        """Set model to training mode."""
        self.model.train()

    @torch.no_grad()
    def validate(self) -> float:
        """Evaluate current epoch accuracy on validation data."""
        self.model.eval()
        correct = 0
        total = 0

        # Retrieve ArcFace weights (shape: [embedding_size, num_classes])
        arcface_w = self.criterion.loss.W

        for imgs, labels in self.val_loader:
            imgs, labels = imgs.to(self.device), labels.to(self.device)
            embeddings = self.model(imgs)

            # Predict by finding maximum cosine similarity with class weight vectors
            norm_embeddings = F.normalize(embeddings, p=2, dim=1)
            norm_w = F.normalize(arcface_w, p=2, dim=0)
            logits = torch.matmul(norm_embeddings, norm_w)

            _, predicted = logits.max(dim=1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()

        return 100. * correct / total

    def save_model(self) -> None:
        """Save fine-tuned backbone weights checkpoint."""
        torch.save(self.model.state_dict(), self.get_save_path())

    def get_save_path(self) -> str:
        """Return weight file save path."""
        return self.model_instance.model_path
```

기존 `wildlife/train.py`와 동일한 로직이며 클래스명과 docstring만 바뀐다. **학습 동작은 의도적으로 그대로 둔다** (2차 작업 대상).

- [ ] **Step 3: 회귀 테스트 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_extractor.py -v`
Expected: 2건 PASS

- [ ] **Step 4: 전체 테스트 그린 확인**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건. 이 시점에는 `wildlife/`가 아직 살아 있어 `tests/test_wildlife.py`도 함께 통과해야 한다.

---

## Task 3: `wildlife/` 삭제 및 임포트 체인 정리

**Files:**
- Delete: `reid/models/extractor/wildlife/__init__.py`, `reid/models/extractor/wildlife/model.py`, `reid/models/extractor/wildlife/train.py`
- Modify: `reid/models/extractor/__init__.py`, `reid/models/__init__.py`, `reid/__init__.py`, `reid/container.py`, `reid/models/extractor/predict.py:213`
- Delete: `tests/test_wildlife.py`
- Modify: `tests/test_extractor.py` (통합 플로우 테스트 흡수)

**Interfaces:**
- Consumes: Task 2의 `MegaDesExtractorModel`, `MegaDesExtractorTrainer`
- Produces: `build_extractor(cfg) -> MegaDesExtractorModel` — `cfg.extractor_type` 값과 무관하게 항상 이 타입을 반환한다

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/test_extractor.py` 끝에 추가:

```python
def test_build_extractor_ignores_legacy_extractor_type(tmp_path):
    """레거시 extractor_type 값이 남아 있어도 무시하고 단일 구현을 반환해야 한다."""
    from reid.container import build_extractor

    cfg = _tiny_cfg(tmp_path)
    cfg.extractor_type = "wildlife"  # 하위호환: 구 설정 파일에 남아 있는 값
    model = build_extractor(cfg)
    assert isinstance(model, MegaDesExtractorModel)
```

- [ ] **Step 2: 테스트가 의도한 이유로 실패하는지 확인**

Run: `.venv/bin/python -m pytest tests/test_extractor.py::test_build_extractor_ignores_legacy_extractor_type -v`
Expected: FAIL — `WildlifeExtractorModel` 인스턴스가 반환되어 `isinstance` 단언 실패

- [ ] **Step 3: `reid/container.py`의 `build_extractor` 교체**

```python
def build_extractor(cfg=None):
    cfg = cfg or get_config()
    from reid.models.extractor.mega_descriptor.model import MegaDesExtractorModel
    return MegaDesExtractorModel(model_path=cfg.extractor_weights, model_name=cfg.model_name, cfg=cfg)
```

- [ ] **Step 4: `reid/models/extractor/__init__.py` 교체**

```python

from reid.models.extractor import mega_descriptor
from .predict import ExtractorPredictor
from .val import ExtractorValidator
from .embedding import EmbeddingStore

__all__ = "mega_descriptor", "ExtractorPredictor", "ExtractorValidator", "EmbeddingStore"
```

- [ ] **Step 5: `reid/models/__init__.py` 교체**

```python
from .reid import ReIdModel
from .yolo import YoloModel
from .extractor.mega_descriptor import MegaDesExtractorModel

__all__ = "ReIdModel","YoloModel","MegaDesExtractorModel"
```

- [ ] **Step 6: `reid/__init__.py`에서 `WildlifeExtractorModel` 제거**

`MODELS` 튜플(`:10` 부근)과 `TYPE_CHECKING` 임포트(`:22`) 두 곳을 수정한다:

```python
MODELS = (
    "ReIdModel",
    "YoloModel",
    "MegaDesExtractorModel",
    "KnnMatcher", "FaissMatcher"
)
```

```python
if TYPE_CHECKING:
    # Enable hints for type checkers
    from reid.models import ReIdModel, YoloModel, MegaDesExtractorModel
```

이 파일은 lazy-import 방식이라 이름을 빠뜨리면 `import reid` 시점이 아니라 속성 접근 시점에 `AttributeError`가 난다. 두 곳 모두 확인한다.

- [ ] **Step 7: `predict.py`의 폴백 문자열 수정**

`reid/models/extractor/predict.py:213`의 ONNX 메타데이터 폴백값을 바꾼다. 이 줄을 남겨두면 Step 10의 잔여 참조 검사에 걸린다.

```python
            "extractor_type": str(getattr(self.cfg, "extractor_type", "mega_descriptor")),
```

- [ ] **Step 8: `wildlife/` 디렉터리 삭제**

```bash
rm -rf reid/models/extractor/wildlife
find reid -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null; true
```

- [ ] **Step 9: 통합 플로우 테스트를 `tests/test_extractor.py`로 흡수**

`tests/test_wildlife.py`의 `test_wildlife_flow`를 아래 내용으로 `tests/test_extractor.py` 끝에 옮기고, 원본 파일은 삭제한다. 임포트와 클래스명만 바뀌며 **테스트 로직은 그대로 유지**한다.

```python
def test_extractor_flow():
    import os
    import shutil
    import numpy as np
    from reid.core.config import get_config
    from reid.container import build_extractor
    from reid.models.extractor.mega_descriptor.train import MegaDesExtractorTrainer

    print("Testing MegaDesExtractorModel initialization...")
    cfg = get_config()
    cfg.model_name = TINY_MODEL
    cfg.extractor_weights = "weights/test_extractor_weights.pth"
    cfg.db_path = "embeddings/test_db.npz"
    cfg.dataset_path = "datasets/mini_dataset"
    cfg.epochs = 1
    cfg.batch_size = 2
    cfg.device = "cpu"  # enforce CPU testing for stability

    # 1. Initialize model
    model = build_extractor(cfg)
    assert isinstance(model, MegaDesExtractorModel)
    assert model.embedding_size > 0
    print(f"Success! Model embedding size is {model.embedding_size}")

    # 2. Extract features check
    dummy_img = np.zeros((384, 384, 3), dtype=np.uint8)
    emb = model.predict(dummy_img)
    assert emb.shape[0] == model.embedding_size
    print(f"Success! Predict feature shape: {emb.shape}")

    # 3. Train check
    print("Testing 1 epoch training with ArcFaceLoss...")
    for cat_name in ["cat1", "cat2"]:
        dummy_dir = os.path.join(cfg.dataset_path, cat_name)
        os.makedirs(dummy_dir, exist_ok=True)
        for i in range(4):
            dummy_img_path = os.path.join(dummy_dir, f"img_{i}.jpg")
            if not os.path.exists(dummy_img_path):
                import cv2
                cv2.imwrite(dummy_img_path, np.zeros((100, 100, 3), dtype=np.uint8))

    trainer = model._get_trainer()
    assert isinstance(trainer, MegaDesExtractorTrainer)
    trainer.train()
    assert os.path.exists(cfg.extractor_weights)
    print("Success! Checkpoint saved.")

    # Clean up test outputs
    if os.path.exists(cfg.extractor_weights):
        os.remove(cfg.extractor_weights)
    if os.path.exists(cfg.db_path):
        os.remove(cfg.db_path)
    if os.path.exists("datasets/mini_dataset"):
        shutil.rmtree("datasets/mini_dataset")
    db_db_path = cfg.db_path.replace(".npz", ".db")
    if os.path.exists(db_db_path):
        os.remove(db_db_path)
    print("All tests passed successfully!")
```

```bash
rm tests/test_wildlife.py
```

> 관찰(이번 범위 밖): 이 테스트는 전역 `get_config()` 싱글턴을 직접 변경하고 저장소 경로에 임시 파일을 만든다. 다른 테스트에 상태가 샐 수 있다. 2차 작업의 더미 데이터셋 정리 때 함께 다룬다.

- [ ] **Step 10: 전체 테스트 그린 확인**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건. `wildlife` 잔여 참조가 있으면 여기서 `ImportError`로 드러난다.

- [ ] **Step 11: 잔여 참조 확인**

Run: `grep -rn --include='*.py' -i 'wildlife' reid/ tests/`
Expected: `reid/models/extractor/mega_descriptor/train.py`의 `from wildlife_tools.train.objective import ArcFaceLoss` **한 줄만** 남는다. 이것은 라이브러리 임포트이므로 정상이다.

---

## Task 4: config 기본값 변경

**Files:**
- Modify: `reid/core/config.py` (`:14`, `:18`, `:45`, `:47`)
- Modify: `reid/cfg/default.yaml` (`:5`, `:9`, `:35`, `:37`)
- Test: `tests/test_config.py:28`

**Interfaces:**
- Consumes: 없음
- Produces: `Config` 기본값 — `extractor_weights="weights/mega_descriptor.pth"`, `extractor_type="mega_descriptor"`, `onnx_extractor_path="weights/mega_descriptor.onnx"`, `engine_extractor_path="weights/mega_descriptor.engine"`

- [ ] **Step 1: 실패하는 테스트로 변경**

`tests/test_config.py`의 `test_config_properties` 안 `:28` 한 줄을 수정한다:

```python
    assert cfg.onnx_extractor.endswith("weights/mega_descriptor.onnx")
```

같은 함수 아래에 기본값 단언을 추가한다:

```python
def test_extractor_defaults_are_mega_descriptor():
    cfg = Config()
    assert cfg.extractor_type == "mega_descriptor"
    assert cfg.extractor_weights == "weights/mega_descriptor.pth"
    assert cfg.engine_extractor_path == "weights/mega_descriptor.engine"
```

- [ ] **Step 2: 테스트가 의도한 이유로 실패하는지 확인**

Run: `.venv/bin/python -m pytest tests/test_config.py -v`
Expected: `test_config_properties`와 `test_extractor_defaults_are_mega_descriptor` 2건 FAIL (현재 값은 `wildlife`)

- [ ] **Step 3: `reid/core/config.py` 기본값 수정**

```python
    extractor_weights: str = "weights/mega_descriptor.pth"
```
```python
    extractor_type: str = "mega_descriptor"  # backbone label (metadata only, no dispatch)
```
```python
    onnx_extractor_path: str = "weights/mega_descriptor.onnx"
```
```python
    engine_extractor_path: str = "weights/mega_descriptor.engine"
```

- [ ] **Step 4: `reid/cfg/default.yaml` 기본값 수정**

```yaml
extractor_weights: "weights/mega_descriptor.pth"
```
```yaml
extractor_type: "mega_descriptor"  # backbone label (metadata only)
```
```yaml
onnx_extractor_path: "weights/mega_descriptor.onnx"
```
```yaml
engine_extractor_path: "weights/mega_descriptor.engine"
```

- [ ] **Step 5: 전체 테스트 그린 확인**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건

---

## Task 5: 문서 및 부수 파일 정리

**Files:**
- Modify: `README.md` (`:10`, `:34`, `:71`, `:87`, `:175`, `:177`)
- Modify: `baselines/training/model_train.py`

**Interfaces:**
- Consumes: 없음 / Produces: 없음 (문서 전용)

- [ ] **Step 1: README의 이원화 서술 정리**

수정 대상 6곳과 변경 방향:

| 위치 | 현재 | 변경 |
|---|---|---|
| `:10` | "`BVRA/MegaDescriptor`(Swin-L) 및 `Wildlife-Tools` 등의 동물 전용 Foundation Model을 연동하여" | "`BVRA/MegaDescriptor`(Swin-L) 동물 전용 Foundation Model을 연동하여" (Wildlife-Tools는 학습 라이브러리이므로 추출기 나열에서 제외) |
| `:34` | `I[특징 추출기: MegaDescriptor / Wildlife]` | `I[특징 추출기: MegaDescriptor]` |
| `:71` | `# Wildlife / MegaDescriptor 임베딩 추출 모델 어댑터` | `# MegaDescriptor 임베딩 추출 모델 어댑터` |
| `:87` | `구체적인 객체(Faiss vs KNN, MegaDescriptor vs Wildlife) 생성을` | `구체적인 객체(Faiss vs KNN, 검출기/추출기 백본) 생성을` |
| `:175` | `weights/wildlife_tools_train_fine_07.pth` | `weights/mega_descriptor.pth` |
| `:177` | `extractor_type` 행 — 설명 `"wildlife 또는 mega_descriptor"` | 설명을 "백본 종류 라벨 (ONNX 메타데이터 기록용, 동작 분기 없음)"으로, 기본값을 `"mega_descriptor"`로 |

- [ ] **Step 2: `baselines/training/model_train.py`에서 레거시 키 제거**

`config` 딕셔너리에서 아래 한 줄을 삭제한다:

```python
        'extractor_type'    : 'wildlife',
```

- [ ] **Step 3: 문서 변경이 코드에 영향 없음 확인**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건

---

## Task 6: 최종 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 실행**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건. 수집 개수가 착수 시점(59개)과 다르면 그 차이를 설명할 수 있어야 한다 — 이번 작업에서 추가한 테스트 3건과 `test_wildlife.py` 흡수분이 전부여야 한다.

- [ ] **Step 2: 기존 DB 조회 동작 확인**

Run: `.venv/bin/reid list`
Expected: `config.yaml`이 가리키는 DB(`embeddings/cream_test_hc_01.db`)의 라벨 5개(chuchu, lulu, momo, titi, white)가 적합도 배지와 함께 출력된다. 오류 없이 종료.

- [ ] **Step 3: 기존 1536차원 DB로 추론 동작 확인**

`datasets/cream_heroes/` 아래 임의의 이미지 1장 경로를 골라 실행한다:

```bash
.venv/bin/reid predict source=<이미지경로> show=False
```

Expected: 차원 불일치 `ValueError` 없이 완료. `ReIdPredictor.__init__`이 추출기 출력 차원과 DB 차원(1536)을 비교하므로, 여기서 통과하면 통합 후에도 기존 자산이 호환된다는 증거가 된다.

- [ ] **Step 4: 변경 요약 보고**

```bash
git status --short
git diff --stat
```

변경 파일 목록과 각 변경의 목적을 정리해 보고한다. **커밋하지 않는다** — 사용자가 코드를 확인한 뒤 요청하면 그때 논리 단위로 나누어 커밋한다 (`dev/workflow.md` §0.3).

---

## 완료 기준

- [ ] `reid/models/extractor/wildlife/`가 존재하지 않는다
- [ ] `reid/` 및 `tests/` 내 `wildlife` 문자열이 `wildlife_tools` 라이브러리 임포트 1건만 남는다
- [ ] `MegaDesExtractorModel.cfg`가 생성자에 전달된 인스턴스와 동일하다
- [ ] `MegaDesExtractorModel.embedding_size`가 백본 실제 출력 차원과 일치한다
- [ ] `build_extractor()`가 `extractor_type` 값과 무관하게 `MegaDesExtractorModel`을 반환한다
- [ ] 전체 테스트 그린
- [ ] 기존 체크포인트·DB로 `reid list` / `reid predict`가 동작한다
- [ ] 커밋하지 않은 상태로 변경 요약을 보고했다
