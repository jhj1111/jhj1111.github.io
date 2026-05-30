---
title: (CatHealth) 비전 테스트 작업일지
post_order: 7
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_07.png
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
excerpt: 비전 모델 테스트 프레임워크 구현 및 TFLite 모델 분석 작업 기록
---

# 비전 테스트 작업일지
> 작성일: 2026-05-29
> 문서 버전: v 1.0
> 목적: AI 모델 실시간 검증 도구 구현 과정 및 모델 분석 결과 기록
---

## 1. 작업 내용 요약
### 1.1 핵심 인프라 구축
- `비전 테스트 아키텍처` 기획을 바탕으로 기본 프레임워크 뼈대 구현 완료.
- **`core/camera.py`**: OpenCV (`cv2.VideoCapture`)를 활용한 실시간 웹캠 프레임 캡처 기능 구현.
- **`core/renderer.py`**: OpenCV (`cv2.imshow`)를 활용하여 프레임 위에 모델 추론 결과(Label, Confidence)를 오버레이하는 렌더링 모듈 작성.
- **`core/pipeline.py`**: 다중 모델 등록 및 순차적 추론 실행을 관리하는 오케스트레이터(Pipeline) 구현. (파일명 오타 수정 완료)
- **`main.py`**: `models.yaml` 설정을 로드하여 파이프라인을 구성하고 실시간 추론 루프를 구동하는 진입점 작성.

### 1.2 TFLite 분류기(Classifier) 구현
- `models/classifier.py` 에 TensorFlow Lite 모델 추론을 위한 `Classifier` 클래스 구현.
- `BaseModel` 인터페이스 준수 (`load`, `preprocess`, `infer`, `postprocess` 구현).
- 양자화(Quantization) 모델 지원: `uint8` 및 `int8` 입력 타입에 대응하는 전처리 로직 및 출력(확률) 변환 로직 적용.
- `labels.txt` 파일을 로드하여 예측된 인덱스(class_id)를 사람이 읽을 수 있는 레이블 이름으로 매핑하는 기능 추가.

### 1.3 모델 스펙 분석

테스트 대상 모델인 `cat_breed_int8.tflite` (EfficientNet-Lite 4 기반 추정)의 구조를 분석함.
- **입력 (Input)**: `[1, 300, 300, 3]`, 타입 `uint8`
- **출력 (Output)**: `[1, 1000]`, 타입 `uint8`
- **분석 결과**: 해당 모델은 입력 크기가 `300x300` 이며, 1,000개의 클래스를 출력하는 **ImageNet-1 K 사전 학습(Pre-trained) 모델**로 확인됨.

### 1.4 설정 업데이트
- 확인된 모델 스펙에 맞추어 `config/models.yaml` 의 `input_size` 를 `[224, 224]` 에서 `[300, 300]` 으로 수정.
- 레이블 파일 경로(`weights/imagenet_labels.txt`) 설정 추가.
---
## 2. 다음 작업 (To-Do)
### 2.1 임시 테스트 환경 완성
- **ImageNet 레이블 파일 준비**: 현재 모델이 1,000개 클래스를 출력하므로, 정상 동작 확인을 위해 1,000개 클래스가 정의된 `imagenet_labels.txt` 파일을 `weights/` 디렉토리에 추가하여 테스트 진행.

### 2.2 고양이 품종 분류 모델 고도화 (Fine-Tuning)

- **목표 모델 학습**: 현재 모델은 범용 모델(ImageNet)이므로 고양이 품종 전용 모델로 변환 필요.
- **데이터셋 준비**: `docs/02_AI_상세.md` 에 명시된 Oxford-IIIT Pet Dataset, Kaggle Cat Breeds Dataset 등을 수집 및 전처리.
- **Transfer Learning**: EfficientNet-Lite 4를 백본으로 하여 출력 레이어를 고양이 품종 수(예: 67개)에 맞게 변경하고 재학습.
- **양자화 변환**: 학습된 모델을 모바일 탑재 및 현재 프레임워크 호환을 위해 INT 8/UINT 8 TFLite 포맷으로 양자화 변환.

### 2.3 프레임워크 확장
- 객체 탐지(`detector.py`), 세그멘테이션(`segmentor.py`) 등 다른 모델 타입 지원 추가.
- `utils/metrics.py` 구현하여 FPS 및 모델별 추론 지연 시간(Latency) 측정 및 화면 표시.
---
## 3. 유의사항
- **모델 입력 크기**: 향후 자체 학습한 모델 적용 시, 모델의 요구 입력 사이즈(예: 224 x 224 또는 300 x 300)와 `models.yaml` 의 `input_size` 설정이 일치하는지 반드시 확인해야 함. 불일치 시 텐서 형태 오류(ValueError) 발생.
- **양자화 파라미터**: TFLite 모델 로드 시 양자화 파라미터(`scale`, `zero_point`)가 올바르게 적용되어 확률이 0.0 ~ 1.0 사이로 계산되는지 모니터링 필요.