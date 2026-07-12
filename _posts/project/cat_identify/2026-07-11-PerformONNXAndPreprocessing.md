---
title: (CatHealth) ONNX 가속 및 전처리 최적화
post_order: 9
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_09.png
layout: post
author: jhj
categories:
  - Project
  - CatHealth
tags:
  - AI
  - ComputerVision
  - Python
  - reid
  - ONNX
  - Preprocessing
excerpt: 실시간 30 FPS 처리를 위한 ONNX Runtime/TensorRT 모델 추론 가속 및 OpenCV 모멘트 정렬, 다중 스케일 크롭, 가중 평균 임베딩 설계 명세
---

# Re-ID 성능 최적화 설계 명세서

> 실시간 처리 성능(30 FPS 이상) 충족 및 식별 정확도 보정을 타겟으로, ONNX/TensorRT 추론 가속, OpenCV 모멘트 회전 정렬, 다중 스케일 크롭 및 품질 가중 평균 임베딩 설계 기술 명세.

## 개요

실시간 고성능 고양이 식별 서비스 구현을 위한 다각적 최적화 설계 사양 정의. 속도 개선용 모델 가속화(ONNX/TensorRT)와 물리적 왜곡 보정용 전처리 기술(Moments Alignment, Multi-scale Crop, Weighted Embedding)을 통합하고, 설정 파일(`reid/cfg/default.yaml`)을 통해 기능별 토글을 유연하게 매핑함.

## 주요 기능 구성 및 설계 요구 사양

- **모델 추론 가속화 (ONNX Runtime / TensorRT)**:
  - YOLOv8 고양이 탐지기 및 MegaDescriptor 특징 추출기 백본 모델을 가속 엔진 형태로 구동하여 기존 PyTorch 순수 추론 지연 시간(Latency) 대비 2배 이상 연산 속도를 가속화함
- **FAISS 기반 고속 KNN 및 다수결 검증 (Top-K Matching)**:
  - 단일 비교(Top-1)로 기인하는 오동작 방지를 위해, 상위 K개의 최근접 벡터 리스트를 도출하고 각 최근접 결과에 가중치 다수결(Voting) 방식을 합산 연산해 신뢰성을 극대화함
- **품질 점수 기반 가중 평균 임베딩 (Weighted Mean Embedding)**:
  - 프레임 시퀀스의 각 바운딩 박스 크기(Area)와 선명도 값(Laplacian Variance)의 곱을 품질 가중치로 환산하여, 캐시 누적 시 고품질 프레임의 영향도를 가중하고 불량 프레임의 피처 노이즈 유입을 감쇄함
- **다중 스케일 크롭 기법 (Multi-Scale Cropping)**:
  - BBox 경계 오차와 스케일 왜곡 변동성에 강건하게 반응하도록 단일 타겟 영역의 상하좌우를 다른 비율(예: 0.85x, 1.0x, 1.15x)로 동시 크롭 후 특징 임베딩의 평균값을 도출함
- **모멘트 기반 2차원 회전 정렬 (Moments Alignment)**:
  - 추가적인 딥러닝 키포인트 연산 없이 OpenCV Moments 연산만을 이용하여 크롭 객체의 주축 회전 각도를 역추적하고, 이를 수평 정렬하여 각도 변화에 대응하는 템플릿 정합성을 가짐
- **설정 활성 토글화 (Feature Toggles)**:
  - 각 옵티마이저 속성 제어를 위한 환경변수 키를 배치하여 디바이스 성능별 구성 선택권을 제공함

## 설정 스키마 구성 (`reid/cfg/default.yaml`)

```yaml
# Re-ID KNN & Weighted Settings
k: 5                          # FAISS KNN 탐색을 위한 Top-K 이웃 개수
use_weighted_mean: True       # 누적 임베딩 시 이미지 선명도 가중치 반영 여부

# Preprocessing & Data Augmentations
use_multi_scale_crop: True    # 다중 스케일 크롭 사용 여부
multi_scale_factors: [0.85, 1.0, 1.15] # 크롭 비율 리스트

use_alignment: True           # 고양이 이미지 회전 정렬 사용 여부
alignment_method: "moments"   # 정렬 알고리즘 ("moments" 또는 "none")

# Model Acceleration (ONNX / TensorRT) Settings
use_onnx: False               # ONNX Runtime 가속 사용 여부 (On/Off)
use_tensorrt: False           # TensorRT 가속 사용 여부 (On/Off)
onnx_detector_path: "weights/yolo26n.onnx"
onnx_extractor_path: "weights/wildlife.onnx"
engine_detector_path: "weights/yolo26n.engine"
engine_extractor_path: "weights/wildlife.engine"
```

## 아키텍처 및 추론 데이터 흐름

```
[YOLOv8 검출 BBox]  →  [품질 검사 필터 통과]  →  [use_alignment 검사]
                                                  ↓ (True)
                                         [OpenCV Moments 회전 정렬]
                                                  ↓
                                         [use_multi_scale_crop 검사]
                                                  ↓ (True)
                                         [0.85x, 1.0x, 1.15x 다중 크롭]
                                                  ↓
                                         [Extractor 가속 추론 세션 실행]
                                                  ↓
                                         [다중 크롭 평균 임베딩 연산]
                                                  ↓
                                         [Laplacian 면적 가중 평균 연계]
                                                  ↓
                                         [FAISS Top-K KNN 매칭 및 투표]
```

## 컴포넌트 세부 구현 명세

### 모델 추론 가속화 설계 (Acceleration Engine)
- **YOLOv8 Detector**:
  - Ultralytics 내장 가속 호출 인터페이스를 활용하며, `use_tensorrt` 활성화 시 `.engine` 파일을, `use_onnx` 시 `.onnx` 경로를 Detector 생성자에 바인딩함
- **Feature Extractor (ExtractorPredictor)**:
  - PyTorch TensorRT 백엔드와 `onnxruntime.InferenceSession`을 내부로 캡슐화하는 전용 어댑터를 제공함
  - 추론 진입 시 가속 런타임 세션의 메모리 버퍼를 활성화해 고속 텐서 캐스팅과 채널 반전을 실행함

### 전처리 가공 프로세스 설계 (Image Processing)
- **모멘트 회전 정렬 (`use_alignment`)**:
  - 크롭 영역의 그레이스케일화 및 Otsu 이진화 처리를 행한 후 OpenCV `cv2.moments` 연산 수행
  - 1차 모멘트 기반 무게중심 $(x_c, y_c)$ 계산 및 중심 모멘트 ($\mu_{11}, \mu_{20}, \mu_{02}$) 값을 산출하여 주축 각도 $\theta$ 연산 진행
    $$\theta = \frac{1}{2} \arctan\left(\frac{2 \mu_{11}}{\mu_{20} - \mu_{02}}\right)$$
  - `cv2.getRotationMatrix2D` 연산으로 어핀 변환 행렬을 획득하고 `cv2.warpAffine`으로 이미지를 수평 회전 정렬 보정함
- **다중 스케일 크롭 (`use_multi_scale_crop`)**:
  - BBox 가로 $w$, 세로 $h$, 중심점을 추출하여 지정 인수 $[0.85, 1.0, 1.15]$ 배율로 복사 및 자르기 수행
  - 이미지 해상도를 벗어나는 바운더리에 대해 클리핑(Clipping) 처리를 상시 선행함

### 가중 평균 임베딩 및 KNN 투표 매칭 설계
- **품질 점수 가중 평균 (`use_weighted_mean`)**:
  - `TrackState` 관리 객체 내 품질 변수 $w_i = \text{blur\_score}_i \times \text{bbox\_area}_i$ 산정
  - 가중 특징 합성 연산을 한 후 최종 매칭 거리를 측정하기 위한 L2 정규화 단계 수행
    $$\mathbf{e}_{\text{weighted}} = \sum (w_i \cdot \mathbf{e}_i), \quad \mathbf{e}_{\text{final}} = \frac{\mathbf{e}_{\text{weighted}}}{\|\mathbf{e}_{\text{weighted}}\|_2}$$
- **Top-K KNN 다수결 매칭**:
  - FAISS index search 결과 `(distances, indices)`의 상위 K개 라벨 분포를 획득하여 코사인 거리 가중 합산 투표(Weighted Voting) 적용
  - 최종 득표 1순위 라벨의 평균 매칭 유사도가 설정 임계치를 초과하는 경우에만 신원을 보증하고, 미달할 시 `Unknown` 처리함
