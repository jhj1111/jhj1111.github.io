# 설계 명세 — 가속 백엔드를 가중치 확장자로 판단 (TensorRT 제거)

**작성일** 2026-09-02
**경로 분류** Architectural (문서화된 공개 설정 계약 변경 + 모델 로딩 재배치)
**선행 문서** `dev/workflow.md` §4 (검출기 ONNX 스파이크 노트는 2026-09-03 삭제 — 결론은
아래 §6.1 에 그대로 옮겨져 있고, CUDA 관련 절은 오진이라 `dev/notes/2026-09-02-handoff.md` §4.2 로 정정됐다)
**제안 브랜치** `refactor/onnx-backend-by-extension`

---

## 1. 목표

한 문장: **`use_onnx` / `use_tensorrt` 설정을 없애고, 가중치 파일의 확장자가 백엔드를 정하게 한다.**

부수 목표 — 반쪽만 구현된 TensorRT 경로를 걷어낸다.

---

## 2. 문제

### 2.1 설정이 확장자와 중복된다

`extractor_weights: "weights/x.pth"` 와 `use_onnx: True` 를 함께 줘야 ONNX 를 쓴다. 파일이 무엇인지
이미 확장자가 말하는데 별도 불리언이 또 있다. 두 값이 어긋날 수 있는 상태 자체가 불필요하다.

### 2.2 TensorRT 는 추출기에 구현이 없다

| 위치 | 내용 |
|---|---|
| `lumipet/models/yolo/model.py:26-27` | `use_tensorrt` → `engine_detector`. **검출기만** |
| `lumipet/models/extractor/` | TensorRT 분기 **없음** |

`cfg.engine_extractor` 프로퍼티는 **프로덕션 코드에서 아무도 읽지 않는다**(`tests/test_config.py` 만 읽는다).
즉 `use_tensorrt=True` 로 둬도 추출기는 PyTorch 로 돈다. 그런데 `README.md:271` 은
"TensorRT 가속 백엔드 사용 여부"로 문서화하고 있다. **문서가 없는 기능을 약속한다.**

사용자 확인: TensorRT 는 **한 번도 실행한 적이 없다.**

### 2.3 백엔드 판정이 세 곳에 흩어져 있다

`ExtractorPredictor` 가 `use_onnx` 를 세 번 따로 본다.

| 위치 | 용도 |
|---|---|
| `predict.py:23` | 세션 생성 여부 |
| `predict.py:48` | fp16 캐스팅 여부 |
| `predict.py:54` | 추론 경로 선택 |

`embedding_size` 를 아는 것은 모델인데 백엔드는 예측기가 정한다. 책임이 갈라져 있다.

---

## 3. 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| TensorRT | **제거** | §2.2. 구현 없음 · 미실행 |
| ONNX | **유지**, 확장자로 판단 | 실행 이력 있음. `export()` 는 테스트도 통과 |
| 분기 위치 | **`_load_model` 안** (접근안 A) | §2.3 을 한 곳으로 수렴 |
| ONNX 백엔드 제약 | `train()` / `export()` 는 **명확한 에러** | 추론 전용으로 규정. 오동작 없음 |
| ONNX 의존성 | **이번 범위 밖.** extras 분리는 후속 | §8 |

### 3.1 접근안 비교 (기각한 것)

**B. 백엔드 클래스 분리 + 팩토리** — `OnnxExtractor` 가 `train`/`export` 를 아예 갖지 않아 제약이
타입 수준에서 성립한다. 그러나 `MegaDesExtractorModel` 은 `register` · `register_batch_images` ·
`_detect_and_filter_crops` · `_evaluate_and_save_profile` 등 **약 360줄의 등록 파이프라인**을 갖고 있어,
두 백엔드가 공유하려면 기반 클래스로 끌어올리는 큰 리팩터링이 따라온다. 설정 정리라는 목적에 비해 과하다.

**C. 예측기에서만 분기** — 가장 작은 변경이지만 §2.3 의 책임 분리 문제가 그대로 남는다.

### 3.2 A 가 지불하는 대가 — LSP 위반

**흐리지 않고 적는다. SOLID 관점에서는 B 가 옳다.**

| 원칙 | 판정 |
|---|---|
| ISP | **B 승.** `OnnxExtractor` 가 쓸 수 없는 메서드를 아예 갖지 않는다 |
| **LSP** | **B 승.** `train()` 이 `RuntimeError` 를 던지는 것은 **상위 타입의 계약을 못 지키는 하위 타입**이다. 교과서적 위반이다 |
| SRP | B 승. A 는 한 클래스가 두 백엔드를 안다 |
| OCP / DIP | 무승부 |

그럼에도 A 를 택하는 근거는 **ONNX 백엔드가 torch 백엔드의 대등한 형제가 아니라 기능이 빠진
열화판**이라는 데 있다. 열화를 형제 클래스로 모델링하면 공통부(등록 파이프라인 약 360줄)를 담을
기반 클래스를 새로 만들어야 하고, **그 추상은 오직 이 분리를 위해서만 존재한다.** 백엔드는 둘뿐이고
셋째가 올 가능성도 낮다 — TensorRT 는 파일 포맷이 아니라 provider 설정으로 오기 때문이다(§8).

즉 **YAGNI 를 위해 LSP 를 지불한 선택**이다. 백엔드가 셋 이상으로 늘거나 ONNX 쪽 분기가 커지면
B 로 올리는 것이 맞다.

---

## 4. 백엔드 판정과 모델 로딩

`MegaDesExtractorModel._load_model` 이 확장자를 보고 갈라진다. 호출 지점은
`ExtractorModel.__init__:34` 로 이미 존재하므로 새 진입점을 만들지 않는다.

```python
def _load_model(self, weights: str) -> None:
    if str(weights).lower().endswith(".onnx"):
        self.backend = "onnx"
        self._load_onnx(weights)
    else:
        self.backend = "torch"
        self._load_torch(weights)      # 현행 로직을 그대로 옮긴다
```

### 4.1 `_load_onnx` 가 얻는 값

실측으로 확인했다(더미 모델 export 후 `onnxruntime` 세션 조회).

| 항목 | 출처 | 실측 |
|---|---|---|
| 세션 | `ort.InferenceSession(path, providers=...)` — 현 `predict.py:26-28` 로직 이동 | — |
| `embedding_size` | `session.get_outputs()[0].shape[1]` | `['batch_size', 8]` → `8` (`int`) |
| `imgsz` | `session.get_modelmeta().custom_metadata_map["imgsz"]` | `{'imgsz': '32', 'model_name': 'tiny', ...}` |
| `imgsz` 폴백 | `session.get_inputs()[0].shape[2]` | `['batch_size', 3, 32, 32]` → `32` |

`export()` 가 `imgsz` · `model_name` · `extractor_type` · `threshold` 를 메타데이터로 심으므로
(`predict.py:210-215`) 우리가 내보낸 ONNX 는 자기 자신을 설명한다. 외부에서 받은 ONNX 를 대비해
입력 shape 폴백을 둔다.

`weights/ci_15.onnx`(실제 export 산출물, Swin-L)로 검증했다.

```
opset  : 18
meta   : {'imgsz': '384', 'model_name': 'hf-hub:BVRA/MegaDescriptor-L-384',
          'extractor_type': 'mega_descriptor', 'threshold': '0.15'}
input  : ['batch_size', 3, 384, 384]
output : ['batch_size', 1536]
```

### 4.1.1 3단 폴백

`shape[1]` 은 정수가 아닐 수 있다 — 차원이 동적이면 문자열(`'dim'`)이 온다. 예외로 끝내지 않고
**더미 추론으로 실제 shape 를 읽는다.** 실측 비용이 **CPU 0.3초**라 예외를 던질 이유가 없다.

**`embedding_size`**

1. `session.get_outputs()[0].shape[1]` 이 `int` 면 그것 (실측 `1536`)
2. 아니면 `session.run(None, {input: zeros((1,3,H,H))})[0].shape[1]` (실측 0.3s, CPU)
3. 둘 다 실패하면 예외 — 임베딩 차원을 모르면 매칭을 할 수 없다

**`imgsz`**

1. 메타데이터 `imgsz` (실측 `'384'`)
2. `session.get_inputs()[0].shape[2]` 가 `int` 면 그것 (실측 `384`)
3. 둘 다 동적이면 `cfg.imgsz` 를 그대로 둔다

2단계가 있으면 출력 차원이 동적인 **외부 ONNX 도 받아낼 수 있다.**

### 4.1.2 외부 데이터 사이드카

2GB 급 모델은 ONNX 가 가중치를 별도 파일로 뺀다. 실측:

```
weights/ci_15.onnx        798M
weights/ci_15.onnx.data   794M   <- 외부 데이터
```

- **파일 존재 검사를 `.onnx` 만 보면 부족하다.** `.data` 가 없으면 세션 생성이 실패한다
- 가중치를 옮기거나 복사할 때 **두 파일이 함께** 가야 한다
- 로딩 실패 메시지에 사이드카 가능성을 언급한다 (§4.3)

`Config.onnx_extractor` 는 `.onnx` 경로만 돌려주는 현행을 유지한다 — 사이드카는 ORT 가 인접 파일에서
자동으로 찾는다.

### 4.2 상태 변수

| 이름 | torch 백엔드 | onnx 백엔드 |
|---|---|---|
| `self.backend` | `"torch"` | `"onnx"` |
| `self.model` | timm 모듈 | **`None`** |
| `self.session` | `None` | `ort.InferenceSession` |
| `self.embedding_size` | 더미 forward 로 추론 | 세션 출력 shape |

### 4.3 실패 처리 — ONNX 는 조용히 넘어가지 않는다

파일이 없거나 세션 생성이 실패하면 **즉시 예외**를 던진다.

현행 `_load_torch` 는 가중치 로딩이 실패해도 except 로 삼키고 pretrained 백본으로 계속한다
(`mega_descriptor/model.py:60-70`). 같은 짓을 ONNX 에서 하면 "가속을 켰는데 왜 느리지"로 끝난다.

### 4.4 `_load_torch` — 조건부 pretrained 와 엄격 실패

**이번 작업에 포함한다.** 당초 범위 밖으로 뒀으나, 아래 두 변경이 한 몸이고 어차피 같은 함수를
`_load_torch` / `_load_onnx` 로 쪼개면서 건드리게 된다. ONNX 경로에만 엄격 실패를 적용하고 torch 는
조용히 폴백하면 **같은 파일 안에서 일관성이 없다.**

#### 문제 — 받아온 가중치를 즉시 버린다

```python
self.model = timm.create_model(self.model_name, pretrained=True, num_classes=0)  # HF 에서 로드
...
self.model.load_state_dict(ckpt["model"])                                        # 곧바로 덮어씀
```

실측:

| | 시간 | RSS 증가 | 파라미터 |
|---|---|---|---|
| `pretrained=False` | 1.36s | 772 MB | 195.2M float32 cpu |
| `pretrained=True` | 2.62s | 1,900 MB | 195.2M float32 cpu |

**`pretrained=False` 도 모델을 실제로 메모리에 만든다**(`is_meta=False`, 값 존재). 차이는 가중치의
출처뿐이다 — 전자는 레이어별 기본 초기화, 후자는 그 위에 체크포인트를 덮어쓴다.

RSS 차이 ~1.1GB 는 로딩 중 **일시적 중복**이다(모델 780MB + state_dict 780MB 를 동시에 든다).
체크포인트가 있을 때는 여기에 **세 번째 복사본**이 더해진다.

`default_cfg` 는 모델 레지스트리에서 오므로 `pretrained=False` 에서도 `input_size=[3,384,384]` 가
그대로 나온다. **`imgsz` 조정 로직(`model.py:35-36`)은 영향받지 않는다.**

#### 조치

```python
def _load_torch(self, weights: str) -> None:
    has_ckpt = bool(weights) and os.path.exists(weights)
    # 체크포인트로 덮어쓸 것이면 사전학습 가중치를 받아올 이유가 없다.
    self.model = timm.create_model(self.model_name, pretrained=not has_ckpt, num_classes=0)
    ...
    if has_ckpt:
        try:
            self.model.load_state_dict(ckpt["model"])
        except Exception as e:
            raise RuntimeError(
                f"Failed to load extractor weights from '{weights}': {first_line}\n"
                f"백본이 랜덤 초기화 상태이므로 계속하지 않는다. "
                f"체크포인트가 model_name='{self.model_name}' 과 맞는지 확인하라."
            ) from e
```

**두 변경은 분리할 수 없다.** 현재 `pretrained=True` 는 의도치 않게 안전망 역할을 한다 — 로딩이
실패해도 사전학습 가중치가 남아 "성능은 떨어져도 동작은 한다"가 된다. 조건부만 넣고 폴백을 그대로
두면 **같은 실패가 랜덤 초기화 상태로 조용히 계속된다.**

가중치 파일이 없을 때(첫 파인튜닝)는 `pretrained=True` 가 그대로 필요하므로 `has_ckpt` 로 가른다.

#### 동작 변경

체크포인트 로딩 실패가 **경고 후 계속** 에서 **예외** 로 바뀐다. 깨진 체크포인트로 도는 것에
의존하는 사용처가 있다면 깨진다. 그것이 의도다.

---

## 5. 설정 변화

| 키 / 프로퍼티 | 조치 | 근거 |
|---|---|---|
| `use_onnx` | **삭제** | 확장자가 대신한다 |
| `use_tensorrt` | **삭제** | §2.2 |
| `Config.onnx_detector` | **삭제** | `detector_weights` 가 곧 경로다 |
| `Config.engine_detector` | **삭제** | TensorRT 제거 |
| `Config.engine_extractor` | **삭제** | 프로덕션 소비처 없음 |
| `Config.onnx_extractor` | **유지** | `export()` 의 기본 출력 경로 (`predict.py:152`) |
| `get_accelerated_model_path` | **유지** | `onnx_extractor` 가 계속 쓴다 |
| `yolo_fp16` | 변경 없음 | 무관한 설정 |

`default.yaml` 에서도 `use_onnx` · `use_tensorrt` 두 줄을 지운다. `yolo_fp16` 은 남으므로
"추론 가속" 주석 블록 자체는 유지하되 문구를 고친다.

`tests/test_config.py::test_default_yaml_mirrors_config_dataclass`(6fa56eb)가 YAML 과 데이터클래스의
동기화를 강제하므로, 한쪽만 지우면 실패한다.

---

## 6. 소비처 정리

### 6.1 검출기 (`lumipet/models/yolo/model.py`)

`_get_predictor` 의 분기 전체를 삭제한다.

```python
    def _get_predictor(self, **kwargs):
        predictor = YoloPredictor(self.cfg)
        predictor.setup_model(self.model)
        return predictor
```

`YOLO(weights)` 가 `.pt` · `.onnx` · `.engine` 를 자체 처리하므로, `detector_weights` 에 원하는
확장자를 주면 그만이다. `_load_model` 은 이미 `YOLO(weights)` 한 줄이라 손대지 않는다.

**추측이 아니라 실측이다** (스파이크 실측. 원본 노트는 2026-09-03 삭제했고 아래가 그 결론이다).

```
                   conf  0.5 / 0.9 / 0.94 / 0.97 / 0.999   (검출 개수 합)
  yolo26n.pt    ->        3     3      1      0      0
  yolo26n.onnx  ->        3     3      1      0      0
```

- **검출 결과가 완전히 일치한다.** conf 응답까지 같다
- **`conf`/`iou` 는 정상 적용된다.** YOLO26 이 `end2end=True`(NMS-free, 출력 `[1,300,6]`)여도
  ultralytics 후처리가 conf 로 거른다. `.pt` 도 `end2end=True` 라 출력 의미가 같다
- **ONNX 의 고정 입력 `[1,3,640,640]` 은 문제가 되지 않는다.** `YoloPredictor` 가 애초에
  `imgsz` 를 넘기지 않기 때문이다(`detect/predict.py:28`). `cfg.imgsz` 는 추출기 전용 값이며,
  실측으로도 384/640/960 결과가 동일했다
- 박스 좌표는 7~70px(3264px 기준 최대 2%) 차이가 난다. letterbox 반올림·정밀도 차이이며 같은 객체를 잡는다

### 6.2 예측기 (`lumipet/models/extractor/predict.py`)

| 위치 | 현재 | 변경 후 |
|---|---|---|
| `:22-29` `setup_model` | 세션 생성 | **삭제.** 모델이 이미 갖고 있다 |
| `:48` `preprocess` | `not getattr(cfg, "use_onnx", False)` | `model.backend == "torch"` |
| `:54` `inference` | `use_onnx and self.onnx_session` | `model.backend == "onnx"` |
| `:56-63` ONNX 추론 | `self.onnx_session` | `self.session` |

**백엔드 정보는 생성자로 넘긴다.** `BasePredictor.setup_model(model)` 은 `self.model = model` 로
보관하고 torch 경로가 `self.model(im)` 으로 **호출**하므로(`predict.py:70`), 여기에 래퍼를 넣을 수
없다. ONNX 백엔드에서는 `self.model` 이 `None` 이 된다.

```python
class ExtractorPredictor(BasePredictor):
    def __init__(self, config=None, backend: str = "torch", session=None) -> None:
        super().__init__(config)
        self.backend = backend
        self.session = session
        ...
```

`ExtractorModel._get_predictor` 가 이렇게 넘긴다.

```python
    def _get_predictor(self):
        if self.backend == "torch" and getattr(self.cfg, "fp16", False) and "cuda" in str(...):
            if hasattr(self.model, "half"):
                self.model.half()
        predictor = ExtractorPredictor(self.cfg, backend=self.backend, session=self.session)
        predictor.setup_model(self.model)      # onnx 백엔드에서는 None
        return predictor
```

`BasePredictor.setup_model(None)` 은 `hasattr(None, 'to')` 가 거짓이라 그대로 통과한다
(`predictor.py:31-40` 이 이미 "Exported models do not support .to()" 를 상정하고 방어하고 있다).
**기존 `fp16` → `self.model.half()` 블록은 `backend == "torch"` 로 감싼다.** 감싸지 않으면
`None.half()` 로 터진다.

### 6.3 문서

`README.md:270-271` 의 설정 표에서 `use_onnx` · `use_tensorrt` 행을 지우고, 확장자로 판단한다는
한 줄을 대신 넣는다. `README.md:159` 의 export 설명에서 "또는 TensorRT" 를 뺀다.

---

## 7. 제약 강제

```python
def _require_torch(self, op: str) -> None:
    if self.backend != "torch":
        raise RuntimeError(
            f"'{op}' requires a PyTorch checkpoint, but extractor_weights is "
            f"'{self.model_path}' (ONNX backend, inference only). "
            f"Set extractor_weights to a .pth file."
        )
```

| 메서드 | ONNX 백엔드에서 |
|---|---|
| `train()` | `RuntimeError` |
| `export()` | `RuntimeError` |
| `val()` | **허용.** 추론만 한다 |
| `register()` · `predict()` · DB 조작 | **허용** |

---

## 8. 범위 밖 (후속)

| 항목 | 비고 |
|---|---|
| **ONNX 의존성 extras 분리** | 확정된 후속. `onnx = ["onnx", "onnxscript", "onnxruntime-gpu>=1.20"]` 로 빼고 미설치 시 설치 명령을 안내한다. 378MB(전체 6.8GB 의 5.5%). **본 작업이 ONNX 경로를 한 곳으로 모으므로 선행 작업이다** |
| TensorRT 재도입 | ORT 의 `TensorrtExecutionProvider` 경로를 권한다. `.engine` **파일이 생기지 않고 provider 설정**이므로 확장자 추론과 무관하며, 오늘 `engine_*` 를 지우는 것이 그 길을 막지 않는다. TensorRT 라이브러리 별도 설치와 ORT ↔ TRT 버전 조합 확인이 선행 과제다 |
| **`onnxruntime-gpu` CUDA 조합 복구** | 리스크 2-b. 지금은 ONNX 를 켜면 **가속이 아니라 감속**이라 실질적으로 못 쓰는 기능이다. CUDA 13/cuDNN 9 설치 또는 현재 CUDA 에 맞는 버전으로 상한 설정. `dev/plan_docs/2026-07-11-CudaOnnxRuntimeGpuTroubleshooting.md` 에 과거 이력 |
| `export()` 의 `opset_version=14` 가 지켜지지 않음 | 실제 산출물은 opset 18 이다(`No Adapter To Version $17 for Pad` 로 변환 실패 후 폴백). ORT 1.29 가 18 을 처리하므로 동작 문제는 없으나 **약속하고 못 지키는데 경고가 없다** |
| 런타임 자동 설치(ultralytics 방식) | 기각. `pyproject.toml:32` 주석이 경고하는 CUDA 조합 문제를 런타임에 맡기게 되고, 오프라인 배포와 재현성이 깨진다 |

---

## 9. 테스트 전략

GPU 의존도 장시간 실행도 없으므로 **TDD 예외를 적용하지 않는다**(`workflow.md` §4).

실제 ONNX 파일이 필요한 테스트는 **작은 더미 모델(`nn.Linear`, 출력 8차원)을 즉석에서 export** 해 쓴다.
기존 `tests/test_tracking.py::test_extractor_onnx_export` 는 Swin-L 이라 26초가 걸리므로 재사용하지 않는다.

### 9.1 수정

| 위치 | 조치 |
|---|---|
| `tests/test_config.py:26` | `Config(use_onnx=True, use_tensorrt=False)` → 필드 삭제에 맞춰 제거 |
| `tests/test_config.py:27` | `cfg.onnx_detector` assert 제거 |
| `tests/test_config.py:37-40` | 파생 경로 검증을 `onnx_extractor` 하나로 축소 |
| `tests/test_config.py:59` | `cfg.engine_extractor` assert 제거 |
| `tests/test_yolo_predict.py:8,11` | `use_onnx` 제거 |
| `tests/test_tracking.py:443` | `cfg.use_onnx is False` 제거 |

### 9.2 신설

| 테스트 | 검증 |
|---|---|
| `test_backend_is_torch_for_pth` | `.pth` → `backend == "torch"`, `model` 존재, `session is None` |
| `test_backend_is_onnx_for_onnx` | `.onnx` → `backend == "onnx"`, `session` 존재, `model is None` |
| `test_onnx_backend_reads_embedding_size` | 더미 ONNX(출력 8차원) → `embedding_size == 8` |
| `test_onnx_backend_reads_imgsz_from_metadata` | 메타데이터의 `imgsz` 반영 |
| `test_onnx_backend_falls_back_to_input_shape_for_imgsz` | 메타데이터가 없으면 입력 shape 에서 |
| `test_onnx_backend_infers_embedding_size_by_probe` | 출력 차원이 동적이면 **더미 추론으로 알아낸다** (§4.1.1 2단계) |
| `test_onnx_backend_raises_when_size_undeterminable` | 정적·동적 둘 다 실패하면 예외 (§4.1.1 3단계) |
| `test_torch_skips_pretrained_when_checkpoint_exists` | 체크포인트가 있으면 `timm.create_model` 이 `pretrained=False` 로 불린다 (§4.4) |
| `test_torch_uses_pretrained_without_checkpoint` | 체크포인트가 없으면 `pretrained=True` |
| `test_broken_checkpoint_raises` | 로딩 실패 → `RuntimeError`. **랜덤 가중치로 계속하지 않는다** |
| `test_missing_onnx_file_fails_loudly` | 없는 `.onnx` → 예외. **조용한 pretrained 폴백이 아님** |
| `test_train_rejects_onnx_backend` | `RuntimeError`, 메시지에 `.pth` 안내 |
| `test_export_rejects_onnx_backend` | 동일 |
| `test_predictor_branches_on_backend` | `preprocess` / `inference` 가 `model.backend` 로 분기 |

### 9.3 수동 검증 — 이번 작업의 실질적 성공 기준

`weights/ci_15.onnx`(+`.data`)와 `weights/yolo26n.onnx` 가 이미 있다. 왕복을 직접 돌린다.

```bash
lumipet list    extractor_weights=weights/ci_15.onnx        # ONNX 백엔드로 로딩
lumipet predict extractor_weights=weights/ci_15.onnx \
                detector_weights=weights/yolo26n.onnx source=<영상>
lumipet train   extractor_weights=weights/ci_15.onnx        # RuntimeError 로 거부
lumipet export  extractor_weights=weights/ci_15.onnx        # RuntimeError 로 거부
lumipet export                                              # .pth 로는 정상 동작
```

**속도는 판단 기준으로 쓰지 않는다** — 리스크 2-b 로 ONNX 가 CPU 로 돌기 때문이다.
확인할 것은 **로딩·식별 결과·거부 동작**이다.

---

## 10. 리스크

1. **~~검증할 ONNX 파일이 없다~~ → 해소됨.** `weights/ci_15.onnx`(798M + `.data` 794M)와
   `weights/yolo26n.onnx` 가 확보되었다. §9.3 의 왕복이 이번 작업의 실질적 성공 기준이다.
2. **~~검출기 ONNX 실물 검증 불가~~ → 해소됨.** 사용자가 `weights/yolo26n.onnx` 를 확보했고
   spike 로 동등성을 확인했다(§6.1). 이 리스크는 더 이상 없다.

2-b. **ONNX 백엔드가 현재 환경에서 CPU 로 폴백한다.**

   ```
   Failed to load library libonnxruntime_providers_cuda.so
     error: libcublasLt.so.13: cannot open shared object file
   Failed to create CUDAExecutionProvider. Require cuDNN 9.* and CUDA 13.*
   실제 세션 provider: ['CPUExecutionProvider']
   ```

   `onnxruntime-gpu 1.29` 가 CUDA 13 / cuDNN 9 를 요구하는데 환경이 만족하지 못한다.
   `pyproject.toml:32` 의 주석("상한을 두지 않는다")이 경고한 상황이 실현된 것이다.

   **설계와 무관하지만 수동 검증(§9.3)에 영향이 있다** — ONNX 백엔드가 느려도 이번 변경의
   문제가 아니다. 이를 성능 회귀로 오해하지 않도록 기록한다. 복구는 §8 의 후속 과제다.
3. **ONNX 백엔드에서 `model` 이 `None` 이 된다.** 전수 확인 결과 위험 지점은 두 곳이다.
   - `ExtractorModel._get_predictor` 의 `self.model.half()` → §6.2 에서 `backend` 로 감싼다
   - `mega_descriptor/train.py:69,82,97,102` → 트레이너 경로이며 §7 이 ONNX 백엔드에서 차단한다

   `mega_descriptor/model.py` 의 나머지 참조는 전부 `_load_torch` 내부라 무관하다.
4. **`grad_checkpointing` 등 torch 전용 설정**이 ONNX 백엔드에서 무의미해진다. 경고 없이 무시한다
   (설정을 지우는 것은 범위 밖).

---

## 11. 성공 기준

- 신설·수정 테스트를 포함한 전체 스위트 통과 (실패 0건), 착수 시점 기준선 대비 증가분이 신설 수와 일치
- `Config` 에 `use_onnx` · `use_tensorrt` · `onnx_detector` · `engine_detector` · `engine_extractor` 가 없다
- `lumipet/models/extractor/predict.py` 에 `use_onnx` 참조가 0곳
- §9.3 왕복 5개가 기대대로 동작 (`train`/`export` 두 개는 `RuntimeError`)
- `README` 설정 표에 없는 기능(TensorRT)이 남아 있지 않다
- `.onnx.data` 사이드카가 있는 모델이 정상 로딩된다 (`weights/ci_15.onnx` 로 확인)
- 체크포인트가 있을 때 HF Hub 경고가 로그에 뜨지 않는다 (§4.4 조건부 pretrained 확인)
