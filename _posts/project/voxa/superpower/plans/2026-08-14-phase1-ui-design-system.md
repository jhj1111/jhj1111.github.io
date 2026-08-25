# Phase 1 UI Design System & Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> 
> **Git Commit Note:** As explicitly instructed by the user, do NOT perform intermediate git commits during task execution. Git commits will be performed step-by-step only after all tasks are completed, verified, and requested by the user. The user will manage git branches directly.

**Goal:** Build the complete "Soft Paper Minimal" design system, design tokens, reusable UI primitives, MVI base infrastructure, feature UI skeletons (Camera, Result BottomSheet, PDF reader), and Navigation Graph in Jetpack Compose for Android multi-module architecture with full Light/Dark mode `@Preview` and on-device Showcase catalog.

**Architecture:** 2-tier Clean Architecture with MVI: `:core:designsystem` (tokens/theme) → `:core:ui` (stateless UI primitives/showcase) → `:feature:*` (stateful feature skeletons) → `:app` (navigation & DI). Domain is pure Kotlin without Android dependencies.

**Tech Stack:** Kotlin 2.4, Jetpack Compose (BOM 2026.06.01), Material 3, Navigation Compose, Hilt, Coroutines & Flow, JUnit4, Robolectric, Turbine.

---

## File Structure Map

```
Voxa/
├── settings.gradle.kts
├── gradle/libs.versions.toml
├── core/
│   ├── designsystem/
│   │   ├── build.gradle.kts
│   │   └── src/
│   │       ├── main/java/com/example/voxa/core/designsystem/
│   │       │   ├── ColorPalette.kt
│   │       │   ├── AppColors.kt
│   │       │   ├── Spacing.kt
│   │       │   ├── Radius.kt
│   │       │   ├── AppTypography.kt
│   │       │   └── AppTheme.kt
│   │       └── test/java/com/example/voxa/core/designsystem/
│   │           └── AppColorsTest.kt
│   ├── ui/
│   │   ├── build.gradle.kts
│   │   └── src/main/java/com/example/voxa/core/ui/
│   │       ├── button/
│   │       │   ├── PrimaryPillButton.kt
│   │       │   ├── SecondaryPillButton.kt
│   │       │   ├── AppIconButton.kt
│   │       │   └── ShutterFab.kt
│   │       ├── chip/
│   │       │   └── LanguageSelectChip.kt
│   │       ├── card/
│   │       │   ├── BaseCard.kt
│   │       │   └── AccentCard.kt
│   │       ├── sheet/
│   │       │   └── VoxaBottomSheetContainer.kt
│   │       └── catalog/
│   │           └── DesignSystemCatalog.kt
│   └── common/
│       ├── build.gradle.kts
│       └── src/
│           ├── main/java/com/example/voxa/core/common/
│           │   ├── mvi/
│           │   │   ├── UiState.kt
│           │   │   ├── UiIntent.kt
│           │   │   ├── UiEffect.kt
│           │   │   └── MviViewModel.kt
│           │   └── result/
│           │       └── CoroutineExtensions.kt
│           └── test/java/com/example/voxa/core/common/
│               └── MviViewModelTest.kt
├── domain/
│   ├── build.gradle.kts
│   └── src/
│       ├── main/java/com/example/voxa/domain/
│       │   ├── error/
│       │   │   └── DomainError.kt
│       │   └── model/
│       │       ├── LanguageCode.kt
│       │       └── RecognizedText.kt
│       └── test/java/com/example/voxa/domain/
│           └── DomainErrorTest.kt
├── feature/
│   ├── camera/
│   │   ├── build.gradle.kts
│   │   └── src/main/java/com/example/voxa/feature/camera/
│   │       └── CameraScreen.kt
│   └── result/
│       ├── build.gradle.kts
│       └── src/main/java/com/example/voxa/feature/result/
│           ├── ResultState.kt
│           ├── ResultIntent.kt
│           ├── ResultEffect.kt
│           ├── ResultViewModel.kt
│           └── ResultSheetContent.kt
└── app/
    ├── build.gradle.kts
    └── src/main/java/com/example/voxa/
        ├── VoxaApplication.kt
        ├── MainActivity.kt
        ├── navigation/
        │   ├── ScreenRoute.kt
        │   └── VoxaNavHost.kt
        └── screen/
            └── PdfReaderPlaceholderScreen.kt
```

---

### Task 1: Multi-Module Gradle Configuration & Build Logic Setup

**Files:**
- Modify: `settings.gradle.kts`
- Modify: `core/designsystem/build.gradle.kts`
- Modify: `core/ui/build.gradle.kts`
- Modify: `core/common/build.gradle.kts`
- Modify: `domain/build.gradle.kts`
- Create: `feature/result/build.gradle.kts`
- Modify: `feature/camera/build.gradle.kts`
- Modify: `app/build.gradle.kts`

- [ ] **Step 1: Update `settings.gradle.kts` to register all modules**

```kotlin
// settings.gradle.kts
rootProject.name = "voxa"
include(":app")
include(":core:designsystem")
include(":core:ui")
include(":core:common")
include(":domain")
include(":feature:camera")
include(":feature:result")
```

- [ ] **Step 2: Configure module build scripts using convention plugins**

Configure `domain/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.voxa.jvm.library)
}

dependencies {
    implementation(libs.kotlinx.coroutines)
    testImplementation(libs.junit)
    testImplementation(libs.kotlin.test)
}
```

Configure `core/common/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.voxa.android.library)
    alias(libs.plugins.voxa.android.hilt)
}

android {
    namespace = "com.example.voxa.core.common"
}

dependencies {
    implementation(project(":domain"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.viewModelCompose)
    implementation(libs.androidx.lifecycle.runtimeCompose)
    implementation(libs.kotlinx.coroutines)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine) // or coroutine test flow assertion
}
```

Configure `core/designsystem/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.voxa.android.library)
    alias(libs.plugins.voxa.android.library.compose)
}

android {
    namespace = "com.example.voxa.core.designsystem"
}

dependencies {
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)

    debugImplementation(libs.androidx.compose.ui.tooling)
    testImplementation(libs.junit)
    testImplementation(libs.kotlin.test)
}
```

Configure `core/ui/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.voxa.android.library)
    alias(libs.plugins.voxa.android.library.compose)
}

android {
    namespace = "com.example.voxa.core.ui"
}

dependencies {
    api(project(":core:designsystem"))
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)

    debugImplementation(libs.androidx.compose.ui.tooling)
    testImplementation(libs.junit)
}
```

Configure `feature/result/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.voxa.android.feature)
}

android {
    namespace = "com.example.voxa.feature.result"
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:ui"))
    implementation(project(":core:common"))
    implementation(project(":domain"))
}
```

Configure `feature/camera/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.voxa.android.feature)
}

android {
    namespace = "com.example.voxa.feature.camera"
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:ui"))
    implementation(project(":core:common"))
    implementation(project(":domain"))
}
```

Configure `app/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.voxa.android.application)
    alias(libs.plugins.voxa.android.application.compose)
    alias(libs.plugins.voxa.android.hilt)
}

android {
    namespace = "com.example.voxa"

    defaultConfig {
        applicationId = "com.example.voxa"
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:ui"))
    implementation(project(":core:common"))
    implementation(project(":domain"))
    implementation(project(":feature:camera"))
    implementation(project(":feature:result"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.androidx.core.splashscreen)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
```

- [ ] **Step 3: Run gradle sync/build validation**

Run: `./gradlew tasks --quiet`
Expected: BUILD SUCCESSFUL with all modules recognized.

---

### Task 2: Design Tokens & Theme in `:core:designsystem`

**Files:**
- Create: `core/designsystem/src/test/java/com/example/voxa/core/designsystem/AppColorsTest.kt`
- Create: `core/designsystem/src/main/java/com/example/voxa/core/designsystem/ColorPalette.kt`
- Create: `core/designsystem/src/main/java/com/example/voxa/core/designsystem/AppColors.kt`
- Create: `core/designsystem/src/main/java/com/example/voxa/core/designsystem/Spacing.kt`
- Create: `core/designsystem/src/main/java/com/example/voxa/core/designsystem/Radius.kt`
- Create: `core/designsystem/src/main/java/com/example/voxa/core/designsystem/AppTypography.kt`
- Create: `core/designsystem/src/main/java/com/example/voxa/core/designsystem/AppTheme.kt`

- [ ] **Step 1: Write Unit Test for Semantic Color Token Mappings**

```kotlin
// core/designsystem/src/test/java/com/example/voxa/core/designsystem/AppColorsTest.kt
package com.example.voxa.core.designsystem

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppColorsTest {

    @Test
    fun lightColors_haveCorrectSemantics() {
        val colors = LightColors
        assertFalse(colors.isDark)
        assertEquals(ColorPalette.SageTeal, colors.primary)
        assertEquals(ColorPalette.WarmCream, colors.background)
        assertEquals(ColorPalette.ParchmentBeige, colors.surface)
        assertEquals(ColorPalette.DeepTerracotta, colors.accent)
        assertEquals(ColorPalette.Charcoal, colors.textPrimary)
        assertEquals(ColorPalette.SoftGray, colors.textSecondary)
        assertEquals(ColorPalette.OutlineBeige, colors.outline)
    }

    @Test
    fun darkColors_haveCorrectSemantics() {
        val colors = DarkColors
        assertTrue(colors.isDark)
        assertEquals(ColorPalette.SageTealDark, colors.primary)
        assertEquals(ColorPalette.DarkCocoa, colors.background)
        assertEquals(ColorPalette.DarkSurface, colors.surface)
        assertEquals(ColorPalette.LightTerracotta, colors.accent)
        assertEquals(ColorPalette.IvoryWhite, colors.textPrimary)
        assertEquals(ColorPalette.SoftGrayLight, colors.textSecondary)
        assertEquals(ColorPalette.DarkOutline, colors.outline)
    }

    @Test
    fun lightAndDarkBackgrounds_areDistinct() {
        assertNotEquals(LightColors.background, DarkColors.background)
        assertNotEquals(LightColors.surface, DarkColors.surface)
    }
}
```

- [ ] **Step 2: Run test to verify it fails (unresolved references)**

Run: `./gradlew :core:designsystem:testDebugUnitTest`
Expected: FAIL (unresolved reference `ColorPalette`, `LightColors`, `DarkColors`)

- [ ] **Step 3: Implement `ColorPalette.kt`, `AppColors.kt`, `Spacing.kt`, `Radius.kt`, `AppTypography.kt`, and `AppTheme.kt`**

```kotlin
// core/designsystem/src/main/java/com/example/voxa/core/designsystem/ColorPalette.kt
package com.example.voxa.core.designsystem

import androidx.compose.ui.graphics.Color

object ColorPalette {
    // Light Palette (Soft Paper Minimal)
    val WarmCream = Color(0xFFFDFBF7)
    val ParchmentBeige = Color(0xFFF7F1E4)
    val SageTeal = Color(0xFF3F7768)
    val DeepTerracotta = Color(0xFFD96847)
    val Charcoal = Color(0xFF2B2D42)
    val SoftGray = Color(0xFF6B7690)
    val OutlineBeige = Color(0xFFEDE6D8)
    val Red600 = Color(0xFFB00020)

    // Dark Palette
    val DarkCocoa = Color(0xFF1E1A15)
    val DarkSurface = Color(0xFF2A241C)
    val SageTealDark = Color(0xFF4F9C87)
    val LightTerracotta = Color(0xFFF0997B)
    val IvoryWhite = Color(0xFFEDEAE3)
    val SoftGrayLight = Color(0xFF9AA6BC)
    val DarkOutline = Color(0xFF3A342B)
    val OnPrimaryDark = Color(0xFF14211D)
    val Red300 = Color(0xFFCF6679)

    val White = Color(0xFFFFFFFF)
}
```

```kotlin
// core/designsystem/src/main/java/com/example/voxa/core/designsystem/AppColors.kt
package com.example.voxa.core.designsystem

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

@Immutable
data class AppColors(
    val primary: Color,
    val onPrimary: Color,
    val background: Color,
    val surface: Color,
    val onSurface: Color,
    val accent: Color,
    val onAccent: Color,
    val error: Color,
    val onError: Color,
    val outline: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val isDark: Boolean,
)

val LightColors = AppColors(
    primary = ColorPalette.SageTeal,
    onPrimary = ColorPalette.White,
    background = ColorPalette.WarmCream,
    surface = ColorPalette.ParchmentBeige,
    onSurface = ColorPalette.Charcoal,
    accent = ColorPalette.DeepTerracotta,
    onAccent = ColorPalette.White,
    error = ColorPalette.Red600,
    onError = ColorPalette.White,
    outline = ColorPalette.OutlineBeige,
    textPrimary = ColorPalette.Charcoal,
    textSecondary = ColorPalette.SoftGray,
    isDark = false,
)

val DarkColors = AppColors(
    primary = ColorPalette.SageTealDark,
    onPrimary = ColorPalette.OnPrimaryDark,
    background = ColorPalette.DarkCocoa,
    surface = ColorPalette.DarkSurface,
    onSurface = ColorPalette.IvoryWhite,
    accent = ColorPalette.LightTerracotta,
    onAccent = ColorPalette.DarkCocoa,
    error = ColorPalette.Red300,
    onError = ColorPalette.OnPrimaryDark,
    outline = ColorPalette.DarkOutline,
    textPrimary = ColorPalette.IvoryWhite,
    textSecondary = ColorPalette.SoftGrayLight,
    isDark = true,
)
```

```kotlin
// core/designsystem/src/main/java/com/example/voxa/core/designsystem/Spacing.kt
package com.example.voxa.core.designsystem

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

object Spacing {
    val none: Dp = 0.dp
    val xs: Dp = 4.dp
    val sm: Dp = 8.dp
    val md: Dp = 16.dp
    val lg: Dp = 24.dp
    val xl: Dp = 32.dp
    val xxl: Dp = 48.dp
}
```

```kotlin
// core/designsystem/src/main/java/com/example/voxa/core/designsystem/Radius.kt
package com.example.voxa.core.designsystem

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

object Radius {
    val sm: Dp = 12.dp
    val md: Dp = 16.dp
    val lg: Dp = 20.dp
    val pill: Dp = 28.dp
    val full: Dp = 999.dp
}
```

```kotlin
// core/designsystem/src/main/java/com/example/voxa/core/designsystem/AppTypography.kt
package com.example.voxa.core.designsystem

import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

@Immutable
data class AppTypography(
    val displayLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 28.sp,
        lineHeight = 36.sp,
    ),
    val titleLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        lineHeight = 28.sp,
    ),
    val titleMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 24.sp,
    ),
    val bodyLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
    ),
    val bodyMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    val labelSmall: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
    ),
)
```

```kotlin
// core/designsystem/src/main/java/com/example/voxa/core/designsystem/AppTheme.kt
package com.example.voxa.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf

val LocalAppColors = staticCompositionLocalOf { LightColors }
val LocalAppTypography = staticCompositionLocalOf { AppTypography() }

@Composable
fun AppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) DarkColors else LightColors
    val typography = AppTypography()

    CompositionLocalProvider(
        LocalAppColors provides colors,
        LocalAppTypography provides typography,
        content = content
    )
}

object AppTheme {
    val colors: AppColors
        @Composable
        @ReadOnlyComposable
        get() = LocalAppColors.current

    val typography: AppTypography
        @Composable
        @ReadOnlyComposable
        get() = LocalAppTypography.current

    val spacing: Spacing = Spacing
    val radius: Radius = Radius
}
```

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `./gradlew :core:designsystem:testDebugUnitTest`
Expected: PASS (all tests pass)

---

### Task 3: Common MVI Base & Domain Interfaces

**Files:**
- Create: `domain/src/main/java/com/example/voxa/domain/error/DomainError.kt`
- Create: `domain/src/main/java/com/example/voxa/domain/model/LanguageCode.kt`
- Create: `domain/src/main/java/com/example/voxa/domain/model/RecognizedText.kt`
- Create: `domain/src/test/java/com/example/voxa/domain/DomainErrorTest.kt`
- Create: `core/common/src/main/java/com/example/voxa/core/common/mvi/UiState.kt`
- Create: `core/common/src/main/java/com/example/voxa/core/common/mvi/UiIntent.kt`
- Create: `core/common/src/main/java/com/example/voxa/core/common/mvi/UiEffect.kt`
- Create: `core/common/src/main/java/com/example/voxa/core/common/mvi/MviViewModel.kt`
- Create: `core/common/src/test/java/com/example/voxa/core/common/MviViewModelTest.kt`

- [ ] **Step 1: Write failing unit test for MVI ViewModel & DomainError**

```kotlin
// core/common/src/test/java/com/example/voxa/core/common/MviViewModelTest.kt
package com.example.voxa.core.common

import com.example.voxa.core.common.mvi.MviViewModel
import com.example.voxa.core.common.mvi.UiEffect
import com.example.voxa.core.common.mvi.UiIntent
import com.example.voxa.core.common.mvi.UiState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MviViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    data class TestState(val count: Int = 0) : UiState
    sealed interface TestIntent : UiIntent {
        data object Increment : TestIntent
        data class ShowMessage(val msg: String) : TestIntent
    }
    sealed interface TestEffect : UiEffect {
        data class Toast(val text: String) : TestEffect
    }

    class TestViewModel : MviViewModel<TestState, TestIntent, TestEffect>(TestState()) {
        override fun onIntent(intent: TestIntent) {
            when (intent) {
                is TestIntent.Increment -> updateState { copy(count = count + 1) }
                is TestIntent.ShowMessage -> sendEffect(TestEffect.Toast(intent.msg))
            }
        }
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun initialState_isCorrect() {
        val vm = TestViewModel()
        assertEquals(0, vm.uiState.value.count)
    }

    @Test
    fun onIntent_updatesState() {
        val vm = TestViewModel()
        vm.onIntent(TestIntent.Increment)
        assertEquals(1, vm.uiState.value.count)
    }

    @Test
    fun onIntent_sendsEffect() = runTest(testDispatcher) {
        val vm = TestViewModel()
        var receivedEffect: TestEffect? = null
        val job = launch {
            receivedEffect = vm.effect.first()
        }
        vm.onIntent(TestIntent.ShowMessage("Hello"))
        testDispatcher.scheduler.advanceUntilIdle()
        assertEquals(TestEffect.Toast("Hello"), receivedEffect)
        job.cancel()
    }
}
```

- [ ] **Step 2: Implement Domain Models and MVI Base Classes**

```kotlin
// domain/src/main/java/com/example/voxa/domain/error/DomainError.kt
package com.example.voxa.domain.error

sealed interface DomainError {
    data object ModelNotReady : DomainError
    data object ModelLoadFailed : DomainError
    data object OutOfMemory : DomainError
    data object UnsupportedLanguage : DomainError
    data object FileParsingFailed : DomainError
    data class Unknown(val cause: Throwable) : DomainError
}
```

```kotlin
// domain/src/main/java/com/example/voxa/domain/model/LanguageCode.kt
package com.example.voxa.domain.model

enum class LanguageCode(val code: String, val displayName: String) {
    AUTO_DETECT("auto", "Auto Detect"),
    KOREAN("ko", "한국어"),
    ENGLISH("en", "English"),
    JAPANESE("ja", "日本語"),
    CHINESE("zh", "中文"),
}
```

```kotlin
// domain/src/main/java/com/example/voxa/domain/model/RecognizedText.kt
package com.example.voxa.domain.model

data class RecognizedText(
    val rawText: String,
    val blocks: List<TextBlock> = emptyList(),
)

data class TextBlock(
    val text: String,
    val boundingBox: BoundingBox? = null,
)

data class BoundingBox(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
)
```

```kotlin
// core/common/src/main/java/com/example/voxa/core/common/mvi/UiState.kt
package com.example.voxa.core.common.mvi

interface UiState
```

```kotlin
// core/common/src/main/java/com/example/voxa/core/common/mvi/UiIntent.kt
package com.example.voxa.core.common.mvi

interface UiIntent
```

```kotlin
// core/common/src/main/java/com/example/voxa/core/common/mvi/UiEffect.kt
package com.example.voxa.core.common.mvi

interface UiEffect
```

```kotlin
// core/common/src/main/java/com/example/voxa/core/common/mvi/MviViewModel.kt
package com.example.voxa.core.common.mvi

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

abstract class MviViewModel<S : UiState, I : UiIntent, E : UiEffect>(
    initialState: S
) : ViewModel() {

    private val _uiState = MutableStateFlow(initialState)
    val uiState: StateFlow<S> = _uiState.asStateFlow()

    private val _effect = Channel<E>(Channel.BUFFERED)
    val effect: Flow<E> = _effect.receiveAsFlow()

    abstract fun onIntent(intent: I)

    protected fun updateState(reducer: S.() -> S) {
        _uiState.update(reducer)
    }

    protected fun sendEffect(effect: E) {
        viewModelScope.launch {
            _effect.send(effect)
        }
    }
}
```

- [ ] **Step 3: Run unit tests to verify they pass**

Run: `./gradlew :domain:test :core:common:testDebugUnitTest`
Expected: PASS (all tests pass)

---

### Task 4: Common UI Primitives & Showcase in `:core:ui`

**Files:**
- Create: `core/ui/src/main/java/com/example/voxa/core/ui/button/PrimaryPillButton.kt`
- Create: `core/ui/src/main/java/com/example/voxa/core/ui/button/SecondaryPillButton.kt`
- Create: `core/ui/src/main/java/com/example/voxa/core/ui/button/AppIconButton.kt`
- Create: `core/ui/src/main/java/com/example/voxa/core/ui/button/ShutterFab.kt`
- Create: `core/ui/src/main/java/com/example/voxa/core/ui/chip/LanguageSelectChip.kt`
- Create: `core/ui/src/main/java/com/example/voxa/core/ui/card/BaseCard.kt`
- Create: `core/ui/src/main/java/com/example/voxa/core/ui/card/AccentCard.kt`
- Create: `core/ui/src/main/java/com/example/voxa/core/ui/sheet/VoxaBottomSheetContainer.kt`
- Create: `core/ui/src/main/java/com/example/voxa/core/ui/catalog/DesignSystemCatalog.kt`

- [ ] **Step 1: Implement `PrimaryPillButton.kt` with Light & Dark Previews**

```kotlin
// core/ui/src/main/java/com/example/voxa/core/ui/button/PrimaryPillButton.kt
package com.example.voxa.core.ui.button

import android.content.res.Configuration
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.voxa.core.designsystem.AppTheme

@Composable
fun PrimaryPillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isLoading: Boolean = false,
) {
    Button(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        enabled = enabled && !isLoading,
        shape = RoundedCornerShape(AppTheme.radius.pill),
        colors = ButtonDefaults.buttonColors(
            containerColor = AppTheme.colors.primary,
            contentColor = AppTheme.colors.onPrimary,
            disabledContainerColor = AppTheme.colors.primary.copy(alpha = 0.4f),
            disabledContentColor = AppTheme.colors.onPrimary.copy(alpha = 0.6f),
        ),
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = AppTheme.colors.onPrimary,
                strokeWidth = 2.dp,
                modifier = Modifier.padding(2.dp),
            )
        } else {
            Text(
                text = text,
                style = AppTheme.typography.titleMedium,
            )
        }
    }
}

@Preview(name = "Light Mode", showBackground = true)
@Preview(name = "Dark Mode", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun PrimaryPillButtonPreview() {
    AppTheme {
        PrimaryPillButton(text = "이 페이지 번역", onClick = {})
    }
}
```

- [ ] **Step 2: Implement `SecondaryPillButton.kt`, `AppIconButton.kt`, `ShutterFab.kt` with Previews**

```kotlin
// core/ui/src/main/java/com/example/voxa/core/ui/button/SecondaryPillButton.kt
package com.example.voxa.core.ui.button

import android.content.res.Configuration
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.voxa.core.designsystem.AppTheme

@Composable
fun SecondaryPillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        enabled = enabled,
        shape = RoundedCornerShape(AppTheme.radius.pill),
        border = BorderStroke(1.dp, AppTheme.colors.outline),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = AppTheme.colors.surface,
            contentColor = AppTheme.colors.textPrimary,
            disabledContainerColor = AppTheme.colors.surface.copy(alpha = 0.5f),
            disabledContentColor = AppTheme.colors.textSecondary,
        ),
    ) {
        Text(
            text = text,
            style = AppTheme.typography.titleMedium,
        )
    }
}

@Preview(name = "Light Mode", showBackground = true)
@Preview(name = "Dark Mode", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun SecondaryPillButtonPreview() {
    AppTheme {
        SecondaryPillButton(text = "텍스트 복사", onClick = {})
    }
}
```

```kotlin
// core/ui/src/main/java/com/example/voxa/core/ui/button/AppIconButton.kt
package com.example.voxa.core.ui.button

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.voxa.core.designsystem.AppTheme

@Composable
fun AppIconButton(
    icon: ImageVector,
    contentDescription: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = AppTheme.colors.textPrimary,
    backgroundColor: Color = Color.Transparent,
) {
    IconButton(
        onClick = onClick,
        modifier = modifier
            .size(44.dp)
            .background(backgroundColor, CircleShape),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = tint,
            modifier = Modifier.size(20.dp),
        )
    }
}

@Preview(name = "Light", showBackground = true)
@Preview(name = "Dark", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun AppIconButtonPreview() {
    AppTheme {
        AppIconButton(icon = Icons.Default.Close, contentDescription = "Close", onClick = {})
    }
}
```

```kotlin
// core/ui/src/main/java/com/example/voxa/core/ui/button/ShutterFab.kt
package com.example.voxa.core.ui.button

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.voxa.core.designsystem.AppTheme

@Composable
fun ShutterFab(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .size(64.dp)
            .clip(CircleShape)
            .background(AppTheme.colors.primary)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Default.CameraAlt,
            contentDescription = "Capture",
            tint = AppTheme.colors.onPrimary,
            modifier = Modifier.size(28.dp),
        )
    }
}

@Preview(name = "Light", showBackground = true)
@Preview(name = "Dark", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun ShutterFabPreview() {
    AppTheme {
        ShutterFab(onClick = {})
    }
}
```

- [ ] **Step 3: Implement `LanguageSelectChip.kt`, `BaseCard.kt`, `AccentCard.kt`, `VoxaBottomSheetContainer.kt`**

```kotlin
// core/ui/src/main/java/com/example/voxa/core/ui/chip/LanguageSelectChip.kt
package com.example.voxa.core.ui.chip

import android.content.res.Configuration
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.voxa.core.designsystem.AppTheme

@Composable
fun LanguageSelectChip(
    sourceLanguage: String,
    targetLanguage: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(AppTheme.radius.pill))
            .background(AppTheme.colors.surface)
            .border(
                BorderStroke(1.dp, AppTheme.colors.outline),
                RoundedCornerShape(AppTheme.radius.pill)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = AppTheme.spacing.md, vertical = AppTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.sm),
    ) {
        Text(
            text = sourceLanguage,
            style = AppTheme.typography.titleMedium,
            color = AppTheme.colors.textPrimary,
        )
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
            contentDescription = "to",
            tint = AppTheme.colors.textSecondary,
            modifier = Modifier.size(16.dp),
        )
        Text(
            text = targetLanguage,
            style = AppTheme.typography.titleMedium,
            color = AppTheme.colors.primary,
        )
    }
}

@Preview(name = "Light", showBackground = true)
@Preview(name = "Dark", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun LanguageSelectChipPreview() {
    AppTheme {
        LanguageSelectChip(
            sourceLanguage = "한국어",
            targetLanguage = "English",
            onClick = {}
        )
    }
}
```

```kotlin
// core/ui/src/main/java/com/example/voxa/core/ui/card/BaseCard.kt
package com.example.voxa.core.ui.card

import android.content.res.Configuration
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.voxa.core.designsystem.AppTheme

@Composable
fun BaseCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(AppTheme.radius.md),
        color = AppTheme.colors.surface,
        border = BorderStroke(1.dp, AppTheme.colors.outline),
    ) {
        Column(
            modifier = Modifier.padding(AppTheme.spacing.md),
            content = content
        )
    }
}

@Preview(name = "Light", showBackground = true)
@Preview(name = "Dark", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun BaseCardPreview() {
    AppTheme {
        BaseCard {
            Text("원문 텍스트", style = AppTheme.typography.titleMedium, color = AppTheme.colors.textPrimary)
            Text("카메라 또는 PDF에서 추출된 원문 텍스트 영역입니다.", style = AppTheme.typography.bodyMedium, color = AppTheme.colors.textSecondary)
        }
    }
}
```

```kotlin
// core/ui/src/main/java/com/example/voxa/core/ui/card/AccentCard.kt
package com.example.voxa.core.ui.card

import android.content.res.Configuration
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.voxa.core.designsystem.AppTheme

@Composable
fun AccentCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val accentTint = AppTheme.colors.accent.copy(alpha = 0.08f)
    val borderTint = AppTheme.colors.accent.copy(alpha = 0.35f)

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(AppTheme.radius.md),
        color = accentTint,
        border = BorderStroke(1.dp, borderTint),
    ) {
        Column(
            modifier = Modifier.padding(AppTheme.spacing.md),
            content = content
        )
    }
}

@Preview(name = "Light", showBackground = true)
@Preview(name = "Dark", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun AccentCardPreview() {
    AppTheme {
        AccentCard {
            Text("번역 결과", style = AppTheme.typography.titleMedium, color = AppTheme.colors.accent)
            Text("Translated text content will be rendered here.", style = AppTheme.typography.bodyLarge, color = AppTheme.colors.textPrimary)
        }
    }
}
```

```kotlin
// core/ui/src/main/java/com/example/voxa/core/ui/sheet/VoxaBottomSheetContainer.kt
package com.example.voxa.core.ui.sheet

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.voxa.core.designsystem.AppTheme

@Composable
fun VoxaBottomSheetContainer(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(
            topStart = AppTheme.radius.lg,
            topEnd = AppTheme.radius.lg,
            bottomStart = 0.dp,
            bottomEnd = 0.dp,
        ),
        color = AppTheme.colors.surface,
        shadowElevation = 8.dp,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = AppTheme.spacing.md, vertical = AppTheme.spacing.sm),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Drag Handle
            Box(
                modifier = Modifier
                    .padding(vertical = AppTheme.spacing.xs)
                    .size(width = 36.dp, height = 4.dp)
                    .clip(RoundedCornerShape(AppTheme.radius.full))
                    .background(AppTheme.colors.outline)
            )

            content()
        }
    }
}

@Preview(name = "Light", showBackground = true)
@Preview(name = "Dark", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun VoxaBottomSheetContainerPreview() {
    AppTheme {
        VoxaBottomSheetContainer {
            Text("Bottom Sheet Content", style = AppTheme.typography.titleMedium, color = AppTheme.colors.textPrimary)
        }
    }
}
```

- [ ] **Step 4: Implement `DesignSystemCatalog.kt` Showcase Screen**

```kotlin
// core/ui/src/main/java/com/example/voxa/core/ui/catalog/DesignSystemCatalog.kt
package com.example.voxa.core.ui.catalog

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.voxa.core.designsystem.AppTheme
import com.example.voxa.core.ui.button.PrimaryPillButton
import com.example.voxa.core.ui.button.SecondaryPillButton
import com.example.voxa.core.ui.button.ShutterFab
import com.example.voxa.core.ui.card.AccentCard
import com.example.voxa.core.ui.card.BaseCard
import com.example.voxa.core.ui.chip.LanguageSelectChip

@Composable
fun DesignSystemCatalog(
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppTheme.colors.background)
            .padding(AppTheme.spacing.md)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.lg),
    ) {
        Text(
            text = "Voxa Design System Showcase",
            style = AppTheme.typography.displayLarge,
            color = AppTheme.colors.textPrimary,
        )

        // Colors
        Text("Colors", style = AppTheme.typography.titleLarge, color = AppTheme.colors.textPrimary)
        Row(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.sm)) {
            ColorBadge("Primary", AppTheme.colors.primary)
            ColorBadge("Accent", AppTheme.colors.accent)
            ColorBadge("Surface", AppTheme.colors.surface)
            ColorBadge("Outline", AppTheme.colors.outline)
        }

        // Buttons
        Text("Buttons", style = AppTheme.typography.titleLarge, color = AppTheme.colors.textPrimary)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PrimaryPillButton(text = "Primary Pill", onClick = {})
            SecondaryPillButton(text = "Secondary Pill", onClick = {})
            ShutterFab(onClick = {})
        }

        // Chips
        Text("Chips", style = AppTheme.typography.titleLarge, color = AppTheme.colors.textPrimary)
        LanguageSelectChip(sourceLanguage = "한국어", targetLanguage = "English", onClick = {})

        // Cards
        Text("Cards", style = AppTheme.typography.titleLarge, color = AppTheme.colors.textPrimary)
        BaseCard {
            Text("Base Card", style = AppTheme.typography.titleMedium, color = AppTheme.colors.textPrimary)
            Text("This is a standard surface card.", style = AppTheme.typography.bodyMedium, color = AppTheme.colors.textSecondary)
        }
        AccentCard {
            Text("Accent Card (Translation)", style = AppTheme.typography.titleMedium, color = AppTheme.colors.accent)
            Text("This card highlights translated content with accent tint.", style = AppTheme.typography.bodyMedium, color = AppTheme.colors.textPrimary)
        }
    }
}

@Composable
private fun ColorBadge(label: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(color)
        )
        Text(label, style = AppTheme.typography.labelSmall, color = AppTheme.colors.textSecondary)
    }
}

@Preview(name = "Light Showcase", showBackground = true)
@Preview(name = "Dark Showcase", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun DesignSystemCatalogPreview() {
    AppTheme {
        DesignSystemCatalog()
    }
}
```

- [ ] **Step 5: Verify assemble `:core:ui`**

Run: `./gradlew :core:ui:assembleDebug`
Expected: BUILD SUCCESSFUL

---

### Task 5: Feature Skeletons in `:feature:camera` and `:feature:result`

**Files:**
- Create: `feature/camera/src/main/java/com/example/voxa/feature/camera/CameraScreen.kt`
- Create: `feature/result/src/main/java/com/example/voxa/feature/result/ResultState.kt`
- Create: `feature/result/src/main/java/com/example/voxa/feature/result/ResultIntent.kt`
- Create: `feature/result/src/main/java/com/example/voxa/feature/result/ResultEffect.kt`
- Create: `feature/result/src/main/java/com/example/voxa/feature/result/ResultViewModel.kt`
- Create: `feature/result/src/main/java/com/example/voxa/feature/result/ResultSheetContent.kt`

- [ ] **Step 1: Implement `CameraScreen.kt` in `:feature:camera`**

```kotlin
// feature/camera/src/main/java/com/example/voxa/feature/camera/CameraScreen.kt
package com.example.voxa.feature.camera

import android.content.res.Configuration
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.voxa.core.designsystem.AppTheme
import com.example.voxa.core.ui.button.AppIconButton
import com.example.voxa.core.ui.button.ShutterFab

@Composable
fun CameraScreen(
    onNavigateToPdf: () -> Unit,
    onNavigateToShowcase: () -> Unit,
    onCaptureClick: () -> Unit,
    modifier: Modifier = Modifier,
    bottomSheetSlot: @Composable () -> Unit = {},
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        // Mock Camera Viewfinder
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            // Dynamic Document Detection Outline Mock
            Box(
                modifier = Modifier
                    .fillMaxSize(0.75f)
                    .border(
                        BorderStroke(2.dp, AppTheme.colors.accent),
                        RoundedCornerShape(AppTheme.radius.md)
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "카메라 뷰파인더 (문서 가장자리 감지 중)",
                    color = Color.White.copy(alpha = 0.7f),
                    style = AppTheme.typography.bodyMedium,
                )
            }
        }

        // Top Gradient Scrim & Toolbar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopCenter)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Black.copy(alpha = 0.6f), Color.Transparent)
                    )
                )
                .padding(AppTheme.spacing.md),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AppIconButton(
                    icon = Icons.Default.Close,
                    contentDescription = "Showcase",
                    onClick = onNavigateToShowcase,
                    tint = Color.White,
                )
                Text(
                    text = "문서 가장자리를 인식하고 있어요",
                    color = Color.White,
                    style = AppTheme.typography.titleMedium,
                )
                AppIconButton(
                    icon = Icons.Default.FlashOn,
                    contentDescription = "Flash",
                    onClick = {},
                    tint = Color.White,
                )
            }
        }

        // Bottom Gradient Scrim & Action Bar
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.7f))
                        )
                    )
                    .padding(bottom = AppTheme.spacing.xl, top = AppTheme.spacing.md),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = AppTheme.spacing.xl),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    AppIconButton(
                        icon = Icons.Default.PhotoLibrary,
                        contentDescription = "Gallery",
                        onClick = onCaptureClick,
                        tint = Color.White,
                        backgroundColor = Color.White.copy(alpha = 0.2f),
                    )
                    ShutterFab(onClick = onCaptureClick)
                    AppIconButton(
                        icon = Icons.Default.PictureAsPdf,
                        contentDescription = "PDF Reader",
                        onClick = onNavigateToPdf,
                        tint = Color.White,
                        backgroundColor = Color.White.copy(alpha = 0.2f),
                    )
                }
            }

            // Bottom sheet slot
            bottomSheetSlot()
        }
    }
}

@Preview(name = "Camera Screen", showBackground = true)
@Composable
private fun CameraScreenPreview() {
    AppTheme {
        CameraScreen(
            onNavigateToPdf = {},
            onNavigateToShowcase = {},
            onCaptureClick = {},
        )
    }
}
```

- [ ] **Step 2: Implement MVI and `ResultSheetContent.kt` in `:feature:result`**

```kotlin
// feature/result/src/main/java/com/example/voxa/feature/result/ResultState.kt
package com.example.voxa.feature.result

import com.example.voxa.core.common.mvi.UiState
import com.example.voxa.domain.error.DomainError
import com.example.voxa.domain.model.LanguageCode

enum class SheetState {
    COLLAPSED,
    EXPANDED,
    LOADING,
    ERROR
}

data class ResultState(
    val sheetState: SheetState = SheetState.COLLAPSED,
    val recognizedText: String? = null,
    val translatedText: String? = null,
    val sourceLang: LanguageCode = LanguageCode.AUTO_DETECT,
    val targetLang: LanguageCode = LanguageCode.ENGLISH,
    val error: DomainError? = null,
) : UiState
```

```kotlin
// feature/result/src/main/java/com/example/voxa/feature/result/ResultIntent.kt
package com.example.voxa.feature.result

import com.example.voxa.core.common.mvi.UiIntent
import com.example.voxa.domain.model.LanguageCode

sealed interface ResultIntent : UiIntent {
    data class ChangeLanguage(val target: LanguageCode) : ResultIntent
    data class SetSheetState(val state: SheetState) : ResultIntent
    data object CopyText : ResultIntent
    data object ShareText : ResultIntent
    data object Retry : ResultIntent
}
```

```kotlin
// feature/result/src/main/java/com/example/voxa/feature/result/ResultEffect.kt
package com.example.voxa.feature.result

import com.example.voxa.core.common.mvi.UiEffect

sealed interface ResultEffect : UiEffect {
    data class ShowToast(val message: String) : ResultEffect
}
```

```kotlin
// feature/result/src/main/java/com/example/voxa/feature/result/ResultViewModel.kt
package com.example.voxa.feature.result

import com.example.voxa.core.common.mvi.MviViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class ResultViewModel @Inject constructor() :
    MviViewModel<ResultState, ResultIntent, ResultEffect>(ResultState()) {

    override fun onIntent(intent: ResultIntent) {
        when (intent) {
            is ResultIntent.ChangeLanguage -> updateState { copy(targetLang = intent.target) }
            is ResultIntent.SetSheetState -> updateState { copy(sheetState = intent.state) }
            is ResultIntent.CopyText -> sendEffect(ResultEffect.ShowToast("텍스트가 복사되었습니다."))
            is ResultIntent.ShareText -> sendEffect(ResultEffect.ShowToast("공유하기"))
            is ResultIntent.Retry -> updateState { copy(sheetState = SheetState.LOADING) }
        }
    }
}
```

```kotlin
// feature/result/src/main/java/com/example/voxa/feature/result/ResultSheetContent.kt
package com.example.voxa.feature.result

import android.content.res.Configuration
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.voxa.core.designsystem.AppTheme
import com.example.voxa.core.ui.button.PrimaryPillButton
import com.example.voxa.core.ui.button.SecondaryPillButton
import com.example.voxa.core.ui.card.AccentCard
import com.example.voxa.core.ui.card.BaseCard
import com.example.voxa.core.ui.chip.LanguageSelectChip
import com.example.voxa.core.ui.sheet.VoxaBottomSheetContainer

@Composable
fun ResultSheetContent(
    state: ResultState,
    onIntent: (ResultIntent) -> Unit,
    modifier: Modifier = Modifier,
) {
    VoxaBottomSheetContainer(modifier = modifier) {
        when (state.sheetState) {
            SheetState.LOADING -> {
                Column(
                    modifier = Modifier.padding(AppTheme.spacing.lg),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.md),
                ) {
                    CircularProgressIndicator(color = AppTheme.colors.primary)
                    Text("문서를 인식하고 번역하는 중입니다...", style = AppTheme.typography.bodyMedium, color = AppTheme.colors.textSecondary)
                }
            }
            SheetState.ERROR -> {
                Column(
                    modifier = Modifier.padding(AppTheme.spacing.md),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.md),
                ) {
                    Text("처리 중 오류가 발생했습니다.", style = AppTheme.typography.titleMedium, color = AppTheme.colors.error)
                    PrimaryPillButton(text = "재시도", onClick = { onIntent(ResultIntent.Retry) })
                }
            }
            SheetState.COLLAPSED -> {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(AppTheme.spacing.sm),
                    verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.sm),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        LanguageSelectChip(
                            sourceLanguage = state.sourceLang.displayName,
                            targetLanguage = state.targetLang.displayName,
                            onClick = { onIntent(ResultIntent.SetSheetState(SheetState.EXPANDED)) }
                        )
                        SecondaryPillButton(
                            text = "자세히",
                            onClick = { onIntent(ResultIntent.SetSheetState(SheetState.EXPANDED)) }
                        )
                    }
                    state.translatedText?.let {
                        Text(it, maxLines = 2, style = AppTheme.typography.bodyMedium, color = AppTheme.colors.textPrimary)
                    }
                }
            }
            SheetState.EXPANDED -> {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(AppTheme.spacing.sm),
                    verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.md),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        LanguageSelectChip(
                            sourceLanguage = state.sourceLang.displayName,
                            targetLanguage = state.targetLang.displayName,
                            onClick = {}
                        )
                        SecondaryPillButton(
                            text = "접기",
                            onClick = { onIntent(ResultIntent.SetSheetState(SheetState.COLLAPSED)) }
                        )
                    }

                    BaseCard(modifier = Modifier.fillMaxWidth()) {
                        Text("원문", style = AppTheme.typography.labelSmall, color = AppTheme.colors.textSecondary)
                        Text(state.recognizedText ?: "원문 텍스트가 없습니다.", style = AppTheme.typography.bodyMedium, color = AppTheme.colors.textPrimary)
                    }

                    AccentCard(modifier = Modifier.fillMaxWidth()) {
                        Text("번역", style = AppTheme.typography.labelSmall, color = AppTheme.colors.accent)
                        Text(state.translatedText ?: "번역 텍스트가 없습니다.", style = AppTheme.typography.bodyLarge, color = AppTheme.colors.textPrimary)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.sm),
                    ) {
                        SecondaryPillButton(
                            text = "복사",
                            onClick = { onIntent(ResultIntent.CopyText) },
                            modifier = Modifier.weight(1f)
                        )
                        PrimaryPillButton(
                            text = "공유",
                            onClick = { onIntent(ResultIntent.ShareText) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}

@Preview(name = "Light Collapsed", showBackground = true)
@Preview(name = "Dark Collapsed", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun ResultSheetCollapsedPreview() {
    AppTheme {
        ResultSheetContent(
            state = ResultState(
                sheetState = SheetState.COLLAPSED,
                translatedText = "This is a brief preview of the translated document text."
            ),
            onIntent = {}
        )
    }
}

@Preview(name = "Light Expanded", showBackground = true)
@Preview(name = "Dark Expanded", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun ResultSheetExpandedPreview() {
    AppTheme {
        ResultSheetContent(
            state = ResultState(
                sheetState = SheetState.EXPANDED,
                recognizedText = "여기에 인식된 한국어 문서 원문이 표시됩니다.",
                translatedText = "The recognized Korean source document text is translated into English here."
            ),
            onIntent = {}
        )
    }
}
```

- [ ] **Step 3: Verify assemble feature modules**

Run: `./gradlew :feature:camera:assembleDebug :feature:result:assembleDebug`
Expected: BUILD SUCCESSFUL

---

### Task 6: Application Navigation Graph & MainActivity in `:app`

**Files:**
- Create: `app/src/main/java/com/example/voxa/VoxaApplication.kt`
- Create: `app/src/main/java/com/example/voxa/navigation/ScreenRoute.kt`
- Create: `app/src/main/java/com/example/voxa/navigation/VoxaNavHost.kt`
- Create: `app/src/main/java/com/example/voxa/screen/PdfReaderPlaceholderScreen.kt`
- Modify: `app/src/main/java/com/example/voxa/MainActivity.kt`

- [ ] **Step 1: Implement `VoxaApplication.kt`**

```kotlin
// app/src/main/java/com/example/voxa/VoxaApplication.kt
package com.example.voxa

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class VoxaApplication : Application()
```

- [ ] **Step 2: Implement Navigation Routes and Placeholder PDF Reader Screen**

```kotlin
// app/src/main/java/com/example/voxa/navigation/ScreenRoute.kt
package com.example.voxa.navigation

sealed class ScreenRoute(val route: String) {
    data object Camera : ScreenRoute("camera")
    data object PdfReader : ScreenRoute("pdf_reader")
    data object Showcase : ScreenRoute("showcase")
}
```

```kotlin
// app/src/main/java/com/example/voxa/screen/PdfReaderPlaceholderScreen.kt
package com.example.voxa.screen

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.example.voxa.core.designsystem.AppTheme
import com.example.voxa.core.ui.button.AppIconButton
import com.example.voxa.core.ui.button.PrimaryPillButton

@Composable
fun PdfReaderPlaceholderScreen(
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppTheme.colors.background),
    ) {
        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(AppTheme.spacing.md),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIconButton(
                icon = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                onClick = onNavigateBack,
            )
            Text(
                text = "document.pdf (1/5)",
                style = AppTheme.typography.titleMedium,
                color = AppTheme.colors.textPrimary,
            )
            Box(modifier = Modifier.padding(AppTheme.spacing.sm))
        }

        // PDF Content Canvas Mock
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(AppTheme.spacing.md),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "PDF 뷰어 화면 (Phase 3에서 PdfBox 연동 예정)",
                style = AppTheme.typography.bodyLarge,
                color = AppTheme.colors.textSecondary,
            )
        }

        // Bottom bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(AppTheme.spacing.md),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIconButton(
                icon = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Prev",
                onClick = {},
            )
            PrimaryPillButton(
                text = "이 페이지 번역",
                onClick = {},
            )
            AppIconButton(
                icon = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = "Next",
                onClick = {},
            )
        }
    }
}

@Preview(name = "PDF Reader Light", showBackground = true)
@Preview(name = "PDF Reader Dark", uiMode = Configuration.UI_MODE_NIGHT_YES, showBackground = true)
@Composable
private fun PdfReaderPlaceholderScreenPreview() {
    AppTheme {
        PdfReaderPlaceholderScreen(onNavigateBack = {})
    }
}
```

- [ ] **Step 3: Implement `VoxaNavHost.kt` and update `MainActivity.kt`**

```kotlin
// app/src/main/java/com/example/voxa/navigation/VoxaNavHost.kt
package com.example.voxa.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.voxa.core.ui.catalog.DesignSystemCatalog
import com.example.voxa.feature.camera.CameraScreen
import com.example.voxa.screen.PdfReaderPlaceholderScreen

@Composable
fun VoxaNavHost(
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController(),
    startDestination: String = ScreenRoute.Camera.route,
) {
    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier,
    ) {
        composable(ScreenRoute.Camera.route) {
            CameraScreen(
                onNavigateToPdf = { navController.navigate(ScreenRoute.PdfReader.route) },
                onNavigateToShowcase = { navController.navigate(ScreenRoute.Showcase.route) },
                onCaptureClick = {},
            )
        }
        composable(ScreenRoute.PdfReader.route) {
            PdfReaderPlaceholderScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }
        composable(ScreenRoute.Showcase.route) {
            DesignSystemCatalog()
        }
    }
}
```

```kotlin
// app/src/main/java/com/example/voxa/MainActivity.kt
package com.example.voxa

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.example.voxa.core.designsystem.AppTheme
import com.example.voxa.navigation.VoxaNavHost
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AppTheme {
                VoxaNavHost()
            }
        }
    }
}
```

- [ ] **Step 4: Verify full app assembly**

Run: `./gradlew :app:assembleDebug`
Expected: BUILD SUCCESSFUL

---

### Task 7: Full Suite Verification & Static Checks

- [ ] **Step 1: Run all unit tests across the entire project**

Run: `./gradlew testDebugUnitTest`
Expected: BUILD SUCCESSFUL with 100% tests passing.

- [ ] **Step 2: Check for hardcoded colors and dp values**

Verify that all UI files import and reference `AppTheme.colors.*`, `AppTheme.spacing.*`, `AppTheme.radius.*`, and `AppTheme.typography.*`.

- [ ] **Step 3: Run project build**

Run: `./gradlew build -x lint -x test`
Expected: BUILD SUCCESSFUL.
