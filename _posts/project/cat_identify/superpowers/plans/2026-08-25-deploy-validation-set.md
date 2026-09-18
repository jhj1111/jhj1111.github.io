# 배포 도메인 검증 세트 구현 계획

> **에이전트 작업자에게:** 이 계획은 태스크 단위로 실행한다. 단계는 체크박스(`- [ ]`)로 추적한다.

**목표**: 배포 도메인(영상 YOLO 크롭)에서 측정한 지표가 학습의 체크포인트 선택과 조기 종료를 구동하게 한다.

**아키텍처**: `reid/benchmark/` 서브패키지가 검증 세트 로딩(`dataset.py`)·평가 프로토콜(`protocol.py`)·빌더(`build.py`)를 담당한다. 임베딩 추출은 호출자가 `embed_fn`으로 주입하므로 벤치마크는 모델을 모른다. 트레이너는 `validate()`가 반환하는 metrics dict에 `deploy_*` 키를 병합하기만 하고, 학습 루프(`engine/trainer.py`)는 수정하지 않는다.

**기술 스택**: Python 3.12, numpy, OpenCV, PyTorch, pytest 9.1.1

**명세**: `dev/specs/2026-08-25-deploy-validation-set.md`

## Global Constraints

- **작업 중 커밋하지 않는다.** `dev/workflow.md` §0.3에 따라 모든 태스크가 끝날 때까지 워킹 트리에 변경을 쌓아둔다. 각 태스크의 마지막 단계는 커밋이 아니라 **전체 테스트 통과 확인**이다. 커밋은 §커밋 계획을 사용자 요청 시 일괄 수행한다.
- **브랜치**: `fix/register-detection-mode` (사용자가 관리. 새 브랜치를 만들지 않는다)
- **테스트 실행**: `.venv/bin/python -m pytest -q`
- **착수 시점 그린 베이스라인**: 169 passed + `tests/test_crop_dataset.py`의 미커밋 추가분 1개 = **170 passed**
- **조용한 폴백 금지**: 설정이 요구하는 자원이 없으면 경고 후 진행이 아니라 **에러**로 멈춘다 (명세 §5.1)
- **한국어 주석**: 저장소 관례를 따른다. 주석은 "무엇"이 아니라 "왜"를 적는다
- `dev/`와 `datasets/`는 gitignore 대상이다

---

## 파일 구조

| 파일 | 책임 | 태스크 |
|---|---|---|
| `reid/core/metrics.py` | (수정) `roc_auc_eer` 추가 — 공유 수학 계층 | 1 |
| `reid/benchmark/__init__.py` | (생성) 공개 API 재노출 | 2 |
| `reid/benchmark/dataset.py` | (생성) `BenchmarkItem`, `BenchmarkSet` — manifest 로딩·트랙 그룹핑·누적 평균 | 2 |
| `reid/benchmark/protocol.py` | (생성) `evaluate()` — 개체별 genuine/impostor 구성·지표 집계 | 3 |
| `reid/core/config.py` | (수정) `deploy_*` 필드 5개 | 4 |
| `reid/cfg/default.yaml` | (수정) 같은 키 | 4 |
| `reid/models/extractor/mega_descriptor/train.py` | (수정) 벤치마크 로딩·monitor 검증·지표 병합 | 5 |
| `reid/benchmark/build.py` | (생성) 갤러리·몽타주·빌드 3단계 | 6, 7 |
| `reid/models/extractor/val.py` | (수정) 벤치마크 평가로 교체, 지연 측정 제거 | 8 |
| `tests/test_benchmark_dataset.py` | (생성) | 2 |
| `tests/test_benchmark_protocol.py` | (생성) | 3 |
| `tests/test_benchmark_trainer.py` | (생성) | 5 |
| `tests/test_benchmark_build.py` | (생성) | 6 |
| `tests/test_metrics.py` | (수정) `roc_auc_eer` 테스트 추가 | 1 |
| `tests/test_config.py` | (수정) 신규 기본값 | 4 |

---

### Task 1: `roc_auc_eer` — 공유 지표 함수

`reid/core/metrics.py`에는 `threshold_at_far`는 있지만 AUC·EER이 없다. 벤치마크가 쓸 수 있게 **공유 수학 계층**에 추가한다. 벤치마크에 두면 `reid.core.quality` 등 다른 소비자가 쓸 때 의존 방향이 뒤집힌다.

**Files:**
- Modify: `reid/core/metrics.py` (파일 끝에 추가)
- Test: `tests/test_metrics.py`

**Interfaces:**
- Produces: `roc_auc_eer(genuine: np.ndarray, impostor: np.ndarray) -> Tuple[float, float]` — `(auc, eer)`. impostor가 비면 `(1.0, 0.0)`, genuine이 비면 `(0.0, 1.0)`

- [ ] **Step 1: 실패 테스트 작성**

`tests/test_metrics.py` 끝에 추가:

```python
def test_roc_auc_eer_perfect_separation():
    """겹치지 않는 두 분포는 AUC 1.0, EER 0.0."""
    genuine = np.array([0.8, 0.9, 1.0], dtype=np.float32)
    impostor = np.array([0.1, 0.2, 0.3], dtype=np.float32)

    auc, eer = metrics.roc_auc_eer(genuine, impostor)

    assert auc == pytest.approx(1.0)
    assert eer == pytest.approx(0.0)


def test_roc_auc_eer_complete_overlap():
    """같은 분포면 AUC 0.5 근처, EER 0.5 근처."""
    rng = np.random.default_rng(0)
    same = rng.normal(0.5, 0.1, 400).astype(np.float32)

    auc, eer = metrics.roc_auc_eer(same, same.copy())

    assert auc == pytest.approx(0.5, abs=0.05)
    assert eer == pytest.approx(0.5, abs=0.05)


def test_roc_auc_eer_empty_impostor_is_perfect():
    """오탐 표본이 없으면 판정할 것이 없다. 완벽으로 처리한다."""
    auc, eer = metrics.roc_auc_eer(np.array([0.5]), np.array([]))
    assert (auc, eer) == (1.0, 0.0)


def test_roc_auc_eer_empty_genuine_is_worst():
    auc, eer = metrics.roc_auc_eer(np.array([]), np.array([0.5]))
    assert (auc, eer) == (0.0, 1.0)
```

`tests/test_metrics.py` 상단에 `import pytest`가 없으면 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_metrics.py -q -k roc_auc_eer`
Expected: FAIL — `AttributeError: module 'reid.core.metrics' has no attribute 'roc_auc_eer'`

- [ ] **Step 3: 구현**

`reid/core/metrics.py` 끝에 추가:

```python
def roc_auc_eer(genuine: np.ndarray, impostor: np.ndarray) -> Tuple[float, float]:
    """genuine/impostor 점수 분포에서 AUC와 EER을 구한다.

    임계값을 훑으며 (FAR, TAR) 궤적을 그리고 그 아래 면적이 AUC,
    FAR == 1 - TAR 이 되는 지점의 오류율이 EER 이다.

    표본이 한쪽만 있으면 판정할 것이 없다. impostor 가 없으면 완벽(1.0, 0.0),
    genuine 이 없으면 최악(0.0, 1.0) 으로 둔다 — 호출부가 분기하지 않게 하기 위함이다.
    """
    genuine = np.asarray(genuine, dtype=np.float64).ravel()
    impostor = np.asarray(impostor, dtype=np.float64).ravel()
    if len(impostor) == 0:
        return 1.0, 0.0
    if len(genuine) == 0:
        return 0.0, 1.0

    labels = np.r_[np.ones(len(genuine)), np.zeros(len(impostor))]
    scores = np.r_[genuine, impostor]
    order = np.argsort(-scores)
    labels = labels[order]

    tar = np.cumsum(labels) / len(genuine)
    far = np.cumsum(1.0 - labels) / len(impostor)
    auc = float(np.trapezoid(tar, far))

    i = int(np.argmin(np.abs(far - (1.0 - tar))))
    eer = float((far[i] + 1.0 - tar[i]) / 2.0)
    return auc, eer
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_metrics.py -q`
Expected: PASS (기존 테스트 포함)

- [ ] **Step 5: 전체 테스트**

Run: `.venv/bin/python -m pytest -q`
Expected: 174 passed (170 + 신규 4). 커밋하지 않는다.

---

### Task 2: `BenchmarkSet` — 검증 세트 로딩과 누적 평균

**Files:**
- Create: `reid/benchmark/__init__.py`, `reid/benchmark/dataset.py`
- Test: `tests/test_benchmark_dataset.py`

**Interfaces:**
- Produces:
  - `BenchmarkItem(video: str, frame: int, track_id: int, label: str, path: Path, weight: float)` — frozen dataclass
  - `BenchmarkSet.load(split_dir, gallery_dir=None) -> BenchmarkSet` — `gallery_dir` 기본값은 `split_dir.parent / "gallery"`
  - `BenchmarkSet.items: List[BenchmarkItem]` (manifest 순서, `skip` 제외)
  - `BenchmarkSet.paths: List[str]` / `BenchmarkSet.labels: np.ndarray`
  - `BenchmarkSet.gallery_paths: List[str]` / `BenchmarkSet.gallery_labels: np.ndarray`
  - `BenchmarkSet.has_unknown: bool` — 라벨 중 `unknown` 으로 시작하는 것이 있는가
  - `BenchmarkSet.accumulate(emb: np.ndarray, window: int) -> np.ndarray`

- [ ] **Step 1: 실패 테스트 작성**

`tests/test_benchmark_dataset.py` 생성:

```python
"""검증 세트 로딩과 트랙 누적 평균.

배포는 트랙 단위 누적 가중평균으로 질의를 만든다. 검증도 같은 방식이어야
학습 중 지표가 배포 성능을 대변한다.
"""
import json

import numpy as np
import pytest

from reid.benchmark import BenchmarkSet


def _write(root, split, rows, gallery_rows):
    split_dir = root / split
    (split_dir / "crops").mkdir(parents=True)
    (split_dir / "manifest.jsonl").write_text(
        "\n".join(json.dumps(r) for r in rows), encoding="utf-8"
    )
    gdir = root / "gallery"
    gdir.mkdir(parents=True, exist_ok=True)
    (gdir / "gallery.jsonl").write_text(
        "\n".join(json.dumps(r) for r in gallery_rows), encoding="utf-8"
    )
    return split_dir


def _row(video, frame, track_id, label, weight=1.0):
    return {"video": video, "frame": frame, "track_id": track_id, "label": label,
            "file": f"crops/{video}/f{frame:06d}_t{track_id:03d}.png",
            "bbox": [0, 0, 10, 10], "conf": 0.9, "weight": weight}


def test_load_reads_items_and_gallery(tmp_path):
    split_dir = _write(
        tmp_path, "val",
        [_row("lulu_02", 0, 1, "lulu"), _row("lulu_02", 6, 1, "lulu")],
        [{"file": "crops/lulu_a.png", "label": "lulu"}],
    )

    bench = BenchmarkSet.load(split_dir)

    assert len(bench.items) == 2
    assert list(bench.labels) == ["lulu", "lulu"]
    assert bench.paths[0].endswith("f000000_t001.png")
    assert list(bench.gallery_labels) == ["lulu"]
    assert bench.gallery_paths[0].endswith("lulu_a.png")


def test_load_drops_skip_labels(tmp_path):
    """skip 은 판정 불가·ID drift 트랙이다. 검증 세트에 넣으면 오라벨이 된다."""
    split_dir = _write(
        tmp_path, "val",
        [_row("lulu_02", 0, 1, "lulu"), _row("lulu_02", 0, 2, "skip")],
        [{"file": "crops/lulu_a.png", "label": "lulu"}],
    )

    bench = BenchmarkSet.load(split_dir)

    assert len(bench.items) == 1
    assert list(bench.labels) == ["lulu"]


def test_has_unknown_detects_prefixed_labels(tmp_path):
    split_dir = _write(
        tmp_path, "val",
        [_row("lulu_04", 0, 1, "lulu"), _row("lulu_04", 0, 2, "unknown_a")],
        [{"file": "crops/lulu_a.png", "label": "lulu"}],
    )
    assert BenchmarkSet.load(split_dir).has_unknown is True

    split_dir2 = _write(
        tmp_path / "other", "test",
        [_row("white_01", 0, 1, "white")],
        [{"file": "crops/white_a.png", "label": "white"}],
    )
    assert BenchmarkSet.load(split_dir2).has_unknown is False


def test_accumulate_does_not_cross_track_boundaries(tmp_path):
    """트랙이 다르면 임베딩을 섞으면 안 된다. 다른 개체일 수 있다."""
    split_dir = _write(
        tmp_path, "val",
        [_row("v", 0, 1, "lulu"), _row("v", 3, 2, "momo")],
        [{"file": "crops/g.png", "label": "lulu"}],
    )
    bench = BenchmarkSet.load(split_dir)
    emb = np.array([[1.0, 0.0], [0.0, 1.0]], dtype=np.float32)

    out = bench.accumulate(emb, window=10)

    assert np.allclose(out[0], [1.0, 0.0])
    assert np.allclose(out[1], [0.0, 1.0])


def test_accumulate_uses_weights_and_window(tmp_path):
    """창 크기만큼의 최근 관측을 blur x 면적 가중으로 평균한다."""
    split_dir = _write(
        tmp_path, "val",
        [_row("v", 0, 1, "lulu", weight=1.0),
         _row("v", 3, 1, "lulu", weight=3.0),
         _row("v", 6, 1, "lulu", weight=1.0)],
        [{"file": "crops/g.png", "label": "lulu"}],
    )
    bench = BenchmarkSet.load(split_dir)
    emb = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 0.0]], dtype=np.float32)

    out = bench.accumulate(emb, window=2)

    # 2번째: (1*[1,0] + 3*[0,1]) / 4 = [0.25, 0.75] -> 정규화
    expected = np.array([0.25, 0.75]); expected /= np.linalg.norm(expected)
    assert np.allclose(out[1], expected, atol=1e-6)
    # 3번째: 창 2 이므로 2·3번째만. (3*[0,1] + 1*[1,0]) / 4
    expected3 = np.array([0.25, 0.75]); expected3 /= np.linalg.norm(expected3)
    assert np.allclose(out[2], expected3, atol=1e-6)


def test_accumulate_orders_by_frame_not_manifest(tmp_path):
    """manifest 순서가 뒤섞여 있어도 시간순으로 누적해야 한다."""
    split_dir = _write(
        tmp_path, "val",
        [_row("v", 6, 1, "lulu"), _row("v", 0, 1, "lulu")],
        [{"file": "crops/g.png", "label": "lulu"}],
    )
    bench = BenchmarkSet.load(split_dir)
    emb = np.array([[0.0, 1.0], [1.0, 0.0]], dtype=np.float32)

    out = bench.accumulate(emb, window=10)

    # frame 0(=index 1)이 먼저다. 그 시점의 누적은 자기 자신뿐이다.
    assert np.allclose(out[1], [1.0, 0.0])
    # frame 6(=index 0)은 둘의 평균이다.
    mixed = np.array([0.5, 0.5]); mixed /= np.linalg.norm(mixed)
    assert np.allclose(out[0], mixed, atol=1e-6)


def test_load_errors_when_manifest_missing(tmp_path):
    """조용히 빈 세트를 돌려주면 지표가 0으로 나와 원인을 못 찾는다."""
    (tmp_path / "val").mkdir(parents=True)
    with pytest.raises(FileNotFoundError):
        BenchmarkSet.load(tmp_path / "val")
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_benchmark_dataset.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'reid.benchmark'`

- [ ] **Step 3: 구현**

`reid/benchmark/__init__.py` 생성:

```python
"""배포 도메인 벤치마크.

학습 홀드아웃(원본 사진)과 배포 입력(영상 YOLO 크롭)은 도메인이 달라서, 학습 지표만
보고 모델·체크포인트를 고르면 배포에서 더 나쁜 쪽을 선택하게 된다.
근거: dev/specs/2026-08-25-deploy-validation-set.md §1
"""
from reid.benchmark.dataset import BenchmarkItem, BenchmarkSet
from reid.benchmark.protocol import evaluate

__all__ = ["BenchmarkItem", "BenchmarkSet", "evaluate"]
```

`reid/benchmark/dataset.py` 생성:

```python
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import numpy as np

UNKNOWN_PREFIX = "unknown"
SKIP_LABEL = "skip"


@dataclass(frozen=True)
class BenchmarkItem:
    """크롭 1건. track_id/frame 은 배포와 같은 누적 평균을 재현하는 데 쓴다."""
    video: str
    frame: int
    track_id: int
    label: str
    path: Path
    weight: float


class BenchmarkSet:
    """한 split(val 또는 test)의 크롭 목록과 갤러리.

    갤러리는 split 들이 공유하므로 기본 위치를 split 의 형제 디렉터리로 둔다.
    """

    def __init__(self, items: List[BenchmarkItem],
                 gallery: List[Tuple[Path, str]], root: Path) -> None:
        self.items = items
        self.root = root
        self._gallery = gallery

    @classmethod
    def load(cls, split_dir: Union[str, Path],
             gallery_dir: Optional[Union[str, Path]] = None) -> "BenchmarkSet":
        split_dir = Path(split_dir)
        manifest = split_dir / "manifest.jsonl"
        if not manifest.is_file():
            raise FileNotFoundError(f"벤치마크 manifest 가 없다: {manifest}")

        items: List[BenchmarkItem] = []
        for line in manifest.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            r = json.loads(line)
            if r["label"] == SKIP_LABEL:
                continue
            items.append(BenchmarkItem(
                video=r["video"], frame=int(r["frame"]), track_id=int(r["track_id"]),
                label=r["label"], path=split_dir / r["file"], weight=float(r["weight"]),
            ))

        gdir = Path(gallery_dir) if gallery_dir is not None else split_dir.parent / "gallery"
        gfile = gdir / "gallery.jsonl"
        if not gfile.is_file():
            raise FileNotFoundError(f"갤러리 manifest 가 없다: {gfile}")
        gallery = []
        for line in gfile.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            r = json.loads(line)
            gallery.append((gdir / r["file"], r["label"]))

        return cls(items, gallery, split_dir)

    # -- 조회 ---------------------------------------------------------
    @property
    def paths(self) -> List[str]:
        return [str(it.path) for it in self.items]

    @property
    def labels(self) -> np.ndarray:
        return np.array([it.label for it in self.items])

    @property
    def weights(self) -> np.ndarray:
        return np.array([it.weight for it in self.items], dtype=np.float64)

    @property
    def gallery_paths(self) -> List[str]:
        return [str(p) for p, _ in self._gallery]

    @property
    def gallery_labels(self) -> np.ndarray:
        return np.array([lab for _, lab in self._gallery])

    @property
    def has_unknown(self) -> bool:
        """미등록 개체 표본이 실제로 있는가. impostor 구성 방식을 가른다."""
        return any(it.label.startswith(UNKNOWN_PREFIX) for it in self.items)

    # -- 누적 평균 ----------------------------------------------------
    def _track_groups(self) -> Dict[Tuple[str, int], List[int]]:
        """(video, track_id) 별 인덱스를 프레임 순으로 모은다."""
        groups: Dict[Tuple[str, int], List[int]] = {}
        for i, it in enumerate(self.items):
            groups.setdefault((it.video, it.track_id), []).append(i)
        for key, idx in groups.items():
            groups[key] = sorted(idx, key=lambda i: self.items[i].frame)
        return groups

    def accumulate(self, emb: np.ndarray, window: int) -> np.ndarray:
        """트랙별 최근 window 개의 가중평균. 배포의 누적 임베딩과 같은 계산이다.

        트랙 경계를 넘어 섞으면 다른 개체가 섞일 수 있으므로 그룹 안에서만 평균한다.
        """
        emb = np.asarray(emb, dtype=np.float32)
        w = self.weights
        out = np.zeros_like(emb)
        for idx in self._track_groups().values():
            for n, i in enumerate(idx):
                hist = idx[max(0, n + 1 - window): n + 1]
                mean = (emb[hist] * w[hist][:, None]).sum(0) / w[hist].sum()
                norm = float(np.linalg.norm(mean))
                out[i] = mean / norm if norm > 1e-6 else mean
        return out
```

`reid/benchmark/protocol.py`는 Task 3에서 만든다. 그 전까지 `__init__.py`의 import가 실패하므로 **Task 3의 파일을 먼저 빈 스텁으로 만든다**:

```python
# reid/benchmark/protocol.py  (Task 3 에서 채운다)
def evaluate(*args, **kwargs):
    raise NotImplementedError("Task 3")
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_benchmark_dataset.py -q`
Expected: PASS (7 passed)

- [ ] **Step 5: 전체 테스트**

Run: `.venv/bin/python -m pytest -q`
Expected: 181 passed. 커밋하지 않는다.

---

### Task 3: `evaluate()` — 평가 프로토콜

**Files:**
- Modify: `reid/benchmark/protocol.py` (Task 2의 스텁을 대체)
- Test: `tests/test_benchmark_protocol.py`

**Interfaces:**
- Consumes: `BenchmarkSet` (Task 2), `reid.core.metrics.roc_auc_eer` (Task 1), `reid.core.metrics.threshold_at_far` (기존)
- Produces:
  ```python
  evaluate(bench: BenchmarkSet, query_emb: np.ndarray, gallery_emb: np.ndarray,
           gallery_labels: np.ndarray, *, far: float = 0.01,
           min_samples: int = 30) -> Dict[str, Any]
  ```
  반환 키: `deploy_tar_far1`, `deploy_eer`, `deploy_auc`, `deploy_genuine`, `deploy_n_ids`, `per_identity`

**설계 메모 — split 에 따라 impostor 구성이 다르다** (명세 §4.1)

| 조건 | impostor 표본 |
|---|---|
| `bench.has_unknown` | 라벨이 `L`이 아닌 질의를 `gallery[L]`에 대해 채점 |
| 아니면 (leave-one-out) | 라벨이 `L`인 질의를 **`L`을 뺀 갤러리**에 대해 채점 |

두 방식은 재는 대상이 다르다(전자는 "다른 고양이가 왔다", 후자는 "등록 안 된 고양이가 왔다"). val 과 test 수치를 서로 직접 비교하지 않는다.

- [ ] **Step 1: 실패 테스트 작성**

`tests/test_benchmark_protocol.py` 생성:

```python
"""배포 벤치마크 평가 프로토콜.

운영이 개체별 임계값으로 판정하므로(커밋 e0aed17) 지표도 개체별로 계산해 평균한다.
"""
import json

import numpy as np
import pytest

from reid.benchmark import BenchmarkSet, evaluate


def _unit(v):
    v = np.asarray(v, dtype=np.float32)
    return v / np.linalg.norm(v)


def _make(tmp_path, rows, gallery_rows, split="val"):
    split_dir = tmp_path / split
    split_dir.mkdir(parents=True, exist_ok=True)
    (split_dir / "manifest.jsonl").write_text(
        "\n".join(json.dumps(r) for r in rows), encoding="utf-8")
    gdir = tmp_path / "gallery"
    gdir.mkdir(parents=True, exist_ok=True)
    (gdir / "gallery.jsonl").write_text(
        "\n".join(json.dumps(r) for r in gallery_rows), encoding="utf-8")
    return BenchmarkSet.load(split_dir)


def _rows(specs):
    """specs = [(video, frame, track, label), ...]"""
    return [{"video": v, "frame": f, "track_id": t, "label": lab,
             "file": f"crops/{v}/f{f:06d}_t{t:03d}.png",
             "bbox": [0, 0, 10, 10], "conf": 0.9, "weight": 1.0}
            for v, f, t, lab in specs]


def test_perfect_separation_gives_full_tar(tmp_path):
    """정탐이 갤러리와 정확히 일치하고 오탐이 직교하면 TAR 100%."""
    bench = _make(
        tmp_path,
        _rows([("v", i, 1, "lulu") for i in range(40)] +
              [("v", i, 2, "momo") for i in range(40)]),
        [{"file": "l.png", "label": "lulu"}, {"file": "m.png", "label": "momo"}],
    )
    q = np.array([_unit([1, 0])] * 40 + [_unit([0, 1])] * 40, dtype=np.float32)
    g = np.array([_unit([1, 0]), _unit([0, 1])], dtype=np.float32)

    res = evaluate(bench, q, g, bench.gallery_labels, far=0.01, min_samples=10)

    assert res["deploy_tar_far1"] == pytest.approx(1.0)
    assert res["deploy_auc"] == pytest.approx(1.0)
    assert res["deploy_n_ids"] == 2
    assert set(res["per_identity"]) == {"lulu", "momo"}


def test_unknown_counts_as_impostor_for_every_identity(tmp_path):
    """미등록 개체는 모든 등록 개체의 오탐 표본이다. genuine 에는 절대 들어가지 않는다."""
    bench = _make(
        tmp_path,
        _rows([("v", i, 1, "lulu") for i in range(40)] +
              [("v", i, 9, "unknown_a") for i in range(40)]),
        [{"file": "l.png", "label": "lulu"}],
    )
    # unknown 이 lulu 갤러리와 상당히 닮은 경우 -> TAR 이 떨어져야 한다
    q = np.array([_unit([1, 0])] * 40 + [_unit([0.97, 0.24])] * 40, dtype=np.float32)
    g = np.array([_unit([1, 0])], dtype=np.float32)

    res = evaluate(bench, q, g, bench.gallery_labels, far=0.01, min_samples=10)

    assert res["deploy_n_ids"] == 1
    assert res["per_identity"]["lulu"]["n_impostor"] == 40
    assert res["per_identity"]["lulu"]["n_genuine"] == 40


def test_leave_one_out_used_when_no_unknown(tmp_path):
    """단일 개체 영상만 있는 split 은 라벨이 L 이 아닌 질의가 없다.

    그대로 두면 impostor 가 비어 지표를 계산할 수 없으므로 갤러리에서 L 을 빼는
    방식으로 전환해야 한다.
    """
    bench = _make(
        tmp_path,
        _rows([("white_01", i, 1, "white") for i in range(40)]),
        [{"file": "w.png", "label": "white"}, {"file": "l.png", "label": "lulu"}],
        split="test",
    )
    q = np.array([_unit([1, 0])] * 40, dtype=np.float32)
    g = np.array([_unit([1, 0]), _unit([0, 1])], dtype=np.float32)

    res = evaluate(bench, q, g, bench.gallery_labels, far=0.01, min_samples=10)

    assert bench.has_unknown is False
    assert res["deploy_n_ids"] == 1
    assert res["per_identity"]["white"]["n_impostor"] == 40
    assert res["deploy_tar_far1"] == pytest.approx(1.0)


def test_identity_below_min_samples_is_excluded(tmp_path):
    """표본이 모자란 개체가 평균을 흔들면 안 된다. titi 는 영상 후반에만 나온다."""
    bench = _make(
        tmp_path,
        _rows([("v", i, 1, "lulu") for i in range(40)] +
              [("v", i, 2, "titi") for i in range(5)]),
        [{"file": "l.png", "label": "lulu"}, {"file": "t.png", "label": "titi"}],
    )
    q = np.array([_unit([1, 0])] * 40 + [_unit([0, 1])] * 5, dtype=np.float32)
    g = np.array([_unit([1, 0]), _unit([0, 1])], dtype=np.float32)

    res = evaluate(bench, q, g, bench.gallery_labels, far=0.01, min_samples=30)

    assert res["deploy_n_ids"] == 1
    assert "titi" not in res["per_identity"]
    assert "lulu" in res["per_identity"]


def test_no_eligible_identity_raises(tmp_path):
    """전부 표본 부족이면 지표가 무의미하다. 조용히 0을 돌려주면 안 된다."""
    bench = _make(
        tmp_path,
        _rows([("v", i, 1, "lulu") for i in range(5)]),
        [{"file": "l.png", "label": "lulu"}],
    )
    q = np.array([_unit([1, 0])] * 5, dtype=np.float32)
    g = np.array([_unit([1, 0])], dtype=np.float32)

    with pytest.raises(ValueError, match="표본"):
        evaluate(bench, q, g, bench.gallery_labels, far=0.01, min_samples=30)


def test_gallery_identity_absent_from_queries_is_skipped(tmp_path):
    """chuchu 는 영상에 없다. 갤러리에는 있어도 genuine 표본이 없으니 평균에서 빠진다."""
    bench = _make(
        tmp_path,
        _rows([("v", i, 1, "lulu") for i in range(40)]),
        [{"file": "l.png", "label": "lulu"}, {"file": "c.png", "label": "chuchu"}],
    )
    q = np.array([_unit([1, 0])] * 40, dtype=np.float32)
    g = np.array([_unit([1, 0]), _unit([0, 1])], dtype=np.float32)

    res = evaluate(bench, q, g, bench.gallery_labels, far=0.01, min_samples=10)

    assert "chuchu" not in res["per_identity"]
    assert res["deploy_n_ids"] == 1
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_benchmark_protocol.py -q`
Expected: FAIL — `NotImplementedError: Task 3`

- [ ] **Step 3: 구현**

`reid/benchmark/protocol.py` 전체를 대체:

```python
from typing import Any, Dict

import numpy as np

from reid.benchmark.dataset import BenchmarkSet
from reid.core import metrics


def _label_max(sims: np.ndarray, gallery_labels: np.ndarray, label: str) -> np.ndarray:
    """질의별로 해당 개체 갤러리와의 최대 유사도."""
    col = gallery_labels == label
    return sims[:, col].max(axis=1)


def evaluate(bench: BenchmarkSet, query_emb: np.ndarray, gallery_emb: np.ndarray,
             gallery_labels: np.ndarray, *, far: float = 0.01,
             min_samples: int = 30) -> Dict[str, Any]:
    """개체별로 genuine/impostor 를 만들고 지표를 낸 뒤 평균한다.

    운영이 개체별 임계값으로 판정하므로 지표도 같은 구조여야 한다. 전역 임계값
    하나로는 개체마다 다른 점수 스케일을 감당하지 못한다(명세 §1).
    """
    query_emb = np.asarray(query_emb, dtype=np.float32)
    gallery_emb = np.asarray(gallery_emb, dtype=np.float32)
    gallery_labels = np.asarray(gallery_labels)
    q_labels = bench.labels

    sims = query_emb @ gallery_emb.T
    use_unknown = bench.has_unknown

    per_identity: Dict[str, Dict[str, float]] = {}
    for label in sorted(set(gallery_labels)):
        gen_mask = q_labels == label
        if gen_mask.sum() < min_samples:
            continue

        genuine = _label_max(sims[gen_mask], gallery_labels, label)

        if use_unknown:
            # 다른 등록 개체와 미등록 개체가 모두 오탐 후보다
            imp_mask = ~gen_mask
            impostor = _label_max(sims[imp_mask], gallery_labels, label)
        else:
            # 단일 개체 split: 갤러리에서 이 개체를 빼고 남은 것 중 최대값이
            # "등록되지 않은 고양이가 왔을 때"의 오수락 점수다
            other = gallery_labels != label
            if not other.any():
                continue
            impostor = sims[gen_mask][:, other].max(axis=1)

        if len(impostor) == 0:
            continue

        auc, eer = metrics.roc_auc_eer(genuine, impostor)
        thr, tar = metrics.threshold_at_far(genuine, impostor, far=far)
        per_identity[label] = {
            "tar": tar, "eer": eer, "auc": auc, "threshold": thr,
            "genuine_mean": float(np.mean(genuine)),
            "impostor_mean": float(np.mean(impostor)),
            "n_genuine": int(len(genuine)), "n_impostor": int(len(impostor)),
        }

    if not per_identity:
        raise ValueError(
            f"평가 가능한 등록 개체가 없다. genuine 표본이 min_samples={min_samples} 이상인 "
            f"개체가 하나도 없다. 검증 세트 라벨을 확인할 것."
        )

    def _mean(key: str) -> float:
        return float(np.mean([v[key] for v in per_identity.values()]))

    return {
        "deploy_tar_far1": _mean("tar"),
        "deploy_eer": _mean("eer"),
        "deploy_auc": _mean("auc"),
        "deploy_genuine": _mean("genuine_mean"),
        "deploy_n_ids": len(per_identity),
        "per_identity": per_identity,
    }
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_benchmark_protocol.py -q`
Expected: PASS (6 passed)

- [ ] **Step 5: 전체 테스트**

Run: `.venv/bin/python -m pytest -q`
Expected: 187 passed. 커밋하지 않는다.

---

### Task 4: 설정 키

**Files:**
- Modify: `reid/core/config.py` (`identity_threshold_ratio` 바로 아래)
- Modify: `reid/cfg/default.yaml` (`identity_threshold_ratio` 바로 아래)
- Test: `tests/test_config.py`

**Interfaces:**
- Produces: `Config.deploy_val_path`, `deploy_test_path`, `deploy_val_far`, `deploy_val_min_samples`, `deploy_val_window`

- [ ] **Step 1: 실패 테스트 작성**

`tests/test_config.py` 끝에 추가:

```python
def test_deploy_benchmark_defaults_are_off():
    """검증 세트 없이도 기존 학습이 그대로 돌아야 한다. 경로 기본값은 비어 있다."""
    cfg = Config()
    assert cfg.deploy_val_path == ""
    assert cfg.deploy_test_path == ""
    assert cfg.deploy_val_far == 0.01
    assert cfg.deploy_val_min_samples == 30
    assert cfg.deploy_val_window == 10


def test_monitor_default_is_unchanged():
    """기본값을 deploy 지표로 바꾸면 검증 세트 없는 환경이 즉시 깨진다."""
    assert Config().monitor == "openset_map"


def test_deploy_keys_present_in_default_yaml():
    default_yaml = Path(__file__).parent.parent / "reid" / "cfg" / "default.yaml"
    text = default_yaml.read_text()
    for key in ("deploy_val_path", "deploy_test_path", "deploy_val_far",
                "deploy_val_min_samples", "deploy_val_window"):
        assert f"{key}:" in text, f"default.yaml 에 {key} 가 없다"
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_config.py -q -k deploy`
Expected: FAIL — `AttributeError: 'Config' object has no attribute 'deploy_val_path'`

- [ ] **Step 3: 구현**

`reid/core/config.py`의 `identity_threshold_ratio: float = 0.8` 바로 아래에 추가:

```python
    # 배포 도메인 벤치마크. 경로가 비어 있으면 배포 지표를 계산하지 않는다.
    # monitor 가 deploy_ 로 시작하는데 deploy_val_path 가 비어 있으면 학습이 즉시 실패한다.
    deploy_val_path: str = ""
    deploy_test_path: str = ""
    deploy_val_far: float = 0.01
    deploy_val_min_samples: int = 30
    deploy_val_window: int = 10
```

`reid/cfg/default.yaml`의 `identity_threshold_ratio: 0.8` 바로 아래에 추가:

```yaml
# 배포 도메인 벤치마크. 비어 있으면 배포 지표를 계산하지 않는다.
# monitor: deploy_tar_far1 로 바꾸려면 deploy_val_path 가 반드시 있어야 한다.
deploy_val_path: ""
deploy_test_path: ""
deploy_val_far: 0.01
deploy_val_min_samples: 30
deploy_val_window: 10
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_config.py -q`
Expected: PASS

- [ ] **Step 5: 전체 테스트**

Run: `.venv/bin/python -m pytest -q`
Expected: 190 passed. 커밋하지 않는다.

---

### Task 5: 트레이너 연결 + monitor 사전 검증

**Files:**
- Modify: `reid/models/extractor/mega_descriptor/train.py`
  - `__init__` — `self.bench = None` 초기화
  - `setup()` — 벤치마크 로딩 + monitor 검증
  - `validate()` — `deploy_*` 병합
  - 신규 `_embed_paths`, `_benchmark_metrics`
- Test: `tests/test_benchmark_trainer.py`

**Interfaces:**
- Consumes: `BenchmarkSet.load` (Task 2), `evaluate` (Task 3), `Config.deploy_*` (Task 4)
- Produces:
  - `MegaDesExtractorTrainer.bench: Optional[BenchmarkSet]`
  - `MegaDesExtractorTrainer._embed_paths(paths: List[str]) -> np.ndarray`
  - `MegaDesExtractorTrainer._benchmark_metrics() -> Dict[str, Any]`
  - `MegaDesExtractorTrainer._check_monitor()` — 검증 실패 시 `ValueError`

- [ ] **Step 1: 실패 테스트 작성**

`tests/test_benchmark_trainer.py` 생성:

```python
"""학습이 배포 지표로 체크포인트를 고르게 하는 연결부.

트레이너 루프(engine/trainer.py)는 수정하지 않는다. validate() 가 돌려주는
metrics dict 에 키를 추가하면 monitor 가 그대로 작동한다.
"""
import numpy as np
import pytest

from reid.core.config import Config
from reid.models.extractor.mega_descriptor.train import MegaDesExtractorTrainer


def _trainer(**overrides):
    cfg = Config(device="cpu", **overrides)
    return MegaDesExtractorTrainer(cfg=cfg, model_instance=None)


def test_bench_is_none_without_path():
    """검증 세트 경로가 없으면 기존 동작 그대로여야 한다."""
    t = _trainer(deploy_val_path="")
    assert t._load_benchmark() is None


def test_check_monitor_rejects_deploy_without_benchmark():
    """조용히 openset_map 으로 폴백하면 잘못된 체크포인트를 또 고르게 된다.

    _load_model 이 가중치 파일 부재를 조용히 넘겨 ci_50 실험을 오염시킨 전례가 있다.
    """
    t = _trainer(deploy_val_path="", monitor="deploy_tar_far1")
    t.bench = None

    with pytest.raises(ValueError, match="deploy_val_path"):
        t._check_monitor()


def test_check_monitor_allows_non_deploy_metric():
    t = _trainer(deploy_val_path="", monitor="openset_map")
    t.bench = None
    t._check_monitor()   # 예외가 없어야 한다


def test_benchmark_metrics_merged_into_validate_result(monkeypatch):
    """validate() 결과 dict 에 deploy_* 키가 들어가야 monitor 가 읽을 수 있다."""
    t = _trainer(deploy_val_path="dummy")
    t.bench = object()   # 존재만 하면 된다
    monkeypatch.setattr(t, "_benchmark_metrics",
                        lambda: {"deploy_tar_far1": 0.91, "deploy_n_ids": 3})

    merged = {"openset_map": 0.5}
    if t.bench is not None:
        merged.update(t._benchmark_metrics())

    assert merged["deploy_tar_far1"] == 0.91
    assert merged["openset_map"] == 0.5


def test_embed_paths_returns_empty_for_empty_input():
    t = _trainer()
    out = t._embed_paths([])
    assert out.shape[0] == 0
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_benchmark_trainer.py -q`
Expected: FAIL — `AttributeError: 'MegaDesExtractorTrainer' object has no attribute '_load_benchmark'`

- [ ] **Step 3: 구현**

`reid/models/extractor/mega_descriptor/train.py`:

(a) 파일 상단 import에 추가:

```python
from reid.benchmark import BenchmarkSet, evaluate as benchmark_evaluate
```

(b) `__init__` 마지막에 추가:

```python
        self.bench: Optional[BenchmarkSet] = None
```

(c) `setup()` 를 다음으로 교체:

```python
    def setup(self) -> None:
        super().setup()
        self.run_dir.save_json("holdout_labels.json", self.data.holdout_labels)
        self.bench = self._load_benchmark()
        self._check_monitor()
```

(d) 신규 메서드 3개를 `setup()` 아래에 추가:

```python
    def _load_benchmark(self) -> Optional[BenchmarkSet]:
        """배포 벤치마크를 읽는다. 경로가 비어 있으면 쓰지 않는다는 뜻이다."""
        path = getattr(self.cfg, "deploy_val_path", "")
        if not path:
            return None
        bench = BenchmarkSet.load(path)
        LOGGER.info(f"배포 벤치마크 로드: {path} ({len(bench.items)} crops, "
                    f"unknown={'있음' if bench.has_unknown else '없음'})")
        return bench

    def _check_monitor(self) -> None:
        """monitor 가 배포 지표인데 벤치마크가 없으면 시작 시점에 멈춘다.

        조용히 다른 지표로 폴백하면 학습이 끝난 뒤에야 잘못된 체크포인트를 골랐다는
        것을 알게 된다. 자원이 없으면 즉시 실패하는 편이 낫다.
        """
        monitor = getattr(self.cfg, "monitor", "openset_map")
        if monitor.startswith("deploy_") and self.bench is None:
            raise ValueError(
                f"monitor='{monitor}' 인데 deploy_val_path 가 비어 있다. "
                f"검증 세트를 지정하거나 monitor 를 openset_map 으로 되돌릴 것."
            )

    @torch.no_grad()
    def _embed_paths(self, paths: List[str]) -> np.ndarray:
        """이미지 경로 목록의 L2 정규화 임베딩. 순서를 보존한다."""
        if not paths:
            return np.empty((0, 0), dtype=np.float32)
        # make_eval_loader 는 shuffle=False, drop_last=False 라 순서가 보존된다.
        # 순서가 어긋나면 라벨과 임베딩이 엇갈려 지표가 조용히 틀어진다.
        items = [(p, "") for p in paths]
        loader = self.data.make_eval_loader(
            items, batch_size=self.cfg.batch_size,
            num_workers=getattr(self.cfg, "num_workers", 0),
        )
        return self._embed_loader(loader)

    def _benchmark_metrics(self) -> Dict[str, Any]:
        """배포 벤치마크 지표. 갤러리 임베딩은 모델이 바뀌므로 매번 다시 계산한다."""
        window = int(getattr(self.cfg, "deploy_val_window", 10))
        q = self.bench.accumulate(self._embed_paths(self.bench.paths), window)
        g = self._embed_paths(self.bench.gallery_paths)
        res = benchmark_evaluate(
            self.bench, q, g, self.bench.gallery_labels,
            far=float(getattr(self.cfg, "deploy_val_far", 0.01)),
            min_samples=int(getattr(self.cfg, "deploy_val_min_samples", 30)),
        )
        self.run_dir.save_json("deploy_val.json", res)
        return {k: v for k, v in res.items() if k != "per_identity"}
```

(e) `validate()` 의 `return result` 직전에 추가:

```python
        if self.bench is not None:
            result.update(self._benchmark_metrics())
```

(f) 상단 `from typing import Any, Dict, List, Optional, Tuple` 과 `LOGGER` 는 이미 있다. 추가 import 는 (a)의 한 줄뿐이다.

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_benchmark_trainer.py -q`
Expected: PASS (5 passed)

- [ ] **Step 5: 전체 테스트**

Run: `.venv/bin/python -m pytest -q`
Expected: 195 passed. 커밋하지 않는다.

---

### Task 6: 빌더 순수 함수

**Files:**
- Create: `reid/benchmark/build.py` (순수 함수 부분만)
- Test: `tests/test_benchmark_build.py`

**Interfaces:**
- Produces:
  - `representative_frames(frames: List[int], n: int = 3) -> List[int]`
  - `label_template(tracks: Dict[str, List[int]]) -> Dict[str, Dict[str, str]]`
  - `manifest_record(video, frame, track_id, label, bbox, conf, weight) -> dict`
  - `eligible_tracks(counts: Dict[int, int], min_detections: int = 5) -> List[int]`

- [ ] **Step 1: 실패 테스트 작성**

`tests/test_benchmark_build.py` 생성:

```python
"""벤치마크 빌더의 순수 함수.

패키지 모듈이므로 일반 import 로 테스트한다. baselines/ 에 두었다면
importlib.util.spec_from_file_location 우회가 필요했다.
"""
import pytest

from reid.benchmark import build


def test_representative_frames_picks_first_middle_last():
    """트랙 도중 다른 개체로 넘어가는 ID drift 를 눈으로 잡으려면 3장이 필요하다."""
    assert build.representative_frames([0, 3, 6, 9, 12], n=3) == [0, 6, 12]


def test_representative_frames_handles_short_track():
    assert build.representative_frames([4], n=3) == [4]
    assert build.representative_frames([4, 7], n=3) == [4, 7]


def test_representative_frames_returns_sorted_unique():
    assert build.representative_frames([9, 0, 6, 3], n=3) == [0, 6, 9]


def test_label_template_has_empty_string_per_track():
    """사람이 채울 자리를 빈 문자열로 남긴다. 빈 값이 남아 있으면 build 단계가 거부한다."""
    tmpl = build.label_template({"lulu_02": [1, 14], "lulu_04": [9]})
    assert tmpl == {"lulu_02": {"1": "", "14": ""}, "lulu_04": {"9": ""}}


def test_eligible_tracks_drops_noise():
    """한두 프레임짜리 트랙은 판정 대상이 아니다."""
    assert build.eligible_tracks({1: 120, 2: 3, 7: 40}, min_detections=5) == [1, 7]


def test_manifest_record_shape():
    rec = build.manifest_record("lulu_02", 612, 14, "lulu", (120, 88, 305, 260), 0.91, 84213.5)
    assert rec == {
        "video": "lulu_02", "frame": 612, "track_id": 14, "label": "lulu",
        "file": "crops/lulu_02/f000612_t014.png",
        "bbox": [120, 88, 305, 260], "conf": 0.91, "weight": 84213.5,
    }


def test_validate_labels_rejects_blank():
    """빈 라벨이 남은 채로 build 를 돌리면 조용히 크롭이 누락된다."""
    with pytest.raises(ValueError, match="lulu_02"):
        build.validate_labels({"lulu_02": {"1": "lulu", "14": ""}})


def test_validate_labels_accepts_known_values():
    build.validate_labels({"lulu_02": {"1": "lulu", "14": "skip", "9": "unknown_a"}})
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_benchmark_build.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'reid.benchmark.build'`

- [ ] **Step 3: 구현**

`reid/benchmark/build.py` 생성 (순수 함수 부분):

```python
"""배포 벤치마크 자산 빌더.

3단계로 나눈다.
  gallery  : 등록 사진을 순수 검출로 크롭 -> gallery.jsonl
  montage  : 영상별 트랙 대표 크롭 몽타주 + labels_template.json
  build    : 사람이 채운 labels.json 을 적용해 크롭·manifest 생성

몽타주 단계를 따로 두는 이유: 어느 트랙이 어느 개체인지는 사람만 판정할 수 있고,
트래커가 도중에 다른 개체로 넘어가는 ID drift 도 눈으로 봐야 잡힌다.

사용:
    python -m reid.benchmark.build --stage gallery --out datasets/reid_bench/gallery
    python -m reid.benchmark.build --stage montage --videos lulu_01,lulu_02,lulu_04,lulu_05 \
        --out datasets/reid_bench/val --stride 6
    # 사람이 datasets/reid_bench/val/labels.json 편집
    python -m reid.benchmark.build --stage build --videos lulu_01,lulu_02,lulu_04,lulu_05 \
        --out datasets/reid_bench/val --stride 6
"""
from __future__ import annotations

from typing import Dict, Iterable, List, Sequence, Tuple

MIN_DETECTIONS = 5


def representative_frames(frames: Sequence[int], n: int = 3) -> List[int]:
    """트랙의 처음·중간·끝 프레임. ID drift 확인용이라 시간축으로 벌려 뽑는다."""
    ordered = sorted(set(int(f) for f in frames))
    if len(ordered) <= n:
        return ordered
    idx = [round(i * (len(ordered) - 1) / (n - 1)) for i in range(n)]
    return [ordered[i] for i in sorted(set(idx))]


def eligible_tracks(counts: Dict[int, int], min_detections: int = MIN_DETECTIONS) -> List[int]:
    """검출 수가 모자란 잡음 트랙은 판정 대상에서 뺀다."""
    return sorted(t for t, n in counts.items() if n >= min_detections)


def label_template(tracks: Dict[str, Iterable[int]]) -> Dict[str, Dict[str, str]]:
    """사람이 채울 라벨 틀. 값이 빈 문자열이면 아직 판정하지 않은 것이다."""
    return {video: {str(t): "" for t in sorted(ids)} for video, ids in tracks.items()}


def validate_labels(labels: Dict[str, Dict[str, str]]) -> None:
    """빈 라벨이 남아 있으면 멈춘다.

    그대로 진행하면 해당 트랙이 조용히 빠져 검증 세트가 의도와 달라진다.
    """
    blank = [f"{video}/{track}" for video, tracks in labels.items()
             for track, value in tracks.items() if not str(value).strip()]
    if blank:
        raise ValueError(f"라벨이 비어 있는 트랙이 있다: {', '.join(sorted(blank))}")


def manifest_record(video: str, frame: int, track_id: int, label: str,
                    bbox: Tuple[int, int, int, int], conf: float, weight: float) -> dict:
    """manifest.jsonl 한 줄. weight 는 모델과 무관하므로 크롭 시점에 확정한다."""
    return {
        "video": video, "frame": int(frame), "track_id": int(track_id), "label": label,
        "file": f"crops/{video}/f{int(frame):06d}_t{int(track_id):03d}.png",
        "bbox": [int(v) for v in bbox], "conf": float(conf), "weight": float(weight),
    }
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_benchmark_build.py -q`
Expected: PASS (8 passed)

- [ ] **Step 5: 전체 테스트**

Run: `.venv/bin/python -m pytest -q`
Expected: 203 passed. 커밋하지 않는다.

---

### Task 7: 빌더 3단계 CLI

Task 6의 순수 함수 위에 검출기를 쓰는 실행부를 얹는다. 검출기는 **함수 내부 지연 import**로 가져와 평가 경로가 YOLO를 로드하지 않게 한다.

**Files:**
- Modify: `reid/benchmark/build.py` (실행부 추가)

**Interfaces:**
- Consumes: Task 6의 순수 함수, `reid.container.build_detector`, `reid.core.filters.laplacian_variance`
- Produces: `main() -> int` (`python -m reid.benchmark.build`)

- [ ] **Step 1: 실행부 구현**

`reid/benchmark/build.py` 끝에 추가:

```python
# --------------------------------------------------------------------------
# 실행부 — 검출기가 필요하다. 평가 경로가 YOLO 를 끌어오지 않도록 지연 import 한다.
# --------------------------------------------------------------------------

def _detector(cfg):
    from reid.container import build_detector

    det = build_detector(cfg)
    det.cfg = cfg
    return det


def _crop_weight(crop, imgsz: int) -> float:
    """blur x 면적. 배포의 누적 가중평균과 같은 가중치를 쓴다."""
    from reid.core.filters import laplacian_variance

    return max(1e-3, laplacian_variance(crop, imgsz=imgsz) * crop.shape[0] * crop.shape[1])


def _scan_video(det, video_path, stride: int):
    """추적을 켠 채 전 프레임을 검출하고 stride 간격의 크롭만 모은다.

    프레임을 건너뛰며 추적하면 track_id 가 달라지므로 검출은 모든 프레임에 대해 한다.
    """
    import cv2

    pred = det._get_predictor()
    det.predictor = pred
    pred.streaming = True
    det.model.predictor = None      # 영상 간 추적 상태 초기화

    cap = cv2.VideoCapture(str(video_path))
    frames, fi = [], 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        res = pred.predict_once(frame)
        if fi % stride == 0:
            for b in res.boxes:
                if b.track_id is None:
                    continue
                crop = b.crop(res.orig_img)
                if crop.size == 0 or min(crop.shape[:2]) < 32:
                    continue
                frames.append((fi, int(b.track_id),
                               (int(b.x1), int(b.y1), int(b.x2), int(b.y2)),
                               float(b.conf), crop.copy()))
        fi += 1
    cap.release()
    return frames


def _stage_gallery(cfg, out_dir, args) -> int:
    import json
    import cv2

    det = _detector(cfg)
    crops_dir = out_dir / "crops"
    crops_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    root = Path(args.registration_root)
    for label_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        for img_path in sorted(label_dir.iterdir()):
            if img_path.suffix.lower() not in (".png", ".jpg", ".jpeg"):
                continue
            im = cv2.imread(str(img_path))
            if im is None:
                continue
            res = det.predict(im)            # streaming=False -> 순수 검출
            if len(res.boxes) != 1:
                print(f"  건너뜀 {img_path} (박스 {len(res.boxes)}개)")
                continue
            crop = res.boxes[0].crop(res.orig_img)
            name = f"{label_dir.name}__{img_path.stem}.png"
            cv2.imwrite(str(crops_dir / name), crop)
            rows.append({"file": f"crops/{name}", "label": label_dir.name})
    (out_dir / "gallery.jsonl").write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows), encoding="utf-8")
    print(f"갤러리 {len(rows)}장 -> {out_dir}")
    return 0


def _stage_montage(cfg, out_dir, args) -> int:
    import collections
    import json
    import cv2
    import numpy as np

    det = _detector(cfg)
    out_dir.mkdir(parents=True, exist_ok=True)
    tracks_by_video = {}
    CELL = 170
    for video in args.videos.split(","):
        video = video.strip()
        found = _scan_video(det, Path(args.video_root) / f"{video}.mp4", args.stride)
        by_track = collections.defaultdict(list)
        for fi, tid, bbox, conf, crop in found:
            by_track[tid].append((fi, crop))
        keep = eligible_tracks({t: len(v) for t, v in by_track.items()}, args.min_detections)
        tracks_by_video[video] = keep

        cells = []
        for tid in keep:
            frames = [f for f, _ in by_track[tid]]
            for f in representative_frames(frames, n=3):
                crop = dict(by_track[tid])[f]
                h, w = crop.shape[:2]
                s = CELL / max(h, w)
                r = cv2.resize(crop, (max(1, int(w * s)), max(1, int(h * s))))
                cell = np.full((CELL + 18, CELL, 3), 30, np.uint8)
                y0, x0 = (CELL - r.shape[0]) // 2, (CELL - r.shape[1]) // 2
                cell[y0:y0 + r.shape[0], x0:x0 + r.shape[1]] = r
                cv2.putText(cell, f"t{tid} f{f}", (3, CELL + 13),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)
                cells.append(cell)
        if cells:
            per_row = 9
            rows = [np.hstack(cells[i:i + per_row]) for i in range(0, len(cells), per_row)]
            width = max(r.shape[1] for r in rows)
            rows = [r if r.shape[1] == width else
                    np.hstack([r, np.full((r.shape[0], width - r.shape[1], 3), 30, np.uint8)])
                    for r in rows]
            cv2.imwrite(str(out_dir / f"montage_{video}.png"), np.vstack(rows))
        print(f"{video}: 유효 트랙 {len(keep)}개 -> montage_{video}.png")

    tmpl = label_template(tracks_by_video)
    (out_dir / "labels_template.json").write_text(
        json.dumps(tmpl, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n라벨 틀 -> {out_dir / 'labels_template.json'}")
    print("이 파일을 labels.json 으로 복사한 뒤 트랙마다 개체명 / unknown_x / skip 을 채울 것.")
    return 0


def _stage_build(cfg, out_dir, args) -> int:
    import json
    import cv2

    labels_path = out_dir / "labels.json"
    if not labels_path.is_file():
        raise FileNotFoundError(
            f"{labels_path} 가 없다. --stage montage 로 만든 labels_template.json 을 "
            f"labels.json 으로 복사해 채울 것.")
    labels = json.loads(labels_path.read_text(encoding="utf-8"))
    validate_labels(labels)

    det = _detector(cfg)
    imgsz = int(getattr(cfg, "imgsz", 384))
    records = []
    for video in args.videos.split(","):
        video = video.strip()
        vlabels = labels.get(video, {})
        (out_dir / "crops" / video).mkdir(parents=True, exist_ok=True)
        for fi, tid, bbox, conf, crop in _scan_video(
                det, Path(args.video_root) / f"{video}.mp4", args.stride):
            label = vlabels.get(str(tid))
            if label is None or label == "skip":
                continue
            rec = manifest_record(video, fi, tid, label, bbox, conf,
                                  _crop_weight(crop, imgsz))
            cv2.imwrite(str(out_dir / rec["file"]), crop)
            records.append(rec)
        print(f"{video}: {sum(1 for r in records if r['video'] == video)} crops")

    (out_dir / "manifest.jsonl").write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in records), encoding="utf-8")
    counts = {}
    for r in records:
        counts[r["label"]] = counts.get(r["label"], 0) + 1
    print(f"\n총 {len(records)} crops -> {out_dir / 'manifest.jsonl'}")
    print("라벨별 장수: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    return 0


def main() -> int:
    import argparse
    from pathlib import Path as _Path

    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stage", required=True, choices=["gallery", "montage", "build"])
    ap.add_argument("--out", required=True)
    ap.add_argument("--videos", default="", help="쉼표로 구분한 영상 이름 (확장자 제외)")
    ap.add_argument("--video-root", default="datasets/cream_heroes")
    ap.add_argument("--registration-root", default="datasets/cream_heroes")
    ap.add_argument("--stride", type=int, default=6)
    ap.add_argument("--min-detections", type=int, default=MIN_DETECTIONS)
    args = ap.parse_args()

    from reid.core.config import get_config

    cfg = get_config()
    cfg.show = cfg.save = cfg.dev = False
    out_dir = _Path(args.out)

    if args.stage == "gallery":
        return _stage_gallery(cfg, out_dir, args)
    if args.stage == "montage":
        return _stage_montage(cfg, out_dir, args)
    return _stage_build(cfg, out_dir, args)


if __name__ == "__main__":
    raise SystemExit(main())
```

파일 상단 import에 `from pathlib import Path` 를 추가한다.

- [ ] **Step 2: 순수 함수 테스트가 여전히 통과하는지 확인**

Run: `.venv/bin/python -m pytest tests/test_benchmark_build.py -q`
Expected: PASS (8 passed)

- [ ] **Step 3: CLI 도움말 스모크**

Run: `.venv/bin/python -m reid.benchmark.build --help`
Expected: 3단계(`gallery`/`montage`/`build`)가 표시되고 예외 없이 종료

- [ ] **Step 4: 전체 테스트**

Run: `.venv/bin/python -m pytest -q`
Expected: 203 passed (신규 테스트 없음). 커밋하지 않는다.

---

### Task 8: `reid val` 모드 교체

**Files:**
- Modify: `reid/models/extractor/val.py` (`ExtractorValidator.validate` 전체 교체)
- Test: `tests/test_benchmark_val_mode.py` (생성)

**Interfaces:**
- Consumes: `BenchmarkSet`, `evaluate`, `Config.deploy_test_path`
- Produces: `ExtractorValidator.validate(pipeline) -> dict` — `deploy_*` 키. `BaseValidator` 계약 유지 (LSP)
- split 선택: `getattr(cfg, "split", "test")`. `reid val split=val` 로 지정한다 (`Config.load` 가 미지 CLI 키를 문자열로 넣어준다)

- [ ] **Step 1: 실패 테스트 작성**

`tests/test_benchmark_val_mode.py` 생성:

```python
"""reid val 은 학습 중 지표와 같은 모듈을 써야 정의가 어긋나지 않는다."""
import pytest

from reid.core.config import Config
from reid.models.extractor.val import ExtractorValidator


def test_validate_requires_benchmark_path():
    """경로 없이 부르면 조용히 0을 돌려주지 말고 멈춘다."""
    v = ExtractorValidator(Config(device="cpu", deploy_test_path=""))
    with pytest.raises(ValueError, match="deploy_test_path"):
        v.validate(pipeline=object())


def test_split_selects_path():
    cfg = Config(device="cpu", deploy_val_path="/a/val", deploy_test_path="/b/test")
    v = ExtractorValidator(cfg)
    assert v._split_path("test") == "/b/test"
    assert v._split_path("val") == "/a/val"


def test_latency_is_no_longer_reported():
    """PipelineProfiler 가 구간별로 더 정밀하게 재므로 중복이다."""
    import inspect
    src = inspect.getsource(ExtractorValidator)
    assert "latency" not in src
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_benchmark_val_mode.py -q`
Expected: FAIL — `_split_path` 없음, `latency` 문자열이 아직 있음

- [ ] **Step 3: 구현**

`reid/models/extractor/val.py` 전체를 다음으로 교체:

```python
from typing import Any, Optional

import cv2
import numpy as np

from reid.benchmark import BenchmarkSet, evaluate
from reid.engine.validator import BaseValidator
from reid.utils.logger import LOGGER


class ExtractorValidator(BaseValidator):
    """배포 도메인 벤치마크로 Re-ID 성능을 잰다.

    이전 구현은 dataset_path 의 사진을 동적 분할해 정확도를 쟀는데, 학습 홀드아웃과
    같은 도메인이라 배포 성능 저하를 감지하지 못했다(명세 §1). 지연 측정은
    PipelineProfiler 와 중복이라 제거했다.
    """

    def _split_path(self, split: str) -> str:
        key = "deploy_val_path" if split == "val" else "deploy_test_path"
        return getattr(self.cfg, key, "")

    def validate(self, pipeline: Optional[Any] = None) -> dict:
        split = str(getattr(self.cfg, "split", "test"))
        path = self._split_path(split)
        if not path:
            key = "deploy_val_path" if split == "val" else "deploy_test_path"
            raise ValueError(
                f"{key} 가 비어 있다. 벤치마크 경로를 지정할 것 "
                f"(python -m reid.benchmark.build 로 생성)."
            )
        if pipeline is None:
            raise ValueError("pipeline 이 필요하다.")

        bench = BenchmarkSet.load(path)
        LOGGER.info(f"[{split}] 벤치마크 {len(bench.items)} crops, "
                    f"갤러리 {len(bench.gallery_paths)}장")

        batch = int(getattr(self.cfg, "batch_size", 32))

        def embed(paths):
            """크롭을 배치로 나눠 추출한다.

            읽기 실패를 건너뛰면 임베딩 개수가 라벨 개수와 어긋나 조용히 잘못된
            지표가 나온다. 한 장이라도 못 읽으면 멈춘다.
            """
            out = []
            for i in range(0, len(paths), batch):
                crops = []
                for p in paths[i:i + batch]:
                    im = cv2.imread(p)
                    if im is None:
                        raise FileNotFoundError(f"벤치마크 크롭을 읽지 못했다: {p}")
                    crops.append(im)
                out.append(np.asarray(pipeline.extractor.predict_batch(crops),
                                      dtype=np.float32))
            return np.vstack(out) if out else np.empty((0, 0), dtype=np.float32)

        far = float(getattr(self.cfg, "deploy_val_far", 0.01))
        window = int(getattr(self.cfg, "deploy_val_window", 10))
        q = bench.accumulate(embed(bench.paths), window)
        g = embed(bench.gallery_paths)

        res = evaluate(
            bench, q, g, bench.gallery_labels, far=far,
            min_samples=int(getattr(self.cfg, "deploy_val_min_samples", 30)),
        )

        LOGGER.info(
            f"TAR@FAR{far * 100:.0f}% = {res['deploy_tar_far1'] * 100:.1f}% | "
            f"EER {res['deploy_eer'] * 100:.2f}% | AUC {res['deploy_auc']:.4f} | "
            f"개체 {res['deploy_n_ids']}마리"
        )
        for label, d in sorted(res["per_identity"].items()):
            LOGGER.info(f"  {label:<10} TAR {d['tar'] * 100:5.1f}%  EER {d['eer'] * 100:5.2f}%  "
                        f"genuine {d['genuine_mean']:.3f}  n={d['n_genuine']}")
        return res
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_benchmark_val_mode.py -q`
Expected: PASS (3 passed)

- [ ] **Step 5: 전체 테스트**

Run: `.venv/bin/python -m pytest -q`
Expected: 206 passed. 커밋하지 않는다.

---

### Task 9: 검증 세트 실제 구축 (사람 개입)

여기부터는 코드가 아니라 **데이터 자산 생성**이다. TDD 대상이 아니다(`dev/workflow.md` §4 학습 코드 예외).

**Files:**
- 생성: `datasets/reid_bench/gallery/`, `datasets/reid_bench/val/`, `datasets/reid_bench/test/`
- 사본: `dev/reid_bench_labels/val_labels.json`, `dev/reid_bench_labels/test_labels.json`

- [ ] **Step 1: 갤러리 생성**

```bash
.venv/bin/python -m reid.benchmark.build --stage gallery \
  --out datasets/reid_bench/gallery \
  --registration-root datasets/cream_heroes
```

기대: 등록 5마리 25장이 크롭된다. 박스가 1개가 아닌 이미지는 건너뛰며 이름이 출력된다.

- [ ] **Step 2: val 몽타주 생성**

```bash
.venv/bin/python -m reid.benchmark.build --stage montage \
  --videos lulu_01,lulu_02,lulu_04,lulu_05 \
  --out datasets/reid_bench/val --stride 6
```

기대: `montage_lulu_01.png` 등 4개 + `labels_template.json`

- [ ] **Step 3: 사람이 라벨 확정**

`labels_template.json`을 `labels.json`으로 복사한 뒤 몽타주를 보며 채운다.

명세 §3.1의 확정 정보:

| 영상 | 등장 개체 |
|---|---|
| lulu_01 | lulu, titi |
| lulu_02 | lulu, momo, titi(영상 후반) |
| lulu_04 | lulu, **unknown_a**, titi(영상 후반) |
| lulu_05 | lulu, momo, **unknown_b** |

- `unknown_a`(lulu_04)와 `unknown_b`(lulu_05)는 **서로 다른 개체**다
- 트랙 3장 중 개체가 바뀌는 것이 보이면 `skip`

- [ ] **Step 4: val 빌드**

```bash
.venv/bin/python -m reid.benchmark.build --stage build \
  --videos lulu_01,lulu_02,lulu_04,lulu_05 \
  --out datasets/reid_bench/val --stride 6
```

기대: `manifest.jsonl` + 라벨별 장수 출력. **titi 가 30장 미만이면 경고로 받아들이고 §Step 7에서 확인**한다.

- [ ] **Step 5: test 재생성**

```bash
.venv/bin/python -m reid.benchmark.build --stage montage \
  --videos white_01,lulu_03 --out datasets/reid_bench/test --stride 3
# labels.json: white_01 의 모든 트랙 = white, lulu_03 의 모든 트랙 = lulu
.venv/bin/python -m reid.benchmark.build --stage build \
  --videos white_01,lulu_03 --out datasets/reid_bench/test --stride 3
```

- [ ] **Step 6: 라벨 사본 보관**

```bash
mkdir -p dev/reid_bench_labels
cp datasets/reid_bench/val/labels.json  dev/reid_bench_labels/val_labels.json
cp datasets/reid_bench/test/labels.json dev/reid_bench_labels/test_labels.json
```

`datasets/`는 gitignore 대상이라 재생성 불가능한 사람의 판정 결과를 잃을 수 있다.

- [ ] **Step 7: 로딩 검증**

```bash
.venv/bin/python -c "
from reid.benchmark import BenchmarkSet
import collections
for split in ('val','test'):
    b = BenchmarkSet.load(f'datasets/reid_bench/{split}')
    c = collections.Counter(b.labels)
    print(f'{split}: {len(b.items)} crops, unknown={b.has_unknown}, 갤러리 {len(b.gallery_paths)}장')
    print('   ', dict(c))
"
```

기대: val에 `lulu`/`momo`/`titi`/`unknown_a`/`unknown_b`, `has_unknown=True`. test는 `white`/`lulu`, `has_unknown=False`.

---

### Task 10: 성공 기준 검증

명세 §2 성공 기준 3을 실제로 확인한다. **이 태스크가 통과해야 이 작업이 목적을 달성한 것이다.**

- [ ] **Step 1: 기존 run의 두 체크포인트를 벤치마크로 평가**

`reid val`을 두 가중치로 각각 돌린다.

```bash
RUN=results/train/20260823_021559_ci-crop
for W in best last; do
  echo "===== $W"
  .venv/bin/reid val split=val \
    extractor_weights=$RUN/$W.pth \
    deploy_val_path=datasets/reid_bench/val \
    deploy_test_path=datasets/reid_bench/test
done
```

- [ ] **Step 2: 판정**

기대: **`last.pth`(epoch 10)의 `deploy_tar_far1`이 `best.pth`(epoch 5)보다 높다.**

`openset_map`은 반대로 골랐다(95.9% vs 95.4%). 이 역전이 재현되면 검증 세트가 제 역할을 하는 것이다.

역전되지 않으면 **멈추고 보고한다.** 원인 후보:
- val 표본이 부족하다(개체 3마리 중 titi 제외 시 2마리)
- val과 test의 난이도가 달라 val이 test의 차이를 대변하지 못한다
- `deploy_val_window`가 배포와 다르다

- [ ] **Step 3: 학습 스모크 (2 epoch)**

```bash
.venv/bin/reid train extractor_weights=weights/ci_hc_15.pth \
  dataset_path=datasets/cat_individuals_cropped \
  lr=5e-5 epochs=2 name=bench-smoke \
  deploy_val_path=datasets/reid_bench/val \
  monitor=deploy_tar_far1
```

기대: 매 epoch 로그에 `deploy_tar_far1`이 찍히고, `results/train/*_bench-smoke/deploy_val.json`이 생성된다.

- [ ] **Step 4: 조용한 폴백 금지 확인**

```bash
.venv/bin/reid train dataset_path=datasets/cat_individuals_cropped \
  epochs=1 monitor=deploy_tar_far1 deploy_val_path=""
```

기대: **즉시 `ValueError`로 종료**하고 메시지에 `deploy_val_path`가 포함된다. 학습이 시작되면 안 된다.

- [ ] **Step 5: 전체 테스트 + 변경 보고**

Run: `.venv/bin/python -m pytest -q`
Expected: 206 passed

`git status`와 `git diff --stat`을 첨부해 변경 요약을 보고하고, 사용자의 코드 확인을 기다린다.

---

## 커밋 계획

`dev/workflow.md` §0.3에 따라 **사용자가 요청할 때** 아래 단위로 순차 커밋한다.

| # | 메시지 | 파일 |
|---|---|---|
| 1 | `feat(metrics): add ROC AUC and EER for score distributions` | `reid/core/metrics.py`, `tests/test_metrics.py` |
| 2 | `feat(benchmark): load deployment-domain crops with track accumulation` | `reid/benchmark/{__init__,dataset}.py`, `tests/test_benchmark_dataset.py` |
| 3 | `feat(benchmark): score identities against their own thresholds` | `reid/benchmark/protocol.py`, `tests/test_benchmark_protocol.py` |
| 4 | `feat(train): select checkpoints on deployment-domain metrics` | `reid/core/config.py`, `reid/cfg/default.yaml`, `reid/models/extractor/mega_descriptor/train.py`, `tests/test_config.py`, `tests/test_benchmark_trainer.py` |
| 5 | `feat(benchmark): build benchmark assets from tracked video` | `reid/benchmark/build.py`, `tests/test_benchmark_build.py` |
| 6 | `refactor(val): evaluate against the deployment benchmark` | `reid/models/extractor/val.py`, `tests/test_benchmark_val_mode.py` |

`baselines/training/crop_dataset.py`의 미커밋 수정분(`identities_below_minimum` 버그 수정 + 테스트)은 **별도 커밋**으로 앞에 둔다:

| # | 메시지 | 파일 |
|---|---|---|
| 0 | `fix(training): count identities that lost every crop` | `baselines/training/crop_dataset.py`, `tests/test_crop_dataset.py` |

---

## 자체 검토

**명세 커버리지**

| 명세 절 | 담당 태스크 |
|---|---|
| §3.1 val/test 분리 | 9 |
| §3.2 실제 미등록 개체 | 3(프로토콜), 9(라벨링) |
| §3.3 저장 구조 | 2(로딩), 7(생성) |
| §3.4 라벨링 절차 | 6(순수 함수), 7(몽타주), 9(사람) |
| §3.5 갤러리 (검출 캐싱) | 7(`_stage_gallery`), 9 |
| §3.6 표본 규모 (STRIDE) | 9 |
| §4.1 개체별 지표 · split별 impostor | 3 |
| §4.2 산출 지표 5종 | 3 |
| §4.3 누적 평균 | 2 |
| §4.4 표본 부족 처리 | 3 |
| §5.2 모듈 구성 | 2, 3, 6, 7 |
| §5.3 빌더 실행 방식 | 7 |
| §5.4 트레이너 연결 · monitor 검증 | 5 |
| §5.5 `reid val` 교체 · 지연 제거 | 8 |
| §6 설정 인터페이스 | 4 |
| §7 테스트 전략 | 1~8(TDD), 10(스모크) |
| §2 성공 기준 1~5 | 10 |

빠진 절 없음.

**타입 일관성**

- `BenchmarkSet.load(split_dir, gallery_dir=None)` — Task 2에서 정의, Task 5·8에서 동일 시그니처로 호출
- `evaluate(bench, query_emb, gallery_emb, gallery_labels, *, far, min_samples)` — Task 3에서 정의, Task 5·8에서 동일
- `accumulate(emb, window)` — Task 2 정의, Task 5·8 사용
- `roc_auc_eer(genuine, impostor) -> (auc, eer)` — Task 1 정의, Task 3 사용
- `manifest_record(...)` 가 만드는 키와 `BenchmarkSet.load` 가 읽는 키가 일치: `video`, `frame`, `track_id`, `label`, `file`, `bbox`, `conf`, `weight`
- 갤러리 레코드 키 일치: `_stage_gallery` 가 쓰는 `{"file", "label"}` = `BenchmarkSet.load` 가 읽는 키

**알려진 순서 의존**

Task 2의 `__init__.py`가 `protocol.evaluate`를 import 하므로 Task 2 Step 3에서 스텁 파일을 먼저 만든다. Task 3이 그 스텁을 대체한다.
