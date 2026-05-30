---
title: (CatHealth) 카메라 및 tflite 세팅
post_order: 5
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_05.png
layout: post
author: jhj
categories:
  - Project
  - CatHealth
tags:
  - Android
  - AI
  - CleanArchitecture
  - ComputerVision
  - Kotlin
  - OpenCV
  - ViewModel
excerpt: 카메라 연동 및 TFLite를 활용한 온디바이스 고양이 종 분류 파이프라인 구축 과정과 트러블슈팅
---
# 작업 목표

# 문제 및 해결
## [App Crash] TFLite 파일 경로 및 의존성 충돌 문제 (SIGSEGV)
- **원인**:
1. 기존에 추가된 `tensorflow-lite-task-vision` 과 MediaPipe의 내부 LiteRT 엔진 간에 네임스페이스(`org.tensorflow.lite`) 충돌 발생.
2. 앱 실행 시 네이티브 레이어(`asset_manager_util.cc`)에서 `cat_breed_int8.tflite` 모델 파일을 찾지 못해 SIGSEGV (메모리 참조 오류) 발생.

- **해결**:
1. `TFLite` Task 종속성을 **제거**, `MediaPipe` API 사용(` ImageClassifier `)
2. 프로젝트 루트에 있던 모델 파일을 `:ml-core` 모듈의 `src/main/assets/models/` 경로로 이동하여 패키징 시 정상적으로 로드되도록 조치.

### 외부 파일 위치
- 모듈 내 `src/[main/test/...]/assets/` 위치
![](assets/images/project/CatHealth/2026-05-27-MlSetting/assets_directory.png)

## [Error] MediaPipe GPU 설정
- mediapipe 최소 Sdk 호환 문제(minSdk =23 -> 24)
```kotlin
// KotlinAndroid.kt
internal fun Project.configureKotlinAndroid(  
    commonExtension: CommonExtension,  
) {  
    commonExtension.apply {  
        compileSdk = 36  
  
        defaultConfig.apply {  
            minSdk = 24  
        }
...
```

- CPU 전환 실패 오류
	- [GL_INVALID_VALUE](#GL_INVALID_VALUE) 오류 발생
	- `Build.VERSION.SDK_INT < Build.VERSION_CODES.P` (API 28) : 구형 버전 CPU 사용
	- `useGpu`, recursive call을 통한 에러 대응 강화
```kotlin
// TfliteBreedClassifier.kt
@Singleton  
class TfliteBreedClassifier @Inject constructor(  
    @ApplicationContext private val context: Context  
) : BreedClassifier {  
  
    private var classifier: ImageClassifier? = null  
  
    private fun setupClassifier() {  
        val baseOptionsBuilder = BaseOptions.builder()  
            .setModelAssetPath("models/cat_breed_int8.tflite")  
            .setDelegate(Delegate.GPU)  
  
        val optionsBuilder = ImageClassifierOptions.builder()  
            .setBaseOptions(baseOptionsBuilder.build())  
            .setMaxResults(3)  
            .setScoreThreshold(0.3f)  
  
        try {  
            classifier = ImageClassifier.createFromOptions(context, optionsBuilder.build())  
        } catch (e: Exception) {  
            e.printStackTrace()  
            // Fallback to CPU if GPU fails  
            try {  
                val cpuOptionsBuilder = ImageClassifierOptions.builder()  
                    .setBaseOptions(BaseOptions.builder()  
                        .setModelAssetPath("models/cat_breed_int8.tflite")  
                        .setDelegate(Delegate.CPU)  
                        .build())  
                    .setMaxResults(3)  
                    .setScoreThreshold(0.3f)  
                classifier = ImageClassifier.createFromOptions(context, cpuOptionsBuilder.build())  
            } catch (fallbackException: Exception) {  
                fallbackException.printStackTrace()  
            }  
        }  
    }
...    
```
---
```kotlin
@Singleton  
class TfliteBreedClassifier @Inject constructor(  
    @ApplicationContext private val context: Context  
) : BreedClassifier {  
  
    private var classifier: ImageClassifier? = null  
    private var useGpu = true  
  
    private fun setupClassifier() {  
        // GPU compatibility check for older devices (Android 8.0 Galaxy S7 etc.)  
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {  
            Log.w("TfliteBreedClassifier", "Device API level < 28. Forcing CPU for stability.")  
            useGpu = false  
        }  
  
        classifier = createClassifier(if (useGpu) Delegate.GPU else Delegate.CPU)  
    }  
  
    private fun createClassifier(delegate: Delegate): ImageClassifier? {  
        val baseOptionsBuilder = BaseOptions.builder()  
            .setModelAssetPath("models/cat_breed_int8.tflite")  
            .setDelegate(delegate)  
  
        val optionsBuilder = ImageClassifierOptions.builder()  
            .setBaseOptions(baseOptionsBuilder.build())  
            .setMaxResults(3)  
            .setScoreThreshold(0.3f)  
  
        return try {  
            ImageClassifier.createFromOptions(context, optionsBuilder.build())  
        } catch (e: Exception) {  
            Log.e("TfliteBreedClassifier", "Failed to create classifier with $delegate", e)  
            if (delegate == Delegate.GPU) {  
                useGpu = false  
                createClassifier(Delegate.CPU)  
            } else {  
                null  
            }  
        }  
    }
```

## GL_INVALID_VALUE
>  OpenGL ES의 **에러 코드** 중 하나로, 숫자 인자가 허용 범위를 벗어났을 때 발생. 
>  OpenGL ES 스펙에서 정의된 표준 에러입니다.

### TFLite GL Interop 맥락에서의 의미
TFLite GPU 델리게이트는 OpenGL ES와 OpenCL 사이에서 데이터를 공유하기 위해 **GL Interop**을 사용합니다.

```
TFLite GPU Delegate
       │
       ▼
  OpenCL Kernel  ──── gl_interop.cc ────  OpenGL ES Buffer
  (연산 수행)                              (텍스처/버퍼 공유)
```

- 이 과정에서 `glMapBufferRange` 를 호출할 때, **버퍼 크기나 오프셋이 기기 드라이버가 허용하는 범위와 맞지 않으면** `GL_INVALID_VALUE` 가 발생.
- 즉, TFLite가 내부적으로 계산한 버퍼 크기와 실제 드라이버가 허용하는 크기가 **기기마다 다를 수 있어** 구형/특정 기기에서만 재현.
- OpenGL 에러는 <span style="color:rgb(255, 0, 0)">예외(Exception)를 throw하지 않음</span>.
```c
// OpenGL 에러 방식 — 에러를 내부 상태로 저장
glMapBufferRange(...);          // 실패해도 예외 없음
GLenum err = glGetError();      // 별도로 polling해야 에러 확인 가능
```

- TFLite/MediaPipe 내부에서 `glGetError()` 로 이 에러를 감지한 뒤 로그만 출력하고 넘어가는 경우, **JVM 레이어까지 예외가 전파되지 않음.** 
- 그래서 Kotlin의 try-catch가 트리거되지 않고 폴백도 동작하지 않음.