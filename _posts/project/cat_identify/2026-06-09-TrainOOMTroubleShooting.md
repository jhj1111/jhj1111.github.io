---
title: (CatHealth) 학습 OOM 원인 분석 및 해결
post_order: 5
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_05.png
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
excerpt: reid train 학습 모드 실행 시 발생하는 OOM 및 장치 할당 이슈 분석과 조치 결과 정리
---

# Lumipet Re-ID 모델 학습 메모리 초과(OOM) 및 오류 분석 보고서

> `reid train` 실행 시 발생하는 메모리 초과(OOM) 및 연산 장치(Device) 할당 실패의 근본 원인을 진단하고 수정 조치 완료 내용 작성.

## 문제 분석 및 원인 파악

### 메모리 초과 (Out-of-Memory) 원인
- **백본 모델(Backbone)의 학습 모드 활성화**:
  - Re-ID 백본 모델인 `MegaDescriptor-L-384`는 약 2억 2,900만 개의 파라미터를 가진 Swin-Large 기반의 무거운 신경망임
  - 기존 코드상에서 백본의 가중치가 동결(Freeze)되지 않은 상태(`param.requires_grad = True`)로 로딩되어 연산 그래프가 백본 전체 영역에 생성됨
  - 이로 인해 배치 크기를 최소 수준(16)으로 설정해도 15 GB VRAM 수준의 Google Colab T4 및 CPU RAM 환경에서 초과 연산이 누적되어 OOM 세션 폭파가 상시 유발됨
- **학습 범위 오류**:
  - Fine-tuning 대상은 1536차원에서 512차원으로 다운사이징하는 **Projection Layer** 및 **Classifier**에 국한됨
  - 거대한 백본 모델의 가중치를 고정하고 그래디언트 계산에서 완전히 격리시켜야 메모리 확보가 가능한 구조임

### 장치(Device) 선택 및 폴백 오류
- **학습 루프의 CPU 강제 지정 문제**:
  - 기존 `reid/models/extractor/train.py` 내 연산 장치 판별은 `predictor` 속성의 존재 여부에 의존함
  - CLI(`cli.py`)를 통해 훈련(`train`) 명령을 직접 내리는 경우, 추론용 `predictor` 객체가 아직 인스턴스화되지 않은 `None` 상태임
  - 이로 인해 CUDA(GPU) 하드웨어가 활성화되어 있어도 `'cpu'` 장치로 오조정 및 강제 강하되어 연산 속도가 심각하게 하락(`36.00s/it`)하고 시스템 메모리 고갈을 유발함

## 해결 및 수정 내역

### model.py 가중치 고정 처리
- **백본 파라미터 업데이트 제외**:
  - 모델 생성 및 가중치 적재 단계에서 백본 내 모든 파라미터의 그래디언트 요청 속성을 명시적으로 해제함
  ```python
  for param in backbone.parameters():
      param.requires_grad = False
  ```
- **순전파 연산 그래프 생성 차단**:
  - `CombinedModel.forward` 내부의 백본 전방 추론 연산을 `torch.no_grad()` 구문으로 감싸 임시 활성화 맵(Activation Maps) 메모리 점유를 원천 방지함
  ```python
  with torch.no_grad():
      features = self.backbone(x)
  ```

### train.py 학습 동작 정밀화
- **연산 장치(Device) 결정 순서 확립**:
  - 사용자 매개변수(`kwargs`), 설정 YAML(`config.yaml`), 그리고 하드웨어 수준인 `torch.cuda.is_available()` 순으로 검증 단계를 확정하여 GPU 자동 배정 및 CPU Fallback을 정상 연동함
- **백본 모델의 배치 정규화(BatchNorm) 오염 방지**:
  - `model.train()` 상태에서도 백본은 항상 `.eval()` 상태를 고수하도록 제어하여 배치 통계치의 왜곡을 방지함
- **임계 차원 불일치 예외 제어**:
  - 신규 학습 수행 시(가중치 pth 파일 미존재 시)에도 검증 프로세스가 예외 없이 가동되도록 플래그 주입 논리 적용

### cli.py 파라미터 연동
- **Key=Value 오버라이드 매핑 확보**:
  - 명령줄에서 입력하는 튜닝 파라미터(`epochs=10`, `lr=0.001` 등)가 클래스 생성 및 실행 인자로 누수 없이 전달되도록 딕셔너리 언패킹 연동 완료

## 조치 결과 검증

- **CPU Fallback 및 훈련 가동 검증**:
  - CUDA 환경이 부재한 장비에서 `reid train epochs=1 batch_size=2` 작동 확인
  - `Warning: CUDA requested but not available. Falling back to CPU.` 경고 출력 및 CPU 백엔드 추론 연산 흐름 안정 구동
  - 백본 고정 및 그래디언트 제거 기법을 통해 1.5단계 학습 모드의 CPU RAM 점유율 안정화 및 누수 현상 종결