# 학습 파이프라인 재구축 구현 계획

> **실행 방식:** `superpowers:executing-plans`로 태스크 단위 순차 실행. 각 단계는 체크박스(`- [ ]`)로 추적한다.
> **커밋:** `dev/workflow.md` §0.3에 따라 **태스크마다 커밋하지 않는다.** 전체 완료 후 변경 요약을 보고하고, 요청을 받으면 논리 단위로 순차 커밋한다.
> **코드 상세도 정책:** 테스트는 **전부 실행 가능한 코드**로 적는다(테스트가 계약을 정의하므로). 구현은 비자명한 로직(지표 계산, holdout 선정, 샘플러, 학습 루프)은 전문을 싣고, 기계적인 부분(설정 필드 추가 등)은 정확한 시그니처와 번호 매긴 절차로 적는다.

**Goal:** Colab에서 검증된 학습 기법, 실제 Re-ID 성능 평가 체계, 관측 가능한 로깅을 로컬 `reid train`에 갖추고 더미 데이터셋 스모크 런으로 동작을 확인한다.

**Architecture:** 기존 `BaseTrainer`(Template Method)를 확장하고, 체크포인트·run 관리·지표를 각각 `utils/checkpoint.py`·`utils/run.py`·`core/metrics.py`로 분리한다. `engine/`에는 새 파일을 만들지 않는다. 데이터 계층은 다중 루트·라벨 네임스페이스·open-set 분할·PK 샘플링을 지원하도록 확장한다.

**Tech Stack:** Python 3.10+, PyTorch 2.13, timm, wildlife-tools(`ArcFaceLoss`), numpy, torchvision, pytest 9.1.1

**Spec:** `dev/specs/2026-08-21-training-pipeline.md`

## Global Constraints

- 패키지 경계: `core/`는 도메인 알고리즘(engine을 import하지 않는다), `utils/`는 도메인 무관 보조, `engine/`은 실행 골격.
- **`utils/run.py`는 `Config`를 import하지 않는다** — `core/config.py`가 `reid.utils`를 import하므로 순환이 된다. cfg는 덕 타이핑으로만 다룬다.
- `core/metrics.py`는 numpy만 의존한다. 모델·cfg·파일시스템을 모른다.
- 체크포인트 포맷을 아는 곳은 `utils/checkpoint.py` 하나다. 추론 경로도 이 함수를 쓴다.
- `models/extractor/val.py`는 수정하지 않는다.
- `reid/data/transforms.py`의 기존 `get_transform(imgsz)`는 **유지한다** — `models/extractor/predict.py:17`이 쓰고 있다.
- 기존 63개 테스트는 계속 그린이어야 한다.
- 테스트 명령은 `.venv/bin/python -m pytest`.
- 하이퍼파라미터 기본값: `lr=5e-5`, `arcface_margin=0.35`, `arcface_scale=64`, `weight_decay=0.05`, `batch_size=32`, `pk_k=4`, `min_images_per_id=4`, `openset_ratio=0.1`, `openset_known_ratio=0.7`, `patience=5`, `monitor="openset_map"`, `amp_dtype="bf16"`.

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `reid/core/config.py` | 설정 스키마, CLI 파싱 | 확장 |
| `reid/cfg/default.yaml` | 기본 설정 | 확장 |
| `reid/core/metrics.py` | Rank-k, mAP, 유사도 분포, FAR/TAR (순수 함수) | 신규 |
| `reid/utils/checkpoint.py` | 체크포인트 save/load, RNG 상태 | 신규 |
| `reid/utils/run.py` | RunDirectory, metrics.csv, 로그 포맷 순수 함수 | 신규 |
| `reid/data/transforms.py` | train/val transform, 증강 프리셋 | 확장 |
| `reid/data/sampler.py` | PKSampler | 신규 |
| `reid/data/loader.py` | 다중 루트, 네임스페이스, closed/open-set 분할 | 확장 |
| `reid/engine/trainer.py` | 학습 루프 (AMP·accumulation·스케줄러·조기종료·로그) | 확장 |
| `reid/models/extractor/mega_descriptor/model.py` | grad checkpointing 토글, 체크포인트 로더 일원화 | 확장 |
| `reid/models/extractor/mega_descriptor/train.py` | ArcFace·옵티마이저·스케줄러 구성, 검증 | 확장 |
| `tests/dummy_data.py` | 더미 데이터셋 생성 (fixture와 수동 스모크 공유) | 신규 |
| `tests/conftest.py` | fixture | 신규 |

---

## Task 1: config 확장과 리스트 CLI 파싱

**Files:**
- Modify: `reid/core/config.py`, `reid/cfg/default.yaml`
- Test: `tests/test_config.py`

**Interfaces:**
- Produces: `Config`의 신규 필드 19개 + `dataset_path: str | list[str]` 허용. 이후 모든 태스크가 이 필드들을 읽는다.

**배경:** `Config.load`의 타입 변환이 `type(default_val)(v)`라서 리스트 기본값에 문자열을 넣으면 문자 단위로 쪼개진다. 실측 확인됨:
```
multi_scale_factors=0.9,1.0,1.1  →  ['0','.','9',',','1','.','0',',','1','.','1']
```

- [ ] **Step 1: 그린 베이스라인 확인**

Run: `.venv/bin/python -m pytest -q`
Expected: `63 passed`. 실패가 있으면 중단하고 보고한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/test_config.py` 끝에 추가:

```python
def test_cli_list_parsing_splits_on_comma():
    """리스트 기본값 필드에 콤마 문자열을 주면 원소 타입으로 변환되어야 한다."""
    cfg = Config.load(yaml_path=None, args=["multi_scale_factors=0.9,1.0,1.1"])
    assert cfg.multi_scale_factors == [0.9, 1.0, 1.1]


def test_dataset_path_accepts_comma_separated_roots():
    cfg = Config.load(yaml_path=None, args=["dataset_path=datasets/a,datasets/b"])
    assert cfg.dataset_path == ["datasets/a", "datasets/b"]


def test_dataset_path_single_stays_string():
    cfg = Config.load(yaml_path=None, args=["dataset_path=datasets/a"])
    assert cfg.dataset_path == "datasets/a"


def test_training_defaults():
    cfg = Config()
    assert cfg.batch_size == 32
    assert cfg.lr == 5e-5
    assert cfg.weight_decay == 0.05
    assert cfg.arcface_margin == 0.35
    assert cfg.arcface_scale == 64.0
    assert cfg.amp is True and cfg.amp_dtype == "bf16"
    assert cfg.accumulation_steps == 1
    assert cfg.grad_checkpointing is True
    assert cfg.scheduler == "onecycle" and cfg.warmup_pct == 0.1
    assert cfg.patience == 5 and cfg.monitor == "openset_map"
    assert cfg.num_workers == 4
    assert cfg.resume == "" and cfg.reset_head is False
    assert cfg.min_images_per_id == 4 and cfg.pk_k == 4
    assert cfg.augment == "medium"
    assert cfg.openset_ratio == 0.1 and cfg.openset_known_ratio == 0.7
    assert cfg.far_targets == [0.01, 0.001]
    assert cfg.name == "" and cfg.log_interval == 50
    assert cfg.run_root == "results/train"
```

- [ ] **Step 3: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_config.py -v`
Expected: 4건 FAIL — 리스트 파싱 3건은 문자 리스트/단일 문자열 불일치, `test_training_defaults`는 `AttributeError` 또는 `batch_size == 8`.

- [ ] **Step 4: `Config`에 필드 추가**

`reid/core/config.py`의 dataclass에 추가한다. 기존 필드는 유지하고 아래를 배치한다.

```python
    # Train, Val Settings  (기존 블록에 추가)
    batch_size: int = 32                 # 8 → 32
    weight_decay: float = 0.05           # 신규
    arcface_margin: float = 0.35         # 0.5 → 0.35
    accumulation_steps: int = 1
    grad_checkpointing: bool = True
    amp: bool = True
    amp_dtype: str = "bf16"              # "bf16" | "fp16"
    scheduler: str = "onecycle"          # "onecycle" | "cosine" | "none"
    warmup_pct: float = 0.1
    patience: int = 5
    monitor: str = "openset_map"
    num_workers: int = 4
    resume: str = ""
    reset_head: bool = False
    min_images_per_id: int = 4
    pk_k: int = 4
    augment: str = "medium"              # "none" | "light" | "medium" | "strong"
    openset_ratio: float = 0.1
    openset_known_ratio: float = 0.7
    far_targets: List[float] = field(default_factory=lambda: [0.01, 0.001])
    name: str = ""
    log_interval: int = 50
    run_root: str = "results/train"
```

`dataset_path`의 타입 힌트를 `Union[str, List[str]]`로 바꾸되 기본값은 `"datasets/"`를 유지한다.

- [ ] **Step 5: 리스트 CLI 파싱 수정**

`Config.load`의 타입 변환 분기에서 리스트를 먼저 처리한다. 기존 `else: setattr(config, k, type(default_val)(v))` 앞에 넣는다:

```python
                    if isinstance(default_val, bool):
                        setattr(config, k, str(v).lower() in ("true", "1", "yes"))
                    elif isinstance(default_val, list):
                        parts = [s.strip() for s in str(v).split(",") if s.strip()]
                        elem_type = type(default_val[0]) if default_val else str
                        try:
                            setattr(config, k, [elem_type(s) for s in parts])
                        except (ValueError, TypeError):
                            setattr(config, k, parts)
                    elif default_val is None:
```

`dataset_path`는 기본값이 문자열이라 위 분기를 타지 않는다. 콤마가 있을 때만 리스트로 만드는 처리를 `_parse_cli` 뒤에 별도로 둔다:

```python
        # dataset_path: 콤마가 포함되면 다중 루트로 해석
        if isinstance(config.dataset_path, str) and "," in config.dataset_path:
            config.dataset_path = [s.strip() for s in config.dataset_path.split(",") if s.strip()]
```

- [ ] **Step 6: `reid/cfg/default.yaml`에 동일 항목 추가**

`# Train, Val Settings` 블록을 아래로 교체한다.

```yaml
# Train, Val Settings
batch_size: 32
test_size: 0.2
lr: 0.00005
epochs: 5
weight_decay: 0.05
arcface_margin: 0.35
arcface_scale: 64.0
accumulation_steps: 1
grad_checkpointing: True
amp: True
amp_dtype: "bf16"      # "bf16" or "fp16"
scheduler: "onecycle"  # "onecycle", "cosine", or "none"
warmup_pct: 0.1
patience: 5
monitor: "openset_map"
num_workers: 4
resume: ""
reset_head: False
min_images_per_id: 4
pk_k: 4
augment: "medium"      # "none", "light", "medium", or "strong"
openset_ratio: 0.1
openset_known_ratio: 0.7
far_targets: [0.01, 0.001]
name: ""
log_interval: 50
run_root: "results/train"
```

- [ ] **Step 7: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_config.py -v`
Expected: 전부 PASS

- [ ] **Step 8: 전체 그린 확인**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건. `batch_size` 기본값 변경이 다른 테스트에 영향을 주면 여기서 드러난다.

---

## Task 2: `core/metrics.py`

**Files:**
- Create: `reid/core/metrics.py`, `tests/test_metrics.py`

**Interfaces:**
- Consumes: numpy만
- Produces:
  - `leave_one_out_rank1(emb, labels) -> float`
  - `rank_k_accuracy(q_emb, q_labels, g_emb, g_labels, ks=(1,5)) -> dict[int, float]`
  - `mean_average_precision(q_emb, q_labels, g_emb, g_labels) -> float`
  - `similarity_stats(emb, labels) -> dict`
  - `genuine_impostor_scores(q_emb, q_labels, g_emb, g_labels, unknown_mask=None) -> (np.ndarray, np.ndarray)`
  - `threshold_at_far(genuine, impostor, far=0.01) -> (float, float)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_metrics.py`:

```python
import numpy as np
import pytest

from reid.core import metrics


def _ideal(n_ids=4, n_per=3, dim=8):
    """개체별로 완전히 동일한 벡터. 서로 다른 개체는 직교."""
    emb, labels = [], []
    for i in range(n_ids):
        v = np.zeros(dim, dtype=np.float32)
        v[i % dim] = 1.0
        for _ in range(n_per):
            emb.append(v.copy())
            labels.append(f"id{i}")
    return np.stack(emb), np.array(labels)


def test_leave_one_out_rank1_perfect():
    emb, labels = _ideal()
    assert metrics.leave_one_out_rank1(emb, labels) == pytest.approx(1.0)


def test_leave_one_out_excludes_self():
    """자기 자신을 제외하지 않으면 어떤 임베딩이든 1.0이 나온다."""
    rng = np.random.default_rng(0)
    emb = rng.normal(size=(30, 8)).astype(np.float32)
    labels = np.array([f"id{i}" for i in range(30)])   # 전부 서로 다른 개체
    assert metrics.leave_one_out_rank1(emb, labels) == pytest.approx(0.0)


def test_rank_k_accuracy_perfect_and_random():
    emb, labels = _ideal(n_ids=4, n_per=4)
    q, g = emb[::2], emb[1::2]
    ql, gl = labels[::2], labels[1::2]
    res = metrics.rank_k_accuracy(q, ql, g, gl, ks=(1, 5))
    assert res[1] == pytest.approx(1.0)


def test_map_rewards_higher_rank():
    """정답을 1위에 둔 경우가 3위에 둔 경우보다 mAP가 높아야 한다."""
    g = np.eye(4, dtype=np.float32)
    gl = np.array(["a", "b", "c", "d"])
    q_top = np.array([[1.0, 0.0, 0.0, 0.0]], dtype=np.float32)      # a와 최근접
    q_low = np.array([[0.3, 0.9, 0.8, 0.0]], dtype=np.float32)      # a가 3위
    ql = np.array(["a"])
    assert metrics.mean_average_precision(q_top, ql, g, gl) > \
           metrics.mean_average_precision(q_low, ql, g, gl)


def test_similarity_stats_separation_sign():
    emb, labels = _ideal()
    s = metrics.similarity_stats(emb, labels)
    assert s["intra_mean"] > s["inter_mean"]
    assert s["separation"] == pytest.approx(s["intra_mean"] - s["inter_mean"])


def test_threshold_at_far_matches_hand_calculation():
    impostor = np.arange(100, dtype=np.float32)      # 0..99
    genuine = np.full(10, 99.0, dtype=np.float32)
    thr, tar = metrics.threshold_at_far(genuine, impostor, far=0.01)
    assert float(np.mean(impostor >= thr)) <= 0.011   # FAR 1% 이하
    assert tar == pytest.approx(1.0)


def test_genuine_impostor_unknown_only_produces_impostor():
    g = np.eye(3, dtype=np.float32)
    gl = np.array(["a", "b", "c"])
    q = np.eye(3, dtype=np.float32)
    ql = np.array(["a", "b", "z"])                    # z는 갤러리에 없음
    unknown = np.array([False, False, True])
    gen, imp = metrics.genuine_impostor_scores(q, ql, g, gl, unknown)
    assert len(gen) == 2                              # known 2건만 genuine
    assert len(imp) == 3                              # known 오답 2 + unknown 1
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_metrics.py -v`
Expected: 7건 모두 FAIL (`ModuleNotFoundError: reid.core.metrics`)

- [ ] **Step 3: 구현**

`reid/core/metrics.py`:

```python
from typing import Dict, Iterable, Optional, Tuple

import numpy as np


def _l2(emb: np.ndarray) -> np.ndarray:
    emb = np.asarray(emb, dtype=np.float32)
    if emb.ndim == 1:
        emb = emb.reshape(1, -1)
    norms = np.linalg.norm(emb, axis=1, keepdims=True)
    return emb / np.maximum(norms, 1e-12)


def leave_one_out_rank1(emb: np.ndarray, labels: Iterable) -> float:
    """자기 자신을 제외한 최근접 이웃의 라벨이 일치하는 비율."""
    emb = _l2(emb)
    labels = np.asarray(labels)
    if len(labels) < 2:
        return 0.0
    sim = emb @ emb.T
    np.fill_diagonal(sim, -np.inf)
    nn = np.argmax(sim, axis=1)
    return float(np.mean(labels[nn] == labels))


def rank_k_accuracy(q_emb, q_labels, g_emb, g_labels, ks: Tuple[int, ...] = (1, 5)) -> Dict[int, float]:
    q, g = _l2(q_emb), _l2(g_emb)
    q_labels, g_labels = np.asarray(q_labels), np.asarray(g_labels)
    if len(q_labels) == 0 or len(g_labels) == 0:
        return {k: 0.0 for k in ks}
    ranked = g_labels[np.argsort(-(q @ g.T), axis=1)]
    out = {}
    for k in ks:
        kk = min(k, ranked.shape[1])
        out[k] = float(np.mean((ranked[:, :kk] == q_labels[:, None]).any(axis=1)))
    return out


def mean_average_precision(q_emb, q_labels, g_emb, g_labels) -> float:
    q, g = _l2(q_emb), _l2(g_emb)
    q_labels, g_labels = np.asarray(q_labels), np.asarray(g_labels)
    if len(q_labels) == 0 or len(g_labels) == 0:
        return 0.0
    ranked = g_labels[np.argsort(-(q @ g.T), axis=1)]
    aps = []
    for i in range(len(q_labels)):
        rel = (ranked[i] == q_labels[i]).astype(np.float32)
        n_rel = rel.sum()
        if n_rel == 0:
            continue
        prec = np.cumsum(rel) / (np.arange(len(rel)) + 1)
        aps.append(float((prec * rel).sum() / n_rel))
    return float(np.mean(aps)) if aps else 0.0


def similarity_stats(emb: np.ndarray, labels: Iterable) -> Dict[str, float]:
    """intra/inter 클래스 코사인 유사도 분포. core/quality.py의 일관성 점수와 같은 축."""
    emb = _l2(emb)
    labels = np.asarray(labels)
    n = len(labels)
    if n < 2:
        return {"intra_mean": 0.0, "inter_mean": 0.0, "separation": 0.0,
                "intra_p10": 0.0, "inter_p90": 0.0, "n_intra": 0, "n_inter": 0}
    sim = emb @ emb.T
    iu = np.triu_indices(n, k=1)
    same = labels[iu[0]] == labels[iu[1]]
    vals = sim[iu]
    intra, inter = vals[same], vals[~same]
    intra_mean = float(intra.mean()) if len(intra) else 0.0
    inter_mean = float(inter.mean()) if len(inter) else 0.0
    return {
        "intra_mean": intra_mean,
        "inter_mean": inter_mean,
        "separation": intra_mean - inter_mean,
        "intra_p10": float(np.quantile(intra, 0.1)) if len(intra) else 0.0,
        "inter_p90": float(np.quantile(inter, 0.9)) if len(inter) else 0.0,
        "n_intra": int(len(intra)),
        "n_inter": int(len(inter)),
    }


def genuine_impostor_scores(q_emb, q_labels, g_emb, g_labels,
                            unknown_mask: Optional[np.ndarray] = None):
    """genuine = 정답 개체와의 최대 유사도, impostor = 오답 개체 및 미등록 query의 최대 유사도."""
    q, g = _l2(q_emb), _l2(g_emb)
    q_labels, g_labels = np.asarray(q_labels), np.asarray(g_labels)
    sim = q @ g.T
    if unknown_mask is None:
        unknown_mask = np.zeros(len(q_labels), dtype=bool)
    unknown_mask = np.asarray(unknown_mask, dtype=bool)

    genuine, impostor = [], []
    for i in range(len(q_labels)):
        if unknown_mask[i]:
            impostor.append(float(sim[i].max()))
            continue
        same = g_labels == q_labels[i]
        if same.any():
            genuine.append(float(sim[i][same].max()))
        if (~same).any():
            impostor.append(float(sim[i][~same].max()))
    return np.asarray(genuine, dtype=np.float32), np.asarray(impostor, dtype=np.float32)


def threshold_at_far(genuine: np.ndarray, impostor: np.ndarray, far: float = 0.01):
    """목표 FAR을 만족하는 임계값과 그때의 TAR."""
    genuine, impostor = np.asarray(genuine), np.asarray(impostor)
    if len(impostor) == 0:
        return 0.0, 1.0
    thr = float(np.quantile(impostor, 1.0 - far))
    tar = float(np.mean(genuine >= thr)) if len(genuine) else 0.0
    return thr, tar
```

- [ ] **Step 4: 통과 및 전체 그린 확인**

Run: `.venv/bin/python -m pytest tests/test_metrics.py -v && .venv/bin/python -m pytest -q`
Expected: 신규 7건 PASS, 전체 실패 0건

---

## Task 3: `utils/checkpoint.py`

**Files:**
- Create: `reid/utils/checkpoint.py`, `tests/test_checkpoint.py`

**Interfaces:**
- Consumes: torch, numpy
- Produces: `save_checkpoint`, `load_checkpoint`, `get_random_states`, `set_random_states`. Task 7·8이 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_checkpoint.py`:

```python
import numpy as np
import torch
import torch.nn as nn

from reid.utils import checkpoint as ckpt_mod


def _tiny():
    return nn.Linear(4, 3)


def test_roundtrip_preserves_all_keys(tmp_path):
    model, obj = _tiny(), _tiny()
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3)
    sch = torch.optim.lr_scheduler.StepLR(opt, step_size=1)
    path = tmp_path / "ck.pth"

    ckpt_mod.save_checkpoint(path, model=model, objective=obj, optimizer=opt,
                             scheduler=sch, epoch=7,
                             meta={"num_classes": 3, "label_to_idx": {"a": 0}})
    ck = ckpt_mod.load_checkpoint(path)

    for key in ("model", "objective", "optimizer", "scheduler", "epoch", "rng_states", "meta"):
        assert key in ck, key
    assert ck["epoch"] == 7
    assert ck["meta"]["label_to_idx"] == {"a": 0}
    assert ck["format"] == "wrapper"


def test_raw_state_dict_is_normalized(tmp_path):
    """기존 raw state_dict 파일도 {"model": ...} 형태로 정규화되어야 한다."""
    model = _tiny()
    path = tmp_path / "raw.pth"
    torch.save(model.state_dict(), path)

    ck = ckpt_mod.load_checkpoint(path)
    assert ck["format"] == "raw"
    assert set(ck["model"].keys()) == set(model.state_dict().keys())
    assert ck["epoch"] == 0


def test_loaded_state_dict_restores_weights(tmp_path):
    model = _tiny()
    path = tmp_path / "ck.pth"
    ckpt_mod.save_checkpoint(path, model=model, epoch=1, save_rng=False)

    other = _tiny()
    other.load_state_dict(ckpt_mod.load_checkpoint(path)["model"])
    for a, b in zip(model.parameters(), other.parameters()):
        assert torch.allclose(a, b)


def test_rng_roundtrip_reproduces_sequence():
    states = ckpt_mod.get_random_states()
    first = (np.random.rand(3).tolist(), torch.rand(3).tolist())
    ckpt_mod.set_random_states(states)
    second = (np.random.rand(3).tolist(), torch.rand(3).tolist())
    assert first == second


def test_save_rng_false_omits_key(tmp_path):
    path = tmp_path / "ck.pth"
    ckpt_mod.save_checkpoint(path, model=_tiny(), epoch=0, save_rng=False)
    assert "rng_states" not in ckpt_mod.load_checkpoint(path)


def test_optional_components_omitted(tmp_path):
    path = tmp_path / "ck.pth"
    ckpt_mod.save_checkpoint(path, model=_tiny(), epoch=0, save_rng=False)
    ck = ckpt_mod.load_checkpoint(path)
    assert "objective" not in ck and "optimizer" not in ck and "scheduler" not in ck
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_checkpoint.py -v`
Expected: 6건 FAIL (`ModuleNotFoundError`)

- [ ] **Step 3: 구현**

`reid/utils/checkpoint.py`:

```python
import random
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Union

import numpy as np
import torch


def get_random_states() -> Dict[str, Any]:
    states = {
        "random_rng_state": random.getstate(),
        "numpy_rng_state": np.random.get_state(),
        "torch_rng_state": torch.get_rng_state(),
    }
    if torch.cuda.is_available():
        states["torch_cuda_rng_state_all"] = torch.cuda.get_rng_state_all()
    return states


def set_random_states(states: Optional[Dict[str, Any]]) -> None:
    if not states:
        return
    if "random_rng_state" in states:
        random.setstate(states["random_rng_state"])
    if "numpy_rng_state" in states:
        np.random.set_state(states["numpy_rng_state"])
    if "torch_rng_state" in states:
        torch.set_rng_state(states["torch_rng_state"])
    if "torch_cuda_rng_state_all" in states and torch.cuda.is_available():
        torch.cuda.set_rng_state_all(states["torch_cuda_rng_state_all"])


def save_checkpoint(path: Union[str, Path], *, model, objective=None, optimizer=None,
                    scheduler=None, epoch: int = 0, cfg=None,
                    meta: Optional[Dict[str, Any]] = None, save_rng: bool = True) -> None:
    """wildlife_tools.BasicTrainer와 동일한 키 + cfg/meta 로 저장한다."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    ckpt: Dict[str, Any] = {"model": model.state_dict(), "epoch": int(epoch)}
    if objective is not None:
        ckpt["objective"] = objective.state_dict()
    if optimizer is not None:
        ckpt["optimizer"] = optimizer.state_dict()
    if scheduler is not None:
        ckpt["scheduler"] = scheduler.state_dict()
    if cfg is not None:
        ckpt["cfg"] = asdict(cfg) if is_dataclass(cfg) else dict(cfg)
    if meta is not None:
        ckpt["meta"] = dict(meta)
    if save_rng:
        ckpt["rng_states"] = get_random_states()

    torch.save(ckpt, str(path))


def load_checkpoint(path: Union[str, Path], map_location="cpu") -> Dict[str, Any]:
    """래퍼 딕셔너리와 raw state_dict 두 포맷을 읽어 항상 같은 모양으로 반환한다."""
    obj = torch.load(str(path), map_location=map_location, weights_only=False)

    # 래퍼 판별: raw state_dict의 값은 Tensor이므로 obj["model"]이 dict면 래퍼다.
    if isinstance(obj, dict) and isinstance(obj.get("model"), dict):
        obj.setdefault("format", "wrapper")
        obj.setdefault("epoch", 0)
        return obj

    return {"model": obj, "epoch": 0, "format": "raw"}
```

- [ ] **Step 4: 통과 및 전체 그린 확인**

Run: `.venv/bin/python -m pytest tests/test_checkpoint.py -v && .venv/bin/python -m pytest -q`
Expected: 신규 6건 PASS, 전체 실패 0건

---

## Task 4: `utils/run.py`

**Files:**
- Create: `reid/utils/run.py`, `tests/test_run.py`

**Interfaces:**
- Consumes: 표준 라이브러리만. **`Config`를 import하지 않는다** (순환 참조).
- Produces: `RunDirectory`, `format_banner(info: dict)`, `format_epoch_line(m: dict)`, `format_summary(s: dict)`

포맷 함수는 딕셔너리 하나를 받는다. 인자를 20개 나열하면 호출부와 테스트가 모두 취약해진다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_run.py`:

```python
import csv
import json

from reid.utils.run import RunDirectory, format_banner, format_epoch_line, format_summary


def test_creates_directory_and_paths(tmp_path):
    rd = RunDirectory(root=str(tmp_path), name="smoke", timestamp="20260821_120000")
    assert rd.path.is_dir()
    assert rd.path.name == "20260821_120000_smoke"
    assert rd.best_path.name == "best.pth"
    assert rd.last_path.name == "last.pth"
    assert rd.log_path.name == "train.log"


def test_name_optional(tmp_path):
    rd = RunDirectory(root=str(tmp_path), timestamp="20260821_120000")
    assert rd.path.name == "20260821_120000"


def test_log_epoch_writes_header_once_then_appends(tmp_path):
    rd = RunDirectory(root=str(tmp_path), timestamp="t")
    rd.log_epoch({"epoch": 1, "loss": 1.0})
    rd.log_epoch({"epoch": 2, "loss": 0.5})

    with open(rd.path / "metrics.csv") as f:
        rows = list(csv.reader(f))
    assert rows[0] == ["epoch", "loss"]
    assert len(rows) == 3


def test_log_epoch_keeps_columns_stable(tmp_path):
    """첫 행에 없던 키가 뒤에 와도 열이 깨지지 않는다."""
    rd = RunDirectory(root=str(tmp_path), timestamp="t")
    rd.log_epoch({"epoch": 1, "loss": 1.0})
    rd.log_epoch({"epoch": 2})                       # loss 누락
    rd.log_epoch({"epoch": 3, "loss": 0.2, "extra": 9})  # 신규 키

    with open(rd.path / "metrics.csv") as f:
        rows = list(csv.reader(f))
    assert rows[0] == ["epoch", "loss"]
    assert all(len(r) == 2 for r in rows)
    assert rows[2] == ["2", ""]


def test_save_json_roundtrip(tmp_path):
    rd = RunDirectory(root=str(tmp_path), timestamp="t")
    rd.save_json("holdout_labels.json", ["a", "b"])
    assert json.loads((rd.path / "holdout_labels.json").read_text()) == ["a", "b"]


def test_format_banner_shows_effective_batch():
    text = format_banner({"batch_size": 16, "accumulation_steps": 2, "pk_p": 4, "pk_k": 4})
    assert "16" in text and "effective 32" in text


def test_format_epoch_line_contains_both_metrics():
    line = format_epoch_line({"epoch": 3, "epochs": 15, "loss": 3.887, "lr": 4.1e-5,
                              "closed_rank1": 0.784, "openset_map": 0.412,
                              "openset_rank1": 0.521, "is_best": True})
    assert "3/15" in line
    assert "78.4" in line and "41.2" in line
    assert "best" in line.lower()


def test_format_summary_mentions_no_autoapply():
    text = format_summary({"best_epoch": 3, "best_metric": 0.412,
                           "weights": "results/train/x/best.pth",
                           "thresholds": {0.01: (0.71, 0.882)}})
    assert "config.yaml" in text
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_run.py -v`
Expected: 9건 FAIL

- [ ] **Step 3: 구현**

`reid/utils/run.py`. `RunDirectory`는 아래 동작을 갖는다.

1. `__init__(root="results/train", name="", timestamp=None)` — `timestamp`가 없으면 `time.strftime("%Y%m%d_%H%M%S")`. 폴더명은 `name`이 있으면 `<stamp>_<name>`, 없으면 `<stamp>`. `mkdir(parents=True, exist_ok=True)`.
2. `best_path` / `last_path` / `log_path` 프로퍼티 — 각각 `best.pth` / `last.pth` / `train.log`.
3. `save_config(cfg)` — `hasattr(cfg, "save_config")`면 `cfg.save_config(str(self.path / "config.yaml"))`를 호출하고, 아니면 `save_json("config.json", dict(cfg))`. **`Config` 타입을 import하지 않는다.**
4. `log_epoch(row)` — 첫 호출에서 `row.keys()`로 열을 확정하고 헤더를 쓴다. 이후에는 확정된 열만 쓰며 누락은 `""`, 신규 키는 무시한다(`csv.DictWriter(..., extrasaction="ignore")`).
5. `save_json(filename, obj)` — `json.dump(..., ensure_ascii=False, indent=2)`.

포맷 함수 3개는 `info.get(...)`으로 값을 읽어 문자열을 만든다. 필수 동작은 테스트가 정의한다.

- `format_banner(info)` — 아래 라벨들을 각 줄에 낸다. `Batch` 줄은 반드시 `{batch_size} (PK {pk_p}×{pk_k}) × accum {accumulation_steps} = effective {batch_size*accumulation_steps}` 형태를 포함한다.
  ```
  ══ Training run: {run_path} ══
  Model      : {model_name}  (imgsz {imgsz}, embed {embed_dim})
  Params     : {n_params_m:.1f}M total / {n_trainable_m:.1f}M trainable
  Data       : {n_roots} roots, {n_ids} ids, {n_imgs} imgs
               train {n_train} / closed-val {n_val} / open holdout {n_holdout} ids (known {n_known}, unknown {n_unknown})
  Batch      : {batch_size} (PK {pk_p}×{pk_k}) × accum {accumulation_steps} = effective {eff}, workers {num_workers}
  Optim      : AdamW lr {lr} wd {weight_decay} | {scheduler} warmup {warmup_pct:.0%} | ArcFace m={margin} s={scale}
  Runtime    : {device}, AMP {amp_dtype}, grad-checkpointing {on|off}
  Resume     : {resume or "none"}
  Monitor    : {monitor}, patience {patience}
  ```
- `format_epoch_line(m)` — 두 줄을 `\n`으로 잇는다. 백분율 지표는 `×100`하여 소수 1자리로 낸다. `is_best`가 참이면 둘째 줄 끝에 `★ best`를 붙인다.
  ```
  Epoch {epoch:>2}/{epochs}  loss {loss:.3f}  lr {lr:.1e}  {elapsed}  {img_s:.1f} img/s  VRAM {vram:.1f}GB  ETA {eta}
     └ closed R1 {closed_rank1:.1%} | open mAP {openset_map:.1%} R1 {openset_rank1:.1%} R5 {openset_rank5:.1%} | intra {intra_mean:.2f} inter {inter_mean:.2f} sep {separation:.2f}
  ```
- `format_summary(s)` — 소요시간·best epoch·지표·가중치 경로·유사도·임계값을 내고, 마지막 줄에 반드시 다음 문장을 포함한다:
  `recommended_thresholds.json 참고. config.yaml은 자동 변경하지 않습니다.`

- [ ] **Step 4: 통과 및 전체 그린 확인**

Run: `.venv/bin/python -m pytest tests/test_run.py -v && .venv/bin/python -m pytest -q`
Expected: 신규 9건 PASS, 전체 실패 0건

---

## Task 5: `data/transforms.py` 확장과 `data/sampler.py`

**Files:**
- Modify: `reid/data/transforms.py`
- Create: `reid/data/sampler.py`, `tests/test_data_transforms.py`, `tests/test_sampler.py`

**Interfaces:**
- Produces:
  - `get_train_transform(imgsz, level="medium")`, `get_val_transform(imgsz)`, 기존 `get_transform(imgsz)` 유지
  - `PKSampler(labels, p, k, num_samples=None, seed=0)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_data_transforms.py`:

```python
import numpy as np
import torch
from PIL import Image

from reid.data.transforms import get_train_transform, get_val_transform, get_transform


def _img():
    return Image.fromarray(np.random.default_rng(0).integers(0, 255, (64, 64, 3), dtype=np.uint8))


def test_val_transform_is_deterministic():
    t, im = get_val_transform(32), _img()
    assert torch.allclose(t(im), t(im))


def test_train_transform_is_random():
    torch.manual_seed(0)
    t, im = get_train_transform(32, "medium"), _img()
    assert not torch.allclose(t(im), t(im))


def test_train_none_falls_back_to_val():
    t, im = get_train_transform(32, "none"), _img()
    assert torch.allclose(t(im), get_val_transform(32)(im))


def test_output_shape_matches_imgsz():
    assert get_train_transform(48, "strong")(_img()).shape == (3, 48, 48)
    assert get_val_transform(48)(_img()).shape == (3, 48, 48)


def test_legacy_get_transform_still_exists():
    """models/extractor/predict.py 가 사용 중이다."""
    assert get_transform(32)(_img()).shape == (3, 32, 32)
```

`tests/test_sampler.py`:

```python
import pytest

from reid.data.sampler import PKSampler


def test_batches_contain_p_identities_k_each():
    labels = [i // 10 for i in range(100)]          # 개체 10개 × 10장
    s = PKSampler(labels, p=2, k=4, seed=0)
    idx = list(iter(s))
    assert len(idx) % 8 == 0
    for start in range(0, len(idx), 8):
        batch = idx[start:start + 8]
        ids = [labels[i] for i in batch]
        assert len(set(ids)) == 2
        for lab in set(ids):
            assert ids.count(lab) == 4


def test_identity_with_fewer_than_k_is_padded():
    labels = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2]         # 개체 0은 2장뿐
    s = PKSampler(labels, p=3, k=4, num_samples=12, seed=0)
    batch = list(iter(s))[:12]
    ids = [labels[i] for i in batch]
    assert ids.count(0) == 4                        # 중복 허용으로 채움


def test_length_is_multiple_of_batch():
    labels = [i // 10 for i in range(100)]
    s = PKSampler(labels, p=2, k=4, seed=0)
    assert len(s) == len(list(iter(s)))
    assert len(s) % 8 == 0


def test_rejects_p_larger_than_identity_count():
    with pytest.raises(ValueError):
        PKSampler([0, 0, 1, 1], p=5, k=2)


def test_deterministic_with_same_seed():
    labels = [i // 10 for i in range(100)]
    assert list(iter(PKSampler(labels, 2, 4, seed=7))) == list(iter(PKSampler(labels, 2, 4, seed=7)))
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_data_transforms.py tests/test_sampler.py -v`
Expected: 10건 FAIL

- [ ] **Step 3: `reid/data/transforms.py` 교체**

```python
from torchvision import transforms

_MEAN = (0.485, 0.456, 0.406)
_STD = (0.229, 0.224, 0.225)


def get_val_transform(imgsz=384):
    """검증·추론용. 증강 없음."""
    return transforms.Compose([
        transforms.Resize((imgsz, imgsz)),
        transforms.ToTensor(),
        transforms.Normalize(mean=_MEAN, std=_STD),
    ])


def get_train_transform(imgsz=384, level="medium"):
    """학습용 증강. level: none | light | medium | strong"""
    level = (level or "none").lower()
    if level == "none":
        return get_val_transform(imgsz)

    ops = [transforms.Resize((imgsz, imgsz)), transforms.RandomHorizontalFlip(p=0.5)]
    if level == "light":
        ops += [transforms.ColorJitter(brightness=0.2, contrast=0.2)]
        erasing_p = 0.0
    elif level == "strong":
        ops += [
            transforms.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.2),
            transforms.GaussianBlur(kernel_size=5, sigma=(0.1, 2.0)),
            transforms.RandomAffine(degrees=15, translate=(0.1, 0.1)),
        ]
        erasing_p = 0.5
    else:  # medium
        ops += [
            transforms.ColorJitter(brightness=0.3, contrast=0.3),
            transforms.GaussianBlur(kernel_size=5, sigma=(0.1, 2.0)),
            transforms.RandomAffine(degrees=10, translate=(0.05, 0.05)),
        ]
        erasing_p = 0.25

    ops += [transforms.ToTensor(), transforms.Normalize(mean=_MEAN, std=_STD)]
    if erasing_p > 0:
        ops.append(transforms.RandomErasing(p=erasing_p, scale=(0.02, 0.2)))
    return transforms.Compose(ops)


def get_transform(imgsz=384):
    """하위호환: 추론 경로(models/extractor/predict.py)가 사용한다."""
    return get_val_transform(imgsz)
```

- [ ] **Step 4: `reid/data/sampler.py` 생성**

```python
import random
from collections import defaultdict
from typing import Iterator, List, Optional, Sequence

from torch.utils.data import Sampler


class PKSampler(Sampler):
    """배치마다 P개체 × K장을 뽑는다. K장 미만인 개체는 중복 허용으로 채운다."""

    def __init__(self, labels: Sequence, p: int, k: int,
                 num_samples: Optional[int] = None, seed: int = 0) -> None:
        if p < 1 or k < 1:
            raise ValueError(f"p and k must be >= 1 (got p={p}, k={k})")

        self.labels = list(labels)
        self.p, self.k = int(p), int(k)
        self.batch = self.p * self.k

        self.index_by_label = defaultdict(list)
        for idx, lab in enumerate(self.labels):
            self.index_by_label[lab].append(idx)
        self.label_list = sorted(self.index_by_label.keys())

        if self.p > len(self.label_list):
            raise ValueError(
                f"p={self.p} exceeds the number of identities ({len(self.label_list)})"
            )

        total = len(self.labels) if num_samples is None else int(num_samples)
        self.num_batches = max(1, total // self.batch)
        self.seed = seed

    def __len__(self) -> int:
        return self.num_batches * self.batch

    def __iter__(self) -> Iterator[int]:
        rng = random.Random(self.seed)
        out: List[int] = []
        for _ in range(self.num_batches):
            for lab in rng.sample(self.label_list, self.p):
                pool = self.index_by_label[lab]
                if len(pool) >= self.k:
                    out.extend(rng.sample(pool, self.k))
                else:
                    out.extend(rng.choices(pool, k=self.k))
        return iter(out)
```

- [ ] **Step 5: 통과 및 전체 그린 확인**

Run: `.venv/bin/python -m pytest tests/test_data_transforms.py tests/test_sampler.py -v && .venv/bin/python -m pytest -q`
Expected: 신규 10건 PASS, 전체 실패 0건. 기존 `predict.py`가 `get_transform`을 계속 쓰므로 회귀가 없어야 한다.

---

## Task 6: 더미 데이터셋과 `data/loader.py` 확장

**Files:**
- Create: `tests/dummy_data.py`, `tests/conftest.py`, `tests/test_loader.py`
- Modify: `reid/data/loader.py`

**Interfaces:**
- Produces:
  - `make_dummy_dataset(root, n_ids=10, n_imgs=10, size=64, seed=0) -> Path`
  - `CatDataLoader(dataset_path: str | list, imgsz, min_images_per_id=4, augment="medium")`
    - `.split(openset_ratio, known_ratio, test_size)` — holdout 선정 후 train/val 확정. **이 호출 뒤에만** `label_to_idx`가 확정된다.
    - `.get_loaders(batch_size, pk_k, num_workers) -> (train_loader, val_loader)`
    - `.get_openset_data() -> dict` — gallery/query 항목과 `unknown_mask`
    - `.label_to_idx`, `.holdout_labels`, `.stats` (배너용 카운트)
    - 기존 `.image_paths`, `.labels`, `.get_reid_split()` 유지 (`models/extractor/val.py`가 사용)

**주의:** `label_to_idx`는 **holdout을 제외한 학습 라벨로만** 만든다. num_classes가 학습 개체 수와 일치해야 ArcFace W의 열이 맞는다.

- [ ] **Step 1: 더미 데이터 생성기와 fixture 작성**

`tests/dummy_data.py`:

```python
from pathlib import Path

import cv2
import numpy as np


def make_dummy_dataset(root, n_ids: int = 10, n_imgs: int = 10,
                       size: int = 64, seed: int = 0) -> Path:
    """개체별 고유 패턴 + 이미지별 노이즈로 더미 데이터셋을 만든다.

    전부 같은 이미지를 쓰면 임베딩이 동일해져 loss가 내려가지 않고
    intra/inter 분리도가 무의미해진다.
    """
    rng = np.random.default_rng(seed)
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)

    for i in range(n_ids):
        d = root / f"id_{i:02d}"
        d.mkdir(exist_ok=True)
        base = rng.integers(0, 256, size=(size, size, 3), dtype=np.uint8)
        for j in range(n_imgs):
            noise = rng.integers(-30, 31, size=(size, size, 3))
            img = np.clip(base.astype(int) + noise, 0, 255).astype(np.uint8)
            cv2.imwrite(str(d / f"img_{j:02d}.jpg"), img)
    return root
```

`tests/conftest.py`:

```python
import pytest

from tests.dummy_data import make_dummy_dataset


@pytest.fixture
def dummy_dataset(tmp_path):
    """10개체 × 10장. min_images_per_id=4, PK K=4, openset_ratio=0.3 을 만족한다."""
    return make_dummy_dataset(tmp_path / "dummy", n_ids=10, n_imgs=10, size=64)


@pytest.fixture
def dummy_dataset_pair(tmp_path):
    """폴더명이 겹치는 두 루트. 라벨 네임스페이스 검증용."""
    a = make_dummy_dataset(tmp_path / "ds_a", n_ids=4, n_imgs=6, seed=1)
    b = make_dummy_dataset(tmp_path / "ds_b", n_ids=4, n_imgs=6, seed=2)
    return [str(a), str(b)]
```

`tests/` 를 패키지로 import하려면 저장소 루트가 `sys.path`에 있어야 한다. `pyproject.toml`의 pytest 설정에 `rootdir` 기반 경로가 이미 잡혀 있으므로, 실패하면 `tests/__init__.py`(빈 파일)를 추가한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/test_loader.py`:

```python
from reid.data.loader import CatDataLoader


def test_single_root_keeps_plain_labels(dummy_dataset):
    dl = CatDataLoader(str(dummy_dataset), imgsz=32, min_images_per_id=4)
    assert "id_00" in dl.images_by_label
    assert all("/" not in lab for lab in dl.images_by_label)


def test_multi_root_adds_namespace(dummy_dataset_pair):
    dl = CatDataLoader(dummy_dataset_pair, imgsz=32, min_images_per_id=4)
    labels = set(dl.images_by_label)
    assert "ds_a/id_00" in labels and "ds_b/id_00" in labels
    assert len(labels) == 8          # 폴더명이 겹쳐도 충돌하지 않는다


def test_identity_below_minimum_is_dropped(tmp_path):
    from tests.dummy_data import make_dummy_dataset
    root = make_dummy_dataset(tmp_path / "d", n_ids=3, n_imgs=6)
    # 한 개체만 이미지를 2장으로 줄인다
    victim = sorted((root / "id_02").iterdir())
    for f in victim[2:]:
        f.unlink()

    dl = CatDataLoader(str(root), imgsz=32, min_images_per_id=4)
    assert "id_02" not in dl.images_by_label
    assert len(dl.images_by_label) == 2


def test_holdout_labels_never_appear_in_training(dummy_dataset):
    dl = CatDataLoader(str(dummy_dataset), imgsz=32, min_images_per_id=4)
    dl.split(openset_ratio=0.3, known_ratio=0.7, test_size=0.2)

    train_labels = {lab for _, lab in dl.train_items}
    val_labels = {lab for _, lab in dl.val_items}
    assert train_labels.isdisjoint(dl.holdout_labels)
    assert val_labels.isdisjoint(dl.holdout_labels)
    assert set(dl.label_to_idx) == train_labels


def test_holdout_selection_is_deterministic(dummy_dataset):
    a = CatDataLoader(str(dummy_dataset), imgsz=32, min_images_per_id=4)
    a.split(openset_ratio=0.3, known_ratio=0.7, test_size=0.2)
    b = CatDataLoader(str(dummy_dataset), imgsz=32, min_images_per_id=4)
    b.split(openset_ratio=0.3, known_ratio=0.7, test_size=0.2)
    assert a.holdout_labels == b.holdout_labels


def test_openset_split_has_known_and_unknown(dummy_dataset):
    dl = CatDataLoader(str(dummy_dataset), imgsz=32, min_images_per_id=4)
    dl.split(openset_ratio=0.3, known_ratio=0.7, test_size=0.2)
    data = dl.get_openset_data()

    gallery_labels = {lab for _, lab in data["gallery"]}
    query_labels = {lab for _, lab in data["query"]}
    assert len(gallery_labels) >= 2
    assert query_labels - gallery_labels               # 갤러리에 없는 개체가 존재
    assert len(data["unknown_mask"]) == len(data["query"])
    assert any(data["unknown_mask"]) and not all(data["unknown_mask"])


def test_get_loaders_produces_pk_batches(dummy_dataset):
    dl = CatDataLoader(str(dummy_dataset), imgsz=32, min_images_per_id=4)
    dl.split(openset_ratio=0.3, known_ratio=0.7, test_size=0.2)
    train_loader, val_loader = dl.get_loaders(batch_size=8, pk_k=4, num_workers=0)

    imgs, labels = next(iter(train_loader))
    assert imgs.shape[0] == 8
    counts = {}
    for lab in labels.tolist():
        counts[lab] = counts.get(lab, 0) + 1
    assert sorted(counts.values()) == [4, 4]
    assert len(val_loader.dataset) > 0
```

- [ ] **Step 3: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_loader.py -v`
Expected: 7건 FAIL

- [ ] **Step 4: `CatDataLoader` 재작성**

`CatDataset`은 그대로 두고 `CatDataLoader`만 아래 동작으로 바꾼다.

1. **`__init__(dataset_path, imgsz=384, min_images_per_id=4, augment="medium")`**
   - `self.roots` = `dataset_path`가 문자열이면 `[Path(p)]`, 리스트면 각 원소를 `Path`로.
   - `self.train_transform = get_train_transform(imgsz, augment)`, `self.val_transform = get_val_transform(imgsz)`
   - `self.images_by_label = self._scan()`
   - 하위호환: `self.image_paths` / `self.labels`를 `images_by_label`에서 평탄화해 만든다.
   - `self.label_to_idx = {}` (아직 미확정), `self.holdout_labels = []`

2. **`_scan()`**
   - `use_ns = len(self.roots) > 1`
   - 각 루트의 1단계 하위 디렉터리를 개체로 본다. `p.rglob("*")`로 확장자가 `.jpg/.jpeg/.png`인 파일을 모두 모아 **개체 단위로** 합산한다(현재는 `os.walk`의 디렉터리마다 판정해 세션별로 나뉜 데이터셋을 통째로 스킵한다).
   - `len(images) < self.min_images_per_id`면 건너뛰고 카운트한다. 루프 후 `LOGGER.warning`으로 **요약 한 줄**만 남긴다.
   - 라벨 = `f"{root.name}/{dirname}"` if `use_ns` else `dirname`.
   - 루트가 없으면 `LOGGER.warning` 후 건너뛴다.
   - 반환은 `dict[label, list[path]]` (정렬된 경로).

3. **`split(openset_ratio=0.1, known_ratio=0.7, test_size=0.2)`**
   - `self.holdout_labels = self._select_holdout(openset_ratio)`
   - 학습 라벨 = 전체 − holdout. `self.label_to_idx = {lab: i for i, lab in enumerate(sorted(학습 라벨))}`
   - 학습 라벨마다 이미지를 `test_size` 비율로 train/val로 나눈다(정렬된 경로 기준 결정적 분할, val은 최소 1장). `self.train_items` / `self.val_items`는 `(path, label)` 리스트.
   - holdout을 known/unknown으로 나눈다. 이미지 수 내림차순 정렬 후 앞의 `max(1, round(len*known_ratio))`개가 known.
   - known은 이미지를 절반씩 gallery/query로, unknown은 전부 query로 넣는다. `self.gallery_items`, `self.query_items`, `self.query_unknown_mask`(bool 리스트).
   - `self.stats` 딕셔너리에 배너용 카운트를 채운다: `n_roots, n_ids, n_imgs, n_train, n_val, n_holdout, n_known, n_unknown`.

4. **`_select_holdout(ratio)`** — 계통 추출. 무작위면 이미지가 많은 개체가 통째로 빠지는 사고가 시드 운에 좌우된다.

```python
    def _select_holdout(self, ratio):
        holdout = []
        multi = len(self.roots) > 1
        for root in self.roots:
            prefix = f"{root.name}/" if multi else ""
            labels = [l for l in sorted(self.images_by_label) if l.startswith(prefix)]
            if not labels:
                continue
            # 이미지 수 기준 정렬 후 균등 간격 추출 → 결정적이고 분포 대표성이 있다
            labels.sort(key=lambda l: (len(self.images_by_label[l]), l))
            n = max(1, int(round(len(labels) * ratio)))
            n = min(n, len(labels))
            step = len(labels) / n
            picked = [labels[min(len(labels) - 1, int(i * step + step / 2))] for i in range(n)]
            holdout.extend(dict.fromkeys(picked))
        return sorted(set(holdout))
```

5. **`get_loaders(batch_size, pk_k, num_workers)`**
   - train: `CatDataset(train_items, transform=self.train_transform, label_to_idx=self.label_to_idx)`
   - `PKSampler(train_dataset.targets, p=batch_size // pk_k, k=pk_k, num_samples=len(train_items))`
   - `DataLoader(train_ds, batch_size=batch_size, sampler=sampler, drop_last=True, num_workers=num_workers, pin_memory=True, persistent_workers=num_workers > 0)`
   - `batch_size % pk_k != 0`이면 `LOGGER.warning` 후 `p = max(1, batch_size // pk_k)`로 진행한다.
   - val: 같은 `label_to_idx`, `self.val_transform`, `shuffle=False`, `drop_last=False`.

6. **`get_openset_data()`** — `{"gallery": [...], "query": [...], "unknown_mask": [...]}`. 임베딩 추출은 호출부(trainer)가 한다.

7. **`get_reid_split(test_size=0.5)`** — 기존 시그니처와 동작을 유지한다. `models/extractor/val.py`가 사용한다.

- [ ] **Step 5: 통과 및 전체 그린 확인**

Run: `.venv/bin/python -m pytest tests/test_loader.py -v && .venv/bin/python -m pytest -q`
Expected: 신규 7건 PASS, 전체 실패 0건. 기존 `test_extractor_flow`가 `CatDataLoader`를 간접적으로 쓰므로 여기서 회귀가 드러난다.

> 알려진 한계(수정하지 않음): 이미지가 정확히 4장인 개체는 val이 1장이 되어 closed-set leave-one-out에서 같은 개체 짝이 없어 항상 오답이 된다. 실데이터에서 570개 중 7개(약 1%)라 무시한다.

---

## Task 7: `engine/trainer.py` 학습 루프

**Files:**
- Modify: `reid/engine/trainer.py`
- Create: `tests/test_trainer_loop.py`

**Interfaces:**
- Consumes: `utils.checkpoint`, `utils.run`, `utils.logger.LOGGER`
- Produces: 확장된 `BaseTrainer`. Template Method 훅(`get_model`/`get_dataloader`/`compute_loss`/`validate`/`save_model`/`get_save_path`)은 유지하고 아래를 추가한다.
  - `build_scheduler(optimizer, steps_per_epoch) -> scheduler | None`
  - `train_epoch(epoch) -> float` (평균 loss)
  - `run_dir: RunDirectory`, `start_epoch: int`, `best_metric: float`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_trainer_loop.py`:

```python
import math

import pytest
import torch
import torch.nn as nn

from reid.core.config import Config
from reid.engine.trainer import BaseTrainer


class _CountingTrainer(BaseTrainer):
    """optimizer.step 호출 횟수를 세는 최소 트레이너."""

    def __init__(self, cfg, n_batches=5, loss_values=None):
        super().__init__(cfg)
        self.n_batches = n_batches
        self.loss_values = loss_values
        self.step_calls = 0
        self.validate_calls = 0
        self._metrics = [0.1, 0.2, 0.15, 0.15, 0.15, 0.15, 0.15]

    def get_model(self):
        return nn.Linear(4, 2)

    def get_dataloader(self):
        data = [(torch.randn(2, 4), torch.tensor([0, 1])) for _ in range(self.n_batches)]
        return data, data

    def compute_loss(self, outputs, targets):
        if self.loss_values is not None:
            return torch.tensor(self.loss_values[min(len(self.loss_values) - 1, self.step_calls)],
                                requires_grad=True)
        return outputs.sum() * 0.0 + outputs.pow(2).mean()

    def validate(self):
        m = self._metrics[min(self.validate_calls, len(self._metrics) - 1)]
        self.validate_calls += 1
        return m

    def save_model(self):
        pass

    def get_save_path(self):
        return str(self.run_dir.last_path)

    def _make_optimizer(self):
        opt = torch.optim.SGD(self.model.parameters(), lr=1e-3)
        original = opt.step

        def counted(*a, **kw):
            self.step_calls += 1
            return original(*a, **kw)

        opt.step = counted
        return opt


def _cfg(tmp_path, **over):
    cfg = Config()
    cfg.device = "cpu"
    cfg.amp = False
    cfg.epochs = 1
    cfg.patience = 5
    cfg.scheduler = "none"
    cfg.num_workers = 0
    cfg.run_root = str(tmp_path)
    for k, v in over.items():
        setattr(cfg, k, v)
    return cfg


def test_accumulation_halves_optimizer_steps(tmp_path):
    cfg = _cfg(tmp_path, accumulation_steps=2)
    t = _CountingTrainer(cfg, n_batches=6)
    t.train()
    assert t.step_calls == 3


def test_leftover_batches_are_flushed(tmp_path):
    """배치 5개 / accum 2 → step 3회 (마지막 flush 포함)."""
    cfg = _cfg(tmp_path, accumulation_steps=2)
    t = _CountingTrainer(cfg, n_batches=5)
    t.train()
    assert t.step_calls == 3


def test_onecycle_total_steps_matches_actual(tmp_path):
    """total_steps가 어긋나면 스케줄러가 ValueError를 던진다."""
    cfg = _cfg(tmp_path, scheduler="onecycle", accumulation_steps=2, epochs=2)
    t = _CountingTrainer(cfg, n_batches=5)
    t.train()                                   # 예외 없이 완주해야 한다
    assert t.step_calls == math.ceil(5 / 2) * 2


def test_early_stopping_triggers(tmp_path):
    cfg = _cfg(tmp_path, epochs=10, patience=2)
    t = _CountingTrainer(cfg, n_batches=2)
    t.train()
    assert t.validate_calls < 10                # 조기 종료로 전부 돌지 않는다


def test_nan_loss_is_skipped(tmp_path):
    cfg = _cfg(tmp_path, accumulation_steps=1)
    t = _CountingTrainer(cfg, n_batches=3, loss_values=[float("nan")] * 3)
    t.train()
    assert t.step_calls == 0                    # 전부 스킵


def test_run_directory_artifacts_created(tmp_path):
    cfg = _cfg(tmp_path)
    t = _CountingTrainer(cfg, n_batches=2)
    t.train()
    assert (t.run_dir.path / "metrics.csv").exists()
    assert (t.run_dir.path / "config.yaml").exists()
    assert t.run_dir.last_path.exists()


def test_amp_disabled_path_runs(tmp_path):
    cfg = _cfg(tmp_path, amp=False)
    _CountingTrainer(cfg, n_batches=2).train()
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_trainer_loop.py -v`
Expected: 7건 FAIL — `_make_optimizer` 훅과 `run_dir` 속성이 없다.

- [ ] **Step 3: `BaseTrainer` 확장**

기존 Template Method를 유지하면서 아래를 구현한다.

1. **`setup()`**
   - `self.model = self.get_model().to(self.device)`
   - `self.train_loader, self.val_loader = self.get_dataloader()`
   - `self.optimizer = self._make_optimizer()` — 서브클래스가 오버라이드한다. 기본 구현은 `AdamW(self.model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)`.
   - `self.criterion`은 서브클래스가 `setup()`에서 설정한다(기존 동작 유지).
   - `self.run_dir = RunDirectory(root=getattr(cfg,"run_root","results/train"), name=cfg.name)`
   - `set_logging(verbose=cfg.verbose, log_file=str(self.run_dir.log_path))`
   - `self.run_dir.save_config(self.cfg)`
   - `steps_per_epoch = ceil(len(train_loader) / accumulation_steps)`; `self.scheduler = self.build_scheduler(self.optimizer, steps_per_epoch)`
   - `self.scaler = torch.amp.GradScaler(enabled=cfg.amp and cfg.amp_dtype == "fp16" and "cuda" in str(self.device))`
   - `self.start_epoch, self.best_metric = self._maybe_resume()`
   - `LOGGER.info(format_banner(self._banner_info()))`

2. **`build_scheduler(optimizer, steps_per_epoch)`**
   - `"onecycle"` → `OneCycleLR(optimizer, max_lr=cfg.lr, total_steps=steps_per_epoch * cfg.epochs, pct_start=cfg.warmup_pct)`; `self.total_steps`에 기록한다.
   - `"cosine"` → `CosineAnnealingLR(optimizer, T_max=cfg.epochs, eta_min=cfg.lr * 1e-3)`; 에폭 단위로 step한다(`self.scheduler_per_step = False`).
   - `"none"` → `None`
   - OneCycle은 `self.scheduler_per_step = True`.

3. **`train_epoch(epoch)`**
   - `self.model.train()`, `self.optimizer.zero_grad()`
   - 각 배치에서 `torch.amp.autocast(device_type, dtype=..., enabled=cfg.amp)` 안에서 forward + `compute_loss`
   - `torch.isfinite(loss)`가 거짓이면 `LOGGER.warning` 후 `continue`, 연속 카운터가 20에 도달하면 `RuntimeError`
   - `scaler` 사용 여부에 따라 `(loss / accum).backward()` 또는 `scaler.scale(...).backward()`
   - `(i + 1) % accum == 0`이면 step → `zero_grad` → `scheduler.step()` (per-step인 경우)
   - **루프 종료 후** `(i + 1) % accum != 0`이면 한 번 더 step → `zero_grad` → `scheduler.step()`
   - `log_interval`마다 DEBUG 한 줄: batch idx, loss, lr, grad norm, data 시간, compute 시간, VRAM
   - 평균 loss 반환. **모든 배치가 스킵되어 loss 목록이 비면 `0.0`을 반환한다** (빈 리스트 평균은 예외를 낸다)

4. **`train()`**
   - `self.setup()`
   - `for epoch in range(self.start_epoch, cfg.epochs)`
     - `loss = self.train_epoch(epoch)`
     - per-epoch 스케줄러면 여기서 `scheduler.step()`
     - `metric = self.validate()` — 서브클래스가 dict 또는 float을 반환할 수 있다. dict이면 `cfg.monitor` 키를 꺼내 쓰고 전체를 `metrics.csv`에 기록한다.
     - `save_checkpoint(self.run_dir.last_path, model=self.model, objective=getattr(self, "objective", self.criterion), optimizer=self.optimizer, scheduler=self.scheduler, epoch=epoch, cfg=self.cfg, meta=self._meta())` — `_meta()`는 `label_to_idx`·`num_classes`·`embedding_size`·`model_name`·`best_metric`·`total_steps`를 담는다
     - `metric > self.best_metric`이면 best 갱신 + `save_checkpoint(self.run_dir.best_path, ...)` + patience 리셋, 아니면 patience 증가 후 `>= cfg.patience`면 중단
     - `self.run_dir.log_epoch(row)` / `LOGGER.info(format_epoch_line(row))`
   - 종료 시 `LOGGER.info(format_summary(...))`

5. **`_maybe_resume()`**
   - `cfg.resume`이 비어 있으면 `(0, -inf)`
   - `load_checkpoint(cfg.resume)`로 읽는다.
   - 정체성 필드(`model_name`, `imgsz`) 불일치 → `ValueError`
   - `cfg.reset_head`가 참이면 `model`만 로드하고 `(0, -inf)` 반환
   - 아니면 `meta["label_to_idx"]`를 현재와 대조한다. 다르면 다음 메시지로 `ValueError`:
     - 클래스 수가 다르면: `체크포인트는 {a}개 클래스로 학습되었으나 현재 데이터셋은 {b}개입니다. 백본만 이어받으려면 reset_head=True 를 지정하세요.`
     - 수는 같고 구성이 다르면: `라벨 매핑이 일치하지 않습니다 ... 체크포인트에만 있는 라벨: [...] / 현재에만 있는 라벨: [...]`
   - `objective`/`optimizer`/`scheduler`/`rng_states`를 복원한다. 저장된 `meta["total_steps"]`가 현재 계산값과 다르면 `LOGGER.warning` 후 스케줄러를 재생성한다.
   - `(ckpt["epoch"] + 1, meta.get("best_metric", -inf))` 반환

6. **`_make_optimizer()`** — 기본 구현 제공, 서브클래스가 오버라이드 가능.

> 파일이 300줄을 넘으면 `_maybe_resume`과 검증 부분을 분리한다.

- [ ] **Step 4: 통과 및 전체 그린 확인**

Run: `.venv/bin/python -m pytest tests/test_trainer_loop.py -v && .venv/bin/python -m pytest -q`
Expected: 신규 7건 PASS, 전체 실패 0건

---

## Task 8: `mega_descriptor` 학습 구성 결합

**Files:**
- Modify: `reid/models/extractor/mega_descriptor/model.py`, `reid/models/extractor/mega_descriptor/train.py`
- Test: `tests/test_extractor.py` (기존 회귀 테스트 유지)

**Interfaces:**
- Consumes: Task 1~7의 산출물 전부
- Produces: `MegaDesExtractorTrainer`가 실제 데이터·지표·체크포인트와 연결된 상태

- [ ] **Step 1: `model.py`에 gradient checkpointing과 체크포인트 로더 일원화**

`_load_model`의 가중치 로딩을 `utils.checkpoint.load_checkpoint`로 바꾼다. 래퍼 딕셔너리도 읽을 수 있게 되어 학습 산출물을 바로 추론에 쓸 수 있다.

```python
        if weights and os.path.exists(weights):
            try:
                from reid.utils.checkpoint import load_checkpoint
                ckpt = load_checkpoint(weights, map_location=self.cfg.device)
                self.model.load_state_dict(ckpt["model"])
                LOGGER.info(
                    f"🚀 Extractor loaded: '{Path(weights).name}' "
                    f"(Device: {self.cfg.device}, Dim: {self.embedding_size}, "
                    f"Format: {ckpt.get('format', 'wrapper')})"
                )
            except Exception as e:
                LOGGER.error(f"Failed loading weights from '{weights}': {e}")
```

그리고 `_load_model` 끝에 체크포인팅 토글을 추가한다.

```python
        if getattr(self.cfg, "grad_checkpointing", False):
            if hasattr(self.model, "set_grad_checkpointing"):
                self.model.set_grad_checkpointing(enable=True)
                LOGGER.debug("Gradient checkpointing enabled on backbone.")
            else:
                LOGGER.warning(
                    f"'{self.model_name}' does not support set_grad_checkpointing. Skipped."
                )
```

- [ ] **Step 2: `train.py`의 구성 교체**

1. `get_dataloader()`
   - `CatDataLoader(cfg.dataset_path, imgsz=cfg.imgsz, min_images_per_id=cfg.min_images_per_id, augment=cfg.augment)`
   - `loader.split(cfg.openset_ratio, cfg.openset_known_ratio, cfg.test_size)`
   - `self.data = loader` 로 보관(open-set 평가에서 재사용)
   - `return loader.get_loaders(cfg.batch_size, cfg.pk_k, cfg.num_workers)`

2. `setup()`
   - `super().setup()` 전에 `label_to_idx`가 필요하므로, `get_dataloader()`가 먼저 호출되는 순서를 유지한다.
   - `ArcFaceLoss(num_classes=len(self.data.label_to_idx), embedding_size=self.model_instance.embedding_size, margin=cfg.arcface_margin, scale=cfg.arcface_scale)`
   - `self.objective = self.criterion` (체크포인트 저장 시 이름을 맞추기 위한 별칭)

3. `_make_optimizer()`
   - `AdamW(list(self.model.parameters()) + list(self.criterion.parameters()), lr=cfg.lr, weight_decay=cfg.weight_decay)`

4. `validate()` — **ArcFace W 기반 분류 정확도를 버리고 retrieval 지표로 교체한다.**
   - `self._embed(loader)` 헬퍼로 임베딩을 뽑는다: `model.eval()`, `torch.no_grad()`, autocast, `F.normalize(dim=1)`, numpy 변환
   - closed-set: `val_loader` 임베딩 → `metrics.leave_one_out_rank1`
   - open-set: `data.get_openset_data()`의 gallery/query를 `CatDataset` + `DataLoader`로 만들어 임베딩 추출
     - `metrics.rank_k_accuracy(..., ks=(1,5))`, `metrics.mean_average_precision(...)` — known query만 사용
     - `metrics.similarity_stats(query_emb, query_labels)`
     - `metrics.genuine_impostor_scores(...)` → `metrics.threshold_at_far(...)`를 `cfg.far_targets`마다
   - 반환은 dict:
     ```python
     {"closed_rank1": ..., "openset_rank1": ..., "openset_rank5": ...,
      "openset_map": ..., "intra_mean": ..., "inter_mean": ..., "separation": ...,
      "thr_far1": ..., "tar_at_far1": ...}
     ```
   - 종료 시 `run_dir.save_json("recommended_thresholds.json", {...})`

5. `save_model()` / `get_save_path()` — `BaseTrainer`가 `save_checkpoint`로 처리하므로 **no-op으로 남기거나 run 디렉터리 경로를 반환**한다. `weights/`에 확장자 없는 파일을 만들던 경로를 끊는다.

6. `get_dataloader()` 직후 `run_dir.save_json("holdout_labels.json", self.data.holdout_labels)`

- [ ] **Step 3: 전체 그린 확인**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건. 기존 `test_extractor_flow`가 `trainer.train()`을 호출하므로 여기서 통합 회귀가 드러난다.

---

## Task 9: 파이프라인 배선 테스트와 기존 테스트 정리

**Files:**
- Modify: `tests/test_extractor.py`
- Create: `tests/test_training_integration.py`

**배경:** 현재 `test_extractor_flow`는 저장소 경로(`datasets/mini_dataset`, `weights/`, `embeddings/`)에 파일을 만들고 전역 `get_config()` 싱글턴을 변경한다. fixture 기반으로 옮기며 정리한다.

- [ ] **Step 1: 통합 테스트 작성**

`tests/test_training_integration.py`:

```python
import pytest

from reid.core.config import Config

TINY_MODEL = "hf-hub:BVRA/MegaDescriptor-T-224"


def _train_cfg(tmp_path, dataset, **over):
    cfg = Config()
    cfg.model_name = TINY_MODEL
    cfg.dataset_path = str(dataset)
    cfg.db_path = str(tmp_path / "test.db")
    cfg.extractor_weights = str(tmp_path / "missing.pth")
    cfg.device = "cpu"
    cfg.amp = False
    cfg.grad_checkpointing = False
    cfg.epochs = 1
    cfg.batch_size = 8
    cfg.pk_k = 4
    cfg.test_size = 0.2
    cfg.openset_ratio = 0.3
    cfg.num_workers = 0
    cfg.augment = "light"
    cfg.run_root = str(tmp_path / "runs")
    for k, v in over.items():
        setattr(cfg, k, v)
    return cfg


@pytest.mark.slow
def test_one_epoch_produces_run_artifacts(tmp_path, dummy_dataset):
    from reid.container import build_extractor

    cfg = _train_cfg(tmp_path, dummy_dataset)
    model = build_extractor(cfg)
    trainer = model._get_trainer()
    trainer.train()

    run = trainer.run_dir.path
    for f in ("metrics.csv", "config.yaml", "last.pth",
              "holdout_labels.json", "recommended_thresholds.json"):
        assert (run / f).exists(), f

    import csv
    with open(run / "metrics.csv") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == 1
    assert "openset_map" in rows[0] and "closed_rank1" in rows[0]


@pytest.mark.slow
def test_resume_roundtrip(tmp_path, dummy_dataset):
    from reid.container import build_extractor

    cfg = _train_cfg(tmp_path, dummy_dataset, epochs=1)
    trainer = build_extractor(cfg)._get_trainer()
    trainer.train()
    ckpt_path = str(trainer.run_dir.last_path)

    cfg2 = _train_cfg(tmp_path, dummy_dataset, epochs=2, resume=ckpt_path)
    trainer2 = build_extractor(cfg2)._get_trainer()
    trainer2.train()
    assert trainer2.start_epoch == 1


@pytest.mark.slow
def test_resume_with_changed_labels_raises(tmp_path, dummy_dataset):
    import shutil

    from reid.container import build_extractor

    cfg = _train_cfg(tmp_path, dummy_dataset, epochs=1)
    trainer = build_extractor(cfg)._get_trainer()
    trainer.train()
    ckpt_path = str(trainer.run_dir.last_path)

    shutil.rmtree(dummy_dataset / "id_03")          # 개체 하나 제거

    cfg2 = _train_cfg(tmp_path, dummy_dataset, epochs=2, resume=ckpt_path)
    with pytest.raises(ValueError, match="클래스|라벨"):
        build_extractor(cfg2)._get_trainer().train()


@pytest.mark.slow
def test_reset_head_allows_label_change(tmp_path, dummy_dataset):
    import shutil

    from reid.container import build_extractor

    cfg = _train_cfg(tmp_path, dummy_dataset, epochs=1)
    trainer = build_extractor(cfg)._get_trainer()
    trainer.train()
    ckpt_path = str(trainer.run_dir.last_path)

    shutil.rmtree(dummy_dataset / "id_03")

    cfg2 = _train_cfg(tmp_path, dummy_dataset, epochs=1,
                      resume=ckpt_path, reset_head=True)
    t2 = build_extractor(cfg2)._get_trainer()
    t2.train()
    assert t2.start_epoch == 0
```

`pyproject.toml`에 마커를 등록한다:

```toml
[tool.pytest.ini_options]
markers = ["slow: 모델을 내려받아 실제로 학습을 도는 통합 테스트"]
```

- [ ] **Step 2: `test_extractor_flow`를 fixture 기반으로 정리**

`tests/test_extractor.py`의 `test_extractor_flow`에서 저장소 경로 사용과 전역 config 변경을 없앤다.

- `cfg = get_config()` → `cfg = Config()` (전역 싱글턴을 건드리지 않는다)
- `cfg.dataset_path`는 `dummy_dataset` fixture 경로
- `cfg.db_path` / `cfg.extractor_weights`는 `tmp_path` 하위
- 수동 정리 블록(`os.remove` / `shutil.rmtree`) 삭제 — `tmp_path`가 처리한다
- 학습 호출 부분은 `test_training_integration.py`와 중복되므로 제거하고, 이 테스트는 **모델 초기화와 임베딩 추출**만 검증한다

- [ ] **Step 3: 전체 그린 확인**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건

---

## Task 10: 수동 스모크 런과 `dev/train.sh` 정리

**Files:**
- Modify: `dev/train.sh`

- [ ] **Step 1: 전체 테스트**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건. 착수 시 63 → 신규 약 34 추가.

- [ ] **Step 2: 더미 데이터셋 생성과 학습 실행**

```bash
.venv/bin/python -c "from tests.dummy_data import make_dummy_dataset; \
    make_dummy_dataset('datasets/dummy', n_ids=10, n_imgs=10)"

.venv/bin/reid train \
    dataset_path=datasets/dummy \
    model_name=hf-hub:BVRA/MegaDescriptor-T-224 \
    batch_size=8 pk_k=4 epochs=2 test_size=0.2 openset_ratio=0.3 \
    verbose=DEBUG name=smoke
```

**확인 항목**

1. 배너의 데이터 통계가 실제와 맞는가 (ids 10, 분할 수치)
2. 배너의 `Batch` 줄이 `8 (PK 2×4) × accum 1 = effective 8` 인가
3. loss가 내려가는가
4. 에폭 두 줄 로그에 closed R1 / open mAP / intra·inter가 찍히는가
5. run 디렉터리에 산출물 7종이 있는가
6. `metrics.csv` 행 수 = 2, 열이 spec §4.6 스키마와 일치하는가
7. `recommended_thresholds.json`에 FAR 1% / 0.1% 값과 TAR이 있는가
8. DEBUG 로그에 `data` / `compute` 시간이 나오는가

- [ ] **Step 3: 재개 시나리오 3종**

```bash
RUN=results/train/<위에서 만들어진 디렉터리>

# (A) 정상 재개 — epoch 3부터
.venv/bin/reid train dataset_path=datasets/dummy model_name=hf-hub:BVRA/MegaDescriptor-T-224 \
    batch_size=8 pk_k=4 epochs=4 test_size=0.2 openset_ratio=0.3 resume=$RUN/last.pth

# (B) 라벨 구성 변경 후 재개 — 명확한 에러로 중단
mv datasets/dummy/id_03 /tmp/id_03_backup
.venv/bin/reid train dataset_path=datasets/dummy model_name=hf-hub:BVRA/MegaDescriptor-T-224 \
    batch_size=8 pk_k=4 epochs=4 test_size=0.2 openset_ratio=0.3 resume=$RUN/last.pth

# (C) 헤드 리셋 — 백본만 이어받고 진행
.venv/bin/reid train dataset_path=datasets/dummy model_name=hf-hub:BVRA/MegaDescriptor-T-224 \
    batch_size=8 pk_k=4 epochs=1 test_size=0.2 openset_ratio=0.3 \
    resume=$RUN/last.pth reset_head=True

mv /tmp/id_03_backup datasets/dummy/id_03
```

**(B)에서 에러 없이 학습이 시작되면 설계가 실패한 것이다.** 그 경우 중단하고 보고한다.

- [ ] **Step 4: `dev/train.sh` 정리**

`lr=0.005`를 제거하고(기본값 5e-5를 쓴다) 다중 데이터셋 경로로 바꾼다.

```bash
cd /home/eins/project_ws/lumipet-identification-test/ && \
source .venv/bin/activate && \
reid train \
dataset_path=datasets/cat_individuals_dataset,datasets/heellostreetcat-individuals \
epochs=15 \
name=ci-hc
```

`extractor_weights`로 확장자 없는 경로를 지정하던 부분도 제거한다 — 학습 산출물은 이제 run 디렉터리에 저장된다.

- [ ] **Step 5: 변경 요약 보고**

```bash
git status --short
git diff --stat
```

**커밋하지 않는다.** 사용자가 코드를 확인한 뒤 요청하면 논리 단위로 나누어 커밋한다.

---

## 완료 기준

- [ ] 전체 pytest 그린 (기존 63 + 신규 약 34)
- [ ] `reid/core/metrics.py`가 numpy만 import한다 (`grep -n "^from\|^import" reid/core/metrics.py`로 확인)
- [ ] `reid/utils/run.py`가 `Config`를 import하지 않는다
- [ ] 체크포인트에 `objective`(ArcFace W)가 저장되고 재개 시 복원된다
- [ ] 라벨 매핑이 달라지면 재개가 명확한 에러로 중단된다
- [ ] `reset_head=True`로 백본만 이어받을 수 있다
- [ ] `validate()`가 retrieval 지표를 반환하고 ArcFace W 기반 분류 정확도를 쓰지 않는다
- [ ] 수동 스모크 확인 항목 8개 통과
- [ ] 재개 시나리오 (A)(B)(C) 통과
- [ ] `dev/train.sh`에 `lr=0.005`가 없다
- [ ] 커밋하지 않은 상태로 변경 요약을 보고했다
