---
title: (CatHealth) DB 및 배치 설정 관련 성능 저하 원인 해결
post_order: 8
thumbnail: /assets/images/project/CatHealth/thumnail/cat_reid_thumnail_08.png
layout: post
author: jhj
categories:
  - Project
  - CatHealth
tags:
  - AI
  - ComputerVision
  - Python
  - reid
  - SQLlite
excerpt: SQLite 데이터베이스 도입 및 배치 처리 최적화 과정에서 초래된 Re-ID 인식 성능 저하의 BGR/RGB 채널 불일치 원인 분석 및 해결 방안 수립
---

# Re-ID 성능 저하 원인 분석 및 해결 보고서

> 데이터베이스 포맷 교체(SQLite) 및 배치 최적화 이후, 모델 변경이 없었음에도 매칭 정확도가 급감한 현상의 근본 원인(BGR/RGB 채널 교차 오류) 규명 및 교정 조치 보고.

## 근본 원인 분석

### 전처리 단계의 채널 순서 불일치 (RGB vs BGR Mismatch)
- **기존 레거시 동작**:
  - **등록(Register)**: OpenCV `cv2.imread`로 단일 이미지 적재 후 PIL `Image.fromarray` 거쳐 전처리 수행. OpenCV의 기본 BGR 출력을 PIL이 RGB로 인식해 R(Red) 및 B(Blue) 채널이 뒤바뀐 채 가중치 모델에 주입됨
  - **예측(Predict)**: 동영상 프레임 크롭 단계에서도 BGR numpy array 상태로 PIL을 호출하여 동일하게 채널이 오폭 스왑된 채 추론됨
  - **결과**: 비정상 데이터 분포였으나 Gallery(DB)와 Query(실시간 입력) 양측 모두 채널 스왑 상태의 일관성을 유지해 비정상적인 상태에서도 매칭이 동작함
- **배치 처리 최적화 도입 이후 동작**:
  - **등록(Register)**: 대량 이미지 고속 적재를 위해 배치 학습 로직으로 전환하면서 PIL `Image.open().convert('RGB')` 표준 파일 로딩 사용. DB에 **정상적인 RGB 정합성**의 특징 벡터 축적 완료
  - **예측(Predict)**: 예측 크롭 연산부는 기존 OpenCV 기반 슬라이싱을 유지하여 **채널이 뒤바뀐 BGR 정보**로 임베딩을 연산함
  - **결과**: 정상 RGB 분포의 Gallery DB와 BGR 스왑 상태의 Query 벡터 간의 매칭 시도로 피처 공간 불일치가 유발되어 인식률 급락 초래

### 데이터베이스 로딩 시 모델 식별자 필터링 누락
- `ReIdPredictor` 초기화 단계에서 DB 조회를 위한 `extractor.store.get_all()` 호출 시 `model_name` 매개변수 누락
- SQLite DB 내 적재된 다양한 백본 모델 또는 가중치 버전의 특징 정보가 함께 로딩되는 오염 현상 발생
- 임베딩 차원수 불일치 시 `vstack` 병합 단계에서 프로그램이 강제 크래시를 일으키며, 차원이 유사한 경우 이종 모델 벡터 간 충돌로 오인식 가중

## 해결 방법 및 패치 내역

### 입력 소스 채널 보정 (`BGR -> RGB` 전환)
- [reid/models/extractor/predict.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/extractor/predict.py) 전처리 코드 패치 적용
- numpy ndarray 유입 시 BGR 3채널 검사 후 채널 순서를 반전하여 정상 RGB 배열로 변환하도록 보정 완료 (메모리 복사 방지를 위한 슬라이싱 활용)
  ```python
  elif isinstance(im, np.ndarray):
      if im.ndim == 3 and im.shape[2] == 3:
          im = im[:, :, ::-1]  # BGR에서 RGB로 교정
      im = Image.fromarray(im)
  ```
- 이 조치를 통해 대량 DB 등록 배치와 실시간 예측 프레임 모두 올바른 RGB 포맷 하에 추론되도록 통일 수행

### 데이터베이스 조회 시 활성 모델 필터 적용
- [reid/models/reid/predict.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/models/reid/predict.py)의 쿼리 호출부에 현재 활성화된 모델 고유 속성(`model_name`) 인자 주입 강제화
  ```python
  embeddings, labels = extractor.store.get_all(model_name=extractor.cfg.model_name)
  ```
- 타 모델 적재 내역 식별 시 경고 출력 및 재정렬 유틸리티 가이드 메시지 송출 구현

### CLI 등록 로직의 단일 이미지 예외 복원
- [reid/cli.py](file:///home/jhj/project_ws/lumipet_ws/re-id_test/reid/cli.py) 내 `register` 실행 분기 분석을 거쳐 디렉토리뿐 아니라 단일 이미지 경로도 올바르게 파악하여 처리하도록 호환성 수정

## 추후 작업 시 주의사항 및 개발 가이드

- **컬러 스페이스 상호 연동 정합성 사전 검증**:
  - OpenCV(BGR 출력)와 PIL/torchvision(RGB 입력) 라이브러리 간 교차 변환 발생 시 채널 순서 교정 검증 필수화
  - 가공 이미지 전송 전 차원 및 첫/마지막 채널의 원시 데이터 대조 확인
- **데이터 아키텍처 스키마 및 가중치 버전 결합 관리**:
  - 백본 구조 갱신 및 프로젝션 레이어 재학습 시 임베딩 물리적 특성이 변경되므로 DB의 `model_name` 필드로 데이터 정합성을 항시 강제 분할 관리 요망
- **마이그레이션 도구 적극 사용**:
  - 모델 가중치(`.pth`) 업데이트 및 이미지 가공 로직 수정 시, 기존 DB는 폐기 후 `reid migrate` 명령을 호출하여 원본 리소스 기반 신규 임베딩 재빌드 절차 수행 필요
