---
title: (CatHealth) 아키텍처 리펙토링
post_order: 4
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_04.png
layout: post
author: jhj
categories:
  - Project
  - CatHealth
tags:
  - AI
  - ComputerVision
  - Python
  - TFLite
  - Datasets
excerpt: Ultralytics 스타일 설계를 참고한 고양이 Re-ID 시스템 아키텍처 개선 및 통합 명세
---

# Lumipet Re-ID — 아키텍처 설계 및 리팩토링 명세서

> Ultralytics 아키텍처를 벤치마킹하여 설정 통합을 수행하고, 반복 흐름을 베이스 클래스에 캡슐화한 고유 아키텍처 개선 명세.

## 설계 원칙

### 적용 디자인 패턴

| 패턴 | 적용 범위 | 목적 |
|---|---|---|
| Template Method | `engine/` 패키지 베이스 클래스 | 공통 제어 루프 흐름(학습 루프, 스트림 입출력)을 고정하고 세부 훅(Hook)은 하위 클래스에서 정의 |
| Strategy | `models/` 패키지 구체 클래스 | YOLO 탐지기, MegaDescriptor 추출기 구현체 변경 시 상위 의존성 무변화 보장 |
| Factory | `container.py` 모듈 | Config 인자를 기반으로 최적 모델 및 어댑터 동적 생성 및 주입 |

### 상속 아키텍처
- Protocol 기반 Duck Typing 대신 명시적 **Abstract Base Class (ABC)** 채택
- 구현 누락 시 인스턴스화 시점에 `TypeError` 발생을 통한 조기 방어 구현
- 정적 타입 분석 및 IDE 자동완성 지원 최적화
- 공통 보일러플레이트 코드(Batch 처리, GPU 장치 바인딩 등)를 부모 클래스로 상향 배치하여 서브클래스의 코드 중복 극대화 제거

### CLI 설정 오버라이딩 일원화
- 개별 명령어 옵션 하드코딩 대신 **Key=Value 오버라이드 기법** 채택
- YAML 환경설정 파일(`config.yaml`)을 단일 진실 공급원(Single Source of Truth)으로 삼아 파라미터 관리 집중화
- CLI 매개변수는 기존 Config 속성을 재정의하는 역할만 수행하여 파라미터 추가 시 CLI 소스 수정 불필요

## 전체 데이터 흐름

### Re-ID 전체 파이프라인

```
입력 소스 (카메라 / 비디오 파일 / 디렉토리)
        ↓
[YoloModel] detect 수행
  → 프레임 내 고양이 BBox 리스트 반환
        ↓
BBox crop 및 이미지 전처리 (모멘트 정렬 등)
        ↓
[ExtractorModel] extract 수행
  → 개체별 임베딩 벡터 생성 (Batch 단위 병렬 처리)
        ↓
[Matcher] match 수행
  → DB와 Cosine Similarity 계산 및 KNN/FAISS 매칭
        ↓
결과 객체 반환 (cat_id, similarity, is_known)
        ↓
Overlay 컴포넌트를 활용한 화면 렌더링 및 출력
```

### 독립 실행 모델
- 각 컴포넌트(YOLO Detector, Feature Extractor)는 통합 파이프라인 없이도 단독 실행 모드(predict, train, val 등)를 완결성 있게 수행 가능

## 프로젝트 아키텍처 구조

```
reid/
├── core/                         # 공유 타입 및 환경 설정
│   ├── types.py                  # BBox, Results, MatchResult 등 구조 정의
│   └── config.py                 # YAML 및 CLI 오버라이드 병합 Config 파서
├── engine/                       # 추상 제어 흐름 (Base Class)
│   ├── model.py                  # BaseModel (공통 Task 매핑 및 진입점)
│   ├── predictor.py              # BasePredictor (스트림 루프 및 결과 보관)
│   ├── trainer.py                # BaseTrainer (표준 학습 파이프라인 흐름)
│   └── validator.py              # BaseValidator (평가 지표 수집 및 검증 루프)
├── models/                        # 모델별 구체 어댑터
│   ├── yolo/                     # YOLO 검출 모델 래퍼
│   ├── extractor/                # MegaDescriptor 추출 모델 및 DB 관리
│   └── matcher/                  # KNN 및 FAISS 매칭 알고리즘 구현
├── stream/                       # OpenCV 기반 오버레이 시각화
├── utils/                        # 공통 로거 및 환경 유틸리티
├── pipeline.py                   # ReIdModel (E2E 파이프라인 관리 인터페이스)
├── container.py                  # 의존성 생성 공장 (Factory)
└── cli.py                        # CLI 핸들러
```

## 레이어별 상세 아키텍처

### 설정 통합 시스템

```
[YAML Config 파일]  ──┐
                    ├─► [Config.load() 통합 객체 생성] ─► [하위 모듈 전개 주입]
[CLI key=value 인자] ──┘ (동적 타입 매칭 오버라이드 수행)
```

- 모든 실행 인프라는 생성자 주입 방식으로 `cfg`를 전달받아 동작함
- `cfg.device` 자동 판단 프로세스를 포함하여 분산된 로직 단일화 달성

### 학습 파이프라인 아키텍처 (`reid/engine/trainer.py`)
- `BaseTrainer`가 표준 학습 흐름을 정의하고 에폭 루프, 옵티마이저 초기화, 모델 가중치 저장 및 검증 수행을 템플릿화함
- 구체 서브클래스(`ExtractorTrainer`)는 훅 메서드를 구현하여 학습에 필요한 데이터 바인딩 및 손실 함수(ArcFace 등) 연산만 집중 수행

```python
class BaseTrainer(ABC):
    def __init__(self, cfg=None):
        self.cfg = cfg or get_config()
        self.device = self.cfg.device
        self.model = None
        self.train_loader = None
        self.val_loader = None

    @abstractmethod
    def get_model(self) -> nn.Module: ...
    @abstractmethod
    def get_dataloader(self) -> tuple: ...
    @abstractmethod
    def compute_loss(self, outputs, targets) -> torch.Tensor: ...

    def setup(self):
        self.model = self.get_model().to(self.device)
        self.train_loader, self.val_loader = self.get_dataloader()

    def train(self):
        self.setup()
        for epoch in range(int(self.cfg.epochs)):
            self.model.train()
            # 배치 로프 및 학습 스텝 수행...
```

### 추론 파이프라인 아키텍처 (`reid/engine/predictor.py`)
- `BasePredictor` 내부로 스트림 캡처 루프, 화면 렌더링, 비디오 녹화기 연결 기능을 통합함
- 개별 서브클래스는 이미지 전처리(`preprocess`), 모델 추론(`inference`), 결과 정리(`postprocess`)에 속하는 전용 알고리즘만 정의

```python
class BasePredictor(ABC):
    def predict(self, source, **kwargs):
        # source 타입(웹캠, 비디오 경로, 이미지 리스트) 자동 판별 및 프레임 루프 가동
        # predict_once() 템플릿 메서드 순차 수행 후 결과 오버레이 렌더링 적용
```

## 의존성 참조 규칙

```
cli.py  →  container.py  →  pipeline.py  →  engine/
                         →  models/      →  engine/
                         →  stream/
                         →  core/
```
- 상위 레이어가 하위 인터페이스 레이어로만 단방향 참조 수행
- 구체 클래스(`models/`)는 비즈니스 도메인 조합기(`pipeline.py`) 및 스트림 매니저(`stream/`)를 미참조하여 결합도 최소화 유지

## CLI 인터페이스 명세

### 지원 모드 목록

| 명령어 모드 | 설명 | 주요 제어 인자 |
|---|---|---|
| `predict` | 실시간 카메라 또는 비디오 파일 입력 Re-ID 동작 | `source` (0: 웹캠, 파일 경로), `track` |
| `register` | 고양이 이미지 신규 DB 등록 및 특징 벡터 추출 | `source` (폴더/이미지), `label` |
| `list` | 현재 등록된 고양이 목록 및 개별 임베딩 수량 조회 | 없음 |
| `delete` | 지정한 고양이 개체의 DB 데이터 일괄 제거 | `label` |
| `migrate` | 모델 변경에 따른 기존 이미지 임베딩 재추출 및 데이터베이스 마이그레이션 | 없음 |
| `train` | 특징 추출기 미세 조정 학습 가동 | `epochs`, `lr` |
| `val` | 검증 데이터셋 대상 식별 정확도 평가 | `dataset_path` |
| `export` | 가중치 가속 변환용 ONNX 내보내기 실행 | 없음 |

### 실행 예시

```bash
# 실시간 예측 가동 (웹캠 0번)
reid predict source=0

# 신규 고양이 일괄 등록 (디렉토리 내 인물 폴더 매핑)
reid register dataset_path=datasets/new_cats

# 특정 고양이 데이터 삭제
reid delete label=Nabi

# 모델 교체 후 전체 임베딩 재추출 마이그레이션 실행
reid migrate model_name=hf-hub:BVRA/MegaDescriptor-L-384

# 특징 추출기 5에폭 학습
reid train epochs=5 lr=0.001
```
