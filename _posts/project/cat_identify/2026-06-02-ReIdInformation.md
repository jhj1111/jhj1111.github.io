---
title: (CatHealth) Re-id 관련 정보 및 모델
post_order: 1
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_01.png
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
excerpt: 고양이 Re-ID 및 관련 논문 정리
---

# Cat Re-ID 참고 자료 정리

## 모델

### MegaDescriptor
- 동물 Re-ID 목적의 Foundation Model
- Swin Transformer 기반, 29개 이상의 동물 Re-ID 데이터셋으로 사전학습 수행
- 고양이 Re-ID에 Zero-shot 또는 Fine-tuning 방식으로 활용 가능
- **논문**: [WildlifeDatasets: An open-source toolkit for animal re-identification (WACV 2024)](https://arxiv.org/abs/2311.09118)
- **GitHub**: [WildlifeDatasets/wildlife-tools](https://github.com/WildlifeDatasets/wildlife-tools)
- **HuggingFace**: [BVRA/MegaDescriptor-L-384](https://huggingface.co/BVRA/MegaDescriptor-L-384)

**버전별 스펙**

| 버전 | Backbone | 파라미터 | 모델 크기 | 입력 해상도 | 비고 |
|---|---|---|---|---|---|
| Tiny | Swin-T | ~28 M | ~110 MB | 224 px | 엣지 디바이스 검토용 |
| Small | Swin-S | ~50 M | ~200 MB | 224 px | 균형형 |
| Base | Swin-B | ~88 M | ~473 MB | 224 px | - |
| Large | Swin-L | ~229 M | ~900 MB | 224/384 px | 최고 정확도, 서버 권장 |

**빠른 시작 코드**

```python
import timm
import torchvision.transforms as T

model = timm.create_model("hf-hub:BVRA/MegaDescriptor-L-384", pretrained=True)
model = model.eval()

transforms = T.Compose([
    T.Resize((384, 384)),
    T.ToTensor(),
    T.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
])
```

### MiewID
- MegaDescriptor 후속 멀티스피시즈 Re-ID 모델
- 49종, 37K 개체, 225K 이미지 데이터셋으로 학습 수행
- Unseen Species 기준 MegaDescriptor 대비 평균 Top-1 Accuracy 19.2% 향상 확인
- **논문**: [Multispecies Animal Re-ID Using a Large Community-Curated Dataset (2024)](https://arxiv.org/abs/2412.05602)
- EfficientNetV2 Backbone 및 Sub-center ArcFace Loss 채택
- MegaDescriptor 대비 신규 종(Unseen Species)에 대한 강력한 Zero-shot 성능 제공

## 관련 논문

### 고양이 Re-ID 직접 관련

| 논문 | 링크 | 핵심 내용 |
|---|---|---|
| Siamese Networks for Cat Re-Identification (2025) | [arxiv 2501.02112](https://arxiv.org/abs/2501.02112) | Hello Street Cat 데이터셋(69마리, 2796장) 기반 Siamese Network 학습. VGG16 + Contrastive Loss 조합 최고 성능(정확도 97%, F1 0.93) 달성 |
| What cat is that? A re-id model for feral cats (2025) | [arxiv 2507.11575](https://arxiv.org/abs/2507.11575) | 야생 고양이 Re-ID 목적의 Part-based 모델 설계 및 평가 |
| Body-part-based feral cat identification (2025) | [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S1574954125002675) | 카메라 트랩 이미지 활용, 신체 부위별 특징 추출 및 식별 성능 검증 |

### 동물 Re-ID 일반

| 논문 | 링크 | 핵심 내용 |
|---|---|---|
| WildlifeDatasets (WACV 2024) | [arxiv 2311.09118](https://arxiv.org/abs/2311.09118) | MegaDescriptor 발표 논문. 29개 이상 데이터셋 종합 벤치마크 수행 |
| AnimalCLEF 2025 (DS@GT) | [arxiv 2509.12353](https://arxiv.org/abs/2509.12353) | MegaDescriptor + KNN 기반 식별 및 DINOv2 비교 분석. ViT 기반 Triplet Learning 적용 |
| In Defense of Triplet Loss for Person Re-ID | [arxiv 1703.07737](https://arxiv.org/abs/1703.07737) | Triplet Loss의 Re-ID 유효성 실증 및 최적화 기법 제안 |
| ArcFace (CVPR 2019) | [논문 PDF](https://openaccess.thecvf.com/content_CVPR_2019/papers/Deng_ArcFace_Additive_Angular_Margin_Loss_for_Deep_Face_Recognition_CVPR_2019_paper.pdf) | Additive Angular Margin Loss 제안. Triplet Loss 대비 우수한 Inter-class 판별력 확보 |
| Animal Re-ID on Microcontrollers (2025) | [arxiv 2512.08198](https://arxiv.org/abs/2512.08198) | 개체당 2~3장의 소량 데이터 기반 최종 레이어 Few-shot Fine-tuning 성능 실증 |

## 데이터셋

### 메인 데이터셋

| 데이터셋 | 규모 | 링크 | 비고 |
|---|---|---|---|
| Hello Street Cat | 69마리, 2,796장 | HelloStreetCatWiki 수집 | 메인 학습 및 평가 데이터. 추가 데이터 수집 가능 |

### 보조 데이터셋 (고양이)

| 데이터셋 | 규모 | 링크 | 비고 |
|---|---|---|---|
| CatIndividualImages | - | [Kaggle](https://www.kaggle.com/datasets/timost1234/cat-individuals) | 고양이 개체 식별 연구용 데이터셋 |
| Cat Dataset (Oxford) | 9,000장+ | [Kaggle](https://www.kaggle.com/datasets/crawford/cat-dataset) | 고양이 얼굴 랜드마크 어노테이션 포함 |

### WildlifeDatasets 툴킷 (동물 Re-ID 통합)
- 50개 이상의 동물 Re-ID 데이터셋 통합 제공 툴킷
- **GitHub**: [WildlifeDatasets/wildlife-datasets](https://github.com/WildlifeDatasets/wildlife-datasets)
- 고양이, 소, 닭, 거북이, 고래, 표범 등 다양한 종의 데이터 포함

## 툴킷 및 라이브러리

| 이름 | 링크 | 용도 |
|---|---|---|
| wildlife-tools | [GitHub](https://github.com/WildlifeDatasets/wildlife-tools) | MegaDescriptor 학습, 특징 추출, KNN 분류 통합 프레임워크 |
| wildlife-datasets | [GitHub](https://github.com/WildlifeDatasets/wildlife-datasets) | 동물 Re-ID 데이터셋 다운로드 및 전처리 지원 |
| timm | [GitHub](https://github.com/huggingface/pytorch-image-models) | PyTorch 이미지 모델 라이브러리. MegaDescriptor 로드용 |
| YOLOv8 (Ultralytics) | [GitHub](https://github.com/ultralytics/ultralytics) | 객체 탐지(Object Detection) 모델 구현체 |
| ByteTrack | [GitHub](https://github.com/ifzhang/ByteTrack) | 실시간 다중 객체 추적(Multi-Object Tracking) 알고리즘 |

**wildlife-tools 기본 사용 예시**

```python
import timm
from wildlife_tools.features import DeepFeatures
from wildlife_tools.similarity import CosineSimilarity
from wildlife_tools.inference import KnnClassifier

# 특징 추출
extractor = DeepFeatures(timm.create_model('hf-hub:BVRA/MegaDescriptor-T-224', num_classes=0, pretrained=True))
query_features = extractor(query_dataset)
db_features = extractor(db_dataset)

# KNN 분류
similarity = CosineSimilarity()(query_features, db_features)
classifier = KnnClassifier(k=1, database_labels=db_dataset.labels_string)
predictions = classifier(similarity)
```

## 주요 개념 정리

| 개념 | 설명 |
|---|---|
| Embedding | 이미지를 고차원 특징 벡터로 변환한 값. 동일 개체는 가깝고 타 개체는 멀어지도록 매핑 |
| Cosine Similarity | 두 임베딩 벡터 간의 각도 유사도 측정값. Re-ID 매칭 및 비교 표준 메트릭 |
| KNN (K-Nearest Neighbor) | 입력 특징과 가장 가까운 K개의 갤러리 특징을 탐색하여 개체 판별 수행 |
| Contrastive Loss | Siamese Network 학습 시 사용. Positive 쌍은 가깝게, Negative 쌍은 멀어지도록 최적화 |
| Triplet Loss | Anchor, Positive, Negative 세 개체 쌍 기반 학습. 대조 손실 대비 안정적 수렴 제공 |
| ArcFace Loss | 각도 마진을 도입한 분류 손실 함수. 개체 간 경계 구분 능력이 우수하여 Re-ID에 널리 활용 |
| Zero-shot | 추가 학습 없이 사전학습된 모델 특징을 바로 분류에 사용하는 방식 |
| Fine-tuning | 사전학습 모델의 가중치 일부 또는 전체를 신규 데이터로 미세 조정 학습하는 기법 |
| Few-shot fine-tuning | 개체당 극소량(2~3장)의 이미지로 분류용 최종 프로젝션 레이어만 재학습하는 기법 |