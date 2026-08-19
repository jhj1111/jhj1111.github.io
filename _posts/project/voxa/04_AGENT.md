# AGENT.md

이 문서는 AI 코딩 에이전트(Claude Code 등)가 이 프로젝트에서 코드를 작성/수정할 때 반드시 따라야 하는 규칙을 정의한다. 사람용 설계 배경은 `dev/voxa/` 하위의 PRD/아키텍처/컨벤션 문서를 참조하고, 여기서는 실행 가능한 규칙만 간결하게 유지한다.

## 프로젝트 개요

- 카메라/이미지/PDF 문서를 온디바이스로 텍스트 인식(OCR) 및 번역하는 안드로이드 앱
- 핵심 목표: ML Kit 어댑터와 외부 오픈소스 AI 모델(Gemma 3n 등) 어댑터를 동일 인터페이스로 교체 가능하게 유지
- MVI + Hilt + 멀티모듈 구조

## 모듈 구조 지도

```
:app                    → 진입점, DI 그래프, 네비게이션
:core:ui                → 디자인 시스템 (컬러/타이포/스페이싱 토큰)
:core:common            → 공통 유틸
:domain                 → UseCase, Repository/Model 인터페이스, 도메인 모델, DomainError
:data:document          → PDF/이미지 파일 처리
:feature:ocr-mlkit      → ML Kit 기반 TextRecognizer 구현체
:feature:ocr-gemma      → Gemma 3n 기반 TextRecognizer 구현체
:feature:translate-mlkit
:feature:translate-gemma
:feature:camera
:feature:result
```

**의존 방향 규칙 (위반 금지)**
- `feature-*`, `data-*` → `domain` → `core:common` (역방향 절대 금지)
- `domain` 모듈은 `android.*`, `androidx.*` import 금지 (순수 Kotlin 유지)
- `feature-*` 모듈끼리 서로 의존 금지 (조합이 필요하면 domain의 UseCase를 통해서만)

## 아키텍처 규칙

- 화면 상태는 MVI 패턴을 따른다: `State`(불변, 지속 상태) / `Intent`(사용자 입력) / `Effect`(일회성 이벤트, `Channel`/`SharedFlow`로 분리)
- State를 직접 mutate하지 말고 항상 새 인스턴스로 교체 (`copy()`)
- Effect(토스트, 네비게이션)를 State 필드에 넣지 말 것
- 모든 외부 I/O 실패는 `DomainError` sealed interface로 매핑 후 반환. 원본 예외(`IOException` 등)를 상위 레이어로 그대로 전파하지 말 것
- `TextRecognizer`/`Translator`/`Summarizer` 신규 구현체는 반드시 `domain`에 정의된 인터페이스를 그대로 구현하고, 임의로 시그니처를 변경하지 않는다. 시그니처 변경이 필요하면 먼저 `docs/03_도메인인터페이스_테스트전략.md`를 업데이트하고 모든 기존 구현체에 반영한다.
- `Summarizer`는 ML Kit 등 SDK 기반 어댑터가 존재하지 않는다. LLM 어댑터가 준비되기 전까지 요약 기능 관련 UI는 노출하지 않는다.

## 신규 AI 모델 어댑터 추가 시 절차

1. `:feature:{역할}-{모델명}` 형태로 신규 모듈 생성 (예: `:feature:ocr-phi4mini`)
2. `domain`의 `TextRecognizer` 또는 `Translator` 인터페이스 구현
3. `prepare()`/`isReady()`/`release()`를 실제 리소스 생명주기에 맞게 구현 (모델 로딩 시간이 긴 경우 반드시 비동기 처리)
4. 모든 실패 케이스를 `DomainError`로 매핑
5. 해당 모듈에 Hilt `@Module` 작성, 필요 시 `@Qualifier`로 다중 구현체 구분
6. `docs/03_도메인인터페이스_테스트전략.md`의 "어댑터 구현 체크리스트" 항목을 모두 충족했는지 확인
7. 평가셋 기준 벤치마크 결과를 `docs/` 하위에 기록 (신규 파일 또는 기존 비교 문서에 추가)

## 빌드/테스트 명령어

```bash
./gradlew build                     # 전체 빌드
./gradlew :domain:test              # domain 모듈 unit test
./gradlew testDebugUnitTest         # 전체 unit test
./gradlew ktlintCheck               # 린트 검사
./gradlew connectedAndroidTest      # instrumented test (에뮬레이터/기기 필요)
```

- 코드 수정 후에는 최소 `ktlintCheck`와 수정된 모듈의 unit test를 실행할 것
- domain/ViewModel 로직 변경 시 관련 unit test를 함께 갱신할 것 (테스트 없는 로직 변경 PR 지양)

## 코딩 컨벤션 요약

- 패키지: `com.{org}.voxa.{layer}.{feature}`
- 인터페이스: 역할 명사형 (`TextRecognizer`), `I` 접두사 금지
- 구현체: `{공급자}{역할}` (`MlKitTextRecognizer`, `GemmaTextRecognizer`)
- UseCase: `{동사}{대상}UseCase`
- 의존성 버전은 반드시 `libs.versions.toml`(Version Catalog)에 등록 후 사용, 하드코딩 금지
- import wildcard 금지

## UI/디자인 시스템 규칙

- 색상/스페이싱/폰트 크기를 직접 값으로 작성하지 말고 `core:ui`의 토큰(`AppTheme.colors.*`, `Spacing.*`, `AppTypography.*`)만 사용
- 신규 색상 추가 시 Light/Dark 값을 반드시 함께 정의
- UI 텍스트는 `strings.xml`에 리소스화. **번역 결과(런타임 동적 텍스트)는 여기 포함하지 않는다** — 도메인 모델로 별도 관리

## 알려진 제약 / 함정 (Gotchas)

- PDF 페이지를 `PdfRenderer`로 렌더링할 때 Bitmap을 명시적으로 `recycle()`하지 않으면 메모리 누수가 발생한다. 페이지 처리 후 반드시 해제할 것.
- LLM 기반 어댑터(Gemma 3n 등)는 모델 파일이 없거나 로딩 전이면 추론 호출 시 예외가 발생할 수 있다. 반드시 `isReady()`를 먼저 확인하거나 `prepare()`를 호출할 것.
- LLM 기반 OCR은 좌표(바운딩 박스) 정보를 제공하지 않을 수 있다. `TextBlock.boundingBox`는 nullable이므로 이를 가정하지 않는 UI 로직을 작성할 것.
- 긴 문서 텍스트를 번역기에 통째로 넣으면 LLM 계열은 컨텍스트 길이 제한에 걸릴 수 있다. 청크 분할 로직이 필요한지 어댑터 구현 시 확인할 것.
- 온디바이스 모델 추론은 CPU/GPU 부하가 크므로 메인 스레드에서 직접 호출하지 말고 반드시 적절한 Dispatcher(`Dispatchers.Default` 또는 전용 스레드풀)에서 실행할 것.

## 금지 사항

- domain 모듈에 Android 프레임워크 클래스(`Context`, `Bitmap` 등 android.graphics 포함) import 금지 — 필요한 경우 domain에 자체 추상 타입을 정의하고 매핑은 상위 레이어에서 수행
- `feature-*` 모듈 간 직접 참조 금지
- 예외를 catch 없이 상위로 그대로 던지는 코드 작성 금지 (`DomainError`로 매핑 필수)
- 사용자 문서 원문 내용을 로그에 그대로 출력 금지
- 번역 결과 텍스트를 `strings.xml`에 하드코딩 금지
- 신규 라이브러리를 Version Catalog 등록 없이 직접 버전 명시하여 추가 금지

## 참고 문서

- `docs/01_PRD.md` — 제품 요구사항 및 스코프
- `docs/02_아키텍처_디자인시스템_코딩컨벤션.md` — 상세 설계 배경
- `docs/03_도메인인터페이스_테스트전략.md` — 인터페이스 계약 및 테스트 전략
