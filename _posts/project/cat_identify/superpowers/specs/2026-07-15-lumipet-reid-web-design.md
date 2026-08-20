# (CatHealth) Lumipet Re-ID Web Service 아키텍처 및 연동 설계 명세서

- **작성일**: 2026-07-15
- **작성자**: Antigravity (AI Coding Assistant)
- **상태**: 설계 승인 완료 (로컬 임시 저장, Git 커밋 제외)

> 이 문서는 `lumipet-reid` 고양이 재식별(Re-ID) 파이프라인을 활용한 웹 풀스택 서비스의 아키텍처 설계 사양을 정의합니다.

---

## 1. 개요 및 설계 원칙

### 1-1. 프로젝트 목표
* 기존의 Python 기반 고양이 재식별 코어 파이프라인(`lumipet-reid`)을 웹 인터페이스로 노출하여 비디오/이미지를 업로드하고 결과를 시각적으로 분석 및 검증하는 서비스를 구축.
* 1단계 목표: 로컬 비디오/이미지를 업로드하여 BBox 오버레이 및 ReID 매칭 분석 결과를 웹 화면에 실시간 렌더링.

### 1-2. 핵심 설계 원칙
* **도메인(Feature) 중심 구조**: 백엔드와 프론트엔드 모두 기술 분류가 아닌 기능 단위로 모듈을 격리하여 기획 변경에 대응.
* **타입 안전성(Type Sync)**: 백엔드의 OpenAPI 명세와 프론트엔드의 TypeScript 타입을 자동 결합하여 빌드 타임에 API 변경을 실시간 감지.
* **논블로킹 추론**: FastAPI 싱글 스레드 이벤트 루프가 GPU/CPU 추론 연산으로 인해 정지되지 않도록 스레드풀 및 백그라운드 태스크로 분리 처리.

---

## 2. 모노레포 구조 및 개발 환경 (Phase 0)

### 2-1. 디렉터리 레이아웃
웹 풀스택 모노레포인 `lumipet-reid-web` 폴더를 새로이 구성하고 아래와 같이 구조화합니다.

```plaintext
lumipet-reid-web/                   # (신규) 웹 서비스 모노레포 루트
├── .gitignore                      # 웹 전용 git 설정 파일 (임시 파일 배제)
├── AGENTS.md                       # 개발 에이전트 코딩 표준 가이드
├── backend/                        # FastAPI 백엔드
│   ├── pyproject.toml              # Ruff 린터 및 포맷터 설정
│   ├── requirements.txt            # 백엔드 의존성 기술
│   └── src/
│       ├── main.py                 # FastAPI 진입점 및 Lifespan(싱글턴 모델 관리)
│       ├── core/                   # 전역 설정 및 로깅
│       ├── ai/                     # AI 인프라 실행 전담 계층 (HTTP 독립적)
│       │   ├── engine.py           # ReIdModel 싱글턴 적재 및 보관
│       │   └── inference.py        # predict_video, predict_image 래퍼
│       ├── media/                  # 도메인 1: 업로드 미디어 영구/임시 파일 관리
│       │   ├── router.py
│       │   ├── service.py
│       │   └── schemas.py
│       └── reid/                   # 도메인 2: Re-ID 연산 및 백그라운드 태스크 관리
│           ├── router.py
│           ├── service.py          # 태스크 생성, 진행률 업데이트, 결과 조회
│           └── schemas.py
└── frontend/                       # React + Vite + TypeScript 프론트엔드
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── app/                    # 글로벌 라우팅 및 상태 프로바이더
        ├── components/             # 도메인 무관 공유 UI 컴포넌트
        ├── lib/api-client/         # OpenAPI 기반 생성된 TS API 클라이언트
        └── features/               # 기능 단위로 캡슐화된 코드
            ├── video-input/        # 미디어 파일 드래그앤드롭 업로드
            ├── viewer/             # Canvas 오버레이 BBox 렌더링 뷰어
            └── db-management/      # 등록 고양이 DB 및 개체 정보 카드 목록
```

---

## 3. Re-ID 코어 (`lumipet-reid`) 호환성 수정 설계

웹 백엔드와 안정적으로 호환되도록 기존 `lumipet-reid` 패키지의 인터페이스를 개선합니다.

### 3-1. CLI 인자 파싱 오염 차단 ([config.py](file:///home/jhj/project_ws/lumipet_ws/lumipet-reid/reid/core/config.py))
* `Config.load(..., args: Optional[List[str]] = None)` 메서드 수정.
* `args`가 명시적으로 전달될 경우 `sys.argv[1:]`을 파싱하지 않고 전달받은 `args`를 기준으로 로드하도록 변경. 웹 백엔드 구동 시에는 `args=[]`를 호출하여 서버 인수 오염을 완벽히 방지.

### 3-2. 동적 결과 저장 경로 및 콜백 설계 ([predictor.py](file:///home/jhj/project_ws/lumipet_ws/lumipet-reid/reid/engine/predictor.py))
* `default.yaml` 및 `Config` 클래스에 `save_path: null` 속성 추가.
* `BasePredictor.predict(..., save_path: Optional[str] = None, on_frame: Optional[Callable[[int, int, Any], None]] = None)`으로 파라미터 확장.
* `save_path` 지정 시 하드코딩된 `"output.mp4"` 및 `"output_result.png"` 대신 해당 타겟 파일 경로에 쓰기를 수행하여 동시성 쓰기 충돌 회적 차단.
* `on_frame` 콜백 함수를 매 프레임 추론 루프가 도는 시점에 `on_frame(current_frame, total_frames, result)` 형식으로 호출하여 실시간 진행상황 조회 지원.

---

## 4. 백엔드 비동기 태스크 및 API 설계 (Phase 1)

### 4-1. 태스크 상태 자료구조
메모리 내에 비디오 분석 진행 현황을 저장하는 간단한 스토어를 구축합니다.

```python
class TaskStatus(BaseModel):
    task_id: str
    status: str  # "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"
    progress: float  # 0.0 ~ 100.0
    processed_frames: int
    total_frames: int
    result: Optional[List[dict]] = None
    output_video_url: Optional[str] = None
    error: Optional[str] = None
```

### 4-2. 추론 비동기 오프로딩 메커니즘
1. 사용자가 비디오/이미지를 업로드하고 분석 요청을 전달하면 즉시 `task_id`와 `"PENDING"` 상태를 리턴.
2. 실제 분석 연산은 FastAPI의 `BackgroundTasks`를 통해 별도 스레드에서 수행.
3. `predictor.predict` 호출 시 콜백을 등록하여 백그라운드 스레드에서 태스크 상태 맵의 `progress`와 `status`를 실시간 갱신.

### 4-3. API 사양서
* `POST /media/upload`: 미디어 업로드. 업로드 성공 시 임시 폴더에 비디오를 저장하고 `media_id` 반환.
* `POST /reid/predict`: 지정된 `media_id`에 대해 Re-ID 태스크를 기동하고 `task_id`를 즉시 반환.
* `GET /reid/tasks/{task_id}`: 진행률, 작업 상태 및 최종 분석 결과를 확인하기 위한 폴링 API.
* `GET /reid/cats`: SQLite DB에서 현재 등록된 고양이들의 명단 및 임베딩 수 통계를 확인.
* `POST /reid/cats`: 지정 고양이 이름(label)과 등록용 대표 이미지들을 업로드하여 피처 데이터베이스에 등록.
* `DELETE /reid/cats/{label}`: 피처 데이터베이스에서 특정 고양이 개체 삭제.

---

## 5. 프론트엔드 뷰어 및 타입 자동화 설계 (Phase 2)

### 5-1. React Query 기반 진행률 폴링
* 프론트엔드는 비디오 업로드 후 반환된 `task_id`를 기반으로 `GET /reid/tasks/{task_id}` API를 1초 간격으로 폴링 (`refetchInterval: 1000`).
* 응답 데이터의 `status`가 `"COMPLETED"` 또는 `"FAILED"`로 변경되면 자동으로 폴링을 일시 중지(`enabled: false`).

### 5-2. 캔버스 기반 BBox 렌더링
* `<video>` 요소의 재생 진행 이벤트를 수신하여 현재 재생 중인 타임스탬프 또는 프레임 인덱스 추출.
* 비디오 레이어 바로 위에 절대 배치된 `<canvas>` 영역을 구성하고, 현재 프레임 인덱스에 매칭되는 BBox 좌표를 비율에 맞춰 실시간으로 재드로잉.
* BBox 위에 고양이 이름과 매칭 유사도(Confidence) 텍스트 오버레이 출력.

### 5-3. Hey-API 타입 동기화 파이프라인
* 백엔드의 FastAPI Swagger 스펙(`openapi.json`)을 프론트엔드가 감지해 클라이언트를 빌드 타임에 재생성.
* 백엔드의 반환 필드명 혹은 자료형 변동 시, 프론트엔드 소스코드 컴파일 시점에서 빌드 크래시를 유발하여 런타임 버그 사전 배제.

---

## 6. 테스트 및 검증 설계 (Phase 3)

### 6-1. 비동기 테스트 환경 구축
* 백엔드 내에 `httpx.AsyncClient`와 `ASGITransport`를 사용한 통합 API 시나리오 테스트 코드를 구축하여 DB 연동 및 백그라운드 태스크 생명주기 검증.

### 6-2. 미디어 입력 및 렌더링 검증
* 테스트 이미지 및 비디오(`use_db.mp4`)를 웹 프론트에 업로드해 BBox가 원본 고양이 위치와 틀어짐 없이 일치하여 드로잉되는지 육안 확인.
* 다수의 웹 탭에서 동시 업로드 후 분석을 실행하여 파일 쓰기 락(Lock) 충돌 없이 병렬로 비동기 실행되는지 검사.

### 6-3. 타입 세이프티 리허설
* 백엔드 Pydantic 모델의 주요 필드명을 임의로 고쳐 Swagger 문서에 동기화시켰을 때, 프론트엔드 React 빌드 명령어 실행 시 타겟 타입 불일치 에러를 정상 포착해 빌드를 중단하는지 검증.
