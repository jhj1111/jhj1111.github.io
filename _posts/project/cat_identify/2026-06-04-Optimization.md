---
title: (CatHealth) 최적화
post_order: 3
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_03.png
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
excerpt: MegaDescriptor 및 YOLOv8 최적화 기법, ONNX Runtime/TensorRT 가속 및 C++ 포팅 설계
---

# Cat Re-ID — 속도 최적화 및 C++ 포팅 가이드

> 전체 파이프라인 정상 동작 확인 후, 병목 구간 측정 기반의 단계별 최적화 수행 지침.

## 병목 측정 먼저

최적화 작업 시작 전 각 구간별 소요 시간을 정밀 측정하여 병목 위치를 파악하는 것이 필수적임. 일반적으로 추론부보다 이미지 전처리 또는 파일 I/O에서 병목이 발생하는 경우가 존재함.

```python
# scripts/profile_pipeline.py
import time
import cv2
import numpy as np
from reid.container import build_detector, build_extractor, build_matcher
from reid.core.config import get_config
from reid.models import ReIdModel

cfg = get_config()
detector = build_detector(cfg)
extractor = build_extractor(cfg)
matcher = build_matcher(cfg)
pipeline = ReIdModel(detector, extractor, matcher, cfg=cfg)

# 대표 이미지 생성 (384x384, 3채널)
frame = np.zeros((384, 384, 3), dtype=np.uint8)

# 1. Detector 속도 측정
t0 = time.perf_counter()
detector_results = detector.predict(frame)
t1 = time.perf_counter()

# 2. Extractor 속도 측정
crops = [box.crop(frame) for box in detector_results.boxes] if detector_results else []
if crops:
    t2 = time.perf_counter()
    embeddings = extractor.predict_batch(crops)
    t3 = time.perf_counter()
else:
    t2 = t3 = time.perf_counter()

# 3. Matcher 속도 측정
if crops and len(embeddings) > 0:
    t4 = time.perf_counter()
    for emb in embeddings:
        match = matcher.match(emb)
    t5 = time.perf_counter()
else:
    t4 = t5 = time.perf_counter()

print(f"YOLO 탐지:       {(t1 - t0) * 1000:.1f} ms")
print(f"Embedding 추출:  {(t3 - t2) * 1000:.1f} ms")
print(f"KNN 매칭:        {(t5 - t4) * 1000:.1f} ms")
```

**구간별 예상 소요 시간 (GPU 환경, MegaDescriptor-Large 기준)**

| 구간 | 예상 시간 | 비고 |
|---|---|---|
| YOLO 탐지 | 10~30 ms | GPU 환경 최적화 상태 |
| Embedding 추출 | 50~150 ms | 주요 병목 구간 |
| KNN 매칭 | 1~5 ms | CPU 연산, 비중 낮음 |

## Python 내 최적화 전략

### 경량 모델 선택
가장 직관적이고 효과가 큰 속도 개선 방식임.

| 모델 | 파라미터 | 크기 | 입력 | 사용 권장 |
|---|---|---|---|---|
| MegaDescriptor-Tiny | ~28 M | ~110 MB | 224 px | 엣지/CPU 저전력 환경 |
| MegaDescriptor-Small | ~50 M | ~200 MB | 224 px | 속도-정확도 밸런스 |
| MegaDescriptor-Large | ~229 M | ~900 MB | 384 px | 고성능 서버 환경 |

```yaml
# config.yaml 수정
model_name: "hf-hub:BVRA/MegaDescriptor-T-224"  # Tiny 모델 변경 시 3~5배 가속 효과
imgsz: 224
```

### `torch.no_grad()` 및 `model.eval()` 적용
추론 단계에서의 그래디언트 계산 그래프 생성을 비활성화하여 메모리 낭비 방지 및 속도를 향상시킴.

```python
# reid/models/extractor/mega_descriptor/model.py 예시
class CombinedModel(nn.Module):
    def __init__(self, backbone, projection, has_custom_weights):
        super().__init__()
        self.backbone = backbone
        self.projection = projection
        self.has_custom_weights = has_custom_weights
    
    def forward(self, x):
        with torch.no_grad():  # 연산 그래프 생성을 중단하여 VRAM 및 추론 속도 최적화
            features = self.backbone(x)
        if self.has_custom_weights:
            return self.projection(features)
        return features
```

### 배치 추론 적용
동일 프레임 내 다중 고양이가 탐지되었을 때 순차 추론 대신 단일 배치 텐서로 묶어 연산 효율 극대화.

```python
# reid/models/extractor/predict.py 배치 추론 예시
def predict_batch(self, imgs: list[np.ndarray]) -> np.ndarray:
    tensors = torch.stack([self.preprocess(img) for img in imgs]).to(self.device)
    with torch.no_grad():
        embeddings = self.model(tensors)
    return embeddings.cpu().numpy()
```

### 프레임 스킵 및 캐싱 기법
ByteTrack 추적 ID를 기반으로 하여 신규 ID 탐지 시에만 Re-ID 특징 추출을 수행하고, 기존 ID에 대해서는 식별 결과를 재사용함. (Re-ID 연산 횟수를 90% 이상 절감)

```yaml
# config.yaml 설정 연동
track: True                  # 트래킹 활성화
candidate_interval: 10       # 미확정 개체 재매칭 주기 (Frame 단위)
lock_interval: 60            # 확정 개체 재검증 주기 (Frame 단위)
```

## ONNX 변환으로 추론 가속

PyTorch 의존성 없이 C++ 런타임 및 경량화 환경 배포가 가능한 표준 포맷 변환 기법임.

### 가속 장점
- **그래프 최적화**: 레이어 노드 융합(Node Fusion), 상수 폴딩(Constant Folding) 등 적용
- **런타임 효율**: CPU 환경 20~30% 향상, GPU 환경 CUDA/TensorRT Provider 활용 시 2~5배 이상 가속 가능

### ONNX 내보내기 구현
```python
# reid/models/extractor/predict.py 내보내기 예시
def export(self, output_path: str) -> str:
    self.model.eval()
    dummy_input = torch.randn(1, 3, self.cfg.imgsz, self.cfg.imgsz).to(self.device)
    torch.onnx.export(
        self.model,
        dummy_input,
        output_path,
        input_names=["image"],
        output_names=["embedding"],
        dynamic_axes={"image": {0: "batch_size"}},
        opset_version=17
    )
    return output_path
```

## TensorRT 가속 (GPU 환경)

NVIDIA GPU 하드웨어에 최적화된 엔진 빌드를 통해 최고의 FPS 성능 달성 가능.

```python
# ONNX Runtime TensorRT Provider 연동 예시
import onnxruntime as ort

providers = [
    ("TensorrtExecutionProvider", {
        "trt_engine_cache_enable": True,
        "trt_engine_cache_path": "models/trt_cache/",
        "trt_fp16_enable": True
    }),
    "CUDAExecutionProvider",
    "CPUExecutionProvider"
]
session = ort.InferenceSession("weights/wildlife.onnx", providers=providers)
```

## C++ 포팅 가이드

### 포팅 기대 효과 분석

| 구간 | C++ 전환 기대치 | 사유 |
|---|---|---|
| YOLO 추론 | 낮음 | GPU 내부 CUDA 커널에서 실제 연산 수행 |
| Re-ID 특징 추출 | 낮음 | 동일 수준의 GPU 가속 백엔드 호출 |
| 매칭 연산 (KNN) | 매우 낮음 | Python numpy/FAISS 라이브러리가 이미 C 구현체 기반 |
| 이미지 전처리/프레임 루프 | 보통 | Python 인터프리터 루프 오버헤드 제거 |

### 포팅 구조 및 범위 정의
비즈니스 로직(학습, DB 가공)은 Python을 유지하고, 실시간 스트림 파이프라인 루프만 C++로 마이그레이션 수행.

```
cpp/
├── CMakeLists.txt
├── main.cpp                 # 프레임 캡처 및 파이프라인 루프 제어
├── detector.hpp/cpp         # YOLO ONNX Runtime C++ API 어댑터
├── embedder.hpp/cpp         # MegaDescriptor ONNX Runtime C++ API 어댑터
├── matcher.hpp/cpp          # Cosine Similarity 기반 KNN 매칭 알고리즘
└── overlay.hpp/cpp          # OpenCV C++ 활용 오버레이 드로잉
```

### CMakeLists.txt 작성 예시
```cmake
cmake_minimum_required(VERSION 3.18)
project(cat_reid)

set(CMAKE_CXX_STANDARD 17)

find_package(onnxruntime REQUIRED)
find_package(OpenCV REQUIRED)

add_executable(cat_reid
    main.cpp
    detector.cpp
    embedder.cpp
    matcher.cpp
    overlay.cpp
)

target_include_directories(cat_reid PRIVATE ${OpenCV_INCLUDE_DIRS})
target_link_libraries(cat_reid
    onnxruntime
    ${OpenCV_LIBS}
)
```

### 특징 추출기(Embedder) C++ 구현 예시
```cpp
// cpp/embedder.hpp
#pragma once
#include <onnxruntime_cxx_api.h>
#include <opencv2/opencv.hpp>
#include <vector>

class Embedder {
public:
    explicit Embedder(const std::string& model_path);
    std::vector<float> extract(const cv::Mat& image);

private:
    Ort::Env env_;
    Ort::Session session_;
    std::string input_name_;
    cv::Mat preprocess(const cv::Mat& image);
};
```

```cpp
// cpp/embedder.cpp
#include "embedder.hpp"

Embedder::Embedder(const std::string& model_path)
    : env_(ORT_LOGGING_LEVEL_WARNING, "embedder"),
      session_(env_, model_path.c_str(), Ort::SessionOptions{})
{
    Ort::AllocatorWithDefaultOptions alloc;
    input_name_ = session_.GetInputNameAllocated(0, alloc).get();
}

cv::Mat Embedder::preprocess(const cv::Mat& image) {
    cv::Mat resized, float_img;
    cv::resize(image, resized, cv::Size(224, 224));
    resized.convertTo(float_img, CV_32F, 1.0 / 255.0);
    float_img = (float_img - 0.5f) / 0.5f;

    // HWC -> CHW 변환
    cv::Mat chw;
    std::vector<cv::Mat> channels(3);
    cv::split(float_img, channels);
    cv::vconcat(channels, chw);
    return chw.reshape(1, {1, 3, 224, 224});
}

std::vector<float> Embedder::extract(const cv::Mat& image) {
    cv::Mat input = preprocess(image);
    std::vector<int64_t> input_shape = {1, 3, 224, 224};
    Ort::MemoryInfo mem_info = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
    
    Ort::Value input_tensor = Ort::Value::CreateTensor<float>(
        mem_info,
        reinterpret_cast<float*>(input.data),
        input.total(),
        input_shape.data(),
        input_shape.size()
    );

    const char* input_names[] = {input_name_.c_str()};
    const char* output_names[] = {"embedding"};
    
    auto output = session_.Run(
        Ort::RunOptions{nullptr},
        input_names, &input_tensor, 1,
        output_names, 1
    );

    float* data = output[0].GetTensorMutableData<float>();
    int64_t size = output[0].GetTensorTypeAndShapeInfo().GetElementCount();
    return std::vector<float>(data, data + size);
}
```

### 매칭기(Matcher) C++ 구현 예시
```cpp
// cpp/matcher.hpp
#pragma once
#include <vector>
#include <string>

struct MatchResult {
    std::string cat_id;
    float similarity;
    bool is_known;
};

struct DbEntry {
    std::string cat_id;
    std::vector<float> embedding;
};

class KnnMatcher {
public:
    KnnMatcher(float threshold = 0.6f);
    void add(const std::string& cat_id, const std::vector<float>& embedding);
    MatchResult match(const std::vector<float>& query) const;

private:
    float threshold_;
    std::vector<DbEntry> db_;
    float cosine_similarity(const std::vector<float>& a, const std::vector<float>& b) const;
};
```

```cpp
// cpp/matcher.cpp
#include "matcher.cpp"
#include <cmath>
#include <algorithm>

KnnMatcher::KnnMatcher(float threshold) : threshold_(threshold) {}

void KnnMatcher::add(const std::string& cat_id, const std::vector<float>& embedding) {
    db_.push_back({cat_id, embedding});
}

float KnnMatcher::cosine_similarity(const std::vector<float>& a, const std::vector<float>& b) const {
    float dot = 0.0f, norm_a = 0.0f, norm_b = 0.0f;
    for (size_t i = 0; i < a.size(); ++i) {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    return dot / (std::sqrt(norm_a) * std::sqrt(norm_b) + 1e-8f);
}

MatchResult KnnMatcher::match(const std::vector<float>& query) const {
    float best_sim = -1.0f;
    std::string best_id = "Unknown";

    for (const auto& entry : db_) {
        float sim = cosine_similarity(query, entry.embedding);
        if (sim > best_sim) {
            best_sim = sim;
            best_id = entry.cat_id;
        }
    }

    bool is_known = best_sim >= threshold_;
    return {is_known ? best_id : "Unknown", best_sim, is_known};
}
```

## 최적화 전략 선택 가이드

시스템 가용 자원 및 요구 스펙에 대응하는 추천 최적화 단계 정의.

```
[1단계: 모델 경량화] -> [2단계: 추적/캐싱 기반 추론 생략] -> [3단계: ONNX 가속] -> [4단계: TRT 가속] -> [5단계: C++ 프레임 제어 루프 작성]
```

### 디바이스 구동 환경별 권장 셋업

| 환경 | 추천 모델 | 런타임 백엔드 | 목표 성능 |
|---|---|---|---|
| CPU Only (PC/서버) | MegaDescriptor-Tiny | ONNX Runtime CPU | 5~15 FPS |
| GPU (RTX 3060 이상) | MegaDescriptor-Large | PyTorch GPU / ONNX CUDA | 30 FPS+ |
| GPU 서버 (대형 망) | MegaDescriptor-Large | TensorRT GPU | 60 FPS+ |
| 임베디드 엣지 (Jetson 등) | MegaDescriptor-Tiny | TensorRT C++ | 15~30 FPS |