---
title: (CatHealth) Backend 
post_order: 4 
thumbnail: https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=640 
layout: post 
author: jhj 
categories:
  - Project
  - CatHealth
tags:
  - Backend
  - SpringBoot
  - Kotlin
  - PostgreSQL
  - Redis
  - Docker
  - FCM
  - REST
excerpt: 고양이 건강 분석 앱의 Spring Boot 백엔드 아키텍처 — 모델 배포, 통계 집계, FCM 알림, 인증, 배포 환경 상세 정리
---

# Backend 세부 설명

> 작성일: 2025-08  
> 문서 버전: v 1.0  
> 시리즈: 4/4 — Spring Boot 백엔드 아키텍처

---

## 1. 백엔드 설계 원칙

본 프로젝트의 백엔드는 **최소 범위 원칙**을 따른다. 모든 추론·분석은 온디바이스에서 처리하므로, 서버는 다음 네 가지 역할만 담당한다.

|역할|설명|우선순위|
|---|---|---|
|**모델 배포**|TFLite / ONNX 모델 파일 버전 관리 및 배포|Phase 1|
|**FCM 알림**|건강 이상 징후 감지 시 푸시 알림 발송|Phase 1|
|**통계 집계**|익명화된 건강 데이터 집계 (품종별 기준값 산출)|Phase 2|
|**사용자 인증**|기기 등록, 다기기 프로필 동기화|Phase 2|

> **원칙:** 백엔드 없이도 앱의 핵심 기능(촬영·분석·기록)은 완전히 동작해야 한다. 서버는 앱을 **보조**하는 역할에 그친다.

---

## 2. 전체 시스템 구성

```
┌─────────────────────────────────────────────────────────────────┐
│                        Android App                              │
│              (온디바이스 추론 — 서버 불필요)                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS / REST
                       │
          ┌────────────▼────────────┐
          │      API Gateway        │
          │   (Spring Cloud Gateway │
          │    또는 Nginx)           │
          └────────────┬────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐  ┌─────▼────┐  ┌────▼────┐
    │  Model  │  │  Stats   │  │  Auth   │
    │ Service │  │ Service  │  │ Service │
    └────┬────┘  └─────┬────┘  └────┬────┘
         │             │             │
    ┌────▼─────────────▼─────────────▼────┐
    │           공유 인프라                 │
    │  PostgreSQL │ Redis │ S3 (모델 파일) │
    └─────────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │   Firebase Cloud        │
          │   Messaging (FCM)       │
          └─────────────────────────┘
```

---

## 3. 기술 스택

|분류|기술|버전|선택 이유|
|---|---|---|---|
|프레임워크|Spring Boot|3.3. x|Kotlin 네이티브 지원, 생태계 성숙|
|언어|Kotlin|2.0. x|Android와 언어 통일, 코루틴 지원|
|비동기|Spring WebFlux (선택적)|-|모델 다운로드 등 I/O 집약 엔드포인트|
|ORM|Spring Data JPA + Hibernate|-|표준, 복잡 쿼리는 QueryDSL 보완|
|DB|PostgreSQL|16. x|JSONB 지원, 안정성|
|캐시|Redis|7. x|모델 버전 캐싱, FCM 토큰 관리|
|파일 저장|AWS S 3 (또는 MinIO 로컬)|-|모델 파일 (. tflite, .onnx) 저장|
|인증|JWT + Spring Security|-|Stateless, 모바일 친화적|
|알림|Firebase Admin SDK|-|FCM 푸시 알림|
|문서화|Springdoc OpenAPI 3|-|Swagger UI 자동 생성|
|컨테이너|Docker + Docker Compose|-|로컬·서버 환경 통일|
|오케스트레이션|Kubernetes (k 8 s)|-|프로덕션 배포 (Phase 2)|
|CI/CD|GitHub Actions|-|자동 빌드·테스트·배포|
|모니터링|Prometheus + Grafana|-|메트릭 수집·시각화|
|로그|Logback + ELK Stack|-|구조화 로그, 검색|

---

## 4. 프로젝트 구조

```
backend/
├── build.gradle.kts
├── settings.gradle.kts
│
├── gateway/                        # API Gateway 모듈
│   └── src/main/kotlin/
│       └── GatewayApplication.kt
│
├── model-service/                  # 모델 배포 서비스
│   └── src/main/kotlin/
│       ├── ModelServiceApplication.kt
│       ├── controller/
│       │   └── ModelController.kt
│       ├── service/
│       │   ├── ModelService.kt
│       │   └── S3StorageService.kt
│       ├── repository/
│       │   └── ModelVersionRepository.kt
│       └── domain/
│           └── ModelVersion.kt
│
├── stats-service/                  # 통계 집계 서비스
│   └── src/main/kotlin/
│       ├── controller/
│       │   └── StatsController.kt
│       ├── service/
│       │   └── StatsAggregationService.kt
│       └── repository/
│           └── HealthStatsRepository.kt
│
├── auth-service/                   # 인증 서비스
│   └── src/main/kotlin/
│       ├── controller/
│       │   └── AuthController.kt
│       ├── service/
│       │   ├── AuthService.kt
│       │   └── FcmTokenService.kt
│       └── security/
│           ├── JwtProvider.kt
│           └── SecurityConfig.kt
│
└── common/                         # 공통 모듈
    └── src/main/kotlin/
        ├── exception/
        │   ├── GlobalExceptionHandler.kt
        │   └── ApiException.kt
        ├── response/
        │   └── ApiResponse.kt
        └── config/
            └── RedisConfig.kt
```

---

## 5. 모델 배포 서비스 (model-service)

### 5.1 역할

- 앱이 시작될 때 현재 설치된 모델 버전과 서버 최신 버전을 비교
- 신규 버전 존재 시 S 3 다운로드 URL 제공
- 모델 파일 무결성 검증을 위한 SHA-256 체크섬 제공

### 5.2 도메인 모델

```kotlin
// ModelVersion.kt
@Entity
@Table(name = "model_versions")
data class ModelVersion(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    val modelType: String,          // "breed_classifier" | "health_scorer"

    @Column(nullable = false)
    val version: String,            // SemVer: "1.2.0"

    @Column(nullable = false)
    val s3Key: String,              // S3 객체 키

    @Column(nullable = false)
    val checksum: String,           // SHA-256

    @Column(nullable = false)
    val fileSizeBytes: Long,

    @Column(nullable = false)
    val isActive: Boolean = true,   // 현재 배포 버전 여부

    @Column(nullable = false)
    val releaseNote: String = "",

    val createdAt: LocalDateTime = LocalDateTime.now()
)
```

### 5.3 API 명세

#### `GET /api/v1/models/latest`

앱 시작 시 최신 모델 버전 정보 조회.

**Request**

```
GET /api/v1/models/latest
Authorization: Bearer {jwt}

Query Parameters:
  - breed_classifier_version: String  (현재 설치 버전)
  - health_scorer_version: String     (현재 설치 버전)
```

**Response**

```json
{
  "status": "success",
  "data": {
    "breed_classifier": {
      "current_version": "1.0.0",
      "latest_version": "1.2.0",
      "update_available": true,
      "download_url": "https://s3.../models/cat_breed_int8_v1.2.0.tflite",
      "checksum": "sha256:a3f2...",
      "file_size_bytes": 4194304,
      "url_expires_at": "2025-08-01T12:00:00Z"
    },
    "health_scorer": {
      "current_version": "1.0.0",
      "latest_version": "1.0.0",
      "update_available": false
    }
  }
}
```

#### `POST /api/v1/models/upload` (관리자 전용)

새 모델 버전 등록.

```kotlin
// ModelController.kt
@RestController
@RequestMapping("/api/v1/models")
class ModelController(
    private val modelService: ModelService
) {
    @GetMapping("/latest")
    fun getLatestVersions(
        @RequestParam breedClassifierVersion: String,
        @RequestParam healthScorerVersion: String,
        @AuthenticationPrincipal user: DevicePrincipal
    ): ResponseEntity<ApiResponse<ModelUpdateResponse>> {
        val response = modelService.checkUpdates(
            installedVersions = mapOf(
                "breed_classifier" to breedClassifierVersion,
                "health_scorer"    to healthScorerVersion
            )
        )
        return ResponseEntity.ok(ApiResponse.success(response))
    }

    @PostMapping("/upload")
    @PreAuthorize("hasRole('ADMIN')")
    fun uploadModel(
        @RequestPart file: MultipartFile,
        @RequestPart metadata: ModelUploadRequest
    ): ResponseEntity<ApiResponse<ModelVersion>> {
        val version = modelService.uploadNewVersion(file, metadata)
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(version))
    }
}
```

### 5.4 서비스 구현

```kotlin
// ModelService.kt
@Service
@Transactional(readOnly = true)
class ModelService(
    private val repository: ModelVersionRepository,
    private val s3Service: S3StorageService,
    private val redis: RedisTemplate<String, String>
) {
    companion object {
        private const val CACHE_KEY_PREFIX = "model:latest:"
        private const val CACHE_TTL_MINUTES = 10L
    }

    fun checkUpdates(installedVersions: Map<String, String>): ModelUpdateResponse {
        return ModelUpdateResponse(
            models = installedVersions.entries.associate { (type, installedVer) ->
                type to getUpdateInfo(type, installedVer)
            }
        )
    }

    private fun getUpdateInfo(modelType: String, installedVersion: String): ModelUpdateInfo {
        // Redis 캐시 우선 조회
        val cacheKey = "$CACHE_KEY_PREFIX$modelType"
        val cached   = redis.opsForValue().get(cacheKey)
        val latest   = cached?.let { objectMapper.readValue<ModelVersion>(it) }
            ?: repository.findTopByModelTypeAndIsActiveTrueOrderByCreatedAtDesc(modelType)
                ?.also { version ->
                    redis.opsForValue().set(
                        cacheKey,
                        objectMapper.writeValueAsString(version),
                        CACHE_TTL_MINUTES, TimeUnit.MINUTES
                    )
                }
            ?: return ModelUpdateInfo(updateAvailable = false)

        val needsUpdate = isNewerVersion(latest.version, installedVersion)

        return ModelUpdateInfo(
            currentVersion  = installedVersion,
            latestVersion   = latest.version,
            updateAvailable = needsUpdate,
            downloadUrl     = if (needsUpdate) s3Service.generatePresignedUrl(latest.s3Key) else null,
            checksum        = if (needsUpdate) latest.checksum else null,
            fileSizeBytes   = if (needsUpdate) latest.fileSizeBytes else null
        )
    }

    // SemVer 비교: "1.2.0" > "1.0.0" → true
    private fun isNewerVersion(latest: String, installed: String): Boolean {
        val l = latest.split(".").map { it.toInt() }
        val i = installed.split(".").map { it.toInt() }
        return (0..2).any { idx -> l[idx] > i[idx] }
                && (0 until (0..2).indexOfFirst { l[it] != i[it] }).all { l[it] == i[it] }
    }
}
```

---

## 6. 통계 집계 서비스 (stats-service)

### 6.1 역할

- 앱에서 익명화된 건강 분석 결과를 수집
- 품종별 건강 기준값(Baseline) 산출 → 앱으로 배포
- 이상 패턴 발생 빈도 집계 (연구 목적)

### 6.2 개인정보 보호 설계

앱에서 서버로 전송하는 데이터는 다음 원칙을 따른다.

```
전송 O:
  - 익명 기기 ID (UUID, 사용자 식별 불가)
  - 품종 코드 (문자열)
  - 건강 점수 (숫자)
  - 행동 태그 목록 (열거형 코드)
  - 타임스탬프 (일 단위 버킷 — 정확한 시각 미포함)

전송 X:
  - 카메라 영상 / 이미지
  - 위치 정보
  - 사용자 개인 식별 정보
  - 고양이 이름 등 개인화 정보
```

### 6.3 API 명세

#### `POST /api/v1/stats/report`

분석 결과 익명 리포트 전송 (선택적, 사용자 동의 기반).

**Request**

```json
{
  "device_id": "anon-uuid-1234",
  "breed_code": "SCOTTISH_FOLD",
  "health_score": 82.5,
  "behavior_tags": ["NORMAL", "SLIGHTLY_LOW_ACTIVITY"],
  "date_bucket": "2025-08-01"
}
```

#### `GET /api/v1/stats/baseline/{breedCode}`

품종별 건강 기준값 조회 (앱에서 점수 보정에 활용).

**Response**

```json
{
  "status": "success",
  "data": {
    "breed_code": "SCOTTISH_FOLD",
    "sample_count": 1482,
    "avg_health_score": 78.3,
    "avg_activity_index": 0.42,
    "common_behavior_tags": ["NORMAL", "GROOMING"],
    "updated_at": "2025-07-31"
  }
}
```

### 6.4 서비스 구현

```kotlin
// StatsAggregationService.kt
@Service
class StatsAggregationService(
    private val statsRepository: HealthStatsRepository
) {
    // 매일 새벽 2시 기준값 재계산
    @Scheduled(cron = "0 0 2 * * *")
    fun recalculateBaselines() {
        val breeds = statsRepository.findDistinctBreedCodes()
        breeds.forEach { breedCode ->
            val stats = statsRepository.aggregateByBreed(breedCode)
            statsRepository.upsertBaseline(
                BreedBaseline(
                    breedCode       = breedCode,
                    sampleCount     = stats.count,
                    avgHealthScore  = stats.avgScore,
                    avgActivityIdx  = stats.avgActivity,
                    updatedAt       = LocalDate.now()
                )
            )
        }
    }
}
```

---

## 7. 인증 서비스 (auth-service)

### 7.1 인증 흐름

```
앱 최초 실행
    │
    ▼
POST /api/v1/auth/device/register
  { device_id: UUID, platform: "android", app_version: "1.0.0" }
    │
    ▼
서버: 기기 등록 → JWT (Access + Refresh) 발급
    │
    ▼
앱: JWT 로컬 저장 (DataStore Encrypted)
    │
    ▼
이후 모든 API 요청: Authorization: Bearer {access_token}
    │
    ▼
Access Token 만료 (7일)
    │
    ▼
POST /api/v1/auth/token/refresh
  { refresh_token: "..." }
    │
    ▼
새 Access Token 발급
```

### 7.2 JWT 설정

```kotlin
// JwtProvider.kt
@Component
class JwtProvider(
    @Value("\${jwt.secret}") private val secret: String,
    @Value("\${jwt.access-token-expiry-days:7}") private val accessTokenExpiryDays: Long,
    @Value("\${jwt.refresh-token-expiry-days:90}") private val refreshTokenExpiryDays: Long
) {
    private val key: SecretKey by lazy {
        Keys.hmacShaKeyFor(Base64.getDecoder().decode(secret))
    }

    fun generateAccessToken(deviceId: String): String =
        Jwts.builder()
            .subject(deviceId)
            .claim("type", "access")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis()
                + TimeUnit.DAYS.toMillis(accessTokenExpiryDays)))
            .signWith(key)
            .compact()

    fun generateRefreshToken(deviceId: String): String =
        Jwts.builder()
            .subject(deviceId)
            .claim("type", "refresh")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis()
                + TimeUnit.DAYS.toMillis(refreshTokenExpiryDays)))
            .signWith(key)
            .compact()

    fun validateAndExtractDeviceId(token: String): String =
        Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .payload
            .subject
}
```

### 7.3 FCM 토큰 관리

```kotlin
// FcmTokenService.kt
@Service
class FcmTokenService(
    private val redis: RedisTemplate<String, String>,
    private val firebaseMessaging: FirebaseMessaging
) {
    companion object {
        private const val FCM_KEY_PREFIX = "fcm:token:"
    }

    // 앱에서 FCM 토큰 등록/갱신
    fun registerToken(deviceId: String, fcmToken: String) {
        redis.opsForValue().set(
            "$FCM_KEY_PREFIX$deviceId",
            fcmToken,
            90, TimeUnit.DAYS       // Refresh Token 만료와 동기화
        )
    }

    // 건강 이상 징후 알림 발송
    fun sendHealthAlert(deviceId: String, alert: HealthAlert) {
        val token = redis.opsForValue().get("$FCM_KEY_PREFIX$deviceId")
            ?: return  // 토큰 없으면 알림 불가 — 무시

        val message = Message.builder()
            .setToken(token)
            .setNotification(
                Notification.builder()
                    .setTitle(alert.title)
                    .setBody(alert.body)
                    .build()
            )
            .putData("alert_type", alert.type.name)
            .putData("health_score", alert.score.toString())
            .setAndroidConfig(
                AndroidConfig.builder()
                    .setPriority(AndroidConfig.Priority.HIGH)
                    .build()
            )
            .build()

        try {
            firebaseMessaging.send(message)
        } catch (e: FirebaseMessagingException) {
            if (e.messagingErrorCode == MessagingErrorCode.UNREGISTERED) {
                // 만료 토큰 삭제
                redis.delete("$FCM_KEY_PREFIX$deviceId")
            }
        }
    }
}
```

---

## 8. 공통 모듈 (common)

### 8.1 통일된 API 응답 형식

모든 엔드포인트는 동일한 응답 래퍼를 사용한다.

```kotlin
// ApiResponse.kt
data class ApiResponse<T>(
    val status: String,
    val data: T? = null,
    val error: ApiError? = null,
    val timestamp: Long = System.currentTimeMillis()
) {
    companion object {
        fun <T> success(data: T) =
            ApiResponse(status = "success", data = data)

        fun error(code: String, message: String) =
            ApiResponse<Nothing>(
                status = "error",
                error  = ApiError(code, message)
            )
    }
}

data class ApiError(val code: String, val message: String)
```

### 8.2 전역 예외 처리

```kotlin
// GlobalExceptionHandler.kt
@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(ApiException::class)
    fun handleApiException(e: ApiException): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity
            .status(e.httpStatus)
            .body(ApiResponse.error(e.errorCode, e.message ?: "Unknown error"))

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(e: MethodArgumentNotValidException): ResponseEntity<ApiResponse<Nothing>> {
        val message = e.bindingResult.fieldErrors
            .joinToString(", ") { "${it.field}: ${it.defaultMessage}" }
        return ResponseEntity
            .badRequest()
            .body(ApiResponse.error("VALIDATION_ERROR", message))
    }

    @ExceptionHandler(Exception::class)
    fun handleUnexpected(e: Exception): ResponseEntity<ApiResponse<Nothing>> {
        log.error("Unexpected error", e)
        return ResponseEntity
            .internalServerError()
            .body(ApiResponse.error("INTERNAL_ERROR", "Internal server error"))
    }
}
```

---

## 9. 데이터베이스 설계

### 9.1 ERD 요약

```
device_registrations         model_versions
┌──────────────────┐        ┌───────────────────────┐
│ id               │        │ id                    │
│ device_id (UK)   │        │ model_type            │
│ platform         │        │ version               │
│ app_version      │        │ s3_key                │
│ registered_at    │        │ checksum              │
└──────────────────┘        │ file_size_bytes       │
                            │ is_active             │
                            │ release_note          │
                            │ created_at            │
                            └───────────────────────┘

health_stat_reports          breed_baselines
┌──────────────────┐        ┌───────────────────────┐
│ id               │        │ breed_code (PK)       │
│ device_id        │        │ sample_count          │
│ breed_code       │        │ avg_health_score      │
│ health_score     │        │ avg_activity_index    │
│ behavior_tags    │◄──────►│ common_behavior_tags  │
│ date_bucket      │        │ updated_at            │
└──────────────────┘        └───────────────────────┘
```

### 9.2 주요 인덱스 전략

```sql
-- 모델 버전: 타입별 최신 활성 버전 조회 최적화
CREATE INDEX idx_model_versions_type_active
    ON model_versions (model_type, is_active, created_at DESC);

-- 통계: 품종별 집계 최적화
CREATE INDEX idx_health_stats_breed_date
    ON health_stat_reports (breed_code, date_bucket);

-- 기기 등록: device_id 단건 조회
CREATE UNIQUE INDEX idx_device_registrations_device_id
    ON device_registrations (device_id);
```

---

## 10. 설정 파일

### 10.1 application. yml

```yaml
# model-service/src/main/resources/application.yml
spring:
  application:
    name: model-service
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/cathealth}
    username: ${DB_USER:cathealth}
    password: ${DB_PASSWORD:password}
  jpa:
    hibernate:
      ddl-auto: validate           # 프로덕션: validate (Flyway로 마이그레이션)
    show-sql: false
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      password: ${REDIS_PASSWORD:}

aws:
  s3:
    bucket: ${S3_BUCKET:cathealth-models}
    region: ${AWS_REGION:ap-northeast-2}
    presigned-url-expiry-minutes: 60

jwt:
  secret: ${JWT_SECRET}
  access-token-expiry-days: 7
  refresh-token-expiry-days: 90

firebase:
  credentials-path: ${FIREBASE_CREDENTIALS_PATH:firebase-credentials.json}

server:
  port: 8081
```

---

## 11. 배포 환경

### 11.1 Docker Compose (로컬 개발)

```yaml
# docker-compose.yml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: cathealth
      POSTGRES_USER: cathealth
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass password

  model-service:
    build:
      context: ./model-service
      dockerfile: Dockerfile
    ports:
      - "8081:8081"
    environment:
      DB_URL: jdbc:postgresql://postgres:5432/cathealth
      DB_USER: cathealth
      DB_PASSWORD: password
      REDIS_HOST: redis
      REDIS_PASSWORD: password
      JWT_SECRET: ${JWT_SECRET}
      AWS_REGION: ap-northeast-2
    depends_on:
      - postgres
      - redis

  stats-service:
    build:
      context: ./stats-service
      dockerfile: Dockerfile
    ports:
      - "8082:8082"
    environment:
      DB_URL: jdbc:postgresql://postgres:5432/cathealth
      DB_USER: cathealth
      DB_PASSWORD: password
      REDIS_HOST: redis
    depends_on:
      - postgres
      - redis

  auth-service:
    build:
      context: ./auth-service
      dockerfile: Dockerfile
    ports:
      - "8083:8083"
    environment:
      DB_URL: jdbc:postgresql://postgres:5432/cathealth
      DB_USER: cathealth
      DB_PASSWORD: password
      REDIS_HOST: redis
      REDIS_PASSWORD: password
      JWT_SECRET: ${JWT_SECRET}
      FIREBASE_CREDENTIALS_PATH: /app/config/firebase-credentials.json
    volumes:
      - ./config/firebase-credentials.json:/app/config/firebase-credentials.json:ro
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
```

### 11.2 Dockerfile (공통 템플릿)

```dockerfile
# Dockerfile (각 서비스 공통 구조)
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
RUN ./gradlew dependencies --no-daemon  # 레이어 캐시 활용

COPY src ./src
RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar

# 비루트 사용자 실행 (보안)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8081
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", \
            "-jar", "app.jar"]
```

### 11.3 GitHub Actions CI/CD

```yaml
# .github/workflows/backend-deploy.yml
name: Backend Deploy

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: cathealth_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
      - name: Run tests
        working-directory: backend
        run: ./gradlew test --no-daemon
        env:
          DB_URL: jdbc:postgresql://localhost:5432/cathealth_test
          DB_USER: test
          DB_PASSWORD: test

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker images
        run: |
          docker build -t cathealth/model-service:${{ github.sha }} ./backend/model-service
          docker push cathealth/model-service:${{ github.sha }}
```

---

## 12. API 엔드포인트 전체 목록

|서비스|Method|Path|설명|인증|
|---|---|---|---|---|
|auth|POST| `/api/v1/auth/device/register` |기기 등록, JWT 발급|불필요|
|auth|POST| `/api/v1/auth/token/refresh` |Access Token 갱신|Refresh Token|
|auth|POST| `/api/v1/auth/device/fcm-token` |FCM 토큰 등록|JWT|
|model|GET| `/api/v1/models/latest` |최신 모델 버전 확인|JWT|
|model|POST| `/api/v1/models/upload` |모델 신규 버전 등록|JWT (Admin)|
|stats|POST| `/api/v1/stats/report` |익명 건강 데이터 전송|JWT|
|stats|GET| `/api/v1/stats/baseline/{breedCode}` |품종별 기준값 조회|JWT|
|stats|GET| `/api/v1/stats/summary` |전체 통계 요약|JWT (Admin)|

---

## 13. 보안 체크리스트

|항목|적용 방법|
|---|---|
|HTTPS 강제|Nginx/Gateway에서 HTTP → HTTPS 리다이렉트|
|JWT 비밀키 관리|환경변수, AWS Secrets Manager 사용|
|SQL Injection 방지|JPA Parameterized Query (직접 쿼리 금지)|
|민감 데이터 마스킹|로그에서 토큰, 패스워드 필드 제외|
|CORS 설정|허용 Origin 명시적 지정 (와일드카드 금지)|
|Rate Limiting|Spring Cloud Gateway 필터로 IP당 요청 제한|
|모델 파일 무결성|SHA-256 체크섬 검증 후 적용|
|컨테이너 보안|비루트 사용자 실행, 읽기 전용 파일시스템|

---

## 14. 관련 문서

|문서|경로|
|---|---|
|전체 기획 개요| `01_overview.md` |
|Android 아키텍처| `02_android_architecture.md` |
|비전 및 AI 모델| `03_vision_ai_model.md` |

---

_본 문서는 개발 진행에 따라 지속적으로 업데이트됩니다._