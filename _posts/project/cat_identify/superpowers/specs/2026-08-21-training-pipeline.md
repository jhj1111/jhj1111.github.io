# 학습 파이프라인 재구축 설계 명세

**작성일**: 2026-08-21
**상태**: 승인됨
**구현 계획**: `dev/plans/2026-08-21-training-pipeline.md`
**선행 작업**: `dev/specs/2026-08-20-extractor-merge.md` (완료, 브랜치 `refactor/extractor-merge`)

---

## 1. 배경

### 관측된 문제

현재 DB(`embeddings/cream_test_hc_01.db`)의 등록 적합도가 전 라벨 POOR이다.

| label | 화질 평균 | 일관성 | 다양성 | 총점 |
|---|---|---|---|---|
| lulu | 97.7 | **0.0** | 25.0 | 72.8 |
| momo | 97.4 | **0.0** | 25.0 | 72.5 |
| chuchu | 94.4 | **0.0** | 25.0 | 71.2 |
| titi | 93.7 | **0.0** | 21.2 | 68.0 |

화질은 거의 만점인데 일관성만 전부 0점이다. `core/quality.py`의 일관성 0점은 **같은 개체 사진들의 평균 코사인 유사도 < 0.50**일 때만 나온다. 사진은 선명한데 같은 고양이의 임베딩이 뭉치지 않는다 — 점수 산식 문제가 아니라 임베딩 공간이 붕괴한 상태다.

실제 추론에서도 `datasets/cream_heroes/lulu/lulu_03.jpeg`가 `Unknown`(유사도 0.0401)으로 판정된다.

### 원인 후보

`baselines/training/wildlife_tools_train.ipynb`(Colab에서 실제로 동작한 코드)와 현재 `reid train`을 비교하면 검증된 기법이 거의 전부 빠져 있다.

| 항목 | Colab | 현재 저장소 | 심각도 |
|---|---|---|---|
| 체크포인트에 ArcFace W 저장 | model+objective+optimizer+scheduler+epoch+rng | `model.state_dict()`만 | **치명** — 재개 시 클래스 가중치 유실 |
| Augmentation | Flip, ColorJitter, GaussianBlur, RandomAffine | 없음 (train/val 동일 transform) | **치명** |
| LR | 5e-5 | `dev/train.sh`가 **0.005** (100배) | **치명** |
| 검증 지표 | Top-1 retrieval | ArcFace W 기반 분류 정확도 | **치명** — 실제 성능과 괴리 |
| Gradient accumulation | 있음 (잔여 배치 flush 포함) | 없음 | 높음 |
| Gradient checkpointing | 있음 | 없음 | 높음 |
| LR Scheduler | CosineAnnealingLR | 없음 (고정 LR) | 높음 |
| Early stopping | patience=5 | 없음 | 중간 |
| 학습 재개 | 있음 | 없음 | 중간 |
| num_workers | 2 | 0 (기본값) | 중간 |
| 재현성 (seed/rng) | rng_states 저장·복원 | 없음 | 중간 |

`save_model()`이 백본만 저장하는데 ArcFace의 학습된 클래스 중심 벡터 W는 `criterion` 안에 있어 통째로 버려진다. 게다가 `validate()`가 그 W로 정확도를 재기 때문에, 재개 학습에서는 **랜덤 W 기준으로 "best"를 골라 저장**한다.

### 하드웨어

RTX 4070 Ti SUPER 16GB (Ada) — bf16 네이티브 지원. Colab T4(15GB)보다 유리하다.

---

## 2. 목표 / 비목표

### 목표
1. Colab에서 검증된 학습 기법을 로컬 `reid train`에 갖춘다 (A. 학습 코어).
2. 실제 Re-ID 성능을 재는 평가 체계를 만든다 (B. 평가·지표).
3. 학습 과정을 관측 가능하게 만든다 (C. 운영·로깅).
4. 더미 데이터셋 스모크 런으로 위 셋이 실제로 동작함을 확인한다.

### 완료 기준
- 전체 pytest 그린 (기존 63 + 신규 약 34)
- 수동 스모크 런 확인 항목 통과
- 재개 시나리오 3종(정상 / 불일치 중단 / 헤드 리셋) 동작

### 비목표
- **본 학습 실행** (570개체 Swin-L) — 이 작업 완료 후 별도로 진행한다.
- 적합도 POOR 해소 자체 — 학습 결과이지 이 작업의 산출물이 아니다.
- Sub-center ArcFace, Triplet loss 병용, BNNeck — 3차 이후.
- 백본/헤드 차등 LR — warmup과 효과가 겹쳐 기여를 분리할 수 없다. 먼저 warmup으로 돌려본다.
- 라벨 상위집합일 때 ArcFace W 열 부분 이식 — 옵티마이저 모멘텀 재배열이 얽혀 실패 지점이 늘어난다.
- OOM 자동 복구(배치 반감 재시도), TensorBoard, `smoke=True` 전용 플래그.

---

## 3. 핵심 설계 결정

### 3.1 데이터셋을 합쳐서 한 번에 학습한다

"A로 학습한 뒤 B로 이어 학습하면 새 데이터가 기존을 덮어써 의미가 없다"는 우려를 검토한 결과, **절반만 맞다**.

- **맞는 부분**: catastrophic forgetting은 실재한다.
- **틀린 부분**: Re-ID에서 보존 대상은 개체 목록이 아니라 **임베딩 함수**다. ArcFace W는 학습용 발판이고 추론에 쓰이지 않는다. CI의 509마리를 잊는 것은 손실이 아니다. 이 논리대로면 대규모 동물 Re-ID 코퍼스로 학습된 MegaDescriptor를 파인튜닝하는 것 자체가 무의미해진다 — 전이학습이 곧 순차 학습이다.
- **숨은 진짜 메커니즘**: 데이터셋이 바뀌면 `num_classes`가 달라져 W를 랜덤 재초기화해야 하고, 그 큰 초기 그래디언트가 사전학습 백본을 훼손한다(Kumar et al. 2022, LP-FT). 대처는 warmup·낮은 LR이며, 순차 학습 자체를 피할 이유는 되지 않는다.

그럼에도 **합치는 쪽을 택한다**: 클래스 수가 늘어 ArcFace에 유리하고(509→570), W shape 충돌이 사라지며, 학습 시간 증가는 1.2배에 그친다. 로컬 로더는 폴더명을 라벨로 쓰므로 두 데이터셋의 폴더명 형식 차이(`0001` vs `001-brother-valentine`)에 전처리가 필요 없다.

파이프라인은 **데이터셋 개수와 종류에 무관**하게 동작해야 한다. 하나든 여럿이든, 앞으로 추가될 데이터셋이든.

### 3.2 라벨 네임스페이스

루트가 2개 이상이면 라벨은 `<루트 폴더명>/<개체 폴더명>`이 된다.

임의의 데이터셋을 추가할 때 폴더명이 겹치면 **서로 다른 고양이 두 마리가 하나의 클래스로 합쳐진다.** 에러 없이 학습이 오염되고, ArcFace가 닮지 않은 샘플들을 억지로 뭉치려다 임베딩 공간을 망가뜨린다 — 지금 겪는 증상과 같은 부류다.

학습 라벨은 등록 DB로 흘러가지 않으므로(등록은 `reid register`의 별개 경로) 비용이 없다. 루트가 하나면 기존처럼 폴더명 그대로 쓴다.

### 3.3 라벨→인덱스 매핑을 체크포인트에 저장한다

`CatDataLoader`는 인덱스를 `sorted(set(labels))`로 만든다. **개체가 하나 추가·삭제되면 그 뒤 인덱스가 전부 밀린다.** ArcFace W의 각 열은 특정 인덱스에 대응하므로, 밀린 상태로 재개하면 W의 열이 다른 고양이를 가리킨 채 학습이 계속된다. 에러도 경고도 없다.

`num_classes` 비교만으로는 잡히지 않는다 — 개체 하나를 지우고 하나를 추가하면 수는 같다. 따라서 **매핑 전체를 저장하고 재개 시 대조**한다. 570개면 20KB 남짓이다.

### 3.4 체크포인트 스키마는 `wildlife_tools.BasicTrainer`와 같은 키를 쓴다

상속은 하지 않는다. Colab 코드는 프로젝트 코드를 전혀 쓰지 않는 독립 스크립트이므로 이식하지 않고 로직만 참고한다. `BasicTrainer`를 상속해도 실익이 없다 — Colab의 `CustomTrainer`도 `train`·`train_epoch`·`evaluate`·`load`를 전부 오버라이드했고 상속으로 얻은 것은 `save()`뿐이었다. 게다가 `BasicTrainer`는 내부에서 DataLoader를 직접 만들어 PK 샘플러를 주입할 수 없다.

스키마를 맞추는 이유는 호환성이 아니라 **그것이 올바른 스키마이기 때문**이다 — 재개에 필요한 것(모델·ArcFace W·옵티마이저·스케줄러·epoch·RNG)이 빠짐없이 들어 있고, 새로 설계해도 같은 목록에 도달한다. Colab 산출물과의 상호운용성은 덤이다.

### 3.5 best 판정은 open-set mAP

현재 `validate()`는 ArcFace W와의 코사인 유사도로 분류 정확도를 잰다. W는 학습 클래스의 중심 벡터인데 배포 환경에서는 갤러리 임베딩과 검색으로 비교한다. **"검증 정확도는 높은데 등록 일관성은 0.0"이 성립할 수 있는 이유**가 여기 있다.

| 후보 | 판단 |
|---|---|
| closed-set Rank-1 | 학습 데이터에 과적합돼도 높다. 기준으로 부적합 |
| open-set Rank-1 | 목표엔 맞지만 holdout 57개체라 분산이 크다 |
| **open-set mAP** | **채택.** 전체 순위를 반영해 안정적이고 배포 조건에 가장 가깝다 |

closed-set Rank-1도 함께 기록한다. 둘의 격차가 벌어지면 과적합 신호이고, 한쪽만 보면 놓친다.

### 3.6 임계값은 산출만 하고 적용하지 않는다

`threshold: 0.7`, `threshold_lock: 0.85`, `threshold_hysteresis: 0.55`, `quality.py`의 `0.50/0.65`는 전부 손으로 박은 상수다. 학습 종료 시 FAR 1%/0.1% 지점의 임계값을 산출해 `recommended_thresholds.json`으로 남기되, **`config.yaml`을 자동으로 바꾸지 않는다.** 학습 산출물이 프로덕션 설정을 소리 없이 변경하는 것은 위험하다.

### 3.7 warmup이 랜덤 헤드로부터 백본을 보호한다

학습 시작 시 ArcFace 헤드는 항상 랜덤 초기화 상태이고, 그 초기 그래디언트가 잘 정렬된 MegaDescriptor 임베딩 공간을 훼손한다. 1차 작업에서 projection layer를 제거한 것과 같은 메커니즘이다.

OneCycleLR은 `max_lr/25`에서 시작해 10% 지점까지 올라간 뒤 안네일하므로, 헤드가 자리를 잡는 동안 백본에 가해지는 충격이 작다. plan_docs가 "첫 10% 구간 warmup 도입으로 사전 학습 가중치 파괴 현상 방지"라고 적은 그대로다.

---

## 4. 상세 명세

### 4.1 파일 구조와 책임

```text
reid/
├── core/
│   └── metrics.py      [신규]  Rank-k, mAP, intra/inter 유사도 분포, FAR/TAR
├── utils/
│   ├── checkpoint.py   [신규]  체크포인트 스키마 단일 소유 (save/load, 2포맷 읽기)
│   └── run.py          [신규]  RunDirectory, metrics.csv, 로그 포맷 순수 함수
├── engine/
│   └── trainer.py      [확장]  AMP, accumulation, scheduler, 조기 종료, 로그
├── data/
│   ├── loader.py       [확장]  다중 루트, 라벨 네임스페이스, closed/open-set 분할
│   ├── sampler.py      [신규]  PKSampler
│   └── transforms.py   [확장]  train/val 분리, 증강 프리셋
├── models/extractor/mega_descriptor/
│   ├── model.py        [확장]  gradient checkpointing 토글
│   └── train.py        [확장]  ArcFace·옵티마이저·스케줄러 구성, 검증
└── core/config.py      [확장]  학습 설정 + 리스트 CLI 파싱 수정

tests/
├── dummy_data.py       [신규]  더미 데이터셋 생성 (fixture와 수동 스모크가 공유)
└── conftest.py         [신규]  fixture
```

**패키지 경계 원칙** — 저장소가 이미 지키고 있는 구분을 따른다.

| 패키지 | 의미 | 의존 방향 |
|---|---|---|
| `core/` | 도메인 알고리즘·데이터 구조 | numpy/cv2/core 형제/utils.logger. **engine을 import하지 않는다** |
| `utils/` | 도메인 무관 보조 | 외부 라이브러리만 |
| `engine/` | 실행 골격 (추상 기반 클래스) | core, utils |

`core/quality.py`가 이미 pairwise 유사도·medoid를 계산하고 있고 임계값 0.50/0.65를 하드코딩하고 있다. 향후 `metrics.py`를 재사용해야 하는데, metrics가 `engine/`에 있으면 `core → engine` 의존이 생겨 레이어가 뒤집힌다. 그래서 `core/metrics.py`다.

**순환 참조 주의**: `core/config.py`가 `from reid.utils import get_cfg_path`를 한다. `utils/run.py`가 `Config`를 import하면 순환이 된다. `run.py`는 cfg를 덕 타이핑으로만 다루고 타입을 모른다.

**경계 3가지**
1. 체크포인트 포맷을 아는 곳은 `utils/checkpoint.py` 하나다. 추론 로더와 학습 재개가 같은 규칙을 쓴다 — ArcFace W가 조용히 사라지는 문제의 구조적 원인이 이 규칙 분리다.
2. `core/metrics.py`는 순수 함수다. 모델·cfg·파일시스템을 모른다.
3. `models/extractor/val.py`는 건드리지 않는다. YOLO 검출까지 포함한 파이프라인 end-to-end 검증이고, 학습 중 임베딩 품질 검증과는 다른 질문에 답한다. 섞으면 학습 루프가 검출기에 의존하게 된다.

### 4.2 체크포인트와 재개

**스키마**

| 키 | 내용 |
|---|---|
| `model` | 백본 state_dict |
| `objective` | ArcFaceLoss state_dict (**W 포함**) |
| `optimizer` | AdamW 상태 |
| `scheduler` | LR 스케줄 상태 |
| `epoch` | 완료한 epoch 수 |
| `rng_states` | python·numpy·torch·cuda |
| `cfg` | 설정 스냅샷 |
| `meta` | `label_to_idx`, `num_classes`, `embedding_size`, `model_name`, `best_metric`, `total_steps` |

앞의 6개는 `wildlife_tools.BasicTrainer`와 동일한 키다.

**시작 모드 3가지**

| 모드 | 설정 | 동작 |
|---|---|---|
| 신규 학습 | `resume=""` (기본) | `extractor_weights`가 있으면 백본 초기값으로만 로드 |
| 완전 재개 | `resume=<경로>` | 전부 복원, `epoch+1`부터. 라벨 매핑 불일치 시 **중단** |
| 전이 학습 | `resume=<경로> reset_head=True` | 백본만 이어받고 objective·optimizer·scheduler·epoch은 새로 시작 |

`reset_head=True`가 옵티마이저·스케줄러까지 버리는 이유는, 헤드를 새로 만들면 파라미터 그룹이 달라져 이전 모멘텀이 의미를 잃기 때문이다.

`resume`은 경로만 받는다. `True`가 "가장 최근 run을 찾음"으로 동작하면 어느 체크포인트를 이어받는지 불분명해진다.

**읽기는 두 포맷, 반환은 정규화**

`load_checkpoint()`는 래퍼 딕셔너리와 기존 raw state_dict(327키)를 모두 읽고 항상 같은 모양을 반환한다. raw면 `{"model": <state_dict>, "format": "raw"}`로 감싼다. 호출부는 언제나 `ckpt["model"]`을 쓴다. **추론 경로(`mega_descriptor/model.py`)도 이 함수를 쓴다.**

**cfg 스냅샷의 강제 범위**

- **정체성 필드** (`model_name`, `imgsz`, `embedding_size`) — 다르면 중단. 다른 백본 체크포인트를 잘못 이어받는 사고 방지.
- **하이퍼파라미터** (`lr`, `epochs`, `batch_size`, `arcface_margin` 등) — 현재 cfg가 이긴다. 스냅샷은 기록용.

**RNG 복원은 best effort**다. DataLoader worker 시드까지 완벽히 재현되지는 않으므로 "비트 단위 재현"이 아니라 "같은 지점에서 이어짐"이 목표다.

**저장 시점**: `last.pth`는 매 에폭, `best.pth`는 monitor 지표 갱신 시. 둘 다 run 디렉터리 안.

**API**

```python
# reid/utils/checkpoint.py
save_checkpoint(path, *, model, objective=None, optimizer=None, scheduler=None,
                epoch=0, cfg=None, meta=None, save_rng=True) -> None
load_checkpoint(path, map_location="cpu") -> dict
get_random_states() -> dict
set_random_states(states: dict) -> None
```

**실패 메시지 예시**

```
체크포인트는 509개 클래스로 학습되었으나 현재 데이터셋은 570개입니다.
백본만 이어받으려면 reset_head=True 를 지정하세요.
```
```
라벨 매핑이 일치하지 않습니다 (클래스 수는 같지만 구성이 다름).
체크포인트에만 있는 라벨: ['0042'] / 현재에만 있는 라벨: ['heellostreetcat-individuals/007-mango']
```

### 4.3 데이터 계층

**측정 결과** (2026-08-21)

| | 개체 | 이미지 | min | p25 | median | p75 | max |
|---|---|---|---|---|---|---|---|
| CI (`cat_individuals_dataset`) | 509 | 13,106 | 6 | 14 | 20 | 30 | 170 |
| HC (`heellostreetcat-individuals`) | 68 | 2,796 | **1** | 5 | 8 | 78 | 247 |
| 합계 | 577 | 15,902 | | | | | |

HC는 양극단으로 갈라진 분포다 — 중앙값 8장인데 p75가 78장이다.

**다중 루트**: `dataset_path`가 문자열 또는 리스트를 받는다.

```yaml
dataset_path:
  - datasets/cat_individuals_dataset
  - datasets/heellostreetcat-individuals
```
```bash
reid train dataset_path=datasets/cat_individuals_dataset,datasets/heellostreetcat-individuals
```

**개체 단위 수집**: 현재는 `os.walk`가 방문하는 디렉터리마다 최소 장수를 판정한다. 개체 폴더 전체를 모은 뒤 판정하도록 옮긴다.

**`min_images_per_id = 4`** — 측정 근거:

| 기준 | 개체 손실 | 이미지 손실 |
|---|---|---|
| 2장 미만 | 1개 (0.2%) | 1장 |
| **4장 미만** | **7개 (1.2%)** | **17장 (0.1%)** |
| 8장 미만 | 40개 (6.9%) | 194장 — HC 개체의 45.6% |

4장 기준은 거의 공짜이며 PK 샘플러의 K와 맞는다. 결과: **577 → 570개체, 15,902 → 15,885장**.

**분할**

```
전체 570개체
├── open-set holdout (10% ≈ 57개체)  ← 학습에서 완전 제외
│   ├── known   40개체 (70%) : 이미지 절반 → gallery, 절반 → query
│   └── unknown 17개체 (30%) : 전부 query (gallery 없음)
└── 학습 513개체
    ├── train (개체당 80%)
    └── closed-set val (개체당 20%)
```

FAR을 제대로 재려면 **갤러리에 없는 고양이**가 있어야 한다. 배포에서 가장 흔한 실패가 미등록 고양이를 등록 고양이로 오인하는 것이고, 등록 개체만으로 재면 그 실패율을 과소평가한다.

- **genuine** = known query와 정답 개체 gallery의 최대 유사도
- **impostor** = unknown query가 gallery 전체와 갖는 최대 유사도 + known query가 오답 개체와 갖는 최대 유사도

Rank-k와 mAP는 known query로만 계산한다.

**holdout 선정은 계통 추출(systematic sampling)** — 데이터셋별로 개체를 이미지 수 기준 정렬한 뒤 균등 간격으로 뽑는다. 무작위면 HC의 247장짜리 개체가 통째로 빠져 학습 이미지를 크게 잃는 사고가 시드 운에 좌우된다. 계통 추출은 결정적이고 분포 대표성이 있다. **선정된 목록은 `holdout_labels.json`으로 저장**한다.

**Augmentation** — train/val 분리

```
train: Resize → RandomHorizontalFlip(0.5) → ColorJitter(brightness=0.3, contrast=0.3)
       → GaussianBlur(5, sigma=(0.1,2.0)) → RandomAffine(degrees=10, translate=(0.05,0.05))
       → ToTensor → Normalize → RandomErasing(p=0.25)
val:   Resize → ToTensor → Normalize
```

강도는 `augment` 한 필드로 `none | light | medium | strong` 프리셋을 고른다. plan_docs가 과적합 대처로 명시한 "증강 난이도 격상"을 한 번의 설정 변경으로 하기 위함이다. `GaussianBlur`는 CPU에서 비싸므로 `num_workers`가 함께 가야 한다.

**PK 샘플러**: 배치마다 P개체 × K장. `pk_k=4`, `P = batch_size // pk_k`. 이미지가 K장 미만인 개체는 중복 허용 샘플링으로 채운다. 한 epoch의 스텝 수는 `총 이미지 수 // batch_size`로 유지해 epoch 개념을 바꾸지 않는다.

**DataLoader**: `num_workers=4`, `pin_memory=True`, `persistent_workers=True`. 현재 0이라 GPU가 데이터 로딩을 기다린다.

**`batch_size` 8 → 32**. Colab이 T4 15GB에서 gradient checkpointing으로 32를 돌렸다. PK 구성은 8개체 × 4장. 이 값은 `ExtractorModel.register_batch_images`와 공유되며, 등록은 추론만 하므로 384px fp16에서 32는 문제없다. 별도 knob으로 분리하지 않는다.

**API**

```python
# reid/data/loader.py
CatDataLoader(dataset_path: str | list[str], imgsz: int, min_images_per_id: int = 4)
  .get_loaders(batch_size, test_size, pk_k, num_workers) -> (train_loader, val_loader)
  .get_openset_split(ratio=0.1, known_ratio=0.7) -> (gallery, query, unknown_mask, holdout_labels)
  .label_to_idx: dict[str, int]

# reid/data/sampler.py
PKSampler(labels: list[int], p: int, k: int, num_samples: int)

# reid/data/transforms.py
get_train_transform(imgsz, level="medium")
get_val_transform(imgsz)
```

### 4.4 학습 루프

```python
for epoch in range(start_epoch, epochs):
    model.train(); optimizer.zero_grad()
    for i, (imgs, labels) in enumerate(train_loader):
        with autocast(device_type, dtype=amp_dtype):
            loss = criterion(model(imgs), labels)
        if not isfinite(loss): warn & skip
        (loss / accumulation_steps).backward()
        if (i + 1) % accumulation_steps == 0:
            optimizer.step(); optimizer.zero_grad(); scheduler.step()
    if (i + 1) % accumulation_steps != 0:              # 잔여 배치 flush
        optimizer.step(); optimizer.zero_grad(); scheduler.step()

    metric = validate()
    save last.pth
    if metric > best: save best.pth; patience = 0
    else: patience += 1; if patience >= limit: stop
```

**잔여 배치 flush**가 핵심이다. plan_docs가 명시한 "배치 단위 스케줄링 시 누적 계산 오차로 `ValueError` 발생"이 이 지점이다 — 자투리 배치를 버리면 스케줄러 step 횟수가 `total_steps`와 어긋나 학습이 중간에 죽는다.

**AMP**: bf16 기본. fp32와 지수 범위가 같아 GradScaler가 필요 없고 오버플로도 없다. `amp_dtype="fp16"`이면 GradScaler를 함께 쓴다. **기존 `cfg.fp16`은 추론용 `model.half()` 플래그이므로 재사용하지 않고 `amp`/`amp_dtype`을 따로 둔다.**

**Scheduler**: `onecycle` 기본. `max_lr=lr`(5e-5), `pct_start=0.1`, `total_steps = ceil(len(train_loader)/accumulation_steps) × epochs`(잔여 flush 포함해 정확히). `cosine`은 `T_max=epochs`, `eta_min=lr×1e-3`으로 에폭 단위 step.

재개 시 저장된 `total_steps`와 현재 계산값이 다르면 **경고 후 스케줄러를 재생성**한다(옵티마이저·모델은 유지). OneCycleLR은 `total_steps`가 스케줄에 박혀 있어 조용히 터진다.

**Gradient checkpointing**: `backbone.set_grad_checkpointing(enable=True)`, `hasattr` 가드. 기본 `True` — 속도를 약 30% 내주고 활성화 메모리를 크게 아낀다.

**조기 종료**: `patience=5`, 감시 지표는 `monitor`.

**NaN/Inf 방어**: 유한하지 않은 loss는 경고 후 스텝 스킵, 연속 20회면 중단.

### 4.5 평가 지표와 임계값

**세 층위**

1. **closed-set Rank-1** — 학습 개체 val 이미지의 leave-one-out retrieval. gallery/query 구분 없이 매 에폭 저렴하게 돈다. 학습 진행 신호.
2. **open-set Rank-1/Rank-5/mAP** — holdout 개체로 측정. 실제 목표.
3. **intra/inter 유사도 분포** — `core/quality.py`의 consistency 점수와 같은 축(0.50/0.65 임계). 등록 적합도의 선행 지표.

**계산 비용**: holdout 약 1,600장 + closed-set val 약 2,800장 ≈ 4,400장. bf16 batch 32면 1분 내외이므로 **매 에폭 둘 다 계산**한다. 간격 설정 필드를 두지 않는다.

**API**

```python
# reid/core/metrics.py  (numpy만 의존)
leave_one_out_rank1(emb, labels) -> float
rank_k_accuracy(q_emb, q_labels, g_emb, g_labels, ks=(1,5)) -> dict[int, float]
mean_average_precision(q_emb, q_labels, g_emb, g_labels) -> float
similarity_stats(emb, labels) -> dict          # intra_mean, inter_mean, separation, 분위
genuine_impostor_scores(q_emb, q_labels, g_emb, g_labels, unknown_mask) -> (genuine, impostor)
threshold_at_far(genuine, impostor, far=0.01) -> (threshold, tar)
```

### 4.6 로깅과 run 관리

```text
results/train/20260821_143052[_<name>]/
├── best.pth  last.pth  config.yaml  metrics.csv  train.log
├── holdout_labels.json
└── recommended_thresholds.json
```

이름 자동 축약 규칙은 두지 않는다. `train.log`는 기존 `set_logging(log_file=...)`을 그대로 쓰고 `logger.py`는 변경하지 않는다.

학습 산출물이 전부 run 디렉터리에 남으므로 `weights/test_ci_05`처럼 확장자 없는 파일이 생기던 문제가 정리되고, `weights/`는 배포용 가중치 자리가 된다.

**시작 배너 (INFO 1회)** — model / params / data(개체·이미지·분할) / batch(**유효 배치 `batch × accum` 명시**) / optim / runtime / resume / monitor

**에폭 로그 (INFO 2줄)**
```
Epoch  3/15  loss 3.887  lr 4.1e-5  2m14s  38.2 img/s  VRAM 11.3GB  ETA 26m
   └ closed R1 78.4% | open mAP 41.2% R1 52.1% R5 71.0% | intra .62 inter .18 sep .44   ★ best (mAP +2.1)
```
closed R1과 open mAP를 나란히 두는 것이 핵심이다. 격차가 벌어지면 과적합이고 한쪽만 보면 놓친다.

**배치 로그 (DEBUG, `log_interval`마다)** — batch idx, loss, lr, grad norm, **data 시간 vs compute 시간**, VRAM, accumulation 경계. data/compute를 나란히 찍어야 "느리다"의 원인이 모델인지 로더인지 판별된다.

**WARNING**: NaN/Inf 스킵, `min_images_per_id` 미만 제외 개체 수(요약 한 줄), `drop_last` 폐기 샘플 수, 손상 이미지, patience 카운터, lr 하한 도달, OneCycle 재생성, grad checkpointing 미지원.

**ERROR**: 재개 실패, 체크포인트 저장 실패, 데이터셋 비어 있음.

**종료 요약**: 소요시간, best epoch과 지표, 가중치 경로, 유사도 분포, 권장 임계값 + "config.yaml은 자동 변경하지 않습니다" 안내.

**metrics.csv**
```
epoch, train_loss, lr, closed_rank1, openset_rank1, openset_rank5, openset_map,
intra_mean, inter_mean, separation, thr_far1, tar_at_far1, epoch_sec, vram_peak
```
첫 에폭에 헤더를 쓰고 append. 열은 첫 행으로 고정하고 누락은 빈칸.

**API**

```python
# reid/utils/run.py
class RunDirectory:
    def __init__(self, root="results/train", name: str = "") -> None
    path / best_path / last_path / log_path
    def save_config(self, cfg) -> None      # cfg.save_config(path) 위임, 타입은 모름
    def log_epoch(self, row: dict) -> None
    def save_json(self, filename, obj) -> None

format_banner(...) -> str
format_epoch_line(...) -> str
format_summary(...) -> str
```

로그 포맷을 순수 함수로 두는 이유는 검증 때문이다. trainer 안에 있으면 포맷을 확인하려고 학습 루프를 돌려야 한다.

### 4.7 추가되는 설정 전체

| 필드 | 기본값 | 설명 |
|---|---|---|
| `amp` | `True` | 학습 AMP (추론용 `fp16`과 별개) |
| `amp_dtype` | `"bf16"` | `bf16` / `fp16` |
| `accumulation_steps` | `1` | 유효 배치 = `batch_size × 이 값` |
| `grad_checkpointing` | `True` | timm 백본 활성화 체크포인팅 |
| `scheduler` | `"onecycle"` | `onecycle` / `cosine` / `none` |
| `warmup_pct` | `0.1` | OneCycle warmup 구간 |
| `patience` | `5` | 조기 종료 |
| `monitor` | `"openset_map"` | best 판정 지표 |
| `num_workers` | `4` | DataLoader worker |
| `resume` | `""` | 체크포인트 경로 |
| `reset_head` | `False` | 백본만 이어받기 |
| `min_images_per_id` | `4` | 개체당 최소 이미지 |
| `pk_k` | `4` | PK 샘플러의 K |
| `augment` | `"medium"` | `none`/`light`/`medium`/`strong` |
| `openset_ratio` | `0.1` | holdout 개체 비율 |
| `openset_known_ratio` | `0.7` | holdout 중 갤러리 등록 비율 |
| `far_targets` | `[0.01, 0.001]` | 임계값 산출 지점 |
| `name` | `""` | run 디렉터리 접미사 |
| `log_interval` | `50` | DEBUG 배치 로그 간격 |
| `weight_decay` | `0.05` | AdamW 정규화 (기존에는 필드 자체가 없어 torch 기본 0.01이 적용됨) |
| `run_root` | `"results/train"` | run 디렉터리 루트 |

**기본값 변경**

| 필드 | 기존 | 변경 | 근거 |
|---|---|---|---|
| `batch_size` | 8 | **32** | Colab이 T4 15GB에서 32 |
| `arcface_margin` | 0.5 | **0.35** | plan_docs: 높은 클래스 내 변동성 고려해 완화 |
| `weight_decay` | (미지정, torch 0.01) | **0.05** | plan_docs: 정규화 강화, 과적합 지연 |
| `dataset_path` | `"datasets/"` | 문자열 또는 리스트 허용 | 다중 데이터셋 |

**기존 버그 수정**: `Config.load`의 타입 변환이 `type(default_val)(v)`라 리스트 기본값에 문자열을 넣으면 문자 단위로 쪼개진다. 실측:

```
multi_scale_factors=0.9,1.0,1.1
→ ['0', '.', '9', ',', '1', '.', '0', ',', '1', '.', '1']
```

`_parse_cli` 단계에 리스트 처리를 추가한다(콤마 분리 + 원소 타입 변환).

---

## 5. 테스트 전략

### 자동 (pytest) — 약 34개

| 영역 | 개수 | 핵심 |
|---|---|---|
| 체크포인트·재개 | 6 | 라벨 매핑 불일치 감지, 2포맷 읽기 정규화 |
| 데이터 계층 | 7 | 라벨 네임스페이스, holdout이 train에 안 새는가 |
| 학습 루프 | 7 | accumulation 잔여 flush, OneCycle `total_steps` 일치 |
| 지표 | 6 | leave-one-out 자기 제외, FAR 손계산 일치 |
| 로깅·run | 6 | metrics.csv 헤더 고정, 유효 배치 표기 |
| 파이프라인 배선 | 2 | 더미 데이터셋 1 epoch 완주, 재개 왕복 |

지표 테스트는 이미지가 아니라 **합성 임베딩**을 직접 만들어 정답을 손으로 계산한다.

### 더미 데이터셋

이번 설계의 제약이 서로 얽혀 있어 아무 크기로나 만들면 조용히 무의미해진다.

| 제약 | 요구 |
|---|---|
| `min_images_per_id=4` | 개체당 4장 이상 |
| PK (K=4) | `batch_size`가 4의 배수, 학습 개체 ≥ P |
| closed-set leave-one-out Rank-1 | **개체당 val 이미지 ≥ 2장** — 1장이면 같은 개체 짝이 없어 항상 오답 |
| open-set known/unknown | holdout ≥ 3개체 (known 2 + unknown 1) |

최소 구성: **10개체 × 10장 = 100장**, `test_size=0.2`, `openset_ratio=0.3`, `batch_size=8`(P=2 × K=4) → holdout 3개체(known 2 → gallery 5/query 5, unknown 1), 학습 7개체(train 8 / val 2).

이미지는 **개체별 고유 패턴 + 이미지별 노이즈**로 만든다. 전부 같으면 임베딩이 동일해져 loss가 안 내려가고 분리도가 무의미해진다.

생성 함수는 `tests/dummy_data.py`에 두고 fixture와 수동 스모크가 공유한다.

**덤으로 정리되는 것**: 현재 `tests/test_extractor.py`의 `test_extractor_flow`는 저장소 경로(`datasets/mini_dataset`, `weights/`, `embeddings/`)에 파일을 만들고 전역 `get_config()` 싱글턴을 변경한다. 이 fixture 기반으로 옮기며 함께 정리한다.

### 수동 스모크 런

```bash
.venv/bin/python -c "from tests.dummy_data import make_dummy_dataset; \
    make_dummy_dataset('datasets/dummy', n_ids=10, n_imgs=10)"

.venv/bin/reid train dataset_path=datasets/dummy \
    model_name=hf-hub:BVRA/MegaDescriptor-T-224 \
    batch_size=8 pk_k=4 epochs=2 test_size=0.2 openset_ratio=0.3 \
    verbose=DEBUG name=smoke
```

**확인 항목**: 배너 통계·유효 배치 정확 / loss 하강 / 에폭 2줄 로그의 지표 / run 산출물 7종 / metrics.csv 행 수와 열 / recommended_thresholds.json / DEBUG의 data·compute 시간.

**재개 시나리오 3종** — 지금 조용히 깨지는 경로라 손으로 확인한다.

| | 명령 | 기대 |
|---|---|---|
| A | `resume=<run>/last.pth epochs=4` | epoch 3부터 이어짐 |
| B | 개체 폴더 하나 제거 후 `resume=...` | **명확한 에러로 중단** |
| C | 같은 상황 + `reset_head=True` | 백본만 이어받고 진행 |

**(B)에서 에러 없이 학습이 시작되면 설계가 실패한 것이다.**

---

## 6. 리스크

| 리스크 | 대응 |
|---|---|
| `engine/trainer.py`가 비대해짐 (99줄 → 250~300줄 예상) | 300줄 초과 시 로그·검증 부분 분리. 로그 포맷은 이미 `utils/run.py`로 분리됨 |
| `GaussianBlur`가 CPU 병목 | `num_workers=4`, DEBUG 로그의 data/compute 시간으로 즉시 판별 |
| OneCycleLR `total_steps` 계산 오차 | 잔여 flush를 포함해 계산하고, 전용 테스트로 완주 검증 |
| `batch_size` 32가 등록 경로와 공유됨 | 등록은 추론만 하므로 안전. 필요 시 `config.yaml`로 조정 |
| 설정 필드가 19개 늘어남 | 학습 파이프라인 규모상 불가피. 배너에 실제 적용값을 찍어 추적 가능하게 함 |

---

## 7. 후속 작업

1. **본 학습 실행** — 570개체, Swin-L 384. 이 작업의 직후 과제.
2. **적합도 재평가** — 학습 후 `reid migrate` + `reid list`로 consistency 회복 확인.
3. **임계값 적용** — `recommended_thresholds.json`을 보고 `config.yaml`과 `quality.py`의 하드코딩 상수 갱신 검토.
4. **3차 후보** — Sub-center ArcFace(K=3), Batch-hard Triplet 병용, BNNeck A/B, 백본/헤드 차등 LR, `core/quality.py`가 `core/metrics.py`를 재사용하도록 정리.
