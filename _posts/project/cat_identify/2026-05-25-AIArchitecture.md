---
title: (CatHealth) Vision & AI 모델
post_order: 3
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_03.png
layout: post
author: jhj
categories:
  - Project
  - CatHealth
tags:
  - AI
  - ML
  - TFLite
  - MediaPipe
  - OpenCV
  - ONNX
  - ComputerVision
  - NDK
  - ModelTraining
excerpt: 고양이 건강 분석 앱의 온디바이스 AI 파이프라인 상세 — 종 분류·자세 추정·움직임 분석·건강 점수화 모델 선정, 데이터셋, 학습 계획 정리
---

# Vision & AI 모델 세부 설명

> 작성일: 2025-08  
> 문서 버전: v 1.0  
> 시리즈: 3/4 — 비전 모델 선정 · 데이터셋 · 학습 계획

---

## 1. 온디바이스 AI 파이프라인 개요

본 앱의 모든 추론 연산은 기기 내에서 처리한다. 네트워크 없이도 동작하며, 프레임당 처리 지연을 최소화하는 것이 핵심 설계 목표다.

### 1.1 파이프라인 흐름

```
CameraX Frame (1280×720, RGBA)
        │
        ▼
  ┌─────────────────────────────────────────────────────┐
  │                  :ml-core                           │
  │                                                     │
  │   ┌──────────────┐    ┌───────────────┐             │
  │   │BreedClassifier│    │ PoseEstimator │             │
  │   │ TFLite        │    │  MediaPipe    │             │
  │   │ EfficientNet  │    │  Holistic     │             │
  │   └──────┬────────┘    └──────┬────────┘            │
  │          │                   │                      │
  │   ┌──────▼────────┐    ┌──────▼────────┐            │
  │   │BreedResult    │    │PoseLandmarks  │            │
  │   │ (breed, conf) │    │ (17 keypoints)│            │
  │   └──────┬────────┘    └──────┬────────┘            │
  │          │                   │                      │
  │          │      ┌────────────▼──────────┐           │
  │          │      │   MotionAnalyzer      │           │
  │          │      │   OpenCV C++ (JNI)    │           │
  │          │      │   Lucas-Kanade OF     │           │
  │          │      └────────────┬──────────┘           │
  │          │                   │                      │
  │          └──────────┬────────┘                      │
  │                     │                               │
  │              ┌──────▼──────┐                        │
  │              │HealthScorer │                        │
  │              │ ONNX Runtime│                        │
  │              └──────┬──────┘                        │
  └─────────────────────│───────────────────────────────┘
                        │
                        ▼
              AnalysisResult (건강 점수 + 행동 분류)
```

### 1.2 모델별 처리 방식

|모델|실행 방식|스레드 전략|
|---|---|---|
|BreedClassifier|캡처 시 1회 추론|IO Dispatcher|
|PoseEstimator|실시간 (LIVE_STREAM)|MediaPipe 내부 스레드|
|MotionAnalyzer|프레임마다 C++ 처리|NDK 전용 스레드|
|HealthScorer|위 3개 결과 취합 후 1회|Default Dispatcher|

### 1.3 하드웨어 가속 전략

```
Android 기기
    │
    ├── GPU Delegate (TFLite)       ← 종 분류 모델
    ├── GPU Delegate (MediaPipe)    ← 자세 추정
    ├── NNAPI Delegate (ONNX RT)    ← 건강 점수 (API 27+)
    └── C++ NEON SIMD (OpenCV)      ← 광학 흐름 (ARM 최적화)

폴백 순서: GPU → NNAPI → CPU (기기 지원에 따라 자동 선택)
```

---

## 2. 종 분류 모델 (Breed Classifier)

### 2.1 모델 선정

**선정 모델: EfficientNet-Lite 4 (TFLite)**

|후보 모델|정확도|모델 크기|추론 속도 (모바일)|선정 여부|
|---|---|---|---|---|
|EfficientNet-Lite 4|Top-1 80.4%|16.0 MB|~180 ms (CPU)|✅ 선정|
|MobileNetV 3-Large|Top-1 75.2%|5.4 MB|~60 ms (CPU)|보조 후보|
|ResNet-50|Top-1 76.1%|98 MB|~380 ms (CPU)|❌ 모바일 부적합|
|EfficientNet-B 0|Top-1 77.1%|20 MB|~200 ms (CPU)|차순위|

**선정 이유**

- TFLite 공식 최적화 버전 존재 — 별도 변환 없이 바로 사용 가능
- GPU Delegate 적용 시 약 40~50 ms로 단축 → 실용적 속도 달성
- 고양이 품종처럼 세밀한 특징(Fine-grained) 분류에 충분한 표현력
- MobileNetV 3 대비 정확도 우위, ResNet 대비 크기·속도 우위

**단계별 전략**

- Phase 1: 공개 사전학습 모델 + Transfer Learning (빠른 MVP)
- Phase 2: 자체 수집 데이터로 Fine-tuning (정확도 고도화)
- Phase 3: 경량화 — 양자화(INT 8) 적용으로 크기 절반, 속도 2× 향상

### 2.2 데이터셋

**기본 데이터셋**

|데이터셋|품종 수|이미지 수|라이선스|용도|
|---|---|---|---|---|
|Oxford-IIIT Pet Dataset|37종 (고양이 12종)|7,349장|CC BY-SA 4.0|기본 학습|
|Cat Breeds Dataset (Kaggle)|67종|15,746장|공개|학습 보완|
|iNaturalist (고양이 subset)|30종+|10,000장+|CC BY-NC|다양성 확보|

**데이터 수집 확장 계획**

```
1단계 (MVP): Oxford-IIIT + Kaggle 데이터셋 병합
             → 약 50종, 20,000장 기준 학습

2단계: 웹 크롤링 + 사용자 제공 이미지 (앱 내 선택적 업로드)
             → 한국 인기 품종 추가 (코리안 숏헤어, 러시안 블루 등)
             → 목표: 70종, 50,000장

3단계: 앱 배포 후 사용자 피드백 기반 오분류 샘플 재학습 (Active Learning)
```

**데이터 전처리 파이프라인**

```python
# preprocess.py
import tensorflow as tf

IMG_SIZE = 224  # EfficientNet-Lite4 입력 크기

def preprocess_image(image_path: str, label: int):
    img = tf.io.read_file(image_path)
    img = tf.image.decode_jpeg(img, channels=3)
    img = tf.image.resize(img, [IMG_SIZE, IMG_SIZE])
    img = tf.cast(img, tf.float32) / 255.0          # [0, 1] 정규화
    img = (img - [0.485, 0.456, 0.406]) \
               / [0.229, 0.224, 0.225]              # ImageNet 평균/표준편차
    return img, label

def augment(image, label):
    image = tf.image.random_flip_left_right(image)
    image = tf.image.random_brightness(image, 0.2)
    image = tf.image.random_contrast(image, 0.8, 1.2)
    image = tf.image.random_saturation(image, 0.8, 1.2)
    # 랜덤 회전 (±15도)
    image = tfa.image.rotate(image,
                tf.random.uniform([], -0.26, 0.26))
    return image, label
```

### 2.3 학습 계획

**환경**

```
학습 환경: Google Colab Pro+ (A100 GPU) 또는 로컬 RTX 3090
프레임워크: TensorFlow 2.x + Keras
변환 도구: TFLite Converter
```

**Transfer Learning 절차**

```python
# train_breed_classifier.py
import tensorflow as tf

BASE_MODEL_URL = "https://tfhub.dev/google/efficientnet/lite4/feature-vector/2"
NUM_CLASSES = 67  # 목표 품종 수

def build_model():
    base = tf.keras.applications.EfficientNetLite4(
        include_top=False,
        weights="imagenet",
        input_shape=(224, 224, 3)
    )

    # 1단계: Feature Extractor 고정, 분류 헤드만 학습
    base.trainable = False

    model = tf.keras.Sequential([
        base,
        tf.keras.layers.GlobalAveragePooling2D(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(NUM_CLASSES, activation="softmax")
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy", "top_5_accuracy"]
    )
    return model

# 2단계: 상위 레이어 일부 해제 후 Fine-tuning
def fine_tune(model, unfreeze_from: int = -30):
    model.layers[0].trainable = True
    for layer in model.layers[0].layers[:unfreeze_from]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),  # 낮은 학습률
        loss="categorical_crossentropy",
        metrics=["accuracy"]
    )
```

**TFLite 변환 및 양자화**

```python
# convert_to_tflite.py

# Float32 변환 (기본)
converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_model = converter.convert()

# INT8 양자화 (권장 — 크기 1/4, 속도 2×)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.representative_dataset = representative_data_gen
converter.target_spec.supported_ops = [
    tf.lite.OpsSet.TFLITE_BUILTINS_INT8
]
converter.inference_input_type  = tf.uint8
converter.inference_output_type = tf.uint8
quantized_model = converter.convert()

with open("cat_breed_int8.tflite", "wb") as f:
    f.write(quantized_model)
```

**목표 성능 지표**

|지표|MVP 목표|고도화 목표|
|---|---|---|
|Top-1 Accuracy|≥ 70%|≥ 85%|
|Top-5 Accuracy|≥ 90%|≥ 95%|
|모델 크기 (INT 8)|≤ 8 MB|≤ 6 MB|
|추론 속도 (GPU)|≤ 200 ms|≤ 100 ms|

---

## 3. 자세 추정 모델 (Pose Estimator)

### 3.1 모델 선정

**선정 모델: MediaPipe Pose Landmarker (Lite)**

|후보|랜드마크 수|모바일 최적화|동물 지원|선정 여부|
|---|---|---|---|---|
|MediaPipe Pose Landmarker Lite|33개|✅ 공식 지원|사람 기준, 적용 가능|✅ 선정|
|MediaPipe Pose Landmarker Full|33개|✅|사람 기준|보조 (정밀도 필요 시)|
|OpenPose (TFLite 변환)|18개|비공식|사람 기준|❌ 변환 불안정|
|DeepLabCut (동물 전용)|커스텀|❌ 모바일 미지원|✅ 동물 전용|❌ 모바일 부적합|

**선정 이유 및 적용 전략**

MediaPipe는 사람 자세 추정 모델이지만, 고양이의 체형(4지 보행, 척추 굴곡)에서 유의미한 특징점을 추출할 수 있다. 특히 다음 랜드마크가 고양이 건강 분석에 활용 가능하다.

```
사람 랜드마크 → 고양이 적용 매핑

어깨 (11, 12)       → 앞다리 어깨 관절
팔꿈치 (13, 14)     → 앞다리 무릎
손목 (15, 16)       → 앞발 위치
엉덩이 (23, 24)     → 뒷다리 골반
무릎 (25, 26)       → 뒷다리 무릎
발목 (27, 28)       → 뒷발 위치
코 (0)              → 머리 위치
```

**Phase 2 이후:** 고양이 전용 자세 데이터셋으로 커스텀 Pose Landmarker 모델 학습 (MediaPipe Model Maker 활용).

### 3.2 MediaPipe 통합 코드

```kotlin
// CatPoseEstimator.kt (:ml-core)
class CatPoseEstimator @Inject constructor(
    @ApplicationContext private val context: Context,
    private val listener: PoseResultListener
) {
    interface PoseResultListener {
        fun onResult(result: PoseLandmarkerResult, inputImage: MPImage)
        fun onError(error: RuntimeException)
    }

    private val poseLandmarker: PoseLandmarker by lazy {
        PoseLandmarker.createFromOptions(
            context,
            PoseLandmarker.PoseLandmarkerOptions.builder()
                .setBaseOptions(
                    BaseOptions.builder()
                        .setModelAssetPath("pose_landmarker_lite.task")
                        .setDelegate(Delegate.GPU)
                        .build()
                )
                .setRunningMode(RunningMode.LIVE_STREAM)
                .setNumPoses(1)                      // 고양이 1마리 기준
                .setMinPoseDetectionConfidence(0.5f)
                .setMinTrackingConfidence(0.5f)
                .setResultListener(listener::onResult)
                .setErrorListener(listener::onError)
                .build()
        )
    }

    fun detectAsync(imageProxy: ImageProxy) {
        val mpImage = BitmapImageBuilder(imageProxy.toBitmap()).build()
        poseLandmarker.detectAsync(mpImage, imageProxy.imageInfo.timestamp)
    }

    fun close() = poseLandmarker.close()
}
```

### 3.3 자세 기반 건강 지표 계산

```kotlin
// PoseHealthAnalyzer.kt
object PoseHealthAnalyzer {

    // 척추 굴곡 각도: 웅크림 여부 판단
    fun calculateSpineCurvature(landmarks: List<NormalizedLandmark>): Float {
        val shoulder = landmarks[11].toVector()
        val hip      = landmarks[23].toVector()
        val nose     = landmarks[0].toVector()

        // 머리-어깨-골반 각도 계산
        return angleBetweenVectors(nose - shoulder, hip - shoulder)
    }

    // 보행 비대칭 점수: 절뚝거림 감지
    fun calculateGaitAsymmetry(
        leftAnkle: NormalizedLandmark,
        rightAnkle: NormalizedLandmark
    ): Float {
        val leftHeight  = leftAnkle.y()
        val rightHeight = rightAnkle.y()
        return abs(leftHeight - rightHeight) / ((leftHeight + rightHeight) / 2f)
    }

    // 활동 반경: 프레임 간 관절 이동 거리 합산
    fun calculateActivityRadius(
        prev: List<NormalizedLandmark>,
        curr: List<NormalizedLandmark>
    ): Float = KEY_JOINTS.sumOf { idx ->
        val dx = (curr[idx].x() - prev[idx].x()).toDouble()
        val dy = (curr[idx].y() - prev[idx].y()).toDouble()
        sqrt(dx * dx + dy * dy)
    }.toFloat()

    private val KEY_JOINTS = listOf(0, 11, 12, 13, 14, 23, 24, 25, 26)

    private fun angleBetweenVectors(v1: Vector2D, v2: Vector2D): Float {
        val dot = v1.x * v2.x + v1.y * v2.y
        val mag = v1.magnitude() * v2.magnitude()
        return if (mag == 0f) 0f else acos((dot / mag).coerceIn(-1f, 1f))
    }
}
```

---

## 4. 움직임 분석 — OpenCV C++ (NDK)

### 4.1 기술 선택 근거

Java/Kotlin으로 광학 흐름 연산을 구현했을 때와 C++ NDK 구현의 성능 차이는 다음과 같다.

|구현 방식|처리 시간 (1280×720)|FPS|선택|
|---|---|---|---|
|Kotlin + OpenCV Android SDK|~85 ms/frame|~12 FPS|❌|
|C++ NDK + OpenCV (NEON SIMD)|~18 ms/frame|~55 FPS|✅|
|C++ NDK + CUDA (GPU)|~8 ms/frame|~125 FPS|참고 (NDK에서 제한적)|

실시간 분석을 위한 최소 요건(24 FPS)을 충족하려면 C++ NDK가 필수다.

### 4.2 CMake 빌드 설정

```cmake
# ml/ml-core/src/main/cpp/CMakeLists.txt
cmake_minimum_required(VERSION 3.22.1)
project(motion_analyzer)

# OpenCV Android SDK 경로 (로컬 설치)
set(OpenCV_DIR "${CMAKE_SOURCE_DIR}/../../../../../opencv/sdk/native/jni")
find_package(OpenCV REQUIRED)

# ARM NEON SIMD 최적화 활성화
if(ANDROID_ABI STREQUAL "arm64-v8a")
    add_compile_options(-O3 -march=armv8-a+simd)
endif()

add_library(
    motion_analyzer
    SHARED
    motion_analyzer.cpp
    optical_flow_processor.cpp
    behavior_detector.cpp
)

target_include_directories(motion_analyzer PRIVATE
    ${OpenCV_INCLUDE_DIRS}
)

target_link_libraries(motion_analyzer
    ${OpenCV_LIBS}
    android
    log
)
```

### 4.3 C++ 핵심 구현

```cpp
// optical_flow_processor.cpp
#include "optical_flow_processor.h"
#include <opencv2/video/tracking.hpp>
#include <android/log.h>

#define LOG_TAG "MotionAnalyzer"

OpticalFlowResult OpticalFlowProcessor::compute(
        const cv::Mat& prevGray,
        const cv::Mat& currGray) {

    // 1. Shi-Tomasi 특징점 검출
    std::vector<cv::Point2f> prevPts;
    cv::goodFeaturesToTrack(
        prevGray,
        prevPts,
        MAX_CORNERS,          // 최대 200개 특징점
        QUALITY_LEVEL,        // 0.01
        MIN_DISTANCE,         // 10px 최소 거리
        cv::noArray(),
        3,                    // blockSize
        false,
        0.04                  // Harris detector k
    );

    if (prevPts.empty()) return {0.0f, 0.0f, 0};

    // 2. Lucas-Kanade 피라미드 광학 흐름
    std::vector<cv::Point2f> currPts;
    std::vector<uchar> status;
    std::vector<float> err;

    cv::calcOpticalFlowPyrLK(
        prevGray, currGray,
        prevPts, currPts,
        status, err,
        cv::Size(21, 21),    // 윈도우 크기
        3,                   // 피라미드 레벨
        cv::TermCriteria(
            cv::TermCriteria::COUNT | cv::TermCriteria::EPS,
            30, 0.01
        )
    );

    // 3. 유효 벡터 필터링 및 통계 산출
    float totalMagnitude = 0.0f;
    float maxMagnitude   = 0.0f;
    int   validCount     = 0;

    for (size_t i = 0; i < status.size(); ++i) {
        if (!status[i]) continue;

        float dx  = currPts[i].x - prevPts[i].x;
        float dy  = currPts[i].y - prevPts[i].y;
        float mag = std::sqrt(dx * dx + dy * dy);

        totalMagnitude += mag;
        maxMagnitude    = std::max(maxMagnitude, mag);
        ++validCount;
    }

    return {
        validCount > 0 ? totalMagnitude / validCount : 0.0f,  // 평균 이동량
        maxMagnitude,                                          // 최대 이동량
        validCount                                             // 유효 특징점 수
    };
}
```

```cpp
// behavior_detector.cpp
#include "behavior_detector.h"

BehaviorTag BehaviorDetector::classify(
        const std::vector<OpticalFlowResult>& recentFrames,
        float spineCurvature,
        float gaitAsymmetry) {

    // 최근 N프레임 평균 활동량
    float avgMotion = 0.0f;
    for (const auto& f : recentFrames) avgMotion += f.avgMagnitude;
    avgMotion /= static_cast<float>(recentFrames.size());

    // 규칙 기반 1차 분류
    if (gaitAsymmetry > GAIT_ASYMMETRY_THRESHOLD) {
        return BehaviorTag::LIMPING;              // 절뚝거림
    }
    if (avgMotion < LOW_ACTIVITY_THRESHOLD
            && spineCurvature < CROUCH_ANGLE_THRESHOLD) {
        return BehaviorTag::PROLONGED_CROUCHING;  // 웅크림 지속
    }
    if (isGroomingPattern(recentFrames)) {
        return BehaviorTag::EXCESSIVE_GROOMING;   // 과도한 그루밍
    }
    if (avgMotion > HIGH_ACTIVITY_THRESHOLD) {
        return BehaviorTag::HIGH_ACTIVITY;        // 과활동
    }

    return BehaviorTag::NORMAL;
}

bool BehaviorDetector::isGroomingPattern(
        const std::vector<OpticalFlowResult>& frames) {
    // 머리 방향 반복 왕복 패턴 감지 (방향 벡터 주기성 분석)
    // 0.5~2초 주기의 반복 동작 → 그루밍으로 판단
    int reversalCount = 0;
    for (size_t i = 1; i < frames.size(); ++i) {
        // 연속 프레임 간 이동 방향 역전 횟수 카운트
        if (frames[i].avgMagnitude > GROOM_MIN_MOTION
                && directionReversed(frames[i-1], frames[i])) {
            ++reversalCount;
        }
    }
    return reversalCount >= GROOM_REVERSAL_MIN_COUNT;
}
```

### 4.4 Kotlin JNI 브릿지

```kotlin
// MotionAnalyzerJni.kt
class MotionAnalyzerJni {

    init { System.loadLibrary("motion_analyzer") }

    /**
     * @param prevMatPtr OpenCV Mat 포인터 (이전 프레임, Grayscale)
     * @param currMatPtr OpenCV Mat 포인터 (현재 프레임, Grayscale)
     * @return FloatArray [평균이동량, 최대이동량, 유효특징점수, 행동태그코드]
     */
    external fun computeOpticalFlow(prevMatPtr: Long, currMatPtr: Long): FloatArray

    /**
     * @param flowHistory 최근 N프레임 광학흐름 결과
     * @param spineCurvature 자세 추정으로 계산된 척추 굴곡 각도
     * @param gaitAsymmetry 보행 비대칭 점수
     * @return Int 행동 태그 코드 (BehaviorTag enum ordinal)
     */
    external fun classifyBehavior(
        flowHistory: FloatArray,
        spineCurvature: Float,
        gaitAsymmetry: Float
    ): Int
}
```

---

## 5. 건강 점수 모델 (Health Scorer)

### 5.1 모델 개요

앞선 세 모델의 출력을 종합하여 최종 건강 점수(0~100)를 산출하는 경량 앙상블 모델.

**입력 특징 벡터 (총 32차원)**

|특징 그룹|차원|설명|
|---|---|---|
|품종 보정값|2|품종별 평균 활동량, 평균 체형 지수|
|자세 특징|8|척추 굴곡, 보행 비대칭, 관절별 각도 (6개)|
|움직임 특징|6|평균·최대·최소 이동량, 활동 빈도, 방향 엔트로피, 반복성|
|행동 태그|6|그루밍·절뚝거림·웅크림·과호흡·점프회피·과활동 (One-hot)|
|시계열 요약|10|최근 7일 건강 점수 이동 평균, 추세 기울기, 이상 빈도|

**모델 구조: 경량 MLP (ONNX)**

```python
# health_scorer_model.py
import torch
import torch.nn as nn

class HealthScorer(nn.Module):
    def __init__(self, input_dim: int = 32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()            # 출력: [0, 1] → ×100 = 건강 점수
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x) * 100.0  # [0, 100] 스케일
```

**ONNX 변환**

```python
dummy_input = torch.randn(1, 32)
torch.onnx.export(
    model, dummy_input,
    "health_scorer.onnx",
    input_names=["features"],
    output_names=["health_score"],
    dynamic_axes={"features": {0: "batch_size"}},
    opset_version=17
)
```

### 5.2 학습 데이터 구성 전략

건강 점수 모델의 학습 데이터는 두 가지 경로로 구성한다.

**경로 1: 규칙 기반 레이블 생성 (초기)**

수의학 문헌 기반 행동-건강 규칙으로 초기 레이블을 생성한다.

```python
def rule_based_label(features: dict) -> float:
    score = 100.0

    # 보행 이상: 최대 -30점
    score -= min(features["gait_asymmetry"] * 60, 30)

    # 저활동: 최대 -20점
    if features["avg_motion"] < BREED_BASELINE_MOTION * 0.5:
        score -= 20

    # 과도한 그루밍: -10점
    if features["grooming_flag"]:
        score -= 10

    # 웅크림 지속: -15점
    if features["prolonged_crouching"]:
        score -= 15

    # 시계열 하락 추세: 최대 -10점
    score -= min(abs(features["trend_slope"]) * 20, 10)

    return max(score, 0.0)
```

**경로 2: 수의사 레이블 데이터 (고도화)**

앱 배포 후 수의사 협력을 통해 실제 진료 결과와 매칭된 레이블 데이터를 축적하여 모델을 재학습한다.

### 5.3 Android 통합 코드

```kotlin
// HealthScorer.kt
class HealthScorer @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val env: OrtEnvironment = OrtEnvironment.getEnvironment()

    private val session: OrtSession by lazy {
        val modelBytes = context.assets.open("health_scorer.onnx").readBytes()
        env.createSession(
            modelBytes,
            OrtSession.SessionOptions().apply {
                addNnapi()               // NNAPI 가속 (API 27+)
                setIntraOpNumThreads(2)
            }
        )
    }

    fun score(vector: HealthFeatureVector): Float {
        val input = OnnxTensor.createTensor(
            env,
            arrayOf(vector.toFloatArray()),   // shape: [1, 32]
            longArrayOf (1, FEATURE_DIM)
        )

        val result = session.run (mapOf ("features" to input))
        val output = (result[0]. value as Array<FloatArray>)[0][0]

        input.close ()
        result.close ()

        return output.coerceIn (0 f, 100 f)
    }

    companion object {
        const val FEATURE_DIM = 32 L
    }
}
```

---

## 6. 모델 파일 관리

### 6.1 앱 내 모델 파일 구성

```
: ml-core/src/main/assets/
├── models/
│   ├── cat_breed_int 8. tflite       (약 4 MB — INT 8 양자화)
│   ├── pose_landmarker_lite. task   (약 3 MB — MediaPipe Lite)
│   └── health_scorer. onnx          (약 0.1 MB — 경량 MLP)
└── model_manifest. json             (버전 정보)
```

```json
// model_manifest. json
{
  "breed_classifier": {
    "version": "1.0.0",
    "filename": "cat_breed_int 8. tflite",
    "num_classes": 67,
    "input_size": 224,
    "checksum": "sha 256:..."
  },
  "health_scorer": {
    "version": "1.0.0",
    "filename": "health_scorer. onnx",
    "input_dim": 32,
    "checksum": "sha 256:..."
  }
}
```

### 6.2 모델 업데이트 흐름

```
앱 실행
  │
  ▼
ModelRepository.checkUpdate ()
  │  (백그라운드 WorkManager)
  ▼
서버 /api/models/latest 응답
  │
  ├── 동일 버전 → 업데이트 없음
  │
  └── 신규 버전
        │
        ▼
      다운로드 → SHA 256 검증 → 내부 저장소 이동
        │
        ▼
      다음 앱 실행 시 새 모델 로드
```

---

## 7. 성능 벤치마크 목표

|모델|디바이스|가속기|목표 시간|
|---|---|---|---|
|BreedClassifier|중급 (SD 778 G)|GPU Delegate|≤ 150 ms|
|BreedClassifier|고급 (SD 8 Gen 3)|GPU Delegate|≤ 60 ms|
|PoseEstimator|중급|GPU Delegate|≤ 40 ms/frame|
|PoseEstimator|고급|GPU Delegate|≤ 20 ms/frame|
|MotionAnalyzer|중급|C++ NEON|≤ 20 ms/frame|
|HealthScorer|중급|NNAPI|≤ 10 ms|
|**전체 파이프라인**|**중급**|**복합**|**≤ 200 ms**|

---

## 8. 향후 고도화 계획

|단계|내용|예상 시점|
|---|---|---|
|Phase 2|고양이 전용 Pose Landmarker 커스텀 학습|앱 배포 후 3개월|
|Phase 2|흉부 호흡 주기 분석 (FFT 기반) 추가|앱 배포 후 3개월|
|Phase 3|수의사 레이블 기반 HealthScorer 재학습|앱 배포 후 6개월|
|Phase 3|야간 / 저조도 환경 대응 (ISP 전처리)|앱 배포 후 6개월|
|Phase 4|온디바이스 연합 학습 (Federated Learning) 검토|장기 과제|

---

## 9. 관련 문서

|문서|경로|
|---|---|
|전체 기획 개요|`01_overview. md`|
|Android 아키텍처|`02_android_architecture. md`|
|백엔드 세부 설명|`04_backend. md`|

---

_본 문서는 개발 진행에 따라 지속적으로 업데이트됩니다._