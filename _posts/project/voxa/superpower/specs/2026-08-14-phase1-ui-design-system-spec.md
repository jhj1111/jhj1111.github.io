# Phase 1 UI 디자인 시스템 및 스켈레톤 구현 설계 명세서 (Design Spec)

- **작성일**: 2026-08-14
- **대상**: Phase 1 — 기본 구조 수립 및 UI 디자인 시스템 구축
- **문서 위치**: `dev/superpower/specs/2026-08-14-phase1-ui-design-system-spec.md`
- **관련 기준 문서**: `dev/voxa/01_PRD.md`, `dev/voxa/02_아키텍처_디자인시스템_코딩컨벤션.md`, `dev/voxa/04_AGENT.md`, `dev/voxa/05_단계별_기능구현계획.md`, `dev/voxa/06_UI_화면설계명세.md`

---

## 1. 개요 및 설계 목표

### 1.1 목표
- `05_단계별_기능구현계획.md`의 **Phase 1** 요구사항에 따라, 하드코딩된 색상/치수 없이 **토큰 기반 디자인 시스템**(`Soft Paper Minimal`)을 구축하고, 기능 없이도 빌드/실행되며 다크모드와 네비게이션이 동작하는 **스켈레톤 앱**을 완성한다.
- 모든 UI 컴포넌트와 화면에 **라이트/다크 모드 Compose `@Preview`**를 제공하고, 런타임에서 토큰을 시각적으로 검증할 수 있는 **Design System Showcase 화면**을 구축한다.
- `build-logic` 컨벤션 플러그인을 활용하여 멀티모듈 빌드 설정을 표준화한다.

---

## 2. 모듈 구조 및 의존성 설계

### 2.1 모듈 그래프
```
                                   ┌──────────────┐
                                   │     :app     │
                                   └──────┬───────┘
                     ┌────────────────────┼───────────────────┐
                     ▼                    ▼                   ▼
            ┌─────────────────┐  ┌─────────────────┐ ┌─────────────────┐
            │ :feature:camera │  │ :feature:result │ │  :feature:pdf   │ (Phase 2/3)
            └────────┬────────┘  └────────┬────────┘ └────────┬────────┘
                     │                    │                   │
                     └──────────────┐     │     ┌─────────────┘
                                    ▼     ▼     ▼
                                 ┌─────────────────┐
                                 │    :core:ui     │ (공통 컴포넌트/쇼케이스)
                                 └────────┬────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │:core:designsystem│ (토큰/테마/폰트)
                                 └─────────────────┘

            ┌─────────────────┐  ┌─────────────────┐ ┌─────────────────┐
            │     :domain     │  │  :core:common   │ │ :data:document  │ (Phase 2/3)
            └─────────────────┘  └─────────────────┘ └─────────────────┘
```

### 2.2 모듈별 책임 및 Gradle 플러그인 구성

| 모듈 | 책임 | 적용 Convention Plugins | 주요 의존성 |
|---|---|---|---|
| `:core:designsystem` | Raw/Semantic 색상, Spacing, Radius, Typography, Pretendard 폰트, `AppTheme` | `voxa.android.library`, `voxa.android.library.compose` | `compose-ui`, `compose-material3`, `compose-ui-tooling-preview` |
| `:core:ui` | 공통 UI 컴포넌트(버튼, 칩, 카드, 바텀시트 컨테이너), Design System Showcase | `voxa.android.library`, `voxa.android.library.compose` | `:core:designsystem`, `material-icons-extended` |
| `:core:common` | MVI 베이스 클래스(`MviViewModel`, `State/Intent/Effect`), Coroutine/Flow 유틸 | `voxa.android.library`, `voxa.android.hilt` | `kotlinx-coroutines-core`, `lifecycle-viewmodel-ktx` |
| `:domain` | 순수 Kotlin 도메인 모델, `DomainError`, UseCase 인터페이스 | `voxa.jvm.library` (Android 무의존) | `kotlinx-coroutines-core` |
| `:feature:camera` | 카메라 프리뷰 화면 스켈레톤, 오버레이 가이드, 스크림 툴바 | `voxa.android.feature` | `:core:designsystem`, `:core:ui`, `:core:common`, `:domain` |
| `:feature:result` | 결과 바텀시트 UI(4단계 상태), `ResultViewModel` 골격 | `voxa.android.feature` | `:core:designsystem`, `:core:ui`, `:core:common`, `:domain` |
| `:app` | 진입점(`MainActivity`), Hilt Application, Navigation Graph, 테마 루트 | `voxa.android.application`, `voxa.android.application.compose`, `voxa.android.hilt` | 모든 모듈 |

---

## 3. 디자인 시스템 토큰 명세 (`:core:designsystem`)

### 3.1 컨셉: Soft Paper Minimal
따뜻한 종이 질감의 톤과 정갈한 기능적 UI를 결합하여 눈의 피로를 최소화.

### 3.2 컬러 토큰

#### ① Raw 컬러 팔레트 (`ColorPalette`)
```kotlin
object ColorPalette {
    // Light Palette
    val WarmCream       = Color(0xFFFDFBF7)  // 전체 배경 (Warm White)
    val ParchmentBeige  = Color(0xFFF7F1E4)  // 카드/패널 surface
    val SageTeal        = Color(0xFF3F7768)  // Primary CTA
    val DeepTerracotta  = Color(0xFFD96847)  // Secondary / Accent
    val Charcoal        = Color(0xFF2B2D42)  // Primary Text
    val SoftGray        = Color(0xFF6B7690)  // Secondary Text
    val OutlineBeige    = Color(0xFFEDE6D8)  // Outline 테두리
    val Red600          = Color(0xFFB00020)  // Error (Light)

    // Dark Palette
    val DarkCocoa       = Color(0xFF1E1A15)  // 전체 배경 (Dark)
    val DarkSurface     = Color(0xFF2A241C)  // 카드/패널 surface (Dark)
    val SageTealDark    = Color(0xFF4F9C87)  // Primary (Dark)
    val LightTerracotta = Color(0xFFF0997B)  // Accent (Dark)
    val IvoryWhite      = Color(0xFFEDEAE3)  // Primary Text (Dark)
    val SoftGrayLight   = Color(0xFF9AA6BC)  // Secondary Text (Dark)
    val DarkOutline     = Color(0xFF3A342B)  // Outline 테두리 (Dark)
    val OnPrimaryDark   = Color(0xFF14211D)  // onPrimary Text (Dark)
    val Red300          = Color(0xFFCF6679)  // Error (Dark)

    val White           = Color(0xFFFFFFFF)
}
```

#### ② Semantic 컬러 (`AppColors`)
```kotlin
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

### 3.3 치수 및 곡률 토큰 (`Spacing`, `Radius`)
```kotlin
object Spacing {
    val none = 0.dp
    val xs = 4.dp
    val sm = 8.dp
    val md = 16.dp
    val lg = 24.dp
    val xl = 32.dp
    val xxl = 48.dp
}

object Radius {
    val sm = 12.dp     // 칩, 작은 인풋
    val md = 16.dp     // 카드, 패널
    val lg = 20.dp     // 바텀시트 상단 모서리
    val pill = 28.dp   // 주요 버튼, 토글 칩
    val full = 999.dp  // 원형 FAB
}
```

### 3.4 타이포그래피 토큰 (`AppTypography`)
- **폰트 패밀리**: `Pretendard` (Regular, Medium, SemiBold, Bold) 에셋 번들 + Fallback `FontFamily.SansSerif`
- **텍스트 스타일 위계**:
  - `displayLarge`: 28.sp, SemiBold, line-height 36.sp
  - `titleLarge`: 20.sp, SemiBold, line-height 28.sp
  - `titleMedium`: 16.sp, Medium, line-height 24.sp
  - `bodyLarge`: 16.sp, Regular, line-height 24.sp
  - `bodyMedium`: 14.sp, Regular, line-height 20.sp
  - `labelSmall`: 12.sp, Medium, line-height 16.sp

### 3.5 테마 제공 (`AppTheme`)
```kotlin
val LocalAppColors = staticCompositionLocalOf { LightColors }
val LocalAppTypography = staticCompositionLocalOf { AppTypographyDefault }

@Composable
fun AppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) DarkColors else LightColors
    CompositionLocalProvider(
        LocalAppColors provides colors,
        LocalAppTypography provides AppTypographyDefault,
        content = content
    )
}

object AppTheme {
    val colors: AppColors
        @Composable
        get() = LocalAppColors.current
    val typography: AppTypography
        @Composable
        get() = LocalAppTypography.current
    val spacing: Spacing = Spacing
    val radius: Radius = Radius
}
```

---

## 4. 공통 UI 컴포넌트 명세 (`:core:ui`)

모든 컴포넌트는 오직 `AppTheme` 토큰만을 참조하며, 독립적인 `@Preview(name = "Light")` 및 `@Preview(name = "Dark", uiMode = UI_MODE_NIGHT_YES)`를 포함한다.

### 4.1 버튼 세트
1. **`PrimaryPillButton`**:
   - 높이: 48dp, 모양: `Radius.pill`
   - 배경: `AppTheme.colors.primary`, 텍스트: `AppTheme.colors.onPrimary`
   - 인터랙션: 활성/비활성/로딩 인디케이터 지원
2. **`SecondaryPillButton`**:
   - 높이: 48dp, 모양: `Radius.pill`
   - 배경: `AppTheme.colors.surface`, 테두리: `1.dp solid AppTheme.colors.outline`, 텍스트: `AppTheme.colors.textPrimary`
3. **`AppIconButton`**:
   - 크기: 44dp 원형 터치 타겟, 아이콘: 20dp, 틴트: `AppTheme.colors.textPrimary`
4. **`ShutterFab`**:
   - 크기: 56dp 원형 FAB, 배경: `AppTheme.colors.primary`, 아이콘: `AppTheme.colors.onPrimary` (촬영 아이콘)

### 4.2 칩 및 카드
1. **`LanguageSelectChip`**:
   - Source ↔ Target 언어 전환 토글
   - 선택 상태: `AppTheme.colors.primary` 배경 + `onPrimary` 텍스트
   - 비선택/중간 화살표: `AppTheme.colors.textSecondary`
2. **`BaseCard`**:
   - 모양: `Radius.md`, 배경: `AppTheme.colors.surface`, 테두리: `AppTheme.colors.outline` 1.dp
3. **`AccentCard`**:
   - 번역 결과 강조용 카드. 모양: `Radius.md`, 배경: `AppTheme.colors.accent.copy(alpha = 0.12f)`, 테두리: `AppTheme.colors.accent.copy(alpha = 0.3f)`

### 4.3 바텀시트 프레임 (`VoxaBottomSheetContainer`)
- 드래그 핸들 (32dp × 4dp, `AppTheme.colors.outline`)
- 상단 모서리 `Radius.lg`, 배경 `AppTheme.colors.surface`
- Collapsed (~25%) 및 Expanded (~80%) 부드러운 스냅 애니메이션 지원

### 4.4 Design System Showcase 화면 (`DesignSystemCatalog`)
- Light/Dark 토큰 시각 확인 그리드
- 모든 버튼, 칩, 카드, 타이포그래피 샘플을 한 화면에 렌더링하여 토큰 누락 및 다크모드 대비 확인

---

## 5. 화면 스켈레톤 및 네비게이션 설계

### 5.1 네비게이션 라우트 (`:app`)
```kotlin
sealed interface ScreenRoute {
    @Serializable data object Camera : ScreenRoute
    @Serializable data object PdfReader : ScreenRoute
    @Serializable data object Showcase : ScreenRoute
}
```

### 5.2 화면별 스켈레톤 구성
1. **`CameraScreen` (`:feature:camera`)**:
   - 전체 화면 Mock 카메라 뷰파인더
   - 상단 스크림: 닫기 / 안내 텍스트("문서 가장자리를 인식하고 있어요") / 플래시
   - 문서 감지 동적 아웃라인 Mock Overlay (`AppTheme.colors.accent` 2.dp)
   - 하단 스크림: 갤러리 버튼(좌), Shutter FAB(중앙), PDF 선택 버튼(우)
   - Result 바텀시트 결합 슬롯
2. **`PdfReaderScreen` (`:feature:result` / `:app`)**:
   - 몰입형 리더 스켈레톤 (기본 상태: 툴바 숨김, 탭 시 상/하단 바 200ms Fade-in)
   - 상단바: 뒤로가기 / 파일명 / 페이지 인덱스
   - 하단바: 이전 / "이 페이지 번역" PrimaryPillButton / 다음
3. **`ResultSheetContent` (`:feature:result`)**:
   - 4단계 상태(Collapsed, Expanded, Loading, Error) 전환 지원

---

## 6. MVI 베이스 구조 (`:core:common`)

```kotlin
interface UiState
interface UiIntent
interface UiEffect

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

---

## 7. 검증 계획 및 DoD (Definition of Done)

### 7.1 검증 항목
1. **빌드 검증**: `./gradlew build` 및 `./gradlew check` 에러 없이 통과
2. **정적 분석**: 하드코딩된 `Color(0xFF...)`나 `dp` 리터럴이 컴포넌트 코드에 없고 오직 `AppTheme` 토큰만 사용하는지 검사
3. **Compose Preview 검증**: 모든 공통 컴포넌트 및 화면의 Light/Dark Preview 렌더링 확인
4. **네비게이션 동작**: 앱 실행 시 Camera ↔ PDF ↔ Showcase 간 전환 정상 동작 확인
5. **다크모드 전환**: 시스템 테마 변경 시 모든 화면이 즉시 다크모드 토큰으로 리컴포지션되는지 확인

### 7.2 Git 커밋 정책 준수
- 사용자 요청에 따라 작업 중 임의 커밋을 수행하지 않으며, 전체 구현 및 확인 완료 후 사용자의 단계별 커밋 요청 시 진행.
