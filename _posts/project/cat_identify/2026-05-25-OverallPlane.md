---
title: (CatHealth) 전체 기획
post_order: 1
thumbnail: https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=640
layout: post
author: jhj
categories:
  - Project
  - CatHealth
tags:
  - Android
  - Kotlin
  - MVI
  - TFLite
  - MediaPipe
  - OpenCV
excerpt: 고양이 건강 분석 앱의 전체 기능 개요, 시스템 아키텍처, 기술 스택, 개발 로드맵 정리
---

# 고양이 건강 분석 앱 — 전체 기획 개요

> 작성일: 2025-08  
> 문서 버전: v 1.0  
> 시리즈: 1/4 — 전체 기능·아키텍처·기술 스택

---

## 1. 프로젝트 개요

### 1.1 한 줄 정의

스마트폰 카메라만으로 고양이의 **종(Breed)을 식별**하고, **움직임·자세·행동 패턴**을 실시간 분석하여 건강 이상 징후를 조기에 감지하는 Android 앱.

### 1.2 핵심 가치

|가치|설명|
|---|---|
|**온디바이스 우선**|추론 연산의 95% 이상을 기기 내에서 처리. 인터넷 없이도 분석 가능|
|**비침습적 모니터링**|별도 센서 장착 없이 카메라 영상만으로 건강 지표 도출|
|**지속적 트래킹**|단발성 진단이 아닌 시계열 건강 기록으로 추세 파악|
|**종(Breed) 맞춤 분석**|품종별 평균 행동·체형 기준값을 적용한 개인화 진단|

### 1.3 목표 사용자

- 고양이를 혼자 키우며 건강 모니터링이 어려운 1인 가구
- 다두 보호자 중 개별 고양이 상태를 관리하고 싶은 사용자
- 수의사 방문 전 사전 정보를 수집하고 싶은 반려인

---

## 2. 핵심 기능 목록

### 2.1 종 식별 (Breed Classification)

- CameraX 실시간 프리뷰에서 고양이 감지 시 자동 캡처
- TFLite EfficientNet 기반 모델로 50+ 품종 분류
- 품종명, 신뢰도(%), 품종 특성 정보 제공
- 오프라인 동작 가능 (모델 번들 내장)

### 2.2 자세·관절 분석 (Pose Estimation)

- MediaPipe Holistic을 이용한 실시간 관절 랜드마크 추출
- 등·목·다리 각도 측정 → 비대칭·이상 자세 탐지
- 절뚝거림, 웅크림 지속, 이동 회피 패턴 분류

### 2.3 움직임 분석 (Motion Analysis)

- OpenCV C++ (JNI) Lucas-Kanade 광학 흐름으로 프레임 간 운동량 계산
- 일일 활동 지수(Daily Activity Index) 산출
- 급격한 활동 감소 / 과활동 패턴 이상 감지

### 2.4 행동 패턴 분류 (Behavior Classification)

|행동|감지 방법|관련 건강 지표|
|---|---|---|
|과도한 그루밍|머리→몸 반복 동작 벡터|피부 자극, 스트레스|
|절뚝거림|보행 좌우 비대칭 점수|관절 통증, 부상|
|웅크림 지속|저자세 + 저활동 복합|통증, 우울|
|흉부 과호흡|흉부 영역 주기 분석|호흡기 질환|
|점프 회피|수직 이동 빈도 감소|관절염|
|과식/저식 탐지|사용자 보조 입력 + 시간 로그|내과 질환|

### 2.5 건강 점수 및 리포트 (Health Scoring)

- ONNX Runtime 앙상블 모델로 0~100 건강 점수 산출
- 종별 기준값(Breed Baseline) 대비 상대 점수 제공
- 주간/월간 건강 추세 그래프 (Compose Charts)
- 이상 징후 임계값 초과 시 푸시 알림

### 2.6 기록 및 리포트 (History & Report)

- Room DB 기반 분석 이력 영속 저장
- PDF/이미지 리포트 내보내기 (수의사 공유용)
- 다두 보호자를 위한 고양이 프로필 다중 지원

---

## 3. 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Android App                              │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Presentation│    │    Domain    │    │       Data       │  │
│  │  (MVI/Compose│◄──►│  (UseCase   │◄──►│  (Room/DataStore │  │
│  │   Features)  │    │  + Models)  │    │  + CameraX/IMU)  │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                │                                │
│                     ┌──────────▼──────────┐                    │
│                     │    :ml-core          │                    │
│                     │  TFLite │ MediaPipe  │                    │
│                     │  OpenCV │ ONNX RT    │                    │
│                     └─────────────────────┘                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS (선택, 모델 업데이트만)
                ┌──────────────▼──────────────┐
                │   Spring Boot Backend        │
                │  모델 배포 / 통계 / FCM 알림  │
                └─────────────────────────────┘
```

### 3.1 계층별 책임

|계층|모듈|책임|
|---|---|---|
|Presentation| `:feature-*` |UI 렌더링, 사용자 인터랙션, MVI State 소비|
|Domain| `:domain` |비즈니스 룰, UseCase 정의, Repository 인터페이스|
|Data| `:data-*` |DB·센서·네트워크 구현체, Repository 구현|
|ML| `:ml-core` |모든 AI/ML 추론 로직, C++ JNI 브릿지|
|Core| `:core-*` |공통 UI 컴포넌트, DI 설정, 유틸리티|
|Backend|Spring Boot|모델 배포, 통계 집계, 푸시 알림 (최소 범위)|

### 3.2 데이터 흐름

```
CameraX ImageAnalysis
    │
    ▼
:data-sensor (ImageProxy → Bitmap/Mat 변환)
    │
    ├──► BreedClassifier (TFLite)   ─► 품종 결과
    ├──► PoseEstimator (MediaPipe)  ─► 관절 랜드마크
    └──► MotionAnalyzer (OpenCV)    ─► 광학 흐름 벡터
                │
                ▼
          HealthScorer (ONNX)       ─► 건강 점수 [0-100]
                │
                ▼
          Domain UseCase            ─► 행동 패턴 분류 + 이상 감지
                │
                ├──► Room DB (기록 저장)
                └──► ViewModel State (UI 업데이트)
```

---

## 4. 기술 스택 상세

### 4.1 Android

|분류|기술|버전|선택 이유|
|---|---|---|---|
|언어|Kotlin|2. x|코루틴, Flow, 확장 함수 생산성|
|UI|Jetpack Compose|최신 stable|선언형 UI, MVI 상태 모델과 자연스러운 결합|
|비동기|Kotlin Coroutines + Flow|-|StateFlow → MVI State, 구조화된 동시성|
|아키텍처|MVI (Model-View-Intent)|-|단방향 데이터 흐름, 예측 가능한 상태 관리|
|의존성 주입|Hilt|-|멀티모듈 환경에서 검증된 DI 솔루션|
|카메라|CameraX|-|Lifecycle 연동, 일관된 디바이스 지원|
|로컬 DB|Room|-|SQLite 추상화, Flow 쿼리 지원|
|설정 저장|DataStore (Proto)|-|타입 안전, SharedPreferences 대체|
|네비게이션|Navigation Compose|-|타입 안전 라우팅, 딥링크|
|빌드|Gradle Version Catalog|-|멀티모듈 의존성 일괄 관리|

### 4.2 AI / ML

|분류|기술|선택 이유|
|---|---|---|
|종 분류|TFLite + GPU Delegate|온디바이스 추론, GPU 가속으로 실시간 처리|
|자세 추정|MediaPipe Tasks (Pose Landmarker)|17개 랜드마크, 검증된 모바일 최적화|
|움직임 분석|OpenCV 4. x (NDK C++)|Java 대비 3~5× 빠른 광학 흐름 연산|
|건강 점수화|ONNX Runtime + NNAPI|하드웨어 가속, 프레임워크 독립적 모델 포맷|

### 4.3 Backend (선택적)

|분류|기술|용도|
|---|---|---|
|프레임워크|Spring Boot 3 (Kotlin)|REST API 서버|
|데이터베이스|PostgreSQL|통계 집계, 모델 메타데이터|
|캐시|Redis|모델 버전 캐싱, 세션|
|컨테이너|Docker + Kubernetes|배포 환경|
|푸시 알림|Firebase Cloud Messaging|건강 이상 징후 알림|
|인증|JWT + Spring Security|기기 등록, 사용자 식별|

### 4.4 개발 환경 및 도구

|도구|용도|
|---|---|
|Android Studio|주 개발 IDE|
|CMake + NDK|OpenCV C++ 빌드|
|Python (학습 환경)|TFLite/ONNX 모델 학습 및 변환|
|Roboflow / Label Studio|데이터셋 라벨링|
|GitHub Actions|CI/CD|
|Firebase Crashlytics|크래시 모니터링|

---

## 5. 비기능 요건

### 5.1 성능 목표

|항목|목표치|
|---|---|
|종 분류 추론 시간|≤ 200 ms (GPU Delegate 기준)|
|자세 추정 처리 속도|≥ 15 FPS (실시간 분석 기준)|
|광학 흐름 분석|≥ 24 FPS (C++ NDK 기준)|
|건강 점수 산출|≤ 100 ms|
|앱 콜드 스타트|≤ 2초|
|배터리 소모|일반 사용 시 시간당 ≤ 5% 추가 소모|

### 5.2 호환성

- 최소 지원 버전: Android 8.0 (API 26) — CameraX, TFLite, MediaPipe 지원 기준
- 권장 버전: Android 11 (API 30) 이상 — NNAPI 2.0 최적화 활용
- 아키텍처: arm 64-v 8 a (주), x 86_64 (에뮬레이터 지원)

### 5.3 개인정보 및 보안

- 카메라 영상은 기기 외부로 전송하지 않음 (온디바이스 추론)
- 서버 전송 데이터: 모델 업데이트 요청, 익명화된 통계만 해당
- 분석 결과 암호화 저장 (Android Keystore)
- GDPR / 개인정보보호법 준수 설계

---

## 6. 개발 로드맵

### Phase 1 — MVP 

- [ ] 프로젝트 멀티모듈 구조 셋업
- [ ] CameraX 실시간 프리뷰 구현
- [ ] TFLite 종 분류 모델 통합
- [ ] 기본 MVI 아키텍처 구축 (feature-home, feature-analysis)
- [ ] Room DB 건강 기록 저장

### Phase 2 — Core AI

- [ ] MediaPipe 자세 추정 통합
- [ ] OpenCV C++ NDK 광학 흐름 분석
- [ ] ONNX Runtime 건강 점수 모델 통합
- [ ] 행동 패턴 분류 로직 구현

### Phase 3 — 고도화 

- [ ] 시계열 건강 기록 대시보드
- [ ] 종별 기준값 데이터베이스 구축
- [ ] Spring Boot 백엔드 모델 배포 서버
- [ ] FCM 이상 징후 알림

### Phase 4 — 완성 

- [ ] PDF 리포트 내보내기
- [ ] 다두 프로필 지원
- [ ] 성능 최적화 (배터리, 메모리)
- [ ] Google Play 출시

---

## 7. 관련 문서

|문서|경로|
|---|---|
|안드로이드 세부 아키텍처| `02_android_architecture.md` |
|비전 및 AI 모델| `03_vision_ai_model.md` |
|백엔드 세부 설명| `04_backend.md` |

---

_본 문서는 개발 진행에 따라 지속적으로 업데이트됩니다._