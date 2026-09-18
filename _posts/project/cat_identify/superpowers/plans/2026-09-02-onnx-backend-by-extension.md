# ONNX 백엔드 확장자 판정 구현 계획

> **에이전트 작업자에게:** 이 계획은 `superpowers:executing-plans`(에이전트가 직접 순차 실행)로 수행한다.
> `dev/workflow.md` §4 가 서브에이전트 병렬 실행을 **사용자 명시 요청 시에만** 허용한다.
> 각 단계는 체크박스(`- [ ]`)로 추적한다.

**Goal:** `use_onnx` / `use_tensorrt` 설정을 없애고 가중치 확장자가 백엔드를 정하게 한다.

**Architecture:** `MegaDesExtractorModel._load_model` 이 확장자를 보고 `_load_torch` / `_load_onnx` 로
갈라지며 `self.backend` 를 남긴다. 예측기는 생성자로 `backend` 와 `session` 을 받아 그것만 보고 분기한다.
ONNX 는 추론 전용이므로 `train()` / `export()` 는 `RuntimeError` 로 거부한다. 반쪽만 구현된 TensorRT
경로는 걷어낸다. 함께 `_load_torch` 가 체크포인트를 덮어쓸 때 사전학습 가중치를 받지 않도록 고친다.

**Tech Stack:** Python 3.12, pytest, timm, onnxruntime, ultralytics

**Spec:** `dev/specs/2026-09-02-onnx-backend-by-extension.md`
**참고:** `dev/notes/2026-09-02-detector-onnx-spike/README.md` (검출기 동등성 실측)

## Global Constraints

- 작업 문서는 `dev/` 하위에만 쓴다. `dev/` 는 gitignore 대상이다.
- **브랜치는 사용자가 만든다.** 제안: `refactor/onnx-backend-by-extension`.
  사용자가 "직접 진행해도 좋다"고 하면 에이전트가 만든다.
- **작업 도중 커밋하지 않는다.** 전체 완료 → 사용자 확인 → 요청 시 단계별 커밋.
- 커밋 메시지는 Conventional Commits. 스코프는 `config`, `extractor`, `detector`, `docs` 등.
- `git push` 하지 않는다.
- 테스트: `.venv/bin/python -m pytest -q`
- 착수 시점 전체 통과를 확인하고 **그때 나온 수집 개수를 기준선으로 삼는다.** 개수를 문서에 적지 않는다.
- **`config.yaml` 은 gitignore 대상 사용자 파일이다.** 에이전트가 고치지 않는다.
  단 `use_onnx` / `use_tensorrt` 키가 남아도 `Config.load` 의 `hasattr` 필터가 조용히 무시하므로
  오류는 나지 않는다. 작업 후 사용자에게 알린다.
- **속도를 판단 기준으로 쓰지 않는다.** 명세 리스크 2-b 대로 이 환경에서 ONNX 는 CPU 로 폴백한다
  (`libcublasLt.so.13` 부재). 느린 것은 이번 변경의 문제가 아니다.

---

## 파일 구조

| 파일 | 책임 | 변경 |
|---|---|---|
| `lumipet/core/config.py` | 중앙 설정 | 필드 2개 · 프로퍼티 3개 삭제 |
| `lumipet/cfg/default.yaml` | 배포 기본 설정 | 키 2줄 삭제 + 주석 수정 |
| `lumipet/models/yolo/model.py` | 검출기 래퍼 | `_get_predictor` 분기 삭제 |
| `lumipet/models/extractor/mega_descriptor/model.py` | 백본 로딩 | `_load_torch` / `_load_onnx` 분리 |
| `lumipet/models/extractor/model.py` | 추출기 공통 | `_get_predictor` 가 backend 전달, `_require_torch` |
| `lumipet/models/extractor/predict.py` | 추출기 예측 | 생성자에 backend·session, `use_onnx` 참조 3곳 제거 |
| `tests/test_extractor_backend.py` | **신설.** 백엔드 판정 테스트 | 생성 |
| `tests/test_config.py` | 설정 테스트 | 삭제된 필드 관련 수정 |
| `tests/test_yolo_predict.py` · `tests/test_tracking.py` | 기존 테스트 | `use_onnx` 참조 제거 |
| `README.md` | 문서 | 설정 표에서 2행 삭제, export 설명 수정 |

---

## Task 1: 그린 베이스라인과 사전 조사

**Files:** 조사만. 변경 없음

**Interfaces:**
- Consumes: 없음
- Produces: 기준선 테스트 개수, `self.model` 참조 위험 지점 목록

- [ ] **Step 1: 브랜치 확인**

```bash
git branch --show-current
```

기대: `refactor/onnx-backend-by-extension`. `main` 이면 **중단하고 사용자에게 요청한다.**

- [ ] **Step 2: 그린 베이스라인**

```bash
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: `N passed` (실패 0건). **이 N 을 기준선으로 기록한다.**

- [ ] **Step 3: ONNX 파일 확인**

```bash
ls -la weights/ci_15.onnx weights/ci_15.onnx.data weights/yolo26n.onnx
```

기대: 셋 다 존재. 없으면 §9.3 수동 검증이 불가하므로 사용자에게 알린다.

- [ ] **Step 4: `self.model` 참조 위험 지점 확인**

ONNX 백엔드에서 `self.model` 이 `None` 이 된다. 무조건 참조하는 곳을 찾는다.

```bash
grep -rn "self\.model\b" --include=*.py lumipet/models/extractor/
```

명세 리스크 3 이 예상한 것: `extractor/model.py` 의 `_get_predictor` 안 `self.model.half()`,
그리고 `mega_descriptor/train.py:69,82,97,102`(트레이너 경로, §7 이 차단).
**예상 밖 항목이 있으면 진행 전에 보고한다.**

---

## Task 2: 설정에서 `use_onnx` · `use_tensorrt` 제거

**Files:**
- Modify: `lumipet/core/config.py:126-127`(필드), `:220-238`(프로퍼티)
- Modify: `lumipet/cfg/default.yaml`
- Test: `tests/test_config.py`, `tests/test_yolo_predict.py`, `tests/test_tracking.py`

**Interfaces:**
- Consumes: 없음
- Produces: `Config` 에서 `use_onnx`·`use_tensorrt`·`onnx_detector`·`engine_detector`·`engine_extractor` 부재.
  `Config.onnx_extractor` 는 유지

- [ ] **Step 1: 실패하는 테스트로 바꾸기**

`tests/test_config.py` 의 `test_config_properties` 를 아래로 교체한다.

```python
def test_removed_acceleration_settings():
    """확장자가 백엔드를 정하므로 가속 플래그와 경로 프로퍼티는 존재하지 않는다."""
    cfg = Config()
    for name in ("use_onnx", "use_tensorrt",
                 "onnx_detector", "engine_detector", "engine_extractor"):
        assert not hasattr(cfg, name), f"{name} 는 삭제 대상이다"


def test_onnx_extractor_property_survives():
    """export() 의 기본 출력 경로로 계속 쓰인다."""
    cfg = Config(extractor_weights="weights/custom_ext.pth")
    assert cfg.onnx_extractor == "weights/custom_ext.onnx"
```

같은 파일의 `test_accelerated_paths_derive_from_weights` 를 아래로 줄인다.

```python
def test_accelerated_paths_derive_from_weights():
    """가속 모델 경로는 별도 설정 없이 가중치 경로의 확장자만 바꿔 얻는다."""
    cfg = Config(extractor_weights="weights/custom_ext.pth")
    assert cfg.onnx_extractor == "weights/custom_ext.onnx"
```

`test_extractor_defaults_are_mega_descriptor` 의 마지막 줄을 바꾼다.

```python
    assert cfg.onnx_extractor == "weights/mega_descriptor.onnx"
```

- [ ] **Step 2: 실패 확인**

```bash
.venv/bin/python -m pytest tests/test_config.py -q
```

기대: `test_removed_acceleration_settings` FAIL — 필드가 아직 있다.

- [ ] **Step 3: `Config` 에서 필드·프로퍼티 삭제**

`lumipet/core/config.py` 의 "추론 가속" 블록에서 두 줄을 지운다.

```python
    # ------------------------------------------------------------------
    # 추론 가속
    # ONNX 백엔드는 가중치 파일의 확장자로 판단한다.
    #   extractor_weights: weights/x.pth  -> PyTorch
    #   extractor_weights: weights/x.onnx -> ONNX (추론 전용)
    # onnx_extractor 는 export() 의 기본 출력 경로다.
    # ------------------------------------------------------------------
    yolo_fp16: bool = False
```

프로퍼티 4개 중 3개를 지우고 `onnx_extractor` 만 남긴다.

```python
    @property
    def onnx_extractor(self) -> str:
        """export() 의 기본 출력 경로. extractor_weights 의 확장자를 .onnx 로 바꾼 것."""
        from lumipet.utils import get_accelerated_model_path
        return get_accelerated_model_path(self.extractor_weights, ".onnx")
```

- [ ] **Step 4: `default.yaml` 에서 두 줄 삭제**

"추론 가속" 블록을 아래로 바꾼다.

```yaml
# =====================================================================
# 추론 가속
# ONNX 백엔드는 가중치 파일의 확장자로 판단한다.
#   extractor_weights: weights/x.pth  -> PyTorch
#   extractor_weights: weights/x.onnx -> ONNX (추론 전용, train/export 불가)
# =====================================================================
yolo_fp16: False
```

- [ ] **Step 5: 다른 테스트의 참조 제거**

`tests/test_yolo_predict.py:8` 과 `:11`:

```python
    cfg = Config(yolo_fp16=True)
```

그리고 `assert getattr(predictor.cfg, "use_onnx", False) is False` 줄을 삭제한다.

`tests/test_tracking.py:443` 의 `assert cfg.use_onnx is False` 와
`assert cfg.use_tensorrt is False` 두 줄을 삭제한다.

- [ ] **Step 6: 통과 확인**

```bash
.venv/bin/python -m pytest tests/test_config.py tests/test_yolo_predict.py tests/test_tracking.py -q
```

기대: PASS. `test_default_yaml_mirrors_config_dataclass` 가 YAML 과 데이터클래스 동기화를 강제하므로
한쪽만 지웠으면 여기서 잡힌다.

---

## Task 3: 검출기 분기 삭제

**Files:**
- Modify: `lumipet/models/yolo/model.py:18-31`

**Interfaces:**
- Consumes: Task 2 의 프로퍼티 삭제
- Produces: 없음

- [ ] **Step 1: 분기 삭제**

`_get_predictor` 를 아래로 바꾼다.

```python
    def _get_predictor(self, **kwargs):
        # 백엔드는 detector_weights 의 확장자가 정한다. YOLO(weights) 가
        # .pt / .onnx / .engine 를 자체 처리하므로 여기서 분기하지 않는다.
        predictor = YoloPredictor(self.cfg)
        predictor.setup_model(self.model)
        return predictor
```

`_load_model` 은 이미 `YOLO(weights)` 한 줄이라 손대지 않는다.

- [ ] **Step 2: 전체 테스트**

```bash
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: 기준선과 동일(Task 2 에서 테스트를 지웠으면 그만큼 줄어든 수).

- [ ] **Step 3: 검출기 ONNX 실물 확인**

spike 로 이미 동등성을 확인했으나(§6.1), 분기 삭제 후에도 되는지 본다.

```bash
.venv/bin/python -c "
from lumipet.core.config import Config
from lumipet.container import build_detector
import cv2, glob
p = sorted(glob.glob('datasets/cat_individuals_dataset/0009/*.JPG'))[0]
for w in ('weights/yolo26n.pt', 'weights/yolo26n.onnx'):
    cfg = Config(detector_weights=w, conf=0.25, iou=0.7, device='cuda', fp16=False, verbose='ERROR')
    n = len(build_detector(cfg).predict(cv2.imread(p)).boxes)
    print(w, '->', n, '개')
"
```

기대: 둘 다 같은 개수.

---

## Task 4: `_load_torch` 분리와 조건부 pretrained

**Files:**
- Modify: `lumipet/models/extractor/mega_descriptor/model.py:30-75`
- Test: `tests/test_extractor_backend.py` (신설)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `MegaDesExtractorModel.backend: str` — `"torch"` | `"onnx"`
  - `MegaDesExtractorModel.session` — `None` | `ort.InferenceSession`
  - `MegaDesExtractorModel._load_torch(weights: str) -> None`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_extractor_backend.py` 를 새로 만든다.

```python
import os
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
import torch
import torch.nn as nn

from lumipet.core.config import Config


TINY = "resnet18"   # timm 내장, 가볍다. HF 다운로드 없이 아키텍처만 만든다.


def _cfg(tmp_path, **kw):
    base = dict(model_name=TINY, imgsz=64, device="cpu", fp16=False,
                grad_checkpointing=False, db_path=str(tmp_path / "t.db"),
                verbose="ERROR")
    base.update(kw)
    return Config(**base)


def _build(cfg):
    from lumipet.models.extractor.mega_descriptor.model import MegaDesExtractorModel
    return MegaDesExtractorModel(cfg=cfg)


def test_backend_is_torch_for_pth(tmp_path):
    m = _build(_cfg(tmp_path, extractor_weights=str(tmp_path / "none.pth")))
    assert m.backend == "torch"
    assert m.model is not None
    assert m.session is None


def test_torch_uses_pretrained_without_checkpoint(tmp_path):
    """가중치가 없으면 사전학습 가중치가 출발점이므로 받아와야 한다."""
    cfg = _cfg(tmp_path, extractor_weights=str(tmp_path / "absent.pth"))
    with patch("timm.create_model", wraps=__import__("timm").create_model) as spy:
        _build(cfg)
    assert spy.call_args.kwargs["pretrained"] is True


def test_torch_skips_pretrained_when_checkpoint_exists(tmp_path):
    """체크포인트로 덮어쓸 것이면 사전학습 가중치를 받아올 이유가 없다."""
    import timm

    ref = timm.create_model(TINY, pretrained=False, num_classes=0)
    ckpt = tmp_path / "w.pth"
    torch.save({"model": ref.state_dict()}, ckpt)

    cfg = _cfg(tmp_path, extractor_weights=str(ckpt))
    with patch("timm.create_model", wraps=timm.create_model) as spy:
        m = _build(cfg)
    assert spy.call_args.kwargs["pretrained"] is False
    # 체크포인트가 실제로 반영됐는지
    a = next(iter(m.model.state_dict().values()))
    b = next(iter(ref.state_dict().values()))
    assert torch.allclose(a, b)


def test_broken_checkpoint_raises(tmp_path):
    """로딩 실패 시 랜덤 가중치로 계속하지 않는다."""
    bad = tmp_path / "bad.pth"
    torch.save({"model": {"nonexistent.weight": torch.zeros(3)}}, bad)
    with pytest.raises(RuntimeError, match="Failed to load extractor weights"):
        _build(_cfg(tmp_path, extractor_weights=str(bad)))
```

- [ ] **Step 2: 실패 확인**

```bash
.venv/bin/python -m pytest tests/test_extractor_backend.py -q
```

기대: FAIL — `backend` 속성이 없고, 깨진 체크포인트는 예외 대신 경고를 낸다.

- [ ] **Step 3: `__init__` 에 기본값 추가**

`mega_descriptor/model.py` 의 `__init__` 에서 `self.embedding_size = 0` 옆에 둘을 더한다.
`_load_model` 이 `super().__init__()` 안에서 불리므로 그 전에 있어야 한다.

```python
        self.embedding_size = 0
        self.backend = "torch"
        self.session = None
        super().__init__(model_path=m_path, model_name=m_name, cfg=cfg_inst)
```

- [ ] **Step 4: `_load_model` 을 분기로 바꾸고 `_load_torch` 를 만든다**

`_load_model` 전체(현 `:30-75`)를 아래로 교체한다.

```python
    def _load_model(self, weights: str) -> None:
        """가중치 확장자가 백엔드를 정한다."""
        if str(weights).lower().endswith(".onnx"):
            self.backend = "onnx"
            self._load_onnx(weights)
        else:
            self.backend = "torch"
            self._load_torch(weights)

    def _load_torch(self, weights: str) -> None:
        """timm 백본을 만들고 체크포인트가 있으면 덮어쓴다."""
        has_ckpt = bool(weights) and os.path.exists(weights)
        # 체크포인트로 덮어쓸 것이면 사전학습 가중치를 받아올 이유가 없다.
        # 실측: pretrained=True 는 1.3초와 피크 메모리 약 1.1GB 를 더 쓴다.
        self.model = timm.create_model(
            self.model_name, pretrained=not has_ckpt, num_classes=0
        )

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

        if has_ckpt:
            try:
                from lumipet.utils.checkpoint import load_checkpoint
                ckpt = load_checkpoint(weights, map_location=self.cfg.device)
                self.model.load_state_dict(ckpt["model"])
                LOGGER.info(
                    f"🚀 Extractor loaded: '{Path(weights).name}' "
                    f"(Device: {self.cfg.device}, Dim: {self.embedding_size}, "
                    f"Format: {ckpt.get('format', 'wrapper')})"
                )
            except Exception as e:
                # 여기서 계속하면 백본이 랜덤 초기화 상태로 남는다.
                # pretrained=False 로 만들었으므로 폴백할 사전학습 가중치가 없다.
                first_line = str(e).strip().splitlines()[0]
                LOGGER.debug(f"Full weight-loading error: {e}")
                raise RuntimeError(
                    f"Failed to load extractor weights from '{Path(weights).name}': {first_line}\n"
                    f"백본이 랜덤 초기화 상태이므로 계속하지 않는다. "
                    f"체크포인트가 model_name='{self.model_name}' 과 맞는지 확인하라. "
                    f"(전체 메시지는 verbose=DEBUG)"
                ) from e

        # Gradient checkpointing: 속도를 약 30% 내주고 활성화 메모리를 크게 아낀다.
        if getattr(self.cfg, "grad_checkpointing", False):
            if hasattr(self.model, "set_grad_checkpointing"):
                self.model.set_grad_checkpointing(enable=True)
                LOGGER.debug("Gradient checkpointing enabled on backbone.")
            else:
                LOGGER.warning(
                    f"'{self.model_name}' does not support set_grad_checkpointing. Skipped."
                )
```

- [ ] **Step 5: 통과 확인**

```bash
.venv/bin/python -m pytest tests/test_extractor_backend.py -q
```

기대: `test_backend_is_torch_for_pth` 등 3개 PASS.
`_load_onnx` 가 아직 없으므로 ONNX 테스트는 다음 태스크에서 추가한다.

---

## Task 5: `_load_onnx` 신설

**Files:**
- Modify: `lumipet/models/extractor/mega_descriptor/model.py`
- Test: `tests/test_extractor_backend.py`

**Interfaces:**
- Consumes: Task 4 의 `backend` / `session`
- Produces: `MegaDesExtractorModel._load_onnx(weights: str) -> None`

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/test_extractor_backend.py` 끝에 더한다.

```python
def _make_onnx(path, dim=8, imgsz=32, meta=True, dynamic_out=False):
    """작은 ONNX 를 즉석에서 만든다. Swin-L export 는 26초라 재사용하지 않는다."""
    import onnx

    class Tiny(nn.Module):
        def __init__(self):
            super().__init__()
            self.f = nn.Linear(3 * imgsz * imgsz, dim)
        def forward(self, x):
            return self.f(x.flatten(1))

    axes = {"input": {0: "batch_size"}}
    axes["output"] = {0: "batch_size", 1: "d"} if dynamic_out else {0: "batch_size"}
    torch.onnx.export(Tiny().eval(), torch.randn(1, 3, imgsz, imgsz), str(path),
                      input_names=["input"], output_names=["output"], dynamic_axes=axes)
    if meta:
        m = onnx.load(str(path))
        while len(m.metadata_props):
            m.metadata_props.pop()
        for k, v in (("imgsz", str(imgsz)), ("model_name", "tiny"),
                     ("extractor_type", "probe"), ("threshold", "0.7")):
            mp = m.metadata_props.add(); mp.key = k; mp.value = v
        onnx.save(m, str(path))
    return path


def test_backend_is_onnx_for_onnx(tmp_path):
    p = _make_onnx(tmp_path / "m.onnx")
    m = _build(_cfg(tmp_path, extractor_weights=str(p)))
    assert m.backend == "onnx"
    assert m.session is not None
    assert m.model is None


def test_onnx_backend_reads_embedding_size(tmp_path):
    p = _make_onnx(tmp_path / "m.onnx", dim=8)
    assert _build(_cfg(tmp_path, extractor_weights=str(p))).embedding_size == 8


def test_onnx_backend_reads_imgsz_from_metadata(tmp_path):
    p = _make_onnx(tmp_path / "m.onnx", imgsz=32, meta=True)
    m = _build(_cfg(tmp_path, extractor_weights=str(p), imgsz=999))
    assert m.cfg.imgsz == 32


def test_onnx_backend_falls_back_to_input_shape_for_imgsz(tmp_path):
    p = _make_onnx(tmp_path / "m.onnx", imgsz=32, meta=False)
    m = _build(_cfg(tmp_path, extractor_weights=str(p), imgsz=999))
    assert m.cfg.imgsz == 32


def test_onnx_backend_infers_embedding_size_by_probe(tmp_path):
    """출력 차원이 동적이면 더미 추론으로 알아낸다."""
    p = _make_onnx(tmp_path / "m.onnx", dim=8, dynamic_out=True)
    assert _build(_cfg(tmp_path, extractor_weights=str(p))).embedding_size == 8


def test_missing_onnx_file_fails_loudly(tmp_path):
    """조용한 pretrained 폴백이 아니라 예외여야 한다."""
    with pytest.raises(RuntimeError, match="ONNX"):
        _build(_cfg(tmp_path, extractor_weights=str(tmp_path / "absent.onnx")))


def test_onnx_backend_raises_when_size_undeterminable(tmp_path):
    """정적 shape 도 더미 추론도 실패하면 예외다 (3단 폴백의 마지막).

    실제로 그런 ONNX 를 만들기는 어려우므로 세션을 가짜로 바꿔 폴백 사슬만 검사한다.
    """
    p = _make_onnx(tmp_path / "m.onnx", dim=8, dynamic_out=True)
    m = _build(_cfg(tmp_path, extractor_weights=str(p)))

    class _Broken:
        def get_outputs(self):
            return [type("O", (), {"shape": ["batch", "d"], "name": "output"})()]
        def get_inputs(self):
            return [type("I", (), {"shape": ["batch", 3, "h", "w"], "name": "input"})()]
        def run(self, *a, **k):
            raise RuntimeError("probe failed")

    m.session = _Broken()
    with pytest.raises(RuntimeError, match="embedding dimension"):
        m._onnx_embedding_size()
```

- [ ] **Step 2: 실패 확인**

```bash
.venv/bin/python -m pytest tests/test_extractor_backend.py -q
```

기대: FAIL — `_load_onnx` 가 없어 `AttributeError`.

- [ ] **Step 3: `_load_onnx` 구현**

`_load_torch` 아래에 더한다.

```python
    def _load_onnx(self, weights: str) -> None:
        """ONNX 세션만 만든다. timm 백본은 만들지 않는다 (추론 전용 백엔드).

        큰 모델은 가중치가 '<name>.onnx.data' 사이드카로 분리된다. ORT 가 인접
        파일에서 자동으로 찾으므로 경로는 .onnx 만 주면 되지만, 사이드카가 없으면
        세션 생성이 실패한다.
        """
        self.model = None
        if not weights or not os.path.exists(weights):
            raise RuntimeError(
                f"ONNX backend requires an existing file, but '{weights}' was not found."
            )

        try:
            import onnxruntime as ort
        except ImportError as e:
            raise RuntimeError(
                "ONNX backend requires onnxruntime, which is not installed."
            ) from e

        providers = (["CUDAExecutionProvider", "CPUExecutionProvider"]
                     if "cuda" in str(self.cfg.device) else ["CPUExecutionProvider"])
        try:
            self.session = ort.InferenceSession(str(weights), providers=providers)
        except Exception as e:
            raise RuntimeError(
                f"Failed to create an ONNX session from '{Path(weights).name}': {e}\n"
                f"큰 모델은 '{Path(weights).name}.data' 사이드카가 함께 있어야 한다."
            ) from e

        self.embedding_size = self._onnx_embedding_size()
        imgsz = self._onnx_imgsz()
        if imgsz is not None and imgsz != self.cfg.imgsz:
            LOGGER.info(f"Adjusting configuration imgsz from {self.cfg.imgsz} to {imgsz} to match the ONNX model.")
            self.cfg.imgsz = imgsz

        LOGGER.info(
            f"⚡ Extractor ONNX loaded: '{Path(weights).name}' "
            f"(Provider: {self.session.get_providers()[0]}, Dim: {self.embedding_size})"
        )

    def _onnx_embedding_size(self) -> int:
        """출력 shape -> 더미 추론 -> 예외 순으로 임베딩 차원을 구한다."""
        out = self.session.get_outputs()[0]
        if len(out.shape) > 1 and isinstance(out.shape[1], int):
            return int(out.shape[1])

        # 차원이 동적이면 실제로 한 번 돌려 본다. 실측 0.3초(CPU, Swin-L).
        inp = self.session.get_inputs()[0]
        side = inp.shape[2] if isinstance(inp.shape[2], int) else self.cfg.imgsz
        try:
            probe = np.zeros((1, 3, side, side), dtype=np.float32)
            result = self.session.run(None, {inp.name: probe})[0]
            return int(result.shape[1])
        except Exception as e:
            raise RuntimeError(
                f"Could not determine the embedding dimension of the ONNX model: {e}"
            ) from e

    def _onnx_imgsz(self):
        """메타데이터 -> 입력 shape -> None(cfg.imgsz 유지) 순으로 입력 크기를 구한다."""
        meta = self.session.get_modelmeta().custom_metadata_map or {}
        raw = meta.get("imgsz")
        if raw is not None:
            try:
                return int(raw)
            except (TypeError, ValueError):
                pass
        side = self.session.get_inputs()[0].shape[2]
        return int(side) if isinstance(side, int) else None
```

`mega_descriptor/model.py` 상단 import 에 `numpy` 를 더한다.

```python
import numpy as np
```

- [ ] **Step 4: 통과 확인**

```bash
.venv/bin/python -m pytest tests/test_extractor_backend.py -q
```

기대: 10개 PASS.

---

## Task 6: 예측기 정리

**Files:**
- Modify: `lumipet/models/extractor/predict.py:15-30`, `:48`, `:52-66`
- Modify: `lumipet/models/extractor/model.py:52-59`
- Test: `tests/test_extractor_backend.py`

**Interfaces:**
- Consumes: Task 4·5 의 `backend` / `session`
- Produces: `ExtractorPredictor(config=None, backend="torch", session=None, embedding_size=None)`

> **Task 1 조사에서 추가된 항목.** `predict_batch` 의 빈 리스트 경로(`predict.py:107-131`)가
> `dim = 512` 를 하드코딩하고, 그 폴백을 `self.model` 로 dummy forward 해 고친다. ONNX 백엔드에서는
> `self.model` 이 `None` 이라 **512 가 그대로 반환된다**(실제는 1536). 터지지는 않지만 틀린 차원이다.
> 모델이 이미 `embedding_size` 를 아니 예측기에 넘기면 하드코딩과 dummy forward 가 함께 사라진다.

- [ ] **Step 1: 실패하는 테스트 추가**

```python
def test_predictor_receives_backend_and_session(tmp_path):
    p = _make_onnx(tmp_path / "m.onnx", dim=8, imgsz=32)
    m = _build(_cfg(tmp_path, extractor_weights=str(p)))
    pred = m._get_predictor()
    assert pred.backend == "onnx"
    assert pred.session is m.session


def test_onnx_predict_returns_normalized_embedding(tmp_path):
    p = _make_onnx(tmp_path / "m.onnx", dim=8, imgsz=32)
    m = _build(_cfg(tmp_path, extractor_weights=str(p)))
    emb = m.predict(np.zeros((40, 40, 3), dtype=np.uint8))
    emb = np.asarray(emb).ravel()
    assert emb.shape == (8,)
    assert abs(float(np.linalg.norm(emb)) - 1.0) < 1e-4


def test_empty_batch_uses_model_embedding_size(tmp_path):
    """빈 배치에서도 하드코딩 512 가 아니라 모델의 실제 차원을 쓴다."""
    p = _make_onnx(tmp_path / "m.onnx", dim=8, imgsz=32)
    m = _build(_cfg(tmp_path, extractor_weights=str(p)))
    out = m.predict_batch([])
    assert out.shape == (0, 8)


def test_predictor_has_no_use_onnx_reference():
    """설정 플래그가 아니라 backend 로 분기해야 한다."""
    src = (Path(__file__).parent.parent / "lumipet" / "models" / "extractor" / "predict.py").read_text()
    assert "use_onnx" not in src
```

- [ ] **Step 2: 실패 확인**

```bash
.venv/bin/python -m pytest tests/test_extractor_backend.py -q
```

기대: FAIL — `pred.backend` 가 없다.

- [ ] **Step 3: `ExtractorPredictor` 수정**

생성자를 바꾸고 `setup_model` 의 세션 생성 블록을 지운다.

```python
    def __init__(self, config: Optional[Any] = None, backend: str = "torch",
                 session: Any = None, embedding_size: Optional[int] = None) -> None:
        super().__init__(config)
        self.transform = get_transform(self.cfg.imgsz)
        # 모델이 이미 아는 값이다. 빈 배치에서 하드코딩 512 로 되돌아가지 않게 미리 받아둔다.
        self._embedding_dim = embedding_size
        self.backend = backend
        self.session = session
```

`predict_batch` 의 빈 리스트 경로에서 `dim = 512` 하드코딩과 dummy forward 블록을 지운다.
`_embedding_dim` 이 생성자에서 채워지므로 도달하지 않는다.

```python
    def predict_batch(self, im_list: list) -> np.ndarray:
        """Predict on a batch of images."""
        if not im_list:
            # 차원을 모르면 빈 배열의 shape 을 정할 수 없다. 모델이 알려준 값을 쓴다.
            if self._embedding_dim is None:
                raise RuntimeError(
                    "Cannot build an empty batch result without knowing the embedding "
                    "dimension. The predictor was created without embedding_size."
                )
            return np.empty((0, self._embedding_dim), dtype=np.float32)

        im_prepped = self.preprocess_batch(im_list)
        preds = self.inference(im_prepped)
        self._embedding_dim = preds.shape[1]
        return self.postprocess_batch(preds)
```

`setup_model` 오버라이드는 이제 할 일이 없으므로 **메서드 전체를 삭제**한다
(`BasePredictor.setup_model` 이 그대로 쓰인다).

`preprocess` 의 fp16 줄(`:48`)을 바꾼다.

```python
        # ONNX 세션은 float32 를 받으므로 torch 백엔드에서만 half 로 내린다.
        if self.backend == "torch" and getattr(self.cfg, "fp16", False) and "cuda" in str(self.device):
            im_tensor = im_tensor.half()
```

`inference` 의 분기(`:52-66`)를 바꾼다.

```python
    def inference(self, im: torch.Tensor) -> torch.Tensor:
        if self.backend == "onnx":
            # Dynamically match input data type from ONNX model to prevent type mismatch crashes
            inp = self.session.get_inputs()[0]
            if inp.type == 'tensor(float16)':
                im_np = im.to(torch.float16).cpu().numpy()
            else:
                im_np = im.to(torch.float32).cpu().numpy()
            output_name = self.session.get_outputs()[0].name
            outputs = self.session.run([output_name], {inp.name: im_np})
            features = torch.tensor(outputs[0], device=self.device)
            return F.normalize(features, p=2, dim=1)

        with torch.no_grad():
            features = self.model(im)
            embedding = F.normalize(features, p=2, dim=1)
        return embedding
```

`Path` import 는 `preprocess` 가 계속 쓰므로 남긴다.

- [ ] **Step 4: `ExtractorModel._get_predictor` 수정**

`lumipet/models/extractor/model.py` 의 `_get_predictor` 를 바꾼다.
**`self.model.half()` 를 `backend` 로 감싸지 않으면 ONNX 백엔드에서 `None.half()` 로 터진다.**

```python
    def _get_predictor(self) -> ExtractorPredictor:
        """Return the shared predictor class."""
        if (getattr(self, "backend", "torch") == "torch"
                and getattr(self.cfg, "fp16", False) and "cuda" in str(self.cfg.device)):
            if hasattr(self.model, "half"):
                self.model.half()
        predictor = ExtractorPredictor(
            self.cfg,
            backend=getattr(self, "backend", "torch"),
            session=getattr(self, "session", None),
            embedding_size=getattr(self, "embedding_size", None) or None,
        )
        predictor.setup_model(self.model)   # onnx 백엔드에서는 None
        return predictor
```

- [ ] **Step 5: 통과 확인**

```bash
.venv/bin/python -m pytest tests/test_extractor_backend.py -q
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: 전부 PASS.

---

## Task 7: `train()` / `export()` 거부

**Files:**
- Modify: `lumipet/models/extractor/model.py`
- Test: `tests/test_extractor_backend.py`

**Interfaces:**
- Consumes: Task 4 의 `backend`
- Produces: `ExtractorModel._require_torch(op: str) -> None`

- [ ] **Step 1: 실패하는 테스트 추가**

```python
def test_train_rejects_onnx_backend(tmp_path):
    p = _make_onnx(tmp_path / "m.onnx")
    m = _build(_cfg(tmp_path, extractor_weights=str(p)))
    with pytest.raises(RuntimeError, match=r"\.pth"):
        m.train()


def test_export_rejects_onnx_backend(tmp_path):
    p = _make_onnx(tmp_path / "m.onnx")
    m = _build(_cfg(tmp_path, extractor_weights=str(p)))
    with pytest.raises(RuntimeError, match=r"\.pth"):
        m.export()
```

- [ ] **Step 2: 실패 확인**

```bash
.venv/bin/python -m pytest tests/test_extractor_backend.py -k rejects -q
```

기대: FAIL — 거부하지 않고 다른 예외가 나거나 진행한다.

- [ ] **Step 3: `_require_torch` 와 오버라이드 추가**

`ExtractorModel` 에 더한다.

```python
    def _require_torch(self, op: str) -> None:
        """ONNX 백엔드는 추론 전용이다."""
        if getattr(self, "backend", "torch") != "torch":
            raise RuntimeError(
                f"'{op}' requires a PyTorch checkpoint, but extractor_weights is "
                f"'{self.model_path}' (ONNX backend, inference only). "
                f"Set extractor_weights to a .pth file."
            )

    def train(self):
        self._require_torch("train")
        return super().train()
```

기존 `export` 의 첫 줄에 넣는다.

```python
    def export(self, output_path: Optional[str] = None) -> str:
        """Export the extractor model to ONNX format."""
        self._require_torch("export")
        if self.predictor is None:
            self.predictor = self._get_predictor()
        return self.predictor.export(output_path)
```

`val()` 은 추론만 하므로 **막지 않는다.**

- [ ] **Step 4: 통과 확인**

```bash
.venv/bin/python -m pytest tests/test_extractor_backend.py -q
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: 전부 PASS.

---

## Task 8: 문서와 수동 검증

**Files:**
- Modify: `README.md:159`, `:270-271`

**Interfaces:**
- Consumes: 앞선 전부
- Produces: 없음

- [ ] **Step 1: README 설정 표 수정**

`use_onnx` · `use_tensorrt` 두 행을 지우고 한 행을 넣는다.

```markdown
| **extractor_weights** | `"weights/mega_descriptor.pth"` | 확장자가 백엔드를 정한다. `.pth`=PyTorch, `.onnx`=ONNX(추론 전용, train/export 불가) |
```

- [ ] **Step 2: export 설명에서 TensorRT 제거**

`README.md:159` 를 바꾼다.

```markdown
현재 특징 추출기 백본 모델을 ONNX Runtime에서 구동 가능한 최적화 파일 포맷으로 내보냅니다.
```

- [ ] **Step 3: 남은 참조 확인**

```bash
grep -n -i "use_onnx\|use_tensorrt\|tensorrt" README.md lumipet/cfg/default.yaml
grep -rn "use_onnx\|use_tensorrt" --include=*.py lumipet/ tests/
```

기대: 출력 없음.

- [ ] **Step 4: 수동 검증 — 이번 작업의 실질적 성공 기준**

```bash
lumipet list    extractor_weights=weights/ci_15.onnx
lumipet train   extractor_weights=weights/ci_15.onnx    # RuntimeError 로 거부
lumipet export  extractor_weights=weights/ci_15.onnx    # RuntimeError 로 거부
lumipet predict extractor_weights=weights/ci_15.onnx \
                detector_weights=weights/yolo26n.onnx source=<영상> show=False
```

**속도는 판단 기준으로 쓰지 않는다** — 명세 리스크 2-b 로 ONNX 가 CPU 로 돈다.
확인할 것은 **로딩 · 식별 결과 · 거부 동작**이다.

- [ ] **Step 5: 조건부 pretrained 확인**

체크포인트가 있을 때 HF Hub 경고가 사라져야 한다.

```bash
lumipet list extractor_weights=weights/ci_15.pth 2>&1 | grep -i "hf hub" || echo "HF 경고 없음 (기대)"
```

- [ ] **Step 6: 전체 테스트**

```bash
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

- [ ] **Step 7: Commit (사용자 요청 시)**

```bash
git add lumipet/core/config.py lumipet/cfg/default.yaml lumipet/models/yolo/model.py \
        tests/test_config.py tests/test_yolo_predict.py tests/test_tracking.py
git commit -m "refactor(config): drop use_onnx and use_tensorrt

가중치 파일의 확장자가 이미 백엔드를 말하는데 별도 불리언이 또 있었다.
TensorRT 는 추출기에 구현이 아예 없고(engine_extractor 프로퍼티를 프로덕션
코드에서 아무도 읽지 않았다) 한 번도 실행된 적이 없는데 README 는 지원한다고
문서화하고 있었다.

- Config 에서 use_onnx / use_tensorrt / onnx_detector / engine_detector /
  engine_extractor 삭제. export 기본 출력 경로인 onnx_extractor 만 유지
- 검출기의 가속 분기 삭제. YOLO(weights) 가 .pt/.onnx/.engine 를 자체 처리한다
  (동등성은 dev/notes/2026-09-02-detector-onnx-spike 에서 실측)"

git add lumipet/models/extractor/mega_descriptor/model.py tests/test_extractor_backend.py
git commit -m "feat(extractor): pick the backend from the weights file extension

extractor_weights 가 .onnx 면 ONNX 세션만 만들고 timm 백본은 만들지 않는다.
embedding_size 는 출력 shape -> 더미 추론 순으로, imgsz 는 메타데이터 ->
입력 shape 순으로 구한다. 파일이 없거나 세션 생성이 실패하면 즉시 예외를
던진다 - 조용히 넘어가면 '가속을 켰는데 왜 느리지'로 끝난다.

함께 _load_torch 를 고쳤다. 체크포인트로 덮어쓸 것이면 사전학습 가중치를
받아올 이유가 없다(실측 1.3초, 피크 메모리 약 1.1GB). 대신 로딩 실패 시
폴백할 사전학습 가중치가 없으므로 경고가 아니라 예외로 바꿨다. 두 변경은
분리할 수 없다 - 조건부만 넣으면 실패 시 랜덤 가중치로 조용히 계속된다."

git add lumipet/models/extractor/predict.py lumipet/models/extractor/model.py
git commit -m "refactor(extractor): branch on backend instead of the config flag

예측기가 use_onnx 를 세 곳에서 따로 보던 것을 생성자로 받은 backend 하나로
모았다. 세션 생성도 모델 쪽으로 옮겨 '무엇인지'를 아는 곳과 '어떻게 실행할지'를
정하는 곳을 일치시켰다.

ONNX 백엔드는 추론 전용이므로 train() / export() 는 RuntimeError 로 거부한다.
val() 은 추론만 하므로 허용한다."

git add README.md
git commit -m "docs(readme): describe backend selection by file extension"
```

- [ ] **Step 8: 사용자에게 보고할 것**

- **`config.yaml` 에 `use_onnx` / `use_tensorrt` 가 남아 있다.** gitignore 대상 사용자 파일이라
  고치지 않았다. `Config.load` 의 `hasattr` 필터가 조용히 무시하므로 오류는 나지 않으나 죽은 설정이다.
- 변경 파일 목록과 `git diff --stat`.

---

## 검증 요약

| 항목 | 확인 |
|---|---|
| 설정 삭제 | `Config` 에 `use_onnx`·`use_tensorrt`·프로퍼티 3개 부재 |
| 예측기 | `predict.py` 에 `use_onnx` 문자열 0회 (테스트로 고정) |
| 백엔드 판정 | `.pth`→torch, `.onnx`→onnx. 메타데이터·더미 추론 폴백 동작 |
| 거부 | `train`/`export` 가 ONNX 백엔드에서 `RuntimeError` |
| 조건부 pretrained | 체크포인트 있을 때 `pretrained=False`, HF 경고 없음 |
| 엄격 실패 | 깨진 체크포인트·없는 ONNX 가 예외 |
| 검출기 | `.pt` 와 `.onnx` 검출 개수 동일 |
