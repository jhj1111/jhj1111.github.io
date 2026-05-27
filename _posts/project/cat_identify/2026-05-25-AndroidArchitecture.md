---
title: (CatHealth) Android 아키텍처 
post_order: 2 
thumbnail: https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb?w=640 
layout: post 
author: jhj 
categories:
  - Project
  - CatHealth 
tags:
  - Android
  - Kotlin
  - MVI
  - MultiModule
  - Hilt
  - Compose
  - CleanArchitecture 
excerpt: 고양이 건강 분석 앱의 Android 멀티모듈 구조, MVI 패턴, 각 모듈별 역할과 의존성 규칙 상세 정리
---

# Android 세부 아키텍처

> 작성일: 2025-08  
> 문서 버전: v 1.0  
> 시리즈: 2/4 — Android 멀티모듈 · MVI 아키텍처

---

## 1. 아키텍처 원칙

본 프로젝트는 다음 세 가지 원칙을 기반으로 Android 아키텍처를 설계한다.

**Clean Architecture** — Presentation / Domain / Data 계층을 명확히 분리하여 각 계층이 단방향으로만 의존하도록 한다. Domain 계층은 Android 프레임워크에 의존하지 않는 순수 Kotlin 모듈로 유지한다.

**멀티모듈** — 기능 단위로 모듈을 분리하여 빌드 캐시 효율을 높이고, 모듈 간 의존성을 명시적으로 관리한다. 각 feature 모듈은 독립적으로 개발·테스트 가능하도록 설계한다.

**MVI (Model-View-Intent)** — 단방향 데이터 흐름으로 UI 상태를 예측 가능하게 관리한다. 모든 상태 변경은 Intent → ViewModel → State 경로로만 이루어진다.

---

## 2. 전체 모듈 구조

```
root/
├── app/                          # 앱 진입점
│
├── feature/
│   ├── feature-home/             # 홈 · 카메라 프리뷰
│   ├── feature-analysis/         # 분석 결과 화면
│   ├── feature-history/          # 건강 기록 · 통계
│   └── feature-settings/         # 설정
│
├── domain/
│   └── domain/                   # 비즈니스 로직 (순수 Kotlin)
│
├── data/
│   ├── data-local/               # Room DB · DataStore
│   ├── data-sensor/              # CameraX · IMU 센서
│   └── data-remote/              # Retrofit (선택적)
│
├── ml/
│   └── ml-core/                  # 모든 AI/ML 추론 로직
│
└── core/
    ├── core-ui/                  # 공통 Compose 컴포넌트
    ├── core-network/             # OkHttp · Retrofit 설정
    ├── core-di/                  # Hilt 모듈 정의
    ├── core-testing/             # 테스트 유틸리티
    └── core-utils/               # 확장 함수 · 유틸
```

---

## 3. 모듈 의존성 규칙

```
:feature-*
    │  의존 가능: :domain, :core-ui, :core-utils, :core-di
    │  의존 불가: 다른 :feature-*, :data-*, :ml-core 직접 접근
    ▼
:domain
    │  의존 가능: 없음 (순수 Kotlin)
    │  의존 불가: 모든 Android 프레임워크, :data-*, :ml-core
    ▼
:data-* / :ml-core
    │  의존 가능: :domain (인터페이스 구현), :core-*
    │  의존 불가: :feature-*, 서로 간 직접 의존
    ▼
:core-*
       의존 가능: 없음 (최하단 공통 모듈)
```

> **규칙 요약:** 의존성은 항상 위에서 아래 방향으로만 흐른다. feature 모듈끼리는 직접 참조하지 않고, Navigation 또는 공유 이벤트를 통해 통신한다.

---

## 4. 모듈별 상세 설명

### 4.1 `:app`

앱의 진입점. 최소한의 코드만 포함한다.

**역할**

- `Application` 클래스 및 Hilt 루트 설정
- Navigation Graph 정의 (모든 feature 화면 연결)
- Splash Screen 처리

**의존 모듈:** 모든 `:feature-*`, `:core-di`

```kotlin
@HiltAndroidApp
class CatHealthApp : Application()
```

---

### 4.2 `:feature-home`

카메라 실시간 프리뷰 및 분석 트리거 화면.

**역할**

- CameraX 프리뷰 Composable 제공
- 고양이 감지 시 캡처 버튼 활성화 및 자동 캡처
- 실시간 오버레이 (관절 랜드마크 시각화)
- 분석 시작 Intent 발행 → `:feature-analysis` 로 네비게이션

**주요 파일 구조**

```
feature-home/
├── ui/
│   ├── HomeScreen.kt             # Composable 루트 화면
│   ├── CameraPreviewComposable.kt
│   └── PoseOverlayCanvas.kt      # 관절 오버레이 Canvas
├── HomeViewModel.kt              # MVI ViewModel
└── HomeContract.kt               # State · Intent · Effect 정의
```

**MVI Contract**

```kotlin
// HomeContract.kt
data class HomeState(
    val isCameraReady: Boolean = false,
    val isAnalyzing: Boolean = false,
    val detectedLandmarks: List<PoseLandmark> = emptyList(),
    val error: UiError? = null
)

sealed class HomeIntent {
    data object InitCamera : HomeIntent()
    data object CaptureAndAnalyze : HomeIntent()
    data object ToggleAutoCapture : HomeIntent()
}

sealed class HomeEffect {
    data class NavigateToAnalysis(val imageUri: Uri) : HomeEffect()
    data class ShowPermissionDialog(val permission: String) : HomeEffect()
}
```

---

### 4.3 `:feature-analysis`

분석 결과를 표시하는 화면.

**역할**

- 종(Breed) 분류 결과 및 신뢰도 표시
- 건강 점수 (0~100) 게이지 시각화
- 감지된 행동 패턴 목록 및 설명
- 결과 저장 / 공유 액션 처리

**주요 파일 구조**

```
feature-analysis/
├── ui/
│   ├── AnalysisScreen.kt
│   ├── BreedResultCard.kt
│   ├── HealthScoreGauge.kt       # 커스텀 Canvas 게이지
│   └── BehaviorInsightList.kt
├── AnalysisViewModel.kt
└── AnalysisContract.kt
```

**MVI Contract**

```kotlin
data class AnalysisState(
    val isLoading: Boolean = false,
    val breed: BreedResult? = null,
    val healthScore: Float? = null,
    val behaviorInsights: List<BehaviorInsight> = emptyList(),
    val error: UiError? = null
)

sealed class AnalysisIntent {
    data class StartAnalysis(val imageUri: Uri) : AnalysisIntent()
    data object SaveResult : AnalysisIntent()
    data object ShareResult : AnalysisIntent()
    data object RetryAnalysis : AnalysisIntent()
}

sealed class AnalysisEffect {
    data class ShowError(val message: String) : AnalysisEffect()
    data object NavigateToHistory : AnalysisEffect()
    data class ShowShareSheet(val uri: Uri) : AnalysisEffect()
}
```

---

### 4.4 `:feature-history`

시계열 건강 기록 및 통계 화면.

**역할**

- 날짜별 건강 점수 추세 그래프 (Compose Charts)
- 분석 이력 목록 (날짜, 썸네일, 점수)
- 특정 기록 상세 조회 및 삭제
- 다두 보호자를 위한 고양이 프로필 전환

**주요 파일 구조**

```
feature-history/
├── ui/
│   ├── HistoryScreen.kt
│   ├── HealthTrendChart.kt       # 주간/월간 그래프
│   ├── AnalysisHistoryItem.kt
│   └── CatProfileSelector.kt    # 다두 프로필 탭
├── HistoryViewModel.kt
└── HistoryContract.kt
```

---

### 4.5 `:feature-settings`

앱 설정 화면.

**역할**

- 알림 임계값 설정 (건강 점수 기준값)
- 분석 주기 설정 (자동 캡처 인터벌)
- 고양이 프로필 추가 / 편집 / 삭제
- 모델 업데이트 수동 트리거
- 데이터 초기화 / 내보내기

---

### 4.6 `:domain`

비즈니스 로직의 핵심. **Android 프레임워크 의존성 없음.**

**역할**

- UseCase 정의 (비즈니스 규칙 캡슐화)
- Repository 인터페이스 정의
- 도메인 모델 정의 (UI 모델, DB 엔티티와 분리)

**패키지 구조**

```
domain/
├── usecase/
│   ├── AnalyzeCatUseCase.kt      # 종·건강 추론 오케스트레이션
│   ├── TrackMotionUseCase.kt     # 움직임 패턴 추적
│   ├── HealthInsightUseCase.kt   # 건강 지표 종합 분석
│   ├── SaveAnalysisUseCase.kt    # 결과 저장
│   └── GetHealthHistoryUseCase.kt
├── repository/
│   ├── CatRepository.kt          # interface
│   ├── HealthRepository.kt       # interface
│   └── ModelRepository.kt        # interface (모델 업데이트)
└── model/
    ├── BreedResult.kt
    ├── HealthScore.kt
    ├── BehaviorInsight.kt
    ├── PoseLandmark.kt
    └── AnalysisRecord.kt
```

**UseCase 예시**

```kotlin
// AnalyzeCatUseCase.kt
class AnalyzeCatUseCase @Inject constructor(
    private val breedClassifier: BreedClassifier,
    private val poseEstimator: CatPoseEstimator,
    private val motionAnalyzer: MotionAnalyzer,
    private val healthScorer: HealthScorer
) {
    suspend operator fun invoke(imageUri: Uri): Result<AnalysisResult> =
        runCatching {
            val bitmap = imageUri.toBitmap()

            // 병렬 추론
            val (breed, landmarks, motionVector) = coroutineScope {
                val breedDeferred  = async { breedClassifier.classify(bitmap) }
                val poseDeferred   = async { poseEstimator.estimate(bitmap) }
                val motionDeferred = async { motionAnalyzer.analyze(bitmap) }
                Triple(
                    breedDeferred.await(),
                    poseDeferred.await(),
                    motionDeferred.await()
                )
            }

            val healthScore = healthScorer.score(
                HealthFeatureVector(breed, landmarks, motionVector)
            )

            AnalysisResult(breed, landmarks, healthScore)
        }
}
```

---

### 4.7 `:data-local`

로컬 영속 저장소 구현.

**역할**

- Room DB: 분석 이력, 고양이 프로필, 건강 점수 기록
- DataStore (Proto): 앱 설정, 알림 임계값, 선택된 프로필

**Room 엔티티 구조**

```kotlin
@Entity(tableName = "analysis_records")
data class AnalysisRecordEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val catProfileId: Long,
    val timestamp: Long,
    val breedName: String,
    val breedConfidence: Float,
    val healthScore: Float,
    val behaviorTags: String,   // JSON 직렬화
    val imageUri: String?
)

@Entity(tableName = "cat_profiles")
data class CatProfileEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val breed: String?,
    val birthDate: Long?,
    val photoUri: String?
)
```

---

### 4.8 `:data-sensor`

카메라 및 센서 데이터 수집.

**역할**

- CameraX `ImageAnalysis` 파이프라인 설정
- `ImageProxy` → `Bitmap` / `Mat` (OpenCV) 변환
- IMU 센서 데이터 수집 (추후 활동량 보조 지표)
- 프레임 버퍼 관리 (최신 프레임 유지 전략)

**CameraX 파이프라인 핵심 설정**

```kotlin
val imageAnalysis = ImageAnalysis.Builder()
    .setTargetResolution(Size(1280, 720))
    .setBackpressureStrategy(STRATEGY_KEEP_ONLY_LATEST)  // 최신 프레임만 유지
    .setOutputImageFormat(OUTPUT_IMAGE_FORMAT_RGBA_8888)
    .build()
    .also { analysis ->
        analysis.setAnalyzer(cameraExecutor) { imageProxy ->
            val bitmap = imageProxy.toBitmap()
            frameChannel.trySend(bitmap)  // 코루틴 Channel로 ML 파이프라인 전달
            imageProxy.close()
        }
    }
```

---

### 4.9 `:data-remote`

서버 통신 구현 (선택적 모듈).

**역할**

- Spring Boot API 통신 (모델 버전 확인 · 다운로드)
- 익명화된 통계 업로드
- Retrofit + OkHttp 구현체

**활성화 조건:** 백엔드 미사용 환경에서는 빌드에서 제외 가능하도록 설계. `:domain` 의 `ModelRepository` 인터페이스를 stub 구현체로 대체하여 오프라인 전용 빌드 지원.

---

### 4.10 `:ml-core`

모든 AI/ML 추론 로직을 단일 모듈에 집중.

> 세부 내용은 `03_vision_ai_model.md` 참조.

**역할**

- TFLite 종 분류 모델 래퍼 (`BreedClassifier`)
- MediaPipe 자세 추정 래퍼 (`CatPoseEstimator`)
- OpenCV C++ JNI 브릿지 (`MotionAnalyzerJni`)
- ONNX Runtime 건강 점수 모델 (`HealthScorer`)
- 모델 파일 Asset 관리 및 버전 체크

---

### 4.11 `:core-ui`

공통 Compose UI 컴포넌트.

**역할**

- Design System 정의 (Color, Typography, Shape)
- 공통 컴포넌트: `LoadingOverlay`, `ErrorSnackbar`, `HealthScoreBadge`
- 커스텀 Canvas 컴포넌트: `PoseOverlay`, `TrendChart`
- Compose Preview 용 테마 설정

---

### 4.12 `:core-di`

Hilt 모듈 중앙 정의.

**역할**

- `@Module` 및 `@Provides` 정의 (Repository, UseCase 바인딩)
- Coroutine Dispatcher 제공 (`@IoDispatcher`, `@DefaultDispatcher`)
- ML 모델 인스턴스 싱글턴 관리 (TFLite, ONNX 세션 재사용)

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object MlModule {

    @Provides
    @Singleton
    fun provideBreedClassifier(@ApplicationContext ctx: Context): BreedClassifier =
        BreedClassifier(ctx)

    @Provides
    @Singleton
    fun provideHealthScorer(@ApplicationContext ctx: Context): HealthScorer =
        HealthScorer(ctx)
}
```

---

### 4.13 `:core-testing`

테스트 공통 유틸리티.

**역할**

- `FakeRepository` 구현체 제공 (단위 테스트용)
- Coroutine 테스트 헬퍼 (`TestDispatcherRule`)
- 테스트용 더미 도메인 모델 팩토리

---

## 5. MVI 패턴 상세

### 5.1 구조

```
User Action
    │
    ▼
 [Intent]            ← 사용자 의도 표현 (sealed class)
    │
    ▼
[ViewModel]          ← Intent 처리, UseCase 호출
    │
    ├──► [State]     ← UI 렌더링용 불변 상태 (data class)
    │       │
    │       ▼
    │    [View]      ← Composable이 State 소비
    │
    └──► [Effect]    ← 1회성 이벤트 (네비게이션, 다이얼로그)
             │
             ▼
          [View]     ← LaunchedEffect로 소비
```

### 5.2 기본 ViewModel 템플릿

모든 feature ViewModel이 상속하는 공통 베이스 클래스.

```kotlin
// :core-ui 또는 :domain에 위치
abstract class BaseViewModel<S : UiState, I : UiIntent, E : UiEffect> : ViewModel() {

    private val _state: MutableStateFlow<S> by lazy { MutableStateFlow(initialState()) }
    val state: StateFlow<S> = _state.asStateFlow()

    private val _effect = Channel<E>(Channel.BUFFERED)
    val effect: Flow<E> = _effect.receiveAsFlow()

    abstract fun initialState(): S
    abstract fun processIntent(intent: I)

    protected fun updateState(reducer: S.() -> S) {
        _state.update { it.reducer() }
    }

    protected suspend fun sendEffect(effect: E) {
        _effect.send(effect)
    }
}
```

### 5.3 Composable에서의 소비 패턴

```kotlin
@Composable
fun AnalysisScreen(
    viewModel: AnalysisViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    // 1회성 Effect 처리
    val navController = LocalNavController.current
    LaunchedEffect(Unit) {
        viewModel.effect.collect { effect ->
            when (effect) {
                is AnalysisEffect.NavigateToHistory -> navController.navigate(Route.History)
                is AnalysisEffect.ShowError -> { /* Snackbar 표시 */ }
            }
        }
    }

    // State 기반 UI 렌더링
    AnalysisContent(
        state = state,
        onIntent = viewModel::processIntent
    )
}
```

---

## 6. 의존성 관리 — Version Catalog

멀티모듈 환경에서 라이브러리 버전을 `libs.versions.toml` 한 곳에서 관리한다.

```toml
# gradle/libs.versions.toml

[versions]
kotlin            = "2.0.0"
compose-bom       = "2024.06.00"
hilt              = "2.51"
room              = "2.6.1"
camerax           = "1.3.4"
mediapipe         = "0.10.14"
tflite            = "2.14.0"
onnxruntime       = "1.18.0"
coroutines        = "1.8.1"
navigation        = "2.7.7"

[libraries]
compose-bom       = { group = "androidx.compose", name = "compose-bom",  version.ref = "compose-bom" }
hilt-android      = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler     = { group = "com.google.dagger", name = "hilt-android-compiler", version.ref = "hilt" }
room-runtime      = { group = "androidx.room",     name = "room-runtime",  version.ref = "room" }
room-compiler     = { group = "androidx.room",     name = "room-compiler", version.ref = "room" }
room-ktx          = { group = "androidx.room",     name = "room-ktx",      version.ref = "room" }
camerax-core      = { group = "androidx.camera",   name = "camera-core",   version.ref = "camerax" }
camerax-camera2   = { group = "androidx.camera",   name = "camera-camera2",version.ref = "camerax" }
camerax-lifecycle = { group = "androidx.camera",   name = "camera-lifecycle",version.ref = "camerax" }
mediapipe-tasks   = { group = "com.google.mediapipe", name = "tasks-vision", version.ref = "mediapipe" }
tflite-support    = { group = "org.tensorflow",    name = "tensorflow-lite-support", version.ref = "tflite" }
tflite-gpu        = { group = "org.tensorflow",    name = "tensorflow-lite-gpu",     version.ref = "tflite" }
onnxruntime       = { group = "com.microsoft.onnxruntime", name = "onnxruntime-android", version.ref = "onnxruntime" }

[plugins]
android-application = { id = "com.android.application",  version = "8.5.0" }
android-library     = { id = "com.android.library",       version = "8.5.0" }
kotlin-android      = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
hilt                = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
ksp                 = { id = "com.google.devtools.ksp",    version = "2.0.0-1.0.21" }
```

---

## 7. 빌드 설정 공통화

각 모듈의 반복적인 `build.gradle.kts` 설정을 **Convention Plugin**으로 공통화한다.

```
build-logic/
└── convention/
    ├── AndroidLibraryConventionPlugin.kt   # :data-*, :core-*용
    ├── AndroidFeatureConventionPlugin.kt   # :feature-*용 (Compose, Hilt 포함)
    ├── AndroidHiltConventionPlugin.kt      # Hilt 설정
    └── MlCoreConventionPlugin.kt           # :ml-core NDK/CMake 설정
```

**feature 모듈 build. gradle. kts 예시 (플러그인 적용 후)**

```kotlin
// feature-analysis/build.gradle.kts
plugins {
    alias(libs.plugins.cathealth.android.feature)  // Convention Plugin 적용
    alias(libs.plugins.cathealth.android.hilt)
}

android {
    namespace = "com.cathealth.feature.analysis"
}

dependencies {
    implementation(project(":domain"))
    implementation(project(":core-ui"))
}
```

---

## 8. 테스트 전략

|계층|테스트 종류|도구|
|---|---|---|
|Domain (UseCase)|단위 테스트|JUnit 5, MockK, Turbine|
|ViewModel|단위 테스트|JUnit 5, MockK, Turbine, TestDispatcher|
|Repository|통합 테스트|Robolectric, Room In-Memory|
|ML 모델|정확도 검증|JVM 테스트, TFLite Test Util|
|UI (Composable)|스크린샷 테스트|Paparazzi|
|E 2 E|시나리오 테스트|Espresso + UIAutomator|

---

## 9. 관련 문서

|문서|경로|
|---|---|
|전체 기획 개요| `01_overview.md` |
|비전 및 AI 모델| `03_vision_ai_model.md` |
|백엔드 세부 설명| `04_backend.md` |

---

_본 문서는 개발 진행에 따라 지속적으로 업데이트됩니다._