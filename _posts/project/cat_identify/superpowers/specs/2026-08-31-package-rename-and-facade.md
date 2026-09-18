# 설계 명세 — 패키지 리네이밍(`reid` → `lumipet`)과 단일 진입점 파사드 `ReID`

**작성일** 2026-08-31
**경로 분류** Architectural (새 공개 인터페이스 + 패키지 경계 변경)
**선행 문서** `dev/workflow.md` §0.1, §4
**제안 브랜치** 1단계 `refactor/package-rename` → 2단계 `feature/facade-api`

---

## 1. 목표

한 문장: **`import lumipet` 하나로 학습·등록·추론·DB 조작을 다 할 수 있게 한다.**

부수 목표 — 패키지 이름이 무엇에 대한 re-ID인지 말하게 한다.

---

## 2. 문제

### 2.1 진입점이 흩어져 있다

지금 파이썬에서 학습을 돌리려면 이렇게 해야 한다 (`baselines/training/model_train.py`).

```python
cfg = get_config()
for k, v in config.items():
    setattr(cfg, k, v)
extractor = build_extractor(cfg)
extractor.train()
```

전역 설정을 꺼내 손으로 덮어쓰고, 컨테이너에서 부품을 꺼내 조립한다. **무엇을 부를 수 있는지 알려면 `container.py`와 `cli.py`를 읽어야 한다.**

### 2.2 CLI에만 있는 기능이 있다

`list` / `inspect` / `delete` / `migrate` 로직이 `cli.py` 본문에 인라인으로 있다. 파이썬에서는 못 쓴다.
확인해 보면 `list`/`inspect`/`delete`는 **전부 프레젠테이션**이다 — `EmbeddingStore`에
`list_labels`, `list_identity_profiles`, `get_identity_profile`, `delete_label`이 이미 있고
CLI는 그 결과로 표를 그릴 뿐이다. 실제 로직이 있는 건 `migrate` 하나다.

### 2.3 import 이름이 배포명과 어긋난다

배포명은 이미 `lumipet-reid`(`pyproject.toml:6`)인데 import 이름만 `reid`다.
`import reid`는 어떤 re-ID인지 말해주지 않는다.

### 2.4 전역 설정 싱글턴

`get_config()`가 모듈 전역 `_config`를 돌려준다(`core/config.py`). 설정이 다른 인스턴스를
두 개 만들 수 없어, 노트북에서 실험 두 개를 나란히 돌리지 못한다.

---

## 3. 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 파사드 범위 | **단일 진입점** — `cli.py` 로직 흡수 | 노트북과 CLI가 같은 경로를 타야 동작이 갈라지지 않는다 |
| 설정 소유 | **인스턴스가 소유**, 전역 미변경 | 실험 두 개 병행. 테스트가 전역에 오염되지 않음 |
| import 이름 | **`lumipet`** (소문자) | PEP 8. 대문자는 대소문자 구분 없는 FS(macOS·Windows)에서만 통과하고 Linux에서 깨지는 함정 |
| 패키지 구조 | **평면** (`lumipet/` 아래 현 구조 그대로) | 당분간 re-ID만. 중첩은 확실한 불편을 치르고 불확실한 미래를 삼 |
| 공개 이름 | **`from lumipet import ReID`** | 패키지명이 "어떤 re-ID"를 말해주므로 클래스는 짧게. 기존 PascalCase 규칙과 일치 |
| 호출 가능 모듈 | **채택 안 함** | `sys.modules[__name__].__class__` 우회는 IDE·타입체커가 이해 못 한다. 발견성을 위해 만드는 파사드가 발견성을 잃는다 |
| 출력 책임 | **파사드는 값만 반환, CLI가 표를 그림** | §2.2 |
| 실행 순서 | **리네이밍 먼저, 파사드 나중** | 237곳 기계적 변경과 설계 변경을 한 diff에 섞으면 리뷰 불가. 파사드 이름을 두 번 짓지 않아도 됨 |

---

## 4. 단계 구성

```
1단계  refactor/package-rename   reid/ -> lumipet/   (기계적, 202개 테스트가 검증)
   v
2단계  feature/facade-api        lumipet/api.py 신설 + cli.py 재구성
```

두 단계를 **각각 별도 브랜치·별도 검증**으로 진행한다. 1단계가 그린이 되기 전에는 2단계에 착수하지 않는다.

---

## 5. 1단계 — 패키지 리네이밍

### 5.1 범위

| 대상 | 내용 |
|---|---|
| 디렉터리 | `reid/` → `lumipet/` (`git mv`) |
| import 사이트 | **237곳 / 60파일** (`lumipet` 30, `tests` 28, `baselines` 2) |
| `pyproject.toml` | `[tool.setuptools.packages.find] include = ["reid*"]` → `["lumipet*"]` |
| `pyproject.toml` | `[project.scripts]` — §5.4 참조 |
| `README.md` | 디렉터리 트리, CLI 예시 |

`project.name`은 이미 `lumipet-reid`라 **바꾸지 않는다.**
`DEFAULT_CFG_ROOT`는 `Path(__file__).parents[1]`로 잡히므로 디렉터리를 따라 자동으로 옮겨간다.

### 5.2 바꾸면 안 되는 것 — 맹목적 sed 금지

`sed 's/reid/lumipet/g'` 로 처리하면 아래를 망가뜨린다. **반드시 개별 확인한다.**

| 위치 | 내용 | 조치 |
|---|---|---|
| `models/reid/model.py:15` | `task="reid_pipeline"` | **유지.** 패키지 참조가 아니라 태스크 라벨 |
| `models/extractor/model.py:33` | `task="reid"` | **유지.** 같은 이유 |
| `models/reid/` 디렉터리 | 파이프라인 모듈 이름 | **유지.** `lumipet/models/reid/` 가 된다 |
| 주석·docstring의 `Re-ID`, `re-id` | 제품/기술 용어 | **유지** |
| `datasets/reid_bench` | 데이터 경로 | **유지** |
| `lumipet_reid.egg-info` | 배포 메타데이터 | 재설치 시 자동 갱신 |

### 5.3 문자열 안의 참조 — 문법 기반 치환이 놓치는 것

import 문이 아니라 **문자열**이라 `from X import` 패턴으로는 잡히지 않는다.

| 위치 | 내용 |
|---|---|
| `__init__.py:27` | `importlib.import_module("reid.models")` |
| `tests/test_dependency_isolation.py:21,26` | `_import_probe("import reid.models")`, `_import_probe("from reid.container import ...")` |
| `tests/test_tracking.py:792` 외 | `patch("reid.core.tracker.LOGGER")` 형태의 monkeypatch 대상 경로 |
| `utils/__init__.py:44` | `os.chdir("//reid/cfg/")` — `__main__` 블록의 디버그 코드. 경로가 이미 깨져 있다. **블록째 삭제한다** (사용자 확인: 코드 확인용 임시 작성물) |

착수 시 `grep -rn "['\"][^'\"]*reid" --include=*.py` 로 문자열 참조를 먼저 전수 확인한다.

### 5.4 콘솔 명령 — `lumipet` 하나로 바꾼다

```toml
[project.scripts]
lumipet = "lumipet.cli:main"
```

`reid`는 남기지 않는다. 실제 범위가 작아서 병기할 이유가 없다.

| 대상 | 규모 |
|---|---|
| `pyproject.toml` | 1줄 |
| `README.md` | **11줄** (`reid register` / `predict` / `list` / `delete` / `migrate` / `export` / `val` / `train` 예시) |
| `dev/train.sh` | 1줄. **gitignore 대상인 사용자 파일이라 에이전트가 고치지 않고 알린다** |

재설치(`pip install -e .`) 전까지는 기존 `reid` 명령이 남아 있다. 착수 후 재설치로 갱신한다.

사용자에게 보이는 문자열에도 콘솔 명령이 박혀 있다. **`cli.py` 밖에도 있으므로 함께 고친다.**

| 위치 | 문자열 |
|---|---|
| `cli.py:66` | `"... e.g., 'reid inspect label=Nabi'"` |
| `cli.py:99` | `"... e.g., 'reid delete label=Nabi'"` |
| `models/extractor/embedding.py:290` | `"미검사 상태: 'reid inspect' 명령어를 통해 ..."` |
| `models/extractor/embedding.py:364` | `"Please run 'reid migrate' to regenerate features."` |

`embedding.py` 두 곳은 **1단계에서 함께 고친다** — 콘솔 명령을 바꾸는 것이 1단계이므로 안내 문구가
없는 명령을 가리키게 두면 안 된다. `cli.py` 두 곳은 **1단계에서 건드리지 않는다.**
`cli.py`를 어차피 다시 쓰는 2단계에서 도움말과 함께 정리한다(§7.2). 1단계를 순수 기계적 변경으로 유지하기 위해서다.

### 5.5 검증

- **202개 테스트 전부가 `reid`를 import 한다.** 스위트 통과가 리네이밍의 정확성 검증 그 자체다.
- `pip install -e .` 후 `lumipet list` 가 동작하고, 옛 `reid` 명령은 더 이상 없어야 한다.
- 동작 변화가 없어야 한다. 이 단계에서는 **로직을 한 줄도 고치지 않는다** (§5.3의 `os.chdir` 삭제 제외).

---

## 6. 2단계 — 파사드 `lumipet.ReID`

### 6.1 모듈 배치

```
lumipet/
├── __init__.py     # lazy __getattr__ 목록에 "ReID" 추가
├── api.py          # 신설. ReID
├── cli.py          # 인자 파싱 + 출력 포맷만 남음
├── container.py    # build_* 유지. 파사드가 위임
└── cfg/ core/ data/ engine/ models/ stream/ utils/
```

`container.py`를 유지하는 이유: `tests/test_training_integration.py`·`test_dependency_isolation.py`가
직접 쓰고, `MegaDesExtractorModel._ensure_detector`도 쓴다. README가 DI 이음매로 문서화해 두었다.
파사드는 생성 로직을 **중복 구현하지 않고 위임**한다.

### 6.2 설정 소유

```python
class ReID:
    def __init__(self, cfg: "Config | str | Path | None" = None, **overrides) -> None: ...
```

| `cfg` | 동작 |
|---|---|
| 생략 | `Config.load(get_cfg_path())` — 기존 해석 규칙 그대로 (`config.yaml` 있으면 그것, 없으면 `cfg/default.yaml`) |
| `Config` 인스턴스 | **깊은 복사**해서 소유. 호출자의 객체를 건드리지 않는다 |
| 경로 | 그 YAML로 로드 |

`**overrides`가 노트북의 `for k, v in config.items(): setattr(cfg, k, v)`를 대체한다.

**모르는 키는 `TypeError`로 즉시 실패시킨다.**
`Config.load`의 CLI 경로는 미지의 키를 조용히 `setattr` 한다(`config.py`의 else 분기).
노트북에서 `arcface_margn=0.0` 오타가 아무 일도 일으키지 않는 것은 `reg_*` 필드 누락(9fca5d0)과
같은 실패 모드다. 파사드는 kwargs라 오타를 잡을 수 있으므로 잡는다.

**전역 `get_config()`는 건드리지 않는다.** 인스턴스 두 개가 서로 간섭하지 않는다.

`Config.load`의 부수효과(`select_device`가 CUDA 부재 시 `cpu`로 강등, `set_logging`)는
**오버라이드를 적용한 뒤에** 한 번 수행한다. 순서를 틀리면 오버라이드한 `device`/`verbose`가 안 먹는다.

### 6.3 배선 2곳 — 전역 폴백 차단

`cfg or get_config()` 폴백이 10곳 있으나 전부 폴백이라, 파사드가 cfg를 명시적으로 내려주면 전역을
타지 않는다. **단 두 곳이 `cfg`를 `super()`로 넘기지 않아 무조건 전역을 읽는다.**

| 위치 | 현재 | 변경 |
|---|---|---|
| `models/yolo/model.py` | `YoloModel(model_path, task)` → `BaseModel(..., cfg=None)` | `cfg` 인자 추가, `super()`로 전달 |
| `models/matcher/knn.py` | `KnnMatcher(k, threshold)` → `BaseMatcher(threshold)` | `cfg` 인자 추가, `super()`로 전달 |

`FaissMatcher`는 이미 `cfg`를 받는다(`faiss.py:11`). `container.build_detector`/`build_matcher`도
cfg를 전달하도록 함께 고친다.

### 6.4 지연 생성

`detector` / `extractor` / `matcher` / `pipeline` / `store`를 lazy 프로퍼티로 둔다.

| 호출 | 만들어지는 것 |
|---|---|
| `train()` | extractor만 |
| `register()` | extractor (내부 `_ensure_detector`가 필요할 때 detector) |
| `predict()` | detector + extractor + matcher + pipeline |
| `val()` | 전부 (아래 참고) |
| `identities()` / `inspect()` / `delete()` | **아무 모델도 안 만듦.** `EmbeddingStore`만 |

마지막 줄이 지연 import의 실질적 이득이다 — `lumipet list`가 torch 모델을 올리지 않는다.
지금 `cli.py`도 그 모드들에서 `EmbeddingStore`만 만들고 있으므로 성질을 파사드로 옮기는 것이다.

`val()`에는 lazy 이득이 없다. `ExtractorValidator.validate(pipeline=...)`가 파이프라인을 요구한다.
**기존 동작이며 이번에 바꾸지 않는다.**

### 6.5 메서드 표면

| 메서드 | 반환 | 부품 |
|---|---|---|
| `train()` | `dict` — `BaseTrainer.train()` 반환값 그대로 (`trainer.py:391`) | extractor |
| `val()` | `dict` — `ExtractorValidator.validate()` 반환값 그대로 (`val.py:73`) | extractor + pipeline |
| `export(path=None)` | `str` — 내보낸 경로 | extractor |
| `register(source, label="")` | `None` (현행 유지, §9) | extractor |
| `predict(source=None, streaming=None)` | `Results` | pipeline |
| `identities()` | `list[IdentitySummary]` | store |
| `inspect(label)` | `SuitabilityReport` — 항상 반환 (§6.6) | store |
| `delete(label)` | `int` — 삭제 수 | store |
| `migrate()` | `int` — 재등록 수 | extractor |

**`predict(source=...)`와 `cfg.source`의 이중 경로**: 인자가 우선, 생략하면 `cfg.source`를 쓴다.

### 6.6 신설 타입 — `IdentitySummary` 하나뿐

```python
@dataclass
class IdentitySummary:
    label: str
    embedding_count: int
    profile: SuitabilityReport   # 항상 존재. 미검사면 status_level == UNCHECKED
```

**`Optional` 이 아니다.** `EmbeddingStore.get_identity_profile` 의 타입 힌트는 `Optional[...]` 이지만
구현은 행이 없을 때 **`StatusLevel.UNCHECKED` 리포트를 합성해 돌려준다**(`embedding.py:274-291`).
`None` 을 돌려주는 경로가 없다. 현재 `cli.py` 도 `None` 검사 없이 `prof.status_level` 을 읽고 있어
이 동작에 이미 의존한다. 잘못된 힌트를 고치는 것은 범위 밖이므로 **동작에 맞춰 설계한다.**

`cli.py`가 지금 `list_labels()`(개수)와 `list_identity_profiles()`(프로필)를 합쳐 표를 그린다.
그 합치는 일을 파사드가 하고 CLI는 표만 그린다. `SuitabilityReport`는 이미 있으므로 재사용한다.

**직렬화(`to_dict`)는 넣지 않는다.** 웹 백엔드 연동은 연기된 상태이고, 지금 필요 없는 기능이다.

---

## 7. `cli.py` 재구성

아래는 골격을 보이기 위한 의사코드다. `label` 과 `source` 의 결정 방식은 §7.1 을 따른다.

```python
def main() -> None:
    setup_cuda_libs()
    cfg = Config.load(get_cfg_path(), args=sys.argv[1:])
    if len(sys.argv) > 1 and "=" not in sys.argv[1]:
        cfg.mode = sys.argv[1]

    r = ReID(cfg)

    if   cfg.mode == "list":     _render_identities(r.identities())
    elif cfg.mode == "inspect":  _render_report(r.inspect(label))
    elif cfg.mode == "delete":   LOGGER.info(f"Deleted {r.delete(label)} ...")
    elif cfg.mode == "migrate":  LOGGER.info(f"Migrated {r.migrate()} ...")
    elif cfg.mode == "predict":  r.predict(cfg.source)
    elif cfg.mode == "register": r.register(source, cfg.label)
    elif cfg.mode == "train":    r.train()
    elif cfg.mode == "val":      r.val()
    elif cfg.mode == "export":   r.export()
    else:                        LOGGER.error(...)
```

`_render_identities` / `_render_report`가 지금의 `LOGGER.info` 표 그리기를 그대로 가져간다.
**출력 문구는 한 글자도 바꾸지 않는다.** 동작 변화를 구조 변경과 섞지 않기 위해서다.

### 7.1 함께 사라지는 중복

`inspect`와 `delete`가 `sys.argv[2:]`를 직접 훑어 `label=`을 다시 파싱한다(`cli.py:60`, `:99`).
`Config.load`가 이미 파싱해 `cfg.label`에 넣어 두는데도 그렇다. 디스패치를 새로 쓰면서 제거한다.

**단 `label` 기본값이 `"Unknown"`이라 "값을 안 줬다"와 "Unknown을 줬다"가 구분되지 않는다.**
`register`에서는 `"Unknown"`이 유효한 기본값이라 기본값 자체를 바꿀 수 없다.
`inspect`/`delete`는 **argv에 `label=`이 있었는지**로 판정한다.

### 7.2 CLI 도움말

지금은 `-h` 를 치면 `"="` 가 없어 `cfg.mode = "-h"` 가 되고 `Unknown mode: -h` 와 모드 목록이 나온다.
뼈대는 있으나 도움말이라 부를 수준이 아니다.

#### 7.2.1 `argparse` 를 쓰지 않는다

설정 키가 76개다. 이를 argparse 에 전부 선언할 수 없고, `parse_known_args` 로 받으면 결국
`key=value` 를 직접 처리하게 된다. `key=value` 는 이 저장소의 규약이며 `Config` 데이터클래스와 맞물려 있다.
argparse 가 사주는 것은 `-h` 하나인데 그것은 손으로 쓰는 편이 짧다.

#### 7.2.2 출력 (영어로 작성한다)

기존 CLI 오류 메시지가 영어이므로 도움말도 영어로 맞춘다.

```text
lumipet <mode> [key=value ...]

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
See lumipet/cfg/default.yaml for the full list of keys and defaults.
```

#### 7.2.3 동작 규칙

| 입력 | 결과 |
|---|---|
| `-h` / `--help` / `help` | 도움말 출력 후 종료 |
| 모르는 모드 | `Unknown mode: xxx` + 도움말 |
| `inspect` / `delete` 에 `label=` 누락 | 해당 모드 한 줄 안내. **현재 문구를 유지**하되 예시만 `lumipet` 으로 |
| **인자 없음** | **현행 유지** — `predict source=0`(웹캠) |

마지막 줄은 의도적 보존이다. 지금 `reid` 만 치면 웹캠이 켜진다. 도움말을 띄우는 편이 덜 놀랍지만
**동작 변경**이므로 이번 범위에서 뺀다.

#### 7.2.4 구현 위치

도움말은 `setup_cuda_libs()` 와 `Config.load()` **앞에서** 처리하고 즉시 반환한다.
그래야 `lumipet -h` 가 CUDA 초기화나 YAML 로딩 없이 즉시 뜬다.
문구는 `cli.py` 의 모듈 상수 하나로 두고 `print()` 로 낸다 — 도움말은 로그가 아니므로
`LOGGER` 를 거치지 않는다(로그 레벨·타임스탬프 접두어가 붙으면 안 된다).

---

## 8. 테스트 전략

GPU 의존도 장시간 실행도 없으므로 **TDD 예외를 적용하지 않는다**(`workflow.md` §4).

### 8.1 신설 — 설정 소유

| 테스트 | 검증 |
|---|---|
| `test_instances_own_independent_config` | `ReID(epochs=20)`과 `ReID(epochs=5)`가 서로 간섭하지 않는다 |
| `test_unknown_override_raises` | `ReID(arcface_margn=0.0)` → `TypeError` |
| `test_overrides_applied` | `ReID(epochs=20).cfg.epochs == 20` |
| `test_cfg_instance_is_deep_copied` | 호출자가 넘긴 `Config`가 변형되지 않는다 |
| `test_cfg_path_argument` | 경로를 주면 그 YAML로 로드 |
| `test_global_config_untouched` | `ReID(...)` 생성이 `get_config()` 결과를 바꾸지 않는다 |
| `test_detector_and_matcher_receive_instance_cfg` | §6.3 배선 2곳이 실제로 전달되는지 |

### 8.2 신설 — 지연 생성

| 테스트 | 검증 |
|---|---|
| `test_identities_builds_no_model` | `build_extractor`/`build_detector`를 patch 하고 `identities()` 호출 시 **한 번도 안 불린다** |
| `test_train_builds_extractor_only` | detector·matcher가 만들어지지 않는다 |

### 8.3 신설 — 데이터 반환

| 테스트 | 검증 |
|---|---|
| `test_identities_merges_counts_and_profiles` | `list_labels` + `list_identity_profiles` 합침. 프로필 없는 개체는 `profile is None` |
| `test_inspect_returns_none_for_missing_label` | |
| `test_delete_returns_count` | |

### 8.4 신설 — CLI 디스패치

`ReID`를 patch 하고 9개 모드가 각각 올바른 메서드를 올바른 인자로 부르는지.
기존 `tests/test_cli_quality.py`가 `sys.argv`를 조작해 `list`/`inspect`를 태우고 있으므로 그 방식을 따른다.

### 8.5 신설 — CLI 도움말

| 테스트 | 검증 |
|---|---|
| `test_help_flags_print_usage` | `-h` / `--help` / `help` 각각에서 사용법이 출력되고 정상 종료 |
| `test_unknown_mode_shows_help` | 모르는 모드 → 오류 한 줄 + 도움말 |
| `test_help_does_not_load_config_or_cuda` | `setup_cuda_libs` 와 `Config.load` 를 patch 해두고 `-h` 실행 시 **둘 다 안 불린다** |
| `test_no_args_still_predicts` | 인자 없이 실행하면 도움말이 아니라 `predict` 경로를 탄다 (§7.2.3 마지막 줄 보존) |

### 8.6 기존 스위트

리네이밍으로 import 경로가 전부 바뀌지만 공개 API는 그대로라 통과해야 한다.
착수 시점 그린 베이스라인을 먼저 확인하고 그 수집 개수를 기준선으로 삼는다.

---

## 9. 범위 밖 (후속)

| 항목 | 이유 |
|---|---|
| `register()` 반환값 데이터화 | 등록 파이프라인 내부(품질 게이트·Tier-2 fallback·프로필 생성)를 크게 건드린다 |
| 웹 연동 · JSON 직렬화 | 연기된 상태. 지금 설계 동인이 아니다 |
| `use_onnx`/`use_tensorrt` 확장자 추론 | 별건. `dev/notes` 의 C-3 |
| `key=value` 수동 파서 → `argparse` | 별건. 이번엔 파싱 방식을 건드리지 않는다 |
| `baselines/training/model_train.py` 를 `ReID(**config)` 로 전환 | 사용자 파일. 제안만 하고 직접 고치지 않는다 |

---

## 10. 리스크

1. **리네이밍이 237곳을 건드린다.** 파사드와 섞으면 리뷰가 불가능하다. §4의 2단계 분리가 그 대응이다.
2. **문자열 안의 모듈 경로**(§5.3)를 놓치면 런타임에만 터진다. `monkeypatch` 대상 경로는
   테스트 실패로 드러나지만, `importlib.import_module("reid.models")`는 `__getattr__` 경로라
   해당 이름에 접근할 때만 터진다. 착수 전 문자열 전수 확인이 필수다.
3. **전역 싱글턴을 직접 쓰던 코드의 동작이 달라진다.** `baselines/training/model_train.py`가
   정확히 그 방식이다. 파사드 도입 후에도 `get_config()`는 그대로 동작하므로 깨지지는 않으나,
   파사드 인스턴스와 전역이 별개라는 점을 사용자가 알아야 한다.
4. **`Config.load` 부수효과 순서**(§6.2). 틀리면 오버라이드한 `device`/`verbose`가 조용히 무시된다.
5. **`cfg.mode`/`source`/`label`이 Config에 남는다.** 파사드가 인자로 받으므로 CLI 전용 필드가 된다.
   지금도 CLI 전용이라 실질 변화는 없으나, `Config`에 남아 있는 것이 어색해진다. 정리는 범위 밖.

---

## 11. 성공 기준

### 1단계

- `git mv` 후 전체 스위트 통과 (실패 0건), 착수 시점 수집 개수와 동일
- `pip install -e .` 후 `lumipet list` 동작, 옛 `reid` 명령 부재
- diff가 import 경로·설정·문서에만 나타남. 로직 변경은 `utils/__init__.py` 의
  `__main__` 디버그 블록 삭제(§5.3) 하나뿐이며 실행 경로 밖이다

### 2단계

- 신설 테스트를 포함한 전체 스위트 통과
- `from lumipet import ReID` 한 줄로 `train` / `register` / `predict` / `val` / `export` /
  `identities` / `inspect` / `delete` / `migrate` 9개가 전부 도달 가능
- `identities()` 호출 시 `build_extractor` 가 **한 번도 불리지 않음** (테스트로 고정)
- `cli.py` 의 출력 문구가 변경 전과 동일 (도움말은 신설이므로 제외)
- `lumipet -h` 가 CUDA 초기화·YAML 로딩 없이 사용법을 출력
- 인자 없이 `lumipet` 실행 시 기존대로 `predict` 동작
- 설정이 다른 `ReID` 인스턴스 두 개가 서로 간섭하지 않음
