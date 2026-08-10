---
title: (CatHealth) FastAPI와 React 중심 서비스 아키텍처 설계
post_order: 13
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_13.png
layout: post
author: jhj
categories:
  - Project
  - CatHealth
tags:
  - Architecture
  - FastAPI
  - React
  - OpenAPI
excerpt: 잦은 기획 변경에 대응하는 도메인(Feature) 중심의 유연한 아키텍처 설계
---

# 프로젝트 개요

## 무엇을 만드는가

**Lumipet Re-ID (고양이 재식별) 파이프라인을 웹에서 실행하고 결과를 시각적으로 확인할 수 있는 웹 서비스.** 현재 별도 저장소(`lumipet-reid`)에 존재하는 Python 기반 추론 파이프라인(`ReIdModel`, `ReIdPredictor`, `BasePredictor`, `StreamLoader` 등, PyTorch/YOLO/ArcFace/ `wildlife-tools` 기반)을 감싸는 웹 프론트/백엔드를 새로 구축하는 프로젝트입니다. 파이프라인 자체(모델 구조, 학습, 정확도)는 이 프로젝트의 범위가 아니며, **이미 존재하는 추론 로직을 웹 인터페이스로 노출하는 것**이 목표입니다.

## 왜 만드는가

> 현재는 스크립트/커맨드라인으로만 파이프라인을 실행하고 결과를 확인할 수 있음. 
> 이를 웹 화면으로 옮겨 
> (1) 결과를 눈으로 바로 확인하고 검증하기 쉽게 만들고, 
> (2) 이후 웹캠·휴대폰 카메라를 통한 실시간 입력으로 확장할 수 있는 기반을 마련하며, 
> (3) 장기적으로 모바일 앱으로 이어질 수 있는 API 계층을 미리 구축해두기 위함입니다.

## 단계별 목표 (현재 어디까지가 확정이고 어디부터가 미정인지)

|단계|내용|확정 여부|
|---|---|---|
|**1단계 (지금 진행 대상)**|로컬 폴더의 이미지/영상 파일을 입력받아, 탐지된 개체의 BBox와 ReID 매칭 결과(개체 이름/유사도 등)를 웹 화면에 표시|**확정** — 이번 작업 범위|
|**2단계**|휴대폰 또는 외부 웹캠의 실시간 영상 스트림을 입력받아 동일한 처리를 실시간으로 수행|방향은 확정, **구체적 구현 방식(전송 프로토콜, 온디바이스 처리 범위 등)은 미정** — 6장, 7장의 Phase 4 참고|
|**3단계 이후**|결과를 저장하거나 다른 기기로 전송|방향만 언급됨, **세부 사양 미정**|
|**모바일 앱화**|React Native 등으로 별도 앱 제작|**여부 자체가 미정** — "할 수도 있다" 수준|

### 지금 이 시점에서 확정된 기술 스택

- **백엔드**: FastAPI (Python) — 기존 파이프라인과의 통합 용이성, 비동기/WebSocket 지원 때문에 선정
- **프론트엔드**: React + Vite (TypeScript) — 캔버스 기반 BBox 시각화, 향후 실시간 스트리밍 구현의 표준 생태계, React Native 전환 시 코드 재사용성 때문에 선정
- 아키텍처는 **도메인(feature) 기준 구조**를 따르고, AI 실행 로직(`ai/`)은 도메인이 아니라 여러 도메인이 공유하는 인프라 계층으로 분리 (12장 참고)

### 이 프로젝트의 설계 원칙 (코드를 작성할 때 최우선으로 고려할 것)

> **"기획 세부사항이 자주 바뀔 가능성이 크다."** 이것이 이 문서 전체를 관통하는 단일 제약조건입니다. 따라서:

1. **변경의 영향 범위를 국소화**하는 구조를 우선한다 — 한 기능을 고칠 때 다른 기능이 깨지지 않도록 도메인별로 코드를 격리 (8장)
2. **백엔드-프론트엔드 타입을 자동 동기화**해서, API 필드가 바뀌었을 때 프론트엔드가 빌드 타임에 즉시 알아채도록 한다 (8-4장) — 이 프로젝트에서 가장 중요한 안전장치
3. **지금 필요하지 않은 것은 미리 만들지 않는다** — 인증, DB, 다중 사용자, 마이크로서비스 분리 등은 실제로 요구사항이 될 때까지 도입하지 않음(과설계 방지)
4. 온디바이스 AI 연산(모바일 탐지 등)이나 실시간 스트리밍 프로토콜처럼 **아직 결정되지 않은 사양은 나중에 갈아엎기 쉬운 지점에 위치**시킨다(예: `ai/` 계층 분리, 도메인별 격리)

### 지금 범위가 아닌 것 (Non-goals — 오버엔지니어링 방지용 명시)

- 사용자 인증/로그인, 다중 사용자 권한 관리
- 프로덕션 규모의 트래픽 대응, 마이크로서비스 분리, GPU 추론 서버 별도 스케일링
- 모바일 앱 실제 구현(여부조차 미정 — API가 "나중에 재사용 가능한 형태"이기만 하면 충분하고, 지금 앱을 염두에 둔 특별한 작업을 할 필요는 없음)
- 결과 데이터베이스화(현재는 화면에 표시하는 것까지가 목표. 저장이 필요해지면 그때 `results/` 도메인 추가)

# 아키텍처 설계 전제
> 기획 변경 가능성이 높으므로, 핵심 목표는 **"변경의 영향 범위 국소화(Localize)"**. 한 기능 수정 시 다른 기능이 깨지지 않는 구조 우선.

# FastAPI 백엔드 설계

## 도메인(Feature) 기준 분리 원칙
- **Netflix Dispatch**에서 영감을 받은 구조 .
- `fastapi-best-practices(zhanymkanov)` : github 대표 예시.
- 기술적 파일 타입(routers, models 등) 분류 지양
- **기능(Domain) 단위** 분리 채택 (e.g., `auth`, `detection`, `reid`)
- 요구사항 변경 시 하나의 도메인 폴더 내부만 수정하여 리팩토링 비용 최소화
- 구조 예시
```
src/
├── auth/
│   ├── router.py       # 엔드포인트
│   ├── schemas.py      # 요청/응답 Pydantic 모델
│   ├── models.py       # DB 모델(ORM)
│   ├── service.py      # 비즈니스 로직
│   ├── dependencies.py # 이 도메인 전용 Depends
│   ├── exceptions.py
│   └── constants.py
├── detection/           # 예: 탐지 관련 도메인
│   ├── router.py
│   ├── schemas.py
│   ├── service.py       # ReIdPredictor 호출 등
│   └── ...
├── reid/                 # 예: ReID 매칭 관련 도메인
│   └── ...
├── media/                # 예: 영상/이미지 업로드·스트리밍 관련
│   └── ...
├── core/                # 전역 설정, 보안, 로깅
├── db/                  # DB 세션, 베이스 클래스
└── main.py
```

## 도메인 내부 계층 분리 원칙
- `router.py` : HTTP 요청/응답 제어 전담. 비즈니스 로직 배제.
- `service.py` : 실제 비즈니스 로직(모델 추론, 매칭 등) 구현.
- `schemas.py` : Pydantic 요청/응답 모델. DB 모델(`models.py`)과 엄격히 분리.

# 비동기 및 추론 처리 아키텍처
- **짧은 요청(단일 이미지 추론)** : 이벤트 루프 블로킹 방지를 위해 FastAPI의 `async def` 엔드포인트에서 `run_in_executor` 또는 스레드풀로 GPU 추론 실행.
- **긴 작업(영상 배치 처리)** : `BackgroundTasks` 활용. 부하 증가 시 Celery/RQ 같은 별도 워커 큐로 분리.
	- 진행 상황 조회 API를 별도로 두는 패턴이 일반적
- **실시간 스트리밍** : WebSocket 라우터 분리 (`media/` 또는 `streaming/` 도메인).
- **모델 로딩** : `lifespan` 컨텍스트 매니저로 앱 시작 시 한 번만 로드해 전역에 유지(요청마다 로드하지 않도록) 
	- 이후 `Depends` 로 모델 인스턴스를 각 라우터에 주입

# React 프론트엔드 설계

## Feature 기준 구조 (bulletproof-react 패턴)
- `bulletproof-react(alan 2207)` : 대표 github
- 기술 스택 중심이 아닌 **기능 중심**으로 UI 및 로직 결합
- ESLint(`import/no-restricted-paths`)를 통해 Feature 간 직접 참조 차단 권장
- 예시 구조
```
src/
├── app/               # 라우팅, 전역 프로바이더
├── components/        # 여러 feature에서 공유하는 순수 UI 컴포넌트
├── features/
│   ├── detection/      # 예: 탐지 결과 화면
│   │   ├── api/         # 이 feature 전용 API 호출 훅
│   │   ├── components/  # 이 feature 전용 컴포넌트(BBox 오버레이 등)
│   │   └── hooks/
│   ├── reid-match/      # 예: 매칭 결과 화면
│   └── media-upload/    # 예: 영상 업로드/스트리밍 화면
├── hooks/              # 전역 공유 훅
├── lib/                # 외부 라이브러리 래퍼(axios 인스턴스 등)
└── types/              # 전역 공유 타입
```

## 상태 관리 원칙
- **서버 상태** (추론 결과 등) : `TanStack Query` (React Query) 활용.
	- 캐싱·재요청·로딩상태를 자동 처리해주고, 백엔드 스키마가 바뀌어도 훅 하나만 고치면 됨
- **클라이언트 UI 상태** (모달 창 등) : `useState`, `Zustand` 등 가벼운 도구 사용.
- 서버 상태와 UI 상태 혼합 금지.
	- 서버 상태를 Redux 전역 상태에 억지로 넣지 않기

# FastAPI - React 통합 설계
> OpenAPI 명세 기반 **타입 자동 동기화**. 기획 변경 대응에 가장 핵심적인 요소.

- FastAPI의 Pydantic ↔ OpenAPI ↔ TypeScript 클라이언트 자동 생성
- **장점** : 백엔드 API 응답 구조(필드) 변경 시, 프론트엔드 빌드 시점에 타입 에러로 즉시 인지 가능. "화면 `undefined` 노출 사고" 원천 차단.
- 백엔드에서 필드 하나를 추가/삭제/이름 변경 → 프론트엔드 타입이 자동으로 갱신됨 → 빌드 시점(런타임 아님)에 프론트엔드 코드에서 즉시 타입 에러로 드러남

```mermaid
sequenceDiagram
    participant B as FastAPI (Backend)
    participant O as OpenAPI Spec
    participant F as React (Frontend)
    B->>O: Pydantic 스키마 기반 자동 문서화
    O->>F: 클라이언트 SDK/Type 자동 생성
    Note over F: 백엔드 변경 사항이 빌드 에러로 즉시 감지됨
```

# 요약 디렉토리 구조

```plaintext
lumipet-reid-web/
├── backend/
│   ├── src/
│   │   ├── media/        # 업로드/스트리밍
│   │   ├── detection/    # 객체 탐지 도메인
│   │   ├── reid/         # ReID 매칭 도메인
│   │   ├── results/      # 결과 저장/조회
│   │   ├── core/         # 전역 설정 및 모델 lifespan
│   │   └── main.py
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── video-input/    
│   │   │   ├── detection-view/ 
│   │   │   └── reid-results/   
│   │   └── lib/api-client/     # OpenAPI 기반 자동 생성 클라이언트
└── docker-compose.yml
```

# 학습 자료 및 레퍼런스

| **참고 자료**                             | **성격**                                                                   | **링크**                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `fastapi/full-stack-fastapi-template` | FastAPI + React 통합 레퍼런스 (OpenAPI 클라이언트 자동 생성 포함)                         | [Github 링크](https://github.com/fastapi/full-stack-fastapi-template)           |
| `zhanymkanov/fastapi-best-practices`  | FastAPI 도메인 기준 구조 실무 컨벤션                                                 | [Github 링크](https://github.com/zhanymkanov/fastapi-best-practices)            |
| `alan2207/bulletproof-react`          | React Feature 중심 아키텍처 표준 레퍼런스.문서(`docs/project-structure.md`)만 읽어도 도움이 큼 | [Github 링크](https://github.com/alan2207/bulletproof-react)                    |
| FastAPI - Concurrency                 | 비동기 처리(GPU 추론 블로킹 방지) 원리                                                 | [FastAPI Docs](https://fastapi.tiangolo.com/async/)                           |
| FastAPI 공식 문서 — Bigger Applications   | 공식, 기본기                                                                  | [FastAPI Docs](https://fastapi.tiangolo.com/ko/tutorial/bigger-applications/) |
| TanStack Query 공식 문서                  | 서버 상태 관리(React)                                                          | [TanStackQuery](https://tanstack.com/query/latest)                            |


# 검색 방법 팁

- "FastAPI large application structure", "FastAPI domain driven structure" — 구조 관련 최신 글 검색
- "React feature-based architecture", "React screaming architecture" — 프론트 구조 관련
- "OpenAPI TypeScript client generation" 또는 "openapi-typescript-codegen", "orval" — 자동 클라이언트 생성 도구 비교
- GitHub 검색 시 `stars:>1000 fastapi react template` 형태로 필터링하면 검증된 저장소만 걸러볼 수 있음
- 저장소를 고를 때는 최근 커밋 날짜(활발히 유지보수되는지)와 Issues/PR 논의 내용(실무에서 겪는 문제와 해법)을 함께 보는 것이 문서 자체보다 더 유용한 경우가 많습니다