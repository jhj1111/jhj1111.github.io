# Extractor 단일화 설계 명세 (projection 제거)

**작성일**: 2026-08-20
**상태**: 승인됨
**구현 계획**: `dev/plans/2026-08-20-extractor-merge.md`
**후속 작업**: 학습 파이프라인 재구축 (2차, 별도 spec)

---

## 1. 배경

`reid/models/extractor/` 아래에 두 개의 특징 추출기 구현이 병존한다.

| | `wildlife/` | `mega_descriptor/` |
|---|---|---|
| 구조 | raw timm 백본 | 백본 + projection(1536→512, BN, PReLU) |
| 백본 | 학습 대상 | `requires_grad=False` + forward에 `torch.no_grad()` |
| 체크포인트 | 순수 `state_dict` | `model`/`projection`/raw 3중 분기 |
| 목적함수 | ArcFace | CrossEntropy + 보조 `nn.Linear` 분류기 |
| 저장 대상 | 백본 전체 | projection만 |

`mega_descriptor/`는 "백본 동결 + projection만 학습"이라는 초기 VRAM 절약 전략(1.5단계 학습)의 산물이다. 두 구현은 `container.py`의 `cfg.extractor_type` 분기로 선택된다.

### 실물 확인 결과 (2026-08-20)

- **사용 중인 체크포인트 3개 전부 raw Swin-L state_dict**: `weights/test_hc_01.pth`, `weights/test_ci_10.pth`, `weights/best_weight_ci.pth` — 각 327키, `projection.*` 키 0개, `model`/`objective` 래퍼 없음
- **DB 임베딩은 1536차원**: `embeddings/cream_test_hc_01.db`의 embedding BLOB = 6144바이트 = float32 × 1536
- **결론**: projection 경로(512차원)는 실제로 한 번도 사용된 적이 없다. 제거해도 하위호환 부담이 없다.

### 이 작업이 필요한 이유

곧 진행할 학습 파이프라인 재구축(2차 작업)에서 accumulation·scheduler·AMP·resume·로깅을 구현해야 한다. 두 trainer를 유지하면 이 기능들을 두 번 구현하게 된다. 통합을 선행하면 한 번만 쓴다.

---

## 2. 목표 / 비목표

### 목표
1. 두 extractor 구현을 `mega_descriptor` 이름 하나로 통합한다 (백본을 이름에 명시).
2. projection layer 및 백본 동결 학습 경로를 제거한다.
3. `mega_descriptor/model.py`의 버그 2건을 수정하고 회귀 테스트로 고정한다.
4. 기존 59개 테스트를 그린으로 유지한다.

### 비목표 (2차 작업으로 미룸)
- 학습 로직 개선 일체 — augmentation, LR scheduler, gradient accumulation, gradient checkpointing, AMP, 체크포인트 완전 저장/재개, early stopping, 학습 로깅
- 검증 지표 변경 (현재 ArcFace W 기반 분류 정확도 유지)
- BNNeck 도입 여부 판단
- 등록 품질(`quality.py`) 관련 수정

1차의 trainer는 **파일만 이동하고 내용은 그대로 둔다.** 1차 diff는 구조 정리만, 2차 diff는 학습 동작 변화만 보이게 하여 성능 변화의 원인을 diff로 추적할 수 있게 한다.

---

## 3. 설계 결정

### 3.1 projection layer 제거

성능 관점의 판단이며 VRAM 절약과는 무관하게 결정했다.

1. **MegaDescriptor의 출력이 이미 학습된 임베딩 공간이다.** ArcFace로 동물 Re-ID에 맞춰 metric learning을 마친 백본이다. 위에 랜덤 초기화 Linear를 얹으면 정렬된 공간을 뭉갠 뒤 다시 배우게 된다.
2. **표준 레시피에 차원 축소 projection은 없다.** wildlife-tools의 정석은 `backbone(num_classes=0) → ArcFace(embedding_size=backbone_dim)`이고, Colab에서 성공한 코드도 같은 형태다. Person Re-ID의 Bag of Tricks(Luo et al.)가 권하는 것도 차원 축소가 아니라 BNNeck(BatchNorm1d, 차원 유지)이다.
3. **SSL의 projection head와는 다르다.** SimCLR/BYOL의 head는 추론 시 버리는 것이 핵심이다. 추론 임베딩으로 쓰는 것은 원래 의도와 반대다.
4. **축소의 실익이 이 규모에 없다.** 1536차원 = 장당 6KB. 고양이 1만 마리 × 10장 = 600MB, FAISS Flat 검색도 밀리초 단위다.

추가 위험: full fine-tune과 병용하면 랜덤 초기화 head를 통과한 그래디언트가 사전학습 백본으로 흘러 초기에 파괴적이다. 현재 DB에서 관측된 "클래스 내 유사도 붕괴"(전 라벨 consistency 0.0)와 같은 실패 모드다.

**BNNeck은 2차 작업에서 A/B로 판단한다.** 차원을 유지하면서 ArcFace 헤드 앞에 BatchNorm1d 한 겹을 넣는 방식으로, 이번 범위에는 포함하지 않는다.

### 3.2 이름은 `mega_descriptor`, 내용은 `wildlife`

백본을 이름에 명시하기 위해 `mega_descriptor`를 남긴다. 단 **구현 내용은 `wildlife/` 쪽을 채택한다** — Colab에서 검증된 코드가 그쪽이고, 기존 `mega_descriptor/`의 내용은 삭제 대상인 projection 구조이기 때문이다.

### 3.3 백본 어댑터 계층 유지

`extractor/model.py`(공통 등록 파이프라인) + `mega_descriptor/`(백본별 어댑터) 2계층 구조를 유지한다. 백본이 하나뿐이라 당장은 잉여로 보이지만, 향후 EfficientNetV2·MiewID 등 다른 백본을 붙일 자리이며 기존 패턴과 일치한다.

---

## 4. 상세 명세

### 4.1 최종 파일 구조

```text
reid/models/extractor/
├── model.py                 # ExtractorModel (등록 파이프라인) — 변경 없음
├── mega_descriptor/
│   ├── __init__.py          # MegaDesExtractorModel, MegaDesExtractorTrainer
│   ├── model.py             # wildlife/model.py 내용으로 대체 + 버그 2건 수정
│   └── train.py             # wildlife/train.py 내용으로 대체
├── predict.py               # 변경 없음
├── val.py                   # 변경 없음
└── embedding.py             # 변경 없음
                             # wildlife/ 디렉터리 삭제
```

### 4.2 `MegaDesExtractorModel`

`ExtractorModel`을 상속한다. `_load_model(weights)` 동작:

1. `timm.create_model(self.model_name, pretrained=True, num_classes=0)`으로 백본 생성
2. `model.default_cfg['input_size'][1]`과 `cfg.imgsz`가 다르면 `cfg.imgsz`를 모델 기본값으로 보정하고 INFO 로그
3. 더미 텐서 forward로 `self.embedding_size` 산출
4. `weights` 경로가 존재하면 `torch.load(..., weights_only=True)` 후 `load_state_dict`, 성공 시 INFO 로그 / 실패 시 ERROR 로그 후 pretrained 백본 유지

`_get_trainer()` → `MegaDesExtractorTrainer`, `_get_validator()` → `ExtractorValidator`.

**삭제 대상**: `CombinedModel` 내부 클래스, `projection` Sequential, `has_custom_weights` 플래그, `_load_combined_weights()`의 3중 체크포인트 분기, 백본 freeze 및 `torch.no_grad()` forward.

### 4.3 `MegaDesExtractorTrainer`

`wildlife/train.py`의 `WildlifeExtractorTrainer` 내용을 그대로 이동한다. ArcFace 목적함수, AdamW, `criterion.loss.W` 기반 검증, 백본 state_dict 저장. **내용 변경 없음** (2차 작업 대상).

CE + 보조 `nn.Linear` 분류기 경로는 삭제한다.

### 4.4 버그 수정 2건

| 위치 | 증상 | 수정 |
|---|---|---|
| `mega_descriptor/model.py:24` | `super().__init__(model_path=..., model_name=...)`에 `cfg` 미전달 → 전달받은 cfg 인스턴스를 버리고 `get_config()` 전역 인스턴스를 재조회 | `cfg=cfg_inst` 전달 |
| `mega_descriptor/model.py:25` | `self.embedding_size = 1536`이 `super().__init__()` **뒤에** 실행되어 `_load_model`이 산출한 실제 차원을 덮어씀 → 항상 1536 고정 | `embedding_size`는 `_load_model` 안에서만 설정 |

wildlife 버전을 채택하면 두 버그 모두 자연히 해소되지만, 회귀 방지를 위해 명시적 테스트를 추가한다.

### 4.5 config 및 하위호환

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| `container.build_extractor()` | `cfg.extractor_type` 분기 | 항상 `MegaDesExtractorModel` |
| `Config.extractor_type` | `"wildlife"` (동작 분기용) | `"mega_descriptor"` (ONNX 메타데이터 라벨로 강등, 분기 없음) |
| `Config.extractor_weights` | `"weights/wildlife.pth"` | `"weights/mega_descriptor.pth"` |
| `Config.onnx_extractor_path` | `"weights/wildlife.onnx"` | `"weights/mega_descriptor.onnx"` |
| `Config.engine_extractor_path` | `"weights/wildlife.engine"` | `"weights/mega_descriptor.engine"` |

`reid/cfg/default.yaml`도 동일하게 변경한다.

**`extractor_type` 필드를 남기는 이유**: `reid/models/extractor/predict.py:213`이 ONNX export 메타데이터에 이 값을 기록하고 `tests/test_tracking.py:553`이 키 존재를 검증한다. 필드를 제거하면 두 곳이 함께 흔들린다. 백본 종류를 기록하는 라벨로서 의미가 남으므로 유지 비용이 더 싸다.

**기존 자산 호환성**:
- 로컬 `config.yaml`은 `extractor_weights`를 직접 지정하므로 영향 없음. `extractor_type: wildlife`가 남아 있어도 무시된다.
- 기존 체크포인트(raw state_dict 327키)는 그대로 로드된다.
- 기존 DB(1536차원)는 재등록 불필요.
- `.gitignore:710`이 이미 `!weights/mega_descriptor.pth`를 화이트리스트에 두고 있어 새 기본 경로와 일관된다.

### 4.6 영향 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `reid/models/extractor/mega_descriptor/model.py` | 내용 대체 + 버그 2건 수정 |
| `reid/models/extractor/mega_descriptor/train.py` | 내용 대체 (ArcFace 버전) |
| `reid/models/extractor/mega_descriptor/__init__.py` | 변경 없음 (export 이름 동일) |
| `reid/models/extractor/wildlife/` | 디렉터리 삭제 |
| `reid/models/extractor/predict.py:213` | ONNX 메타데이터의 `extractor_type` 폴백 문자열 `"wildlife"` → `"mega_descriptor"` |
| `reid/models/extractor/__init__.py:2,7` | `wildlife` 임포트·`__all__` 제거 |
| `reid/models/__init__.py:3-6` | `WildlifeExtractorModel` 임포트·`__all__` 제거 |
| `reid/__init__.py:10,22` | lazy-import `MODELS` 튜플 및 TYPE_CHECKING 임포트에서 제거 |
| `reid/container.py:12-17` | `extractor_type` 분기 제거 |
| `reid/core/config.py:14,18,45,47` | 기본값 변경 |
| `reid/cfg/default.yaml:5,9,35,37` | 기본값 변경 |
| `tests/test_wildlife.py` | `tests/test_extractor.py`로 이동 + 임포트 갱신 |
| `tests/test_config.py:28` | `weights/wildlife.onnx` → `weights/mega_descriptor.onnx` |
| `README.md` | 구조도·설정표에서 wildlife/mega_descriptor 이원화 서술 정리 |
| `baselines/training/model_train.py` | `'extractor_type': 'wildlife'` 제거 |

---

## 5. 테스트 전략

### 회귀 기준
착수 전 `pytest -q` 전체 그린을 확인하고(현재 59개 수집), 작업 후에도 동일하게 그린을 유지한다.

### 이동
`tests/test_wildlife.py` → `tests/test_extractor.py`. 이 파일은 이미 더미 데이터셋(고양이 2마리 × 4장, `batch_size=2`, CPU, `MegaDescriptor-T-224`)으로 1 epoch 학습까지 검증한다. 임포트 경로와 클래스명만 갱신하고 내용은 유지한다.

> 참고: 이 더미 데이터셋 구성이 유효한 이유 — `CatDataLoader._load_image_list`는 라벨 폴더당 파일 2개 미만이면 스킵하고(`min_data_size=2`), `get_loaders`의 stratified split은 테스트 쪽 샘플 수가 클래스 수 이상이어야 하며, `DataLoader(drop_last=True)`는 train 세트가 batch_size 미만이면 배치 0개가 된다. 2 라벨 × 4장 + `batch_size=2` 조합이 세 조건을 모두 만족한다. 2차 작업에서 이 구성을 확장한다.

### 신규 테스트 (TDD Red 대상)
1. `build_extractor(cfg)`가 반환한 모델의 `model.cfg`가 전달한 cfg **인스턴스와 동일**할 것 (버그 1)
2. `model.embedding_size`가 백본의 실제 출력 차원과 일치할 것 — `MegaDescriptor-T-224` 사용 시 1536이 아닌 값이 나와야 함 (버그 2)

### 수동 검증
- `reid list` — 기존 DB 조회 정상
- `reid predict source=<이미지>` — 기존 1536차원 DB로 매칭 정상 (차원 불일치 예외가 나지 않을 것)

---

## 6. 리스크

낮다. projection 경로가 실사용된 적이 없고 나머지는 파일 이동과 이름 변경이다.

주의점 하나: `reid/__init__.py`의 lazy-import `MODELS` 튜플에서 `WildlifeExtractorModel`을 빼지 않으면 `import reid` 시점이 아니라 속성 접근 시점에 `AttributeError`가 발생해 발견이 늦어진다.

---

## 7. 후속 작업 (별도 spec)

2차 학습 파이프라인 재구축에서 다룰 항목. 우선순위 순:

1. 체크포인트 완전 저장/재개 — 현재 ArcFace W가 어디에도 저장되지 않아 재개 시 클래스 중심 벡터가 유실된다
2. LR 정상화 — `dev/train.sh`의 `lr=0.005`는 검증값(5e-5)의 100배
3. Augmentation — Flip, ColorJitter, GaussianBlur, RandomAffine (+ RandomErasing)
4. Gradient accumulation + gradient checkpointing + AMP(bf16)
5. LR scheduler (Cosine 또는 OneCycleLR, warmup 10%)
6. 검증 지표를 Top-1 retrieval로 교체
7. Early stopping, run 디렉터리, 학습 로깅 체계
8. PK 샘플러, BNNeck A/B, 임계값 자동 도출(FAR 1%)
