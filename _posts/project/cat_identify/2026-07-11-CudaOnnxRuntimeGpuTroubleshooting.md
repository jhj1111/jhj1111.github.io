---
title: (CatHealth) ONNX Runtime GPU 트러블슈팅
post_order: 10
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_10.png
layout: post
author: jhj
categories:
  - Project
  - CatHealth
tags:
  - CUDA
  - ONNXRuntime
  - PyTorch
  - GPU
excerpt: ONNX Runtime GPU 사용 시 유발되는 CUDA 라이브러리 미적재 오류 분석 및 가속 프로바이더 인식 불가 대책 기술
---

# ONNX Runtime GPU 가동 에러 분석 및 트러블슈팅 가이드

> ONNX Runtime GPU 런타임 적용 과정에서 유발되는 CUDA 연동 라이브러리(`libcudart.so`) 버전 매칭 오류 및 Execution Provider 누락 해결 프로세스 정리.

## 표준 구성 환경

- **운영체제**: Ubuntu 24.04
- **파이썬 런타임**: Python 3.12 (venv 가상환경 격리)
- **프레임워크**: PyTorch 2.5.1 + CUDA 12.1 빌드
- **하드웨어 디바이스**: NVIDIA GTX1060 Max-Q (NVIDIA Driver 535.xx)

## 대표 증상 분석

### libcudart 공유 객체 로딩 실패
- ONNX Runtime 내부 공유 모듈 바인딩 단계에서 CUDA 런타임 종속성 버전 탐색 불가로 로딩 예외 유발
```text
ImportError: libcudart.so.13: cannot open shared object file: No such file or directory
```

### CUDA 실행 백엔드 제공 명단 탈락
- CUDA 가속 장치 요청 시 `ort.InferenceSession` 내부 검색 풀링에서 누락되어 CPU Fallback 강제 발생
```text
Specified provider 'CUDAExecutionProvider' is not in available provider names.
Available providers: CPUExecutionProvider
```

## 진단 및 대응 검증 절차

### 드라이버 연동 수준 확인
- `nvidia-smi`를 통해 물리 드라이버 장치 바인딩 및 가용 최상위 CUDA 호환성 버전 확인
```bash
nvidia-smi
```
- **주의 사항**: 관리 화면에 노출되는 CUDA Version은 **드라이버 한계치 버전**이므로 실제 CUDA Toolkit 설치 버전과 정합성 교차 체크 요망

### PyTorch 환경 내 CUDA 연동 계층 점검
- PyTorch의 GPU 하드웨어 제어권 획득 유무 및 바인딩 버전 정보 출력
```bash
python -c "
import torch
print(torch.__version__)
print(torch.version.cuda)
print(torch.cuda.is_available())
"
```
- `is_available()` 반환값이 `False` 상태일 경우, ONNX 가속 가동 이전에 시스템 수준의 NVIDIA 드라이버 및 PyTorch 재설치 선행 필요

### 시스템 적재 CUDA 런타임 라이브러리 경로 탐색
- 가상환경 폴더 또는 전역 경로 내 실제 가용 `libcudart` 자원 경로 역추적
```bash
find / -name "libcudart.so*" 2>/dev/null
```
- 시스템에 배치된 런타임 바이너리와 패키지 내부 가중 라이브러리 확인

### ONNX Runtime 빌드 요구 런타임 버전 역분석
- 설치된 ONNX Runtime 바이너리가 컴파일 단계에서 기획 지향한 `libcudart` 링크 속성 분석
```bash
ldd .venv/lib/python*/site-packages/onnxruntime/capi/onnxruntime_pybind11_state*.so | grep cudart
```
- `libcudart.so.13 => not found` 분석 결과 도출 시, 설치된 패키지가 CUDA 13.x 환경 요구용 빌드임을 시사함. 시스템 설치 버전이 CUDA 12.x 대역인 경우 불일치로 인한 오동작 확정

### 환경 변수 검색 경로 갱신
- 동적 링커 경로 `LD_LIBRARY_PATH` 내 가상환경 패키지 디렉토리 수동 마운트 테스트
```bash
# CUDA 12 계열 동적 공유 라이브러리 경로 강제 연결
export LD_LIBRARY_PATH=$VIRTUAL_ENV/lib/python3.12/site-packages/nvidia/cuda_runtime/lib:$LD_LIBRARY_PATH
```
- 설정 반영 후 `ort.get_available_providers()` 정상 검출 확인

## 표준 패키지 재빌드 가이드

의존성 패키지 혼재 방지를 위해 기존 가상환경 파괴 후 표준 버전 지정 재배포 절차를 권장함.

```bash
# 1. 가상환경 초기화
rm -rf .venv
python3.12 -m venv .venv
source .venv/bin/activate

# 2. PyTorch CUDA 12.1 전용 Whl 인덱스 설치
pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121

# 3. 프로젝트 GPU 가속 빌드 버전 설치
pip install -e ".[gpu]"
```

## 최종 가동 확인

- `torch.cuda.is_available()` 반환값 `True` 확인
- ONNX Runtime 프로바이더 조회 시 가속 장치 정상 등록 확인
```bash
python -c "
import onnxruntime as ort
print(ort.get_available_providers())
"
# 정상 출력: ['CUDAExecutionProvider', 'CPUExecutionProvider']
```

## 의존성 관리 예방 가이드

- **동종 CUDA 버전 고정성 유지**:
  - `nvidia-cublas-cu12` 등 CUDA 12.x 용 패키지가 CUDA 13.x 대역의 타 런타임 종속 패키지와 공존 시 라이브러리 로더 오염 유발. 가급적 단일 Major 버전(예: 12.x)으로 강제 제한
- **중복 런타임 설치 금지 정책**:
  - CPU 전용 패키지 `onnxruntime`과 GPU 전용 `onnxruntime-gpu` 패키지가 단일 Python 환경 내에 동시 설치될 시 심볼 충돌로 인해 GPU 인식이 차단됨. GPU 타겟 환경에서는 `onnxruntime-gpu` 단독 설치 필수화