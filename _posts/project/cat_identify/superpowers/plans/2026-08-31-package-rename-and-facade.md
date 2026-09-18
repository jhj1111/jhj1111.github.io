# 패키지 리네이밍 + 파사드 `ReID` 구현 계획

> **에이전트 작업자에게:** 이 계획은 `superpowers:executing-plans`(에이전트가 직접 순차 실행)로 수행한다.
> `dev/workflow.md` §4가 서브에이전트 병렬 실행을 **사용자 명시 요청 시에만** 허용하므로 기본은 순차다.
> 각 단계는 체크박스(`- [ ]`)로 추적한다.

**Goal:** `import lumipet` 한 줄로 학습·등록·추론·DB 조작에 전부 도달할 수 있게 한다.

**Architecture:** 두 단계로 나눈다. 1단계는 `reid/` → `lumipet/` 기계적 리네이밍으로, 기존 테스트
스위트가 정확성을 검증한다. 2단계는 `lumipet/api.py`에 `ReID` 파사드를 신설하고 `cli.py`를 얇은
디스패처로 재구성한다. 파사드는 **값만 반환하고 출력은 CLI가 담당**하며, 설정을 인스턴스가 소유해
전역 싱글턴을 타지 않는다.

**Tech Stack:** Python 3.12, pytest, dataclasses, setuptools(`pyproject.toml`)

**Spec:** `dev/specs/2026-08-31-package-rename-and-facade.md`

## Global Constraints

- 작업 문서는 `dev/` 하위에만 쓴다. `dev/`는 gitignore 대상이다.
- **브랜치는 사용자가 만든다.** 에이전트는 이름만 제안하고 대기한다. `main`에서 직접 구현하지 않는다.
- **작업 도중 커밋하지 않는다.** 모든 태스크 완료 → 사용자 확인 → 요청 시 단계별 커밋.
  (이 계획의 "Commit" 단계는 사용자가 커밋을 요청한 뒤에 수행할 논리 단위를 미리 나눠둔 것이다.)
- 커밋 메시지는 Conventional Commits. 타입 `feat`/`fix`/`refactor`/`test`/`docs`/`chore`,
  스코프는 모듈명(`config`, `cli`, `api`, `matcher` 등).
- `git push` 하지 않는다.
- 테스트 실행: `.venv/bin/python -m pytest -q`
- 착수 시점 전체 통과(그린 베이스라인)를 먼저 확인하고 **그때 나온 수집 개수를 기준선으로 삼는다.**
  개수를 문서에 적어두지 않는다.
- 임시 파일은 저장소에 만들지 않고 스크래치패드를 쓴다.
- **`config.yaml`은 gitignore 대상인 사용자 로컬 파일이다.** 에이전트가 임의로 고치지 않는다.
- **`dev/train.sh`도 사용자 파일이다.** 고치지 않고 알린다.

---

## 파일 구조

### 1단계에서 옮기거나 고치는 파일

| 파일 | 책임 | 변경 |
|---|---|---|
| `reid/` → `lumipet/` | 패키지 루트 | `git mv` |
| `pyproject.toml` | 패키징 | `packages.find include`, `[project.scripts]` |
| `lumipet/__init__.py` | lazy 모델 노출 | 문자열 `"reid.models"` |
| `lumipet/utils/__init__.py` | 경로·해시·로깅 유틸 | `__main__` 디버그 블록 삭제 |
| `lumipet/models/extractor/embedding.py` | 임베딩 DB | 안내 문자열 2곳의 콘솔 명령 |
| `tests/*.py` (28파일) | 테스트 | import 경로 + 문자열 경로 |
| `baselines/training/*.py` (2파일) | 사용자 노트북 | import 경로 |
| `README.md` | 문서 | 디렉터리 트리, CLI 예시 11줄 |

### 2단계에서 만들거나 고치는 파일

| 파일 | 책임 | 변경 |
|---|---|---|
| `lumipet/api.py` | **신설.** `ReID` 파사드와 `IdentitySummary` | 생성 |
| `lumipet/__init__.py` | 공개 표면 | `MODELS` 목록에 `"ReID"` 추가 |
| `lumipet/models/yolo/model.py` | 검출기 래퍼 | 생성자에 `cfg` 인자 |
| `lumipet/models/matcher/knn.py` | kNN 매처 | 생성자에 `cfg` 인자 |
| `lumipet/container.py` | DI 팩토리 | `build_detector`/`build_matcher`가 cfg 전달 |
| `lumipet/cli.py` | 인자 파싱 + 출력 | 디스패처로 축소, 도움말 추가 |
| `tests/test_api.py` | **신설.** 파사드 테스트 | 생성 |
| `tests/test_cli_dispatch.py` | **신설.** CLI 디스패치·도움말 테스트 | 생성 |

`api.py`는 파사드 하나만 담는다. 출력 포맷팅은 `cli.py`에 남으므로 `api.py`가 비대해지지 않는다.

---

# 1단계 — 패키지 리네이밍

**제안 브랜치:** `refactor/package-rename`

## Task 1: 그린 베이스라인 확인과 문자열 참조 전수 조사

**Files:**
- 조사만. 변경 없음

**Interfaces:**
- Consumes: 없음
- Produces: 이후 태스크가 고칠 문자열 참조 목록

- [ ] **Step 1: 브랜치 확인**

사용자가 `refactor/package-rename` 브랜치를 만들 때까지 기다린다. 확인:

```bash
git branch --show-current
```

기대: `refactor/package-rename`. `main`이면 **중단하고 사용자에게 브랜치 생성을 요청한다.**

- [ ] **Step 2: 그린 베이스라인 확인**

```bash
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: `N passed` (실패 0건). **이 N을 기준선으로 기록해 둔다.** 실패가 있으면 중단하고 보고한다.

- [ ] **Step 3: 문자열 안의 모듈 경로 전수 조사**

import 문이 아니라 문자열이라 문법 기반 치환이 놓친다.

```bash
grep -rn "['\"][^'\"]*\breid\b[^'\"]*['\"]" --include=*.py reid/ tests/ baselines/
```

명세 §5.3이 예상한 것: `__init__.py`의 `importlib.import_module("reid.models")`,
`tests/test_dependency_isolation.py`의 `_import_probe(...)` 2곳,
`tests/test_tracking.py` 등의 `patch("reid.core.tracker.LOGGER")` 형태.
**목록에 예상 밖의 항목이 있으면 진행 전에 보고한다.**

- [ ] **Step 4: 바꾸면 안 되는 것 확인**

```bash
grep -rn 'task="reid' --include=*.py reid/
```

기대: `models/reid/model.py`의 `task="reid_pipeline"`, `models/extractor/model.py`의 `task="reid"`.
**이 둘은 태스크 라벨이므로 절대 바꾸지 않는다.**

## Task 2: 디렉터리 이동과 import 경로 치환

**Files:**
- Move: `reid/` → `lumipet/`
- Modify: `lumipet/**/*.py`, `tests/**/*.py`, `baselines/training/*.py`

**Interfaces:**
- Consumes: Task 1의 문자열 참조 목록
- Produces: `lumipet.*` 로 import 가능한 패키지

- [ ] **Step 1: 디렉터리 이동**

```bash
git mv reid lumipet
```

- [ ] **Step 2: import 문 치환**

`reid` 가 **단어 경계로 끊기는 경우만** 바꾼다. `reid_pipeline`, `reid_bench`, `Re-ID` 는 안 걸린다.

```bash
grep -rl --include=*.py -E '\b(from|import) reid\b' lumipet/ tests/ baselines/ \
  | xargs sed -i -E 's/\b(from|import) reid\b/\1 lumipet/g; s/\bfrom reid\./from lumipet./g'
```

- [ ] **Step 3: 문자열 안의 모듈 경로 치환**

```bash
grep -rl --include=*.py -E "['\"]reid\." lumipet/ tests/ \
  | xargs sed -i -E "s/(['\"])reid\./\1lumipet./g"
```

이것이 `importlib.import_module("reid.models")`, `patch("reid.core.tracker.LOGGER")`,
`_import_probe("from reid.container import ...")` 를 잡는다.

- [ ] **Step 3.5: 파일시스템 경로로 쓰인 `reid` 치환**

명세 §5.3과 Step 3은 **모듈 경로**(`reid.something`)만 상정했다. `reid` 가 **디렉터리 이름**으로
쓰인 곳은 뒤에 점이 없어 Step 3 패턴에 안 걸리고, `git mv` 후 경로가 사라져 테스트가 깨진다.
(Task 1 조사에서 실측: `tests/test_config.py:15,68,130`, `tests/test_track_mode.py:116`,
`tests/test_run.py:75` — 5곳)

```bash
sed -i -E 's#(["'"'"'])reid/#\1lumipet/#g; s#/ "reid" /#/ "lumipet" /#g' tests/*.py
```

`sys.argv[0]` 로 쓰인 `"reid"` 도 함께 바꾼다. `cli.main()` 은 `sys.argv[1:]` 만 보므로
**기능 영향은 없고 가독성 문제다** (`tests/test_cli_quality.py:26,54`, `tests/test_database.py:143,150`).

```bash
sed -i -E 's/\["reid", /["lumipet", /g' tests/*.py
```

- [ ] **Step 4: `_import_probe("import reid.models")` 확인**

Step 3의 패턴은 `"reid."` 에 붙은 점을 요구하므로 `"import reid.models"` 도 잡힌다.
남은 것이 없는지 확인한다:

```bash
grep -rn --include=*.py -E "\breid\b" lumipet/ tests/ baselines/ | grep -v "reid_pipeline\|reid_bench\|lumipet-reid\|Re-ID\|re-id\|task=\"reid\""
```

기대: 출력 없음. 남아 있으면 개별 확인 후 손으로 고친다.

- [ ] **Step 5: 실행해서 확인**

```bash
.venv/bin/python -c "import lumipet; print(lumipet.__version__)"
```

기대: `0.1.0`

- [ ] **Step 6: 전체 테스트**

```bash
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: Task 1 Step 2의 기준선과 **동일한 개수가 통과**.

## Task 3: 패키징 설정과 콘솔 명령

**Files:**
- Modify: `pyproject.toml`

**Interfaces:**
- Consumes: Task 2의 `lumipet` 패키지
- Produces: `lumipet` 콘솔 명령

- [ ] **Step 1: 패키지 탐색 경로와 진입점 변경**

`pyproject.toml`에서 두 곳을 고친다.

```toml
[project.scripts]
lumipet = "lumipet.cli:main"
```

```toml
[tool.setuptools.packages.find]
where = ["."]
include = ["lumipet*"]
```

`[project] name = "lumipet-reid"` 는 **바꾸지 않는다.** 이미 맞다.

- [ ] **Step 2: 재설치**

```bash
.venv/bin/python -m pip install -e . --no-deps -q
```

- [ ] **Step 3: 콘솔 명령 확인**

```bash
.venv/bin/lumipet list
```

기대: 등록 개체 요약이 출력된다 (DB가 비어 있으면 `No cats registered in the database.`).

```bash
ls .venv/bin/reid
```

기대: `No such file or directory` — 옛 명령이 사라졌다.

## Task 4: 사용자에게 보이는 문자열과 죽은 코드

**Files:**
- Modify: `lumipet/models/extractor/embedding.py:290`, `:364`
- Modify: `lumipet/utils/__init__.py` (`__main__` 블록 삭제)

**Interfaces:**
- Consumes: Task 3의 `lumipet` 콘솔 명령
- Produces: 없음

- [ ] **Step 1: 안내 문자열의 콘솔 명령 수정**

`embedding.py:290`:

```python
                recommendations=["미검사 상태: 'lumipet inspect' 명령어를 통해 적합성 진단을 수행할 수 있습니다."]
```

`embedding.py:364`:

```python
                    f"Please run 'lumipet migrate' to regenerate features."
```

`cli.py:66,99`의 두 문구는 **여기서 건드리지 않는다.** Task 11에서 도움말과 함께 정리한다.

- [ ] **Step 2: 죽은 디버그 블록 삭제**

`lumipet/utils/__init__.py` 끝의 아래 블록을 통째로 지운다. 경로 `//reid/cfg/` 가 이미 깨져 있고
코드 확인용 임시 작성물이다 (사용자 확인 완료).

```python
if __name__ == "__main__":
    import os
    os.chdir("//reid/cfg/")
    print(f"result = {get_cfg_path()}")
```

- [ ] **Step 3: 전체 테스트**

```bash
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: 기준선과 동일.

## Task 5: README 갱신

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 3의 콘솔 명령
- Produces: 없음

- [ ] **Step 1: CLI 예시 치환**

11줄이 `reid <mode>` 형태다. 행 머리의 명령만 바꾼다.

```bash
sed -i -E 's/(^|`|\$ )reid (register|predict|list|delete|migrate|export|val|train|inspect)\b/\1lumipet \2/g' README.md
```

- [ ] **Step 2: 디렉터리 트리와 본문 참조 수정**

`README.md:53`의 `reid/` 트리 루트와 `:74`, `:87`, `:107`, `:121` 의 경로 언급을 `lumipet/` 로 바꾼다.
`:121` 의 "CLI 인터페이스인 `reid` 명령어" → "`lumipet` 명령어", "진입점은 `reid/cli.py`" → "`lumipet/cli.py`".

- [ ] **Step 3: 남은 참조 확인**

```bash
grep -n "\breid\b" README.md | grep -vi "re-id\|lumipet-reid\|reid_bench"
```

기대: 출력 없음.

- [ ] **Step 4: 1단계 최종 검증**

```bash
.venv/bin/python -m pytest -q 2>&1 | tail -3
git status --short
```

기대: 기준선과 동일한 통과 수. `git status` 에 `reid/` 삭제와 `lumipet/` 추가가 rename 으로 잡힌다.

- [ ] **Step 5: Commit (사용자 요청 시)**

```bash
git add -A
git commit -m "refactor(package): rename import package reid to lumipet

배포명은 이미 lumipet-reid 인데 import 이름만 reid 였다. import reid 는
어떤 re-ID 인지 말해주지 않는다. 소문자 lumipet 으로 맞춘다 (PEP 8, 그리고
대문자는 대소문자 구분 없는 파일시스템에서만 통과하고 Linux 에서 깨진다).

- reid/ -> lumipet/ (git mv), import 사이트 및 문자열 안의 모듈 경로 치환
- 콘솔 명령 reid -> lumipet. 하위 호환용 병기는 두지 않는다
- 안내 문자열 2곳(embedding.py)의 콘솔 명령 갱신
- utils/__init__.py 의 __main__ 디버그 블록 삭제 (경로가 이미 깨져 있었다)
- README CLI 예시와 디렉터리 트리 갱신

models/reid/ 디렉터리와 task=\"reid\" / task=\"reid_pipeline\" 은 패키지
참조가 아니라 태스크 라벨이므로 유지한다."
```

- [ ] **Step 6: 사용자에게 알릴 것**

`dev/train.sh:3` 이 `reid train` 을 쓴다. **gitignore 대상 사용자 파일이라 고치지 않았다.**
`lumipet train` 으로 바꿔야 한다고 보고한다.

---

# 2단계 — 파사드 `lumipet.ReID`

**제안 브랜치:** `feature/facade-api`
**선행 조건:** 1단계가 그린이어야 착수한다.

## Task 6: 설정 소유 — `ReID.__init__`

**Files:**
- Create: `lumipet/api.py`
- Create: `tests/test_api.py`
- Modify: `lumipet/__init__.py`

**Interfaces:**
- Consumes: `lumipet.core.config.Config`, `lumipet.utils.get_cfg_path`
- Produces:
  - `class ReID` with `__init__(self, cfg: Config | str | Path | None = None, **overrides)`
  - `self.cfg: Config` — 인스턴스 소유 사본

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_api.py`:

```python
import copy
from pathlib import Path

import pytest

from lumipet.core.config import Config, get_config


def test_overrides_applied():
    r = __import__("lumipet").ReID(epochs=20, arcface_margin=0.0)
    assert r.cfg.epochs == 20
    assert r.cfg.arcface_margin == 0.0


def test_unknown_override_raises():
    from lumipet import ReID
    with pytest.raises(TypeError):
        ReID(arcface_margn=0.0)          # 오타


def test_instances_own_independent_config():
    from lumipet import ReID
    a = ReID(epochs=20)
    b = ReID(epochs=5)
    assert a.cfg.epochs == 20
    assert b.cfg.epochs == 5


def test_cfg_instance_is_deep_copied():
    from lumipet import ReID
    base = Config()
    r = ReID(base, epochs=99)
    assert r.cfg is not base
    assert base.epochs != 99


def test_cfg_path_argument(tmp_path):
    from lumipet import ReID
    p = tmp_path / "probe.yaml"
    p.write_text("epochs: 7\nbatch_size: 8\n")
    r = ReID(str(p))
    assert r.cfg.epochs == 7
    assert r.cfg.batch_size == 8


def test_global_config_untouched():
    from lumipet import ReID
    before = copy.deepcopy(get_config())
    ReID(epochs=123)
    assert get_config().epochs == before.epochs
```

- [ ] **Step 2: 실패 확인**

```bash
.venv/bin/python -m pytest tests/test_api.py -q
```

기대: FAIL — `module lumipet has no attribute ReID`

- [ ] **Step 3: `lumipet/api.py` 작성**

```python
"""단일 진입점 파사드."""

import copy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from lumipet.core.config import Config
from lumipet.utils import get_cfg_path


class ReID:
    """학습 · 등록 · 추론 · DB 조작의 단일 진입점.

    설정을 인스턴스가 소유한다. 전역 get_config() 를 바꾸지 않으므로
    설정이 다른 인스턴스를 여럿 만들어도 서로 간섭하지 않는다.
    """

    def __init__(self, cfg: Union[Config, str, Path, None] = None, **overrides: Any) -> None:
        if isinstance(cfg, Config):
            self.cfg = copy.deepcopy(cfg)
        else:
            yaml_path = get_cfg_path(cfg) if cfg is not None else get_cfg_path()
            self.cfg = Config.load(yaml_path, args=[])

        for key, value in overrides.items():
            if not hasattr(self.cfg, key):
                raise TypeError(
                    f"{type(self).__name__}() got an unexpected setting {key!r}. "
                    f"설정 키는 lumipet/cfg/default.yaml 을 보세요."
                )
            setattr(self.cfg, key, value)

        # 오버라이드가 device/verbose 를 바꿀 수 있으므로 부수효과는 그 뒤에 한 번 수행한다.
        from lumipet.utils.checks import select_device
        from lumipet.utils.logger import set_logging
        self.cfg.device = select_device(self.cfg.device)
        set_logging(verbose=self.cfg.verbose, log_file=self.cfg.log_file)

        self._detector = None
        self._extractor = None
        self._matcher = None
        self._pipeline = None
        self._store = None
```

`Config.load(yaml_path, args=[])` 에서 `args=[]` 가 중요하다. 생략하면 `sys.argv[1:]` 를 읽어
pytest 인자를 설정으로 해석한다.

- [ ] **Step 4: `lumipet/__init__.py` 에 노출**

`MODELS` 튜플 옆에 파사드를 추가한다. 기존 lazy `__getattr__` 를 그대로 쓴다.

```python
MODELS = (
    "ReIdModel",
    "YoloModel",
    "MegaDesExtractorModel",
    "KnnMatcher", "FaissMatcher"
)

_FACADE = ("ReID", "IdentitySummary")

__all__ = (
    "__version__",
    "__author__",
    *MODELS,
    *_FACADE,
)

if TYPE_CHECKING:
    from lumipet.models import ReIdModel, YoloModel, MegaDesExtractorModel
    from lumipet.api import ReID, IdentitySummary

def __getattr__(name: str):
    """Lazy-import model classes and the facade on first access."""
    if name in MODELS:
        return getattr(importlib.import_module("lumipet.models"), name)
    if name in _FACADE:
        return getattr(importlib.import_module("lumipet.api"), name)
    raise AttributeError(f"module {__name__} has no attribute {name}")

def __dir__():
    return sorted(set(globals()) | set(MODELS) | set(_FACADE))
```

`IdentitySummary` 는 Task 8에서 정의한다. Task 6 시점에는 `_FACADE` 에 이름만 올려도
`api.py` 에 없으면 `AttributeError` 가 나므로, **Task 6에서는 `_FACADE = ("ReID",)` 로 두고
Task 8에서 `"IdentitySummary"` 를 추가한다.**

- [ ] **Step 5: 통과 확인**

```bash
.venv/bin/python -m pytest tests/test_api.py -q
```

기대: 6 passed

- [ ] **Step 6: 전체 테스트**

```bash
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: 기준선 + 6

## Task 7: 전역 폴백 차단 — `cfg` 배선 2곳

**Files:**
- Modify: `lumipet/models/yolo/model.py:11-12`
- Modify: `lumipet/models/matcher/knn.py:11-12`
- Modify: `lumipet/container.py`
- Test: `tests/test_api.py`

**Interfaces:**
- Consumes: Task 6의 `ReID.cfg`
- Produces:
  - `YoloModel(model_path=..., task="detect", cfg=None)`
  - `KnnMatcher(k=2, threshold=0.7, cfg=None)`
  - `build_detector(cfg)` / `build_matcher(cfg)` 가 cfg 를 전달

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/test_api.py` 끝에 추가:

```python
def test_detector_and_matcher_receive_instance_cfg():
    """파사드가 만든 부품이 전역이 아니라 인스턴스 cfg 를 들고 있어야 한다."""
    from lumipet.container import build_detector, build_matcher
    from lumipet.core.config import Config

    cfg = Config(detector_weights="weights/yolo26n.pt", matcher_type="knn", k=7, threshold=0.33)

    matcher = build_matcher(cfg)
    assert matcher.cfg is cfg
    assert matcher.k == 7

    detector = build_detector(cfg)
    assert detector.cfg is cfg
```

- [ ] **Step 2: 실패 확인**

```bash
.venv/bin/python -m pytest tests/test_api.py::test_detector_and_matcher_receive_instance_cfg -q
```

기대: FAIL — `matcher.cfg` 가 전역 Config 라 `is cfg` 가 거짓.

- [ ] **Step 3: `YoloModel` 생성자에 cfg 추가**

```python
    def __init__(
        self,
        model_path: Optional[Union[str, Path]] = "yolov8n.pt",
        task: str = "detect",
        cfg: Optional[Any] = None,
    ):
        super().__init__(model_path, task, cfg=cfg)
        self._load_model(model_path)
```

- [ ] **Step 4: `KnnMatcher` 생성자에 cfg 추가**

```python
    def __init__(self, k: int = 2, threshold: float = 0.7, cfg: Optional[Any] = None):
        super().__init__(threshold=threshold, cfg=cfg)
        self.k = k
        self.model = KNeighborsClassifier(n_neighbors=k, metric='cosine')
        self.is_fitted = False
```

`knn.py` 상단 import 에 `Optional`, `Any` 를 추가한다:

```python
from typing import Any, List, Optional
```

- [ ] **Step 5: `container.py` 가 cfg 를 전달하게 수정**

```python
def build_detector(cfg=None):
    cfg = cfg or get_config()
    return YoloModel(model_path=cfg.detector_weights, cfg=cfg)

def build_matcher(cfg=None):
    cfg = cfg or get_config()
    if cfg.matcher_type == "faiss":
        return FaissMatcher(threshold=cfg.threshold, cfg=cfg)
    else:
        return KnnMatcher(k=cfg.k, threshold=cfg.threshold, cfg=cfg)
```

- [ ] **Step 6: 통과 확인**

```bash
.venv/bin/python -m pytest tests/test_api.py -q
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: 전부 통과. 기준선 + 7

## Task 8: 지연 생성과 DB 조회 메서드

**Files:**
- Modify: `lumipet/api.py`
- Modify: `lumipet/__init__.py` (`_FACADE` 에 `"IdentitySummary"` 추가)
- Test: `tests/test_api.py`

**Interfaces:**
- Consumes: Task 6의 `ReID.cfg`, Task 7의 배선
- Produces:
  - `@dataclass IdentitySummary(label: str, embedding_count: int, profile: SuitabilityReport)`
  - `ReID.store` / `.detector` / `.extractor` / `.matcher` / `.pipeline` — lazy 프로퍼티
  - `ReID.identities() -> List[IdentitySummary]`
  - `ReID.inspect(label: str) -> SuitabilityReport`
  - `ReID.delete(label: str) -> int`

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/test_api.py` 끝에 추가:

```python
def _seed_db(tmp_path):
    """임베딩 2개 + 프로필 없는 개체 1개를 심는다."""
    import numpy as np
    from lumipet.models.extractor import EmbeddingStore

    db = tmp_path / "probe.db"
    store = EmbeddingStore(str(db))
    store.add(np.ones(8, dtype=np.float32), "Nabi", "a.jpg", "h1", model_name="m")
    store.add(np.ones(8, dtype=np.float32), "Nabi", "b.jpg", "h2", model_name="m")
    store.add(np.ones(8, dtype=np.float32), "Mimi", "c.jpg", "h3", model_name="m")
    store.close()
    return str(db)


def test_identities_merges_counts_and_profiles(tmp_path):
    from lumipet import ReID
    r = ReID(db_path=_seed_db(tmp_path))
    rows = {s.label: s for s in r.identities()}
    assert set(rows) == {"Nabi", "Mimi"}
    assert rows["Nabi"].embedding_count == 2
    assert rows["Mimi"].embedding_count == 1
    # 프로필은 항상 존재한다. 미검사면 UNCHECKED 다.
    from lumipet.core.quality import StatusLevel
    assert rows["Nabi"].profile.status_level == StatusLevel.UNCHECKED


def test_inspect_returns_unchecked_report_for_missing_label(tmp_path):
    from lumipet import ReID
    from lumipet.core.quality import StatusLevel
    r = ReID(db_path=_seed_db(tmp_path))
    rep = r.inspect("NoSuchCat")
    assert rep is not None
    assert rep.label == "NoSuchCat"
    assert rep.status_level == StatusLevel.UNCHECKED


def test_delete_returns_count(tmp_path):
    from lumipet import ReID
    r = ReID(db_path=_seed_db(tmp_path))
    assert r.delete("Nabi") == 2
    assert {s.label for s in r.identities()} == {"Mimi"}


def test_identities_builds_no_model(tmp_path, monkeypatch):
    """조회 경로가 torch 모델을 올리면 lazy import 의 이득이 사라진다."""
    import lumipet.container as container
    calls = []
    monkeypatch.setattr(container, "build_extractor", lambda *a, **k: calls.append("ext"))
    monkeypatch.setattr(container, "build_detector", lambda *a, **k: calls.append("det"))
    monkeypatch.setattr(container, "build_matcher", lambda *a, **k: calls.append("mat"))

    from lumipet import ReID
    r = ReID(db_path=_seed_db(tmp_path))
    r.identities()
    r.inspect("Nabi")
    assert calls == []
```

- [ ] **Step 2: 실패 확인**

```bash
.venv/bin/python -m pytest tests/test_api.py -q
```

기대: FAIL — `ReID` 에 `identities` 가 없다.

- [ ] **Step 3: `api.py` 에 dataclass 와 lazy 프로퍼티 추가**

`api.py` 의 import 아래, `class ReID` 위에 추가:

```python
@dataclass
class IdentitySummary:
    """등록 개체 한 줄 요약.

    profile 은 항상 존재한다. EmbeddingStore.get_identity_profile 은 행이 없으면
    StatusLevel.UNCHECKED 리포트를 합성해 돌려주므로 None 이 되는 경로가 없다.
    """
    label: str
    embedding_count: int
    profile: "SuitabilityReport"
```

`api.py` 상단에 타입 전용 import 를 둔다. 런타임에 `core.quality` 를 끌어오지 않기 위해서다.

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from lumipet.core.quality import SuitabilityReport
```

`class ReID` 안, `__init__` 아래에 추가:

```python
    # ------------------------------------------------------------------
    # 부품 — 필요할 때만 만든다
    # ------------------------------------------------------------------

    @property
    def store(self):
        if self._store is None:
            from lumipet.models.extractor import EmbeddingStore
            self._store = EmbeddingStore(self.cfg.db_path)
        return self._store

    @property
    def detector(self):
        if self._detector is None:
            from lumipet import container
            self._detector = container.build_detector(self.cfg)
        return self._detector

    @property
    def extractor(self):
        if self._extractor is None:
            from lumipet import container
            self._extractor = container.build_extractor(self.cfg)
        return self._extractor

    @property
    def matcher(self):
        if self._matcher is None:
            from lumipet import container
            self._matcher = container.build_matcher(self.cfg)
        return self._matcher

    @property
    def pipeline(self):
        if self._pipeline is None:
            from lumipet.models import ReIdModel
            self._pipeline = ReIdModel(self.detector, self.extractor, self.matcher, cfg=self.cfg)
        return self._pipeline

    # ------------------------------------------------------------------
    # DB 조회 — 모델을 만들지 않는다
    # ------------------------------------------------------------------

    def identities(self) -> List[IdentitySummary]:
        """등록된 개체 목록. 임베딩 개수와 적합도 프로필을 합쳐 돌려준다."""
        counts = self.store.list_labels()
        profiles = self.store.list_identity_profiles()
        labels = sorted(set(counts) | set(profiles))
        return [
            IdentitySummary(
                label=label,
                embedding_count=counts.get(label, 0),
                profile=self.store.get_identity_profile(label),
            )
            for label in labels
        ]

    def inspect(self, label: str):
        """개체 적합도 리포트. 없는 라벨이면 UNCHECKED 리포트를 돌려준다."""
        return self.store.get_identity_profile(label)

    def delete(self, label: str) -> int:
        """개체의 임베딩과 프로필을 지운다. 지운 임베딩 수를 돌려준다."""
        return self.store.delete_label(label)
```

`container` 를 모듈째 import 하는 것이 중요하다. `from lumipet.container import build_extractor`
로 함수를 직접 가져오면 Step 1의 `monkeypatch.setattr(container, ...)` 가 안 먹는다.

- [ ] **Step 4: `__init__.py` 의 `_FACADE` 갱신**

```python
_FACADE = ("ReID", "IdentitySummary")
```

- [ ] **Step 5: 통과 확인**

```bash
.venv/bin/python -m pytest tests/test_api.py -q
```

기대: 11 passed

- [ ] **Step 6: 전체 테스트**

```bash
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: 기준선 + 11

## Task 9: 실행 메서드 위임

**Files:**
- Modify: `lumipet/api.py`
- Test: `tests/test_api.py`

**Interfaces:**
- Consumes: Task 8의 lazy 프로퍼티
- Produces:
  - `ReID.train() -> Dict[str, Any]`
  - `ReID.val() -> Dict[str, Any]`
  - `ReID.export(path: Optional[str] = None) -> str`
  - `ReID.register(source: str, label: str = "") -> None`
  - `ReID.predict(source: Any = None, streaming: Optional[bool] = None) -> Any`
  - `ReID.migrate() -> int`

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/test_api.py` 끝에 추가:

```python
def test_train_builds_extractor_only(monkeypatch):
    """학습에는 검출기도 매처도 필요 없다."""
    import lumipet.container as container

    class _Ext:
        def train(self): return {"ok": True}

    made = []
    monkeypatch.setattr(container, "build_extractor", lambda cfg: made.append("ext") or _Ext())
    monkeypatch.setattr(container, "build_detector", lambda cfg: made.append("det"))
    monkeypatch.setattr(container, "build_matcher", lambda cfg: made.append("mat"))

    from lumipet import ReID
    assert ReID().train() == {"ok": True}
    assert made == ["ext"]


def test_predict_prefers_argument_over_cfg_source(monkeypatch):
    import lumipet.container as container
    monkeypatch.setattr(container, "build_extractor", lambda cfg: object())
    monkeypatch.setattr(container, "build_detector", lambda cfg: object())
    monkeypatch.setattr(container, "build_matcher", lambda cfg: object())

    seen = {}

    class _Pipe:
        def predict(self, source, streaming=None):
            seen["source"] = source
            return "done"

    from lumipet import ReID
    r = ReID(source="from_cfg")
    r._pipeline = _Pipe()
    assert r.predict() == "done"
    assert seen["source"] == "from_cfg"
    assert r.predict("from_arg") == "done"
    assert seen["source"] == "from_arg"
```

- [ ] **Step 2: 실패 확인**

```bash
.venv/bin/python -m pytest tests/test_api.py::test_train_builds_extractor_only -q
```

기대: FAIL — `ReID` 에 `train` 이 없다.

- [ ] **Step 3: 실행 메서드 구현**

`api.py` 의 `class ReID` 끝에 추가:

```python
    # ------------------------------------------------------------------
    # 실행
    # ------------------------------------------------------------------

    def train(self) -> Dict[str, Any]:
        """추출기를 파인튜닝한다. 트레이너의 결과 dict 를 그대로 돌려준다."""
        return self.extractor.train()

    def val(self) -> Dict[str, Any]:
        """검증셋을 평가한다. 검증기는 파이프라인을 요구한다."""
        return self.extractor.val(pipeline=self.pipeline)

    def export(self, path: Optional[str] = None) -> str:
        """추출기를 ONNX 로 내보낸다. 내보낸 경로를 돌려준다."""
        return self.extractor.export(path)

    def register(self, source: str, label: str = "") -> None:
        """이미지를 개체로 등록한다."""
        return self.extractor.register(source=source, label=label)

    def predict(self, source: Any = None, streaming: Optional[bool] = None) -> Any:
        """영상 · 이미지 · 웹캠에서 개체를 식별한다.

        source 를 생략하면 cfg.source 를 쓴다.
        """
        return self.pipeline.predict(
            source=self.cfg.source if source is None else source,
            streaming=streaming,
        )

    def migrate(self) -> int:
        """현재 모델로 DB 임베딩을 재생성한다. 재등록한 개수를 돌려준다."""
        from lumipet.utils import calculate_md5
        import os

        cursor = self.extractor.store.conn.cursor()
        cursor.execute("SELECT label, image_path FROM embeddings")
        rows = cursor.fetchall()
        if not rows:
            return 0

        valid = [(p, l) for l, p in rows if p and os.path.exists(p)]
        if not valid:
            return 0

        self.extractor.store.clear()
        registrations = []
        for img_path, img_label in valid:
            registrations.append((img_path, img_label, calculate_md5(img_path)))

        self.extractor.register_batch_images(registrations)
        return len(registrations)
```

`ReIdModel.predict` 는 `BaseModel.predict(source, streaming=None)` 시그니처다.

- [ ] **Step 4: 통과 확인**

```bash
.venv/bin/python -m pytest tests/test_api.py -q
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: 전부 통과. 기준선 + 13

## Task 10: CLI 도움말

**Files:**
- Modify: `lumipet/cli.py`
- Create: `tests/test_cli_dispatch.py`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `lumipet.cli.USAGE: str` — 도움말 전문
  - `lumipet.cli.main()` 이 `-h` / `--help` / `help` 를 처리

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_cli_dispatch.py`:

```python
import sys

import pytest


@pytest.mark.parametrize("flag", ["-h", "--help", "help"])
def test_help_flags_print_usage(monkeypatch, capsys, flag):
    from lumipet import cli
    monkeypatch.setattr(sys, "argv", ["lumipet", flag])
    cli.main()
    out = capsys.readouterr().out
    assert "lumipet <mode> [key=value ...]" in out
    assert "predict" in out and "register" in out and "export" in out


def test_help_does_not_load_config_or_cuda(monkeypatch, capsys):
    """도움말은 CUDA 초기화나 YAML 로딩 없이 즉시 떠야 한다."""
    from lumipet import cli
    import lumipet.utils.checks as checks
    from lumipet.core.config import Config

    called = []
    monkeypatch.setattr(checks, "setup_cuda_libs", lambda: called.append("cuda"))
    monkeypatch.setattr(Config, "load", classmethod(lambda *a, **k: called.append("load")))
    monkeypatch.setattr(sys, "argv", ["lumipet", "--help"])
    cli.main()
    assert called == []


def test_unknown_mode_shows_help(monkeypatch, capsys):
    from lumipet import cli
    monkeypatch.setattr(sys, "argv", ["lumipet", "bogus"])
    cli.main()
    captured = capsys.readouterr()
    assert "lumipet <mode> [key=value ...]" in captured.out
```

- [ ] **Step 2: 실패 확인**

```bash
.venv/bin/python -m pytest tests/test_cli_dispatch.py -q
```

기대: FAIL — `cli.main()` 이 `-h` 를 모드로 오인해 `Unknown mode: -h` 를 로깅한다.

- [ ] **Step 3: `cli.py` 상단에 도움말 상수와 조기 분기 추가**

`cli.py` 의 import 아래에 추가:

```python
USAGE = """lumipet <mode> [key=value ...]

Lumipet cat re-identification CLI

Modes
  predict    Identify cats in a video, image, or webcam stream   [source=]
  register   Register images under an identity                   [source= label=]
  list       List registered identities with a suitability summary
  inspect    Suitability report for one identity                 (requires label=)
  delete     Remove an identity and its embeddings               (requires label=)
  migrate    Rebuild database embeddings with the current model
  train      Fine-tune the feature extractor                     [dataset_path=]
  val        Evaluate on the validation set                      [dataset_path=]
  export     Export the feature extractor to ONNX

Common arguments
  source=     Input. 0 for webcam, or a file path, directory, or URL
  label=      Identity name
  db_path=    Embedding database path
  device=     cuda | cpu
  verbose=    INFO | DEBUG | WARNING | ERROR

Examples
  lumipet predict source=0
  lumipet register source=./datasets/cats label=Nabi
  lumipet inspect label=Nabi
  lumipet train dataset_path=datasets/cat_individuals_dataset epochs=10

Settings come from config.yaml, or override any key with key=value.
See lumipet/cfg/default.yaml for the full list of keys and defaults."""

HELP_FLAGS = {"-h", "--help", "help"}
MODES = ("predict", "register", "list", "inspect", "delete",
         "migrate", "train", "val", "export")
```

`main()` 의 **맨 첫 줄**에 조기 분기를 넣는다. `setup_cuda_libs()` 보다 앞이어야 한다.

```python
def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] in HELP_FLAGS:
        print(USAGE)
        return

    from lumipet.utils import setup_cuda_libs, set_logging, LOGGER
    setup_cuda_libs()
    ...
```

도움말은 로그가 아니므로 `print()` 로 낸다. `LOGGER` 를 쓰면 레벨·타임스탬프 접두어가 붙는다.

- [ ] **Step 4: 모르는 모드에서 도움말 출력**

`main()` 끝의 else 분기를 바꾼다.

```python
    else:
        LOGGER.error(f"Unknown mode: {cfg.mode}")
        print(USAGE)
```

- [ ] **Step 5: 통과 확인**

```bash
.venv/bin/python -m pytest tests/test_cli_dispatch.py -q
```

기대: 5 passed

## Task 11: `cli.py` 를 디스패처로 재구성

**Files:**
- Modify: `lumipet/cli.py`
- Test: `tests/test_cli_dispatch.py`

**Interfaces:**
- Consumes: Task 9의 `ReID` 메서드, Task 10의 `USAGE`
- Produces:
  - `lumipet.cli._render_identities(rows: List[IdentitySummary]) -> None`
  - `lumipet.cli._render_report(prof) -> None`

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/test_cli_dispatch.py` 끝에 추가:

```python
def test_no_args_still_predicts(monkeypatch):
    """인자 없이 실행하면 도움말이 아니라 predict 경로를 탄다 (기존 동작 보존)."""
    from lumipet import cli
    calls = []

    class _Stub:
        def __init__(self, cfg): self.cfg = cfg
        def predict(self, source=None, streaming=None): calls.append(("predict", source))

    monkeypatch.setattr(cli, "ReID", _Stub)
    monkeypatch.setattr(sys, "argv", ["lumipet"])
    cli.main()
    assert calls and calls[0][0] == "predict"


def test_dispatch_routes_each_mode(monkeypatch):
    from lumipet import cli
    calls = []

    class _Stub:
        def __init__(self, cfg): self.cfg = cfg      # register 분기가 r.cfg.show 를 건드린다
        def identities(self): calls.append("identities"); return []
        def inspect(self, label): calls.append(("inspect", label)); return None
        def delete(self, label): calls.append(("delete", label)); return 0
        def migrate(self): calls.append("migrate"); return 0
        def train(self): calls.append("train")
        def val(self): calls.append("val")
        def export(self): calls.append("export")
        def register(self, source, label=""): calls.append(("register", source, label))
        def predict(self, source=None, streaming=None): calls.append(("predict", source))

    monkeypatch.setattr(cli, "ReID", _Stub)
    monkeypatch.setattr(cli, "_render_identities", lambda rows: None)
    monkeypatch.setattr(cli, "_render_report", lambda prof: None)

    for argv, expected in (
        (["lumipet", "list"], "identities"),
        (["lumipet", "inspect", "label=Nabi"], ("inspect", "Nabi")),
        (["lumipet", "delete", "label=Nabi"], ("delete", "Nabi")),
        (["lumipet", "migrate"], "migrate"),
        (["lumipet", "train"], "train"),
        (["lumipet", "val"], "val"),
        (["lumipet", "export"], "export"),
        (["lumipet", "register", "source=."], ("register", ".", "Unknown")),
    ):
        calls.clear()
        monkeypatch.setattr(sys, "argv", argv)
        cli.main()
        assert calls == [expected], f"{argv} -> {calls}"


def test_inspect_without_label_errors(monkeypatch, capsys):
    from lumipet import cli
    calls = []

    class _Stub:
        def __init__(self, cfg): self.cfg = cfg
        def inspect(self, label): calls.append(label)

    monkeypatch.setattr(cli, "ReID", _Stub)
    monkeypatch.setattr(sys, "argv", ["lumipet", "inspect"])
    cli.main()
    assert calls == []
```

- [ ] **Step 2: 실패 확인**

```bash
.venv/bin/python -m pytest tests/test_cli_dispatch.py -q
```

기대: FAIL — `cli` 에 `ReID` 도 `_render_identities` 도 없다.

- [ ] **Step 3: 렌더러 2개 작성**

`cli.py` 에 추가한다. **출력 문구는 현재 것을 글자 그대로 옮긴다.**

```python
def _render_identities(rows) -> None:
    from lumipet.core.quality import StatusLevel
    from lumipet.utils import LOGGER

    LOGGER.info("\n=== Registered Cats Summary ===")
    if not rows:
        LOGGER.info("No cats registered in the database.")
    else:
        for row in rows:
            prof = row.profile
            if prof.status_level == StatusLevel.UNCHECKED:
                LOGGER.info(f" - {row.label}: {row.embedding_count} embedding(s) | 적합도: [UNCHECKED] (미검사 상태)")
            else:
                LOGGER.info(
                    f" - {row.label}: {row.embedding_count} embedding(s) | 적합도: {prof.total_score:.1f}점 [{prof.status_level.value}]"
                )
    LOGGER.info("===============================\n")
```

```python
def _render_report(prof) -> None:
    from lumipet.utils import LOGGER

    LOGGER.info("\n" + "=" * 60)
    LOGGER.info(f"[Re-ID 적합성 진단 리포트] 대상: '{prof.label}' (등록 사진 {prof.sample_count}장)")
    LOGGER.info("-" * 60)
    LOGGER.info(f"▶ 종합 적합성 점수: {prof.total_score:.1f}점 / 100점 [{prof.status_level.value}]")
    LOGGER.info("\n[세부 지표 내역]")
    LOGGER.info(f" • 평균 화질 점수   : {prof.quality_avg:.1f} / 100점")
    LOGGER.info(f" • 개체 일관성 점수 : {prof.consistency_score:.1f} / 25점")
    LOGGER.info(f" • 포즈 다양성 점수 : {prof.diversity_score:.1f} / 25점")

    if prof.recommendations:
        LOGGER.info("\n[💡 추천 개선 가이드]")
        for idx, rec in enumerate(prof.recommendations, 1):
            LOGGER.info(f" {idx}. {rec}")
    LOGGER.info("=" * 60 + "\n")
```

현재 `cli.py:72-85` 의 `LOGGER.info` 블록을 **글자 그대로** 옮긴 것이다. 문구를 수정하지 않는다.
원본의 `store.close()` 와 `return` 은 렌더러의 책임이 아니므로 가져오지 않는다.

- [ ] **Step 4: `main()` 을 디스패처로 재구성**

```python
def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] in HELP_FLAGS:
        print(USAGE)
        return

    from lumipet.utils import setup_cuda_libs, set_logging, LOGGER
    from lumipet.core.config import Config
    from lumipet.utils import get_cfg_path
    setup_cuda_libs()

    cfg = Config.load(get_cfg_path(), args=sys.argv[1:])
    if len(sys.argv) > 1 and "=" not in sys.argv[1]:
        cfg.mode = sys.argv[1]
    if isinstance(cfg.source, str) and cfg.source.isdigit():
        cfg.source = int(cfg.source)

    # label 기본값이 "Unknown" 이라 "안 줬다" 와 "Unknown 을 줬다" 가 구분되지 않는다.
    # argv 에 label= 이 있었는지로 판정한다.
    label_given = any(a.startswith("label=") for a in sys.argv[1:])

    r = ReID(cfg)

    if cfg.mode == "list":
        _render_identities(r.identities())

    elif cfg.mode == "inspect":
        if not label_given:
            LOGGER.error("Please specify the label to inspect, e.g., 'lumipet inspect label=Nabi'")
            return
        _render_report(r.inspect(cfg.label))

    elif cfg.mode == "delete":
        if not label_given:
            LOGGER.error("Please specify the label to delete, e.g., 'lumipet delete label=Nabi'")
            return
        count = r.delete(cfg.label)
        LOGGER.info(f"Deleted {count} embedding(s) and profile for label: {cfg.label}")

    elif cfg.mode == "migrate":
        count = r.migrate()
        if count == 0:
            LOGGER.error("No records to migrate.")
        else:
            LOGGER.info(f"Migration completed successfully with quality verification. ({count} images)")

    elif cfg.mode == "predict":
        r.predict(cfg.source)

    elif cfg.mode == "export":
        r.export()

    elif cfg.mode == "register":
        source = ""
        r.cfg.show = False        # 파사드가 사본을 들고 있으므로 cfg 가 아니라 r.cfg 를 고친다
        if isinstance(cfg.source, (str, Path)) and os.path.exists(cfg.source):
            source = cfg.source
        elif os.path.isdir(cfg.dataset_path):
            source = cfg.dataset_path
        r.register(source=source, label=cfg.label)

    elif cfg.mode == "train":
        r.train()

    elif cfg.mode == "val":
        r.val()

    else:
        LOGGER.error(f"Unknown mode: {cfg.mode}")
        print(USAGE)
```

`cli.py` 상단에 `from lumipet.api import ReID` 를 둔다. 테스트가
`monkeypatch.setattr(cli, "ReID", _Stub)` 로 갈아끼우려면 모듈 속성이어야 한다.

`ReID(cfg)` 가 설정을 **깊은 복사**하므로, 생성 뒤에 `cfg` 를 고쳐도 파사드에 반영되지 않는다.
`register` 분기가 `r.cfg.show = False` 를 쓰는 이유다. 같은 이유로 이 아래에서 `cfg` 를 읽는 것은
읽기 전용일 때만 안전하다.

- [ ] **Step 5: 통과 확인**

```bash
.venv/bin/python -m pytest tests/test_cli_dispatch.py -q
```

기대: 8 passed

- [ ] **Step 6: 전체 테스트**

```bash
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

기대: 기준선 + 21

- [ ] **Step 7: 수동 확인 — 출력 문구가 변하지 않았는지**

```bash
.venv/bin/lumipet -h
.venv/bin/lumipet list
.venv/bin/lumipet bogus
```

기대: 도움말이 뜨고, `list` 출력이 변경 전과 동일하고, 모르는 모드에서 오류 + 도움말이 뜬다.

## Task 12: 노트북 사용 확인과 마무리

**Files:**
- 확인만. `baselines/training/model_train.py` 는 **사용자 파일이라 고치지 않는다**

**Interfaces:**
- Consumes: Task 9~11의 전체 표면
- Produces: 없음

- [ ] **Step 1: 파사드 도달 가능성 확인**

```bash
.venv/bin/python -c "
from lumipet import ReID
r = ReID(epochs=1)
for name in ('train','val','export','register','predict','identities','inspect','delete','migrate'):
    assert hasattr(r, name), name
print('9개 메서드 전부 도달 가능')
print('cfg.epochs =', r.cfg.epochs)
"
```

- [ ] **Step 2: 전체 테스트 최종 확인**

```bash
.venv/bin/python -m pytest -q 2>&1 | tail -3
```

- [ ] **Step 3: Commit (사용자 요청 시)**

논리 단위로 나눠 순차 커밋한다.

```bash
git add lumipet/models/yolo/model.py lumipet/models/matcher/knn.py lumipet/container.py
git commit -m "refactor(container): pass cfg into YoloModel and KnnMatcher

두 생성자가 cfg 를 super() 로 넘기지 않아 무조건 전역 싱글턴을 읽었다.
파사드가 인스턴스 설정을 소유하려면 부품까지 그 설정을 받아야 한다."

git add lumipet/api.py lumipet/__init__.py tests/test_api.py
git commit -m "feat(api): add ReID facade as the single entry point

import lumipet 한 줄로 학습 · 등록 · 추론 · DB 조작에 도달한다.

- 설정을 인스턴스가 소유한다. 전역 get_config() 를 바꾸지 않으므로
  설정이 다른 인스턴스를 여럿 만들어도 서로 간섭하지 않는다
- 모르는 오버라이드 키는 TypeError 로 즉시 실패시킨다. Config.load 의
  CLI 경로는 조용히 무시하는데, 그것이 reg_* 누락과 같은 실패 모드다
- 부품은 필요할 때만 만든다. identities()/inspect()/delete() 는
  EmbeddingStore 만 쓰고 torch 모델을 올리지 않는다
- 파사드는 값만 반환한다. 출력은 CLI 가 맡는다"

git add lumipet/cli.py tests/test_cli_dispatch.py
git commit -m "refactor(cli): reduce main() to a dispatcher and add usage help

- list/inspect/delete/migrate 로직이 ReID 파사드로 옮겨가고 cli 는
  인자 파싱과 출력 포맷만 맡는다. 출력 문구는 그대로다
- -h / --help / help 를 지원한다. setup_cuda_libs 와 Config.load 앞에서
  처리하므로 CUDA 초기화 없이 즉시 뜬다
- 모르는 모드에서 오류와 함께 사용법을 보여준다
- inspect/delete 가 sys.argv 를 다시 훑던 중복 파싱을 제거했다
- 인자 없이 실행하면 기존대로 predict 를 탄다"
```

- [ ] **Step 4: 사용자에게 보고할 것**

- `baselines/training/model_train.py` 를 `ReID(**config)` 한 줄로 줄일 수 있다. **사용자 파일이라 고치지 않았다.**

  ```python
  from lumipet import ReID
  ReID(**config).train()
  ```

- `dev/train.sh` 의 `reid train` → `lumipet train` (1단계에서 이미 보고).
- 변경 파일 목록과 `git diff --stat` 을 첨부한다.

---

## 검증 요약

| 단계 | 확인 |
|---|---|
| 1단계 | 기준선과 동일한 테스트 통과 · `lumipet list` 동작 · 옛 `reid` 명령 부재 |
| 2단계 | 기준선 + 21 통과 · 9개 메서드 도달 가능 · `identities()` 가 모델을 안 만듦 · 출력 문구 불변 |
