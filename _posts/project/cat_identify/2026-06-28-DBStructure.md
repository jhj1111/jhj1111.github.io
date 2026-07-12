---
title: (CatHealth) SQLite DB 마이그레이션 및 배치 등록
post_order: 7
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_07.png
layout: post
author: jhj
categories:
  - Project
  - CatHealth
tags:
  - AI
  - ComputerVision
  - Python
  - TFLite
  - Datasets
excerpt: 기존 NumPy npz 기반 임베딩 적재 방식의 한계를 개선한 SQLite 데이터베이스 전환 설계 및 중복 방지 배치 등록 메커니즘
---

# SQLite 기반 데이터베이스 설계 및 배치 등록 명세서

> 기존 NumPy `.npz` 적재 방식의 동시성 및 정보 관리 한계를 극복하기 위해 SQLite 백엔드로 전환하고, MD5 해시 중복 제거 기반의 배치 등록 메커니즘 도입 명세.

## 개요 및 목표

### 기존 NumPy npz 보관 방식의 문제점
- **순차 처리 오버헤드**: 신규 개체 등록(`register`) 시 이미지를 1장씩 순차 연산하여 `predict_batch` 기능 미활용으로 대량 등록 시 소요 시간 극대화
- **메타데이터 결여**: 원본 이미지 절대/상대 경로 및 해시 정보를 유실하여 동일 이미지 중복 등록 방지 불가
- **모델 변경 시 재추출 불가능**: 기존 등록에 활용한 원본 소스 유실로 백본 모델 변경 시 피처 마이그레이션이 불가능한 구조적 한계 존재
- **Race Condition 유발**: 다수 웹 데몬 진입 시 파일 전체 락(Lock)에 의한 동시 수정 충돌 우려
- **비구조적 데이터**: 특징 리스트 및 NumPy Array 타입이 혼재되어 상태 관리 복잡성 유발

### 데이터베이스 리팩토링 설계 목표
- 파일 I/O 속도 개선을 위한 내장 **SQLite 데이터베이스** 엔진 마이그레이션 수행
- 중복 업로드 방지용 **MD5 해시 유일성 인덱스** 적용
- 대량 이미지 적재용 **배치 등록(Batch Registration)** 아키텍처 도입
- 관리 효율 증대를 위한 목록 조회(`list`), 삭제(`delete`), 마이그레이션(`migrate`) 명령어 지원

## 데이터베이스 스키마

Python 내장 `sqlite3` 드라이버를 활용해 데이터베이스를 구성함. 설정 호환을 위해 기존 `.npz` 경로 인입 시 자동으로 `.db` 확장자로 매핑 전환함.

### embeddings 테이블 정의

```sql
CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,              -- 개체 식별 라벨 (고양이 이름)
    embedding BLOB NOT NULL,          -- 1차원 float32 NumPy 임베딩 배열 바이트 직렬화
    image_path TEXT,                  -- 원본 이미지 상대 파일 경로
    image_hash TEXT UNIQUE,           -- 중복 방지 검증용 MD5 해시값 (유일성 제약)
    model_name TEXT NOT NULL,         -- 임베딩 연산에 사용된 모델 식별자
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_embeddings_label ON embeddings(label);
CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON embeddings(image_hash);
```

## 컴포넌트 인터페이스 설계

### EmbeddingStore (`reid/models/extractor/embedding.py`)
- SQLite 데이터베이스 입출력 트랜잭션을 전담 제어함

```python
class EmbeddingStore:
    def __init__(self, db_path: str = "embeddings/db.db"):
        # .npz 경로 지정 시 자동으로 .db 변경 로직 실행 및 sqlite3 커넥션 바인딩
        pass
        
    def add(self, embedding: np.ndarray, label: str, image_path: str, image_hash: str, model_name: str) -> None:
        # 단일 임베딩 삽입 처리
        pass
        
    def add_batch(self, embeddings: np.ndarray, labels: list[str], image_paths: list[str], image_hashes: list[str], model_name: str) -> None:
        # 단일 커밋 트랜잭션을 통한 대량 삽입 기능 제공
        pass
        
    def get_all(self, model_name: str = None) -> tuple[np.ndarray, list[str]]:
        # model_name 일치 임베딩 데이터 셋 일괄 로딩. 타 모델 적재 확인 시 경고 출력
        pass
        
    def list_labels(self) -> dict[str, int]:
        # 등록 개체 명단 및 적재 수량 통계 반환
        pass
        
    def delete_label(self, label: str) -> int:
        # 특정 개체 데이터 일괄 제거 및 영향 행 수 반환
        pass
        
    def clear(self) -> None:
        # 테이블 전체 레코드 제거
        pass
```

## 배치 등록 흐름

### 스캔 및 해시 필터링 단계
- 등록 대상 디렉토리 내부 이미지 탐색 후 개별 이미지 파일에 대한 MD5 해시값 산출
- DB 내 기저장 해시 리스트(`SELECT image_hash FROM embeddings`)와 대조 수행하여 중복 이미지 파일은 등록 리스트에서 사전 제외 처리

### Batch Feature Extraction 실행 단계
- 신규 고유 이미지 대상 리스트를 `cfg.batch_size` (기본값 16) 슬라이스 윈도우 단위로 분할
- 각 슬라이스 배치 단위로 `predict_batch()` API를 1회 호출해 병렬 그래픽카드 코어 추론 처리 및 임베딩 획득
- `add_batch()`를 수행하여 단일 트랜잭션 데이터베이스 반영 완료

## 데이터베이스 관리 CLI 설계

- **reid list**: 등록 완료된 전체 고양이 목록 및 개체별 보유 임베딩 건수 정보 통계 포맷 출력
- **reid delete label=<Nabi>**: 지정한 라벨 명칭에 속하는 이미지 임베딩 정보 일괄 완전 삭제
- **reid migrate**: DB 내부 저장 이미지 상대 경로를 탐색하여 최신 가중치 모델 기반 배치 추론을 재수행하고 신규 임베딩 및 모델명으로 마이그레이션 일괄 업데이트 수행