# 갤러리 등록 품질 검증 및 Re-ID 적합성 진단 시스템 구현 계획 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고양이 Re-ID 등록 파이프라인의 오탐(False Positive) 방지를 위해 엄격한 품질 필터링(Strict Quality Gate), BBox 종횡비와 임베딩 Medoid를 결합한 2단계 포즈 다양성 진단, 100점 만점 적합성 점수화, 그리고 SQLite 2계층 캐싱 시스템을 구축합니다.

**Architecture:** 등록 시 YOLOv8 검출 및 선명도/해상도/조도 기반 Strict 필터링을 거쳐 고품질 크롭만 추출기에 전달합니다. 개체 등록 데이터셋 내부의 BBox 종횡비 분포와 임베딩 상호 중심성(Centrality)으로 `Front Anchor(Medoid)`를 선별하여 상대적 포즈 다양성을 평가하고, 종합 적합도(0~100점)와 추천 가이드를 산출하여 SQLite `embeddings` 및 `identity_profiles` 테이블에 원자적으로 캐싱합니다.

**Tech Stack:** Python 3.12, PyTorch, OpenCV (`cv2`), SQLite3, NumPy, YOLOv8 (Ultralytics), pytest

---

## 작업 전제 조건 및 규칙
- **Branch 관리**: 사용자가 직접 관리하므로 별도의 Git Worktree는 생성하지 않습니다.
- **Git Commit**: 모든 구현 및 단위 테스트 검증 완료 후, 사용자의 최종 확인 및 요청 시 단계별로 커밋을 진행합니다.
- **웹 API 연동**: 향후 FastAPI/React 연동을 위한 DTO 메서드는 코드 상에 `TODO` 주석으로 명시합니다.

---

## File Structure

```text
reid/
├── cfg/
│   └── default.yaml                          # [Modify] 등록 품질 관련 기본 설정 추가
├── core/
│   ├── config.py                             # [Check] 설정 바인딩 확인
│   └── quality.py                            # [Create] QualityMetrics, SuitabilityReport DTO 및 RegistrationQualityInspector
├── models/
│   └── extractor/
│       ├── embedding.py                      # [Modify] identity_profiles 테이블, 컬럼 확장, 스키마 마이그레이션
│       └── model.py                          # [Modify] register()에 YOLO 검출, Strict 필터, 프로필 자동 생성 연동
├── cli.py                                    # [Modify] reid list 등급 출력, reid inspect 핸들러, reid migrate 연동
└── config.yaml                               # [Modify] 등록 품질 임계치 설정 반영

tests/
├── test_quality_inspector.py                 # [Create] 품질 검사 및 BBox-Medoid 적합도 산출 단위 테스트
├── test_embedding_store_profiles.py          # [Create] SQLite identity_profiles 및 확장 컬럼 CRUD 테스트
├── test_register_quality.py                  # [Create] Strict 등록 및 Lazy Auto-fill 통합 테스트
└── test_cli_quality.py                       # [Create] CLI inspect, list, migrate 적합도 출력 테스트
```

---

## Tasks

### Task 1: DTO 및 품질 검사/적합성 진단 엔진 구현 (`reid/core/quality.py`)

**Files:**
- Create: `reid/core/quality.py`
- Test: `tests/test_quality_inspector.py`

- [x] **Step 1: 실패하는 단위 테스트 작성 (`tests/test_quality_inspector.py`)**

```python
import numpy as np
import pytest
from reid.core.quality import (
    QualityMetrics,
    SuitabilityReport,
    RegistrationQualityInspector,
    StatusLevel
)

def test_quality_metrics_dto():
    qm = QualityMetrics(
        blur_score=45.2,
        crop_w=200,
        crop_h=250,
        aspect_ratio=0.8,
        det_conf=0.92,
        is_valid=True,
        quality_score=85.0
    )
    assert qm.is_valid is True
    assert qm.quality_score == 85.0

def test_inspect_single_crop_blur_and_size():
    inspector = RegistrationQualityInspector(min_blur=30.0, min_size=64, min_conf=0.60)
    
    # 1. Very small crop (invalid)
    tiny_crop = np.zeros((32, 32, 3), dtype=np.uint8)
    res_tiny = inspector.inspect_single_crop(tiny_crop, det_conf=0.9)
    assert res_tiny.is_valid is False
    assert res_tiny.crop_w == 32
    
    # 2. Solid color crop (low blur variance -> invalid)
    solid_crop = np.full((128, 128, 3), 128, dtype=np.uint8)
    res_solid = inspector.inspect_single_crop(solid_crop, det_conf=0.9)
    assert res_solid.is_valid is False
    assert res_solid.blur_score < 5.0
    
    # 3. High texture / sharp crop (valid)
    np.random.seed(42)
    sharp_crop = np.random.randint(0, 255, (128, 128, 3), dtype=np.uint8)
    res_sharp = inspector.inspect_single_crop(sharp_crop, det_conf=0.85)
    assert res_sharp.is_valid is True
    assert res_sharp.blur_score >= 30.0

def test_evaluate_identity_bbox_medoid():
    inspector = RegistrationQualityInspector()
    
    # Generate 5 normalized mock embeddings (dim=128)
    np.random.seed(100)
    base_vec = np.random.randn(128)
    base_vec /= np.linalg.norm(base_vec)
    
    # 3 Front candidates (close to base_vec), 2 Side candidates
    e1 = base_vec + np.random.randn(128) * 0.05
    e2 = base_vec + np.random.randn(128) * 0.02
    e3 = base_vec + np.random.randn(128) * 0.04
    e4 = -base_vec + np.random.randn(128) * 0.2
    e5 = np.random.randn(128)
    
    embeddings = np.array([e / np.linalg.norm(e) for e in [e1, e2, e3, e4, e5]], dtype=np.float32)
    aspect_ratios = [0.65, 0.68, 0.72, 1.30, 1.45]
    qualities = [
        QualityMetrics(50.0, 200, 300, 0.65, 0.95, True, 90.0),
        QualityMetrics(60.0, 200, 300, 0.68, 0.95, True, 95.0),
        QualityMetrics(45.0, 200, 300, 0.72, 0.90, True, 88.0),
        QualityMetrics(40.0, 300, 200, 1.30, 0.88, True, 80.0),
        QualityMetrics(42.0, 320, 220, 1.45, 0.85, True, 82.0),
    ]
    
    report = inspector.evaluate_identity(embeddings, aspect_ratios, qualities, label="Nabi")
    
    assert report.label == "Nabi"
    assert report.sample_count == 5
    assert report.front_anchor_idx in [0, 1, 2]
    assert report.total_score > 60.0
    assert report.status_level in [StatusLevel.EXCELLENT, StatusLevel.GOOD]
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `pytest tests/test_quality_inspector.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'reid.core.quality'`

- [ ] **Step 3: `reid/core/quality.py` 구현**

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Any
import cv2
import numpy as np


class StatusLevel(str, Enum):
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    WARN = "WARN"
    POOR = "POOR"
    UNCHECKED = "UNCHECKED"


@dataclass
class QualityMetrics:
    blur_score: float
    crop_w: int
    crop_h: int
    aspect_ratio: float
    det_conf: float
    is_valid: bool
    quality_score: float


@dataclass
class SuitabilityReport:
    label: str
    sample_count: int
    total_score: float
    quality_avg: float
    consistency_score: float
    diversity_score: float
    status_level: StatusLevel
    recommendations: List[str] = field(default_factory=list)
    front_anchor_idx: Optional[int] = None

    # TODO: 향후 FastAPI 백엔드 및 React 웹 대시보드 연동 시 to_dict / JSON 직렬화 지원 확장


class RegistrationQualityInspector:
    """등록 전용 엄격 품질 검증 및 BBox-Medoid 결합형 Re-ID 적합성 진단 엔진."""
    def __init__(
        self,
        min_blur: float = 30.0,
        min_size: int = 64,
        min_conf: float = 0.60
    ) -> None:
        self.min_blur = min_blur
        self.min_size = min_size
        self.min_conf = min_conf

    def inspect_single_crop(self, crop: np.ndarray, det_conf: float) -> QualityMetrics:
        """단일 크롭 이미지의 블러, 해상도, 조도 및 유효성을 판별하고 품질 점수를 산출합니다."""
        if crop is None or crop.size == 0:
            return QualityMetrics(0.0, 0, 0, 1.0, float(det_conf), False, 0.0)

        h, w = crop.shape[:2]
        aspect_ratio = float(w) / float(max(h, 1))

        # Size check
        if w < self.min_size or h < self.min_size:
            return QualityMetrics(0.0, w, h, aspect_ratio, float(det_conf), False, 0.0)

        # Confidence check
        if det_conf < self.min_conf:
            return QualityMetrics(0.0, w, h, aspect_ratio, float(det_conf), False, 0.0)

        # Blur check (Laplacian variance)
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        blur_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if blur_var < self.min_blur:
            return QualityMetrics(blur_var, w, h, aspect_ratio, float(det_conf), False, 0.0)

        # Illumination check
        mean_brightness = float(np.mean(gray))
        if mean_brightness < 25.0 or mean_brightness > 235.0:
            return QualityMetrics(blur_var, w, h, aspect_ratio, float(det_conf), False, 0.0)

        # Compute single-image quality score (0 ~ 100)
        # Blur factor (up to 40 pts) + Resolution factor (up to 30 pts) + Conf factor (up to 30 pts)
        s_blur = min(40.0, (blur_var / 50.0) * 40.0)
        s_res = min(30.0, (min(w, h) / 256.0) * 30.0)
        s_conf = min(30.0, (det_conf / 1.0) * 30.0)
        quality_score = float(np.clip(s_blur + s_res + s_conf, 0.0, 100.0))

        return QualityMetrics(
            blur_score=blur_var,
            crop_w=w,
            crop_h=h,
            aspect_ratio=aspect_ratio,
            det_conf=float(det_conf),
            is_valid=True,
            quality_score=quality_score
        )

    def evaluate_identity(
        self,
        embeddings: np.ndarray,
        aspect_ratios: List[float],
        qualities: List[QualityMetrics],
        label: str
    ) -> SuitabilityReport:
        """BBox 종횡비 + Medoid 결합형 Front Anchor 선정 및 종합 적합도를 평가합니다."""
        n_samples = len(embeddings)
        recommendations = []

        if n_samples == 0:
            return SuitabilityReport(
                label=label,
                sample_count=0,
                total_score=0.0,
                quality_avg=0.0,
                consistency_score=0.0,
                diversity_score=0.0,
                status_level=StatusLevel.POOR,
                recommendations=["등록된 유효 사진이 없습니다. 재등록이 필요합니다."]
            )

        # 1. Quality Average Score (0 ~ 30 pts)
        raw_quality_avg = float(np.mean([q.quality_score for q in qualities])) if qualities else 0.0
        s_quality = (raw_quality_avg / 100.0) * 30.0
        if raw_quality_avg < 40.0:
            recommendations.append("선명도 저조: 일부 사진의 해상도가 낮거나 흔들렸습니다. 선명한 고화질 사진을 권장합니다.")

        # 2. Detection Score (0 ~ 20 pts)
        raw_conf_avg = float(np.mean([q.det_conf for q in qualities])) if qualities else 0.0
        s_detect = min(20.0, raw_conf_avg * 20.0)

        # 3. Consistency Score (0 ~ 25 pts)
        if n_samples == 1:
            s_consistency = 15.0
            s_diversity = 5.0
            front_anchor_idx = 0
            recommendations.append("등록 장수 부족: 현재 1장만 등록되어 있습니다. 최소 3~5장 이상 등록을 권장합니다.")
        else:
            # Pairwise cosine similarity matrix
            sim_matrix = np.dot(embeddings, embeddings.T)
            # Upper triangular without diagonal
            triu_indices = np.triu_indices(n_samples, k=1)
            pair_sims = sim_matrix[triu_indices]
            mean_sim = float(np.mean(pair_sims))

            if mean_sim < 0.50:
                s_consistency = 0.0
                recommendations.append("오라벨링 의심: 등록된 사진들 간의 유사도가 매우 낮습니다. 다른 고양이 사진 혼입 여부를 확인해 주세요.")
            elif mean_sim < 0.65:
                s_consistency = float((mean_sim - 0.50) / 0.15 * 15.0 + 10.0)
            else:
                s_consistency = 25.0

            # 4. Pose Diversity (BBox + Medoid Anchor, 0 ~ 25 pts)
            front_anchor_idx = self._select_front_anchor(aspect_ratios, embeddings)
            anchor_emb = embeddings[front_anchor_idx]
            
            # Cosine distances from anchor (1 - cos_sim)
            dists = 1.0 - np.dot(embeddings, anchor_emb)
            dist_variance = float(np.var(dists))
            dist_range = float(np.ptp(dists))

            # Sample count component (up to 15 pts)
            s_count = min(15.0, (n_samples / 4.0) * 15.0)
            if n_samples < 3:
                recommendations.append(f"등록 장수 부족: 현재 {n_samples}장 등록되어 있습니다. 최소 3~5장 이상 등록을 권장합니다.")

            # Spread variance component (up to 10 pts)
            # A healthy variance/range indicates multi-angle coverage
            if dist_range < 0.08:
                s_spread = 2.0
                recommendations.append("시점 편향: 정면 등 특정 각도 위주로 등록되었습니다. 고양이의 '좌/우 측면 몸통' 사진을 추가해 주세요.")
            elif dist_range < 0.15:
                s_spread = 6.0
            else:
                s_spread = 10.0

            s_diversity = float(s_count + s_spread)

        total_score = float(np.clip(s_quality + s_detect + s_consistency + s_diversity, 0.0, 100.0))

        # Status level
        if s_consistency == 0.0 or total_score < 50.0:
            status_level = StatusLevel.POOR
        elif total_score < 70.0:
            status_level = StatusLevel.WARN
        elif total_score < 85.0:
            status_level = StatusLevel.GOOD
        else:
            status_level = StatusLevel.EXCELLENT
            if not recommendations:
                recommendations.append("최적 등록 상태: 다각도 및 고화질 데이터가 고르게 확보되어 실시간 Re-ID에 최적화되었습니다.")

        return SuitabilityReport(
            label=label,
            sample_count=n_samples,
            total_score=round(total_score, 1),
            quality_avg=round(raw_quality_avg, 1),
            consistency_score=round(s_consistency, 1),
            diversity_score=round(s_diversity, 1),
            status_level=status_level,
            recommendations=recommendations,
            front_anchor_idx=front_anchor_idx
        )

    def _select_front_anchor(self, aspect_ratios: List[float], embeddings: np.ndarray) -> int:
        """BBox 종횡비 분포로 정면 후보군을 좁히고, 후보군 내 Medoid를 선정합니다."""
        n = len(aspect_ratios)
        if n == 1:
            return 0

        # Sort indices by aspect ratio (smaller ratio = more vertical/front-like)
        sorted_indices = np.argsort(aspect_ratios)
        
        # Pick top 40% (at least 2 if n >= 2) as front candidates
        n_candidates = max(2, int(np.ceil(n * 0.4)))
        candidate_indices = sorted_indices[:n_candidates]

        if len(candidate_indices) == 1:
            return int(candidate_indices[0])

        candidate_embeddings = embeddings[candidate_indices]
        # Candidate pairwise distance matrix
        cand_sim = np.dot(candidate_embeddings, candidate_embeddings.T)
        cand_dist = 1.0 - cand_sim
        # Medoid: Candidate with minimal average distance to others
        centralities = np.mean(cand_dist, axis=1)
        best_cand_idx = int(np.argmin(centralities))

        return int(candidate_indices[best_cand_idx])
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `pytest tests/test_quality_inspector.py -v`
Expected: PASS (모든 단위 테스트 통과)

---

### Task 2: SQLite DB 스키마 확장 및 프로필 캐싱 구현 (`reid/models/extractor/embedding.py`)

**Files:**
- Modify: `reid/models/extractor/embedding.py`
- Test: `tests/test_embedding_store_profiles.py`

- [ ] **Step 1: 실패하는 단위 테스트 작성 (`tests/test_embedding_store_profiles.py`)**

```python
import sqlite3
import numpy as np
import pytest
from pathlib import Path
from reid.models.extractor.embedding import EmbeddingStore
from reid.core.quality import SuitabilityReport, StatusLevel

def test_embedding_store_schema_migration(tmp_path):
    db_file = tmp_path / "test_store.db"
    store = EmbeddingStore(str(db_file))
    
    # Verify tables created
    cursor = store.conn.cursor()
    cursor.execute("PRAGMA table_info(embeddings)")
    cols = {row[1] for row in cursor.fetchall()}
    
    for expected_col in ["blur_score", "crop_w", "crop_h", "aspect_ratio", "det_conf", "quality_score"]:
        assert expected_col in cols
        
    cursor.execute("PRAGMA table_info(identity_profiles)")
    prof_cols = {row[1] for row in cursor.fetchall()}
    assert "label" in prof_cols
    assert "total_score" in prof_cols
    assert "status_level" in prof_cols
    store.close()

def test_save_and_get_identity_profile(tmp_path):
    db_file = tmp_path / "test_store.db"
    store = EmbeddingStore(str(db_file))
    
    report = SuitabilityReport(
        label="Nabi",
        sample_count=4,
        total_score=82.5,
        quality_avg=78.0,
        consistency_score=25.0,
        diversity_score=20.0,
        status_level=StatusLevel.GOOD,
        recommendations=["시점 편향: 측면 사진을 추가해 주세요."]
    )
    
    store.save_identity_profile(report)
    
    loaded = store.get_identity_profile("Nabi")
    assert loaded is not None
    assert loaded.label == "Nabi"
    assert loaded.total_score == 82.5
    assert loaded.status_level == StatusLevel.GOOD
    assert len(loaded.recommendations) == 1
    
    # Check non-existent label returns UNCHECKED
    unchecked = store.get_identity_profile("UnknownCat")
    assert unchecked is not None
    assert unchecked.status_level == StatusLevel.UNCHECKED
    store.close()

def test_add_batch_with_quality_metadata(tmp_path):
    db_file = tmp_path / "test_store.db"
    store = EmbeddingStore(str(db_file))
    
    embs = np.random.randn(2, 128).astype(np.float32)
    labels = ["Nabi", "Nabi"]
    paths = ["/tmp/n1.jpg", "/tmp/n2.jpg"]
    hashes = ["h1", "h2"]
    metas = [
        {"blur_score": 45.0, "crop_w": 200, "crop_h": 250, "aspect_ratio": 0.8, "det_conf": 0.9, "quality_score": 80.0},
        {"blur_score": 55.0, "crop_w": 210, "crop_h": 260, "aspect_ratio": 0.81, "det_conf": 0.95, "quality_score": 85.0}
    ]
    
    store.add_batch(
        embeddings=embs,
        labels=labels,
        image_paths=paths,
        image_hashes=hashes,
        model_name="test_model",
        quality_metas=metas
    )
    
    cursor = store.conn.cursor()
    cursor.execute("SELECT blur_score, quality_score FROM embeddings WHERE label = 'Nabi'")
    rows = cursor.fetchall()
    assert len(rows) == 2
    assert rows[0][0] == 45.0
    assert rows[1][1] == 85.0
    store.close()
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `pytest tests/test_embedding_store_profiles.py -v`
Expected: FAIL with missing methods or schema mismatch

- [ ] **Step 3: `reid/models/extractor/embedding.py` 수정**

`EmbeddingStore`에 스키마 자동 마이그레이션, `identity_profiles` CRUD, 및 `add_batch` 품질 메타데이터 인자를 추가합니다:

```python
# reid/models/extractor/embedding.py 수정 내용 요약
# - SQL_CREATE_IDENTITY_PROFILES 및 SQL_CREATE_TABLE 확장
# - _migrate_schema() 구현으로 기존 DB 호환성 유지
# - save_identity_profile(report), get_identity_profile(label), list_identity_profiles() 구현
# - add_batch()에 quality_metas 파라미터(Optional) 추가 지원
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `pytest tests/test_embedding_store_profiles.py -v`
Expected: PASS (모든 단위 테스트 통과)

---

### Task 3: 등록 파이프라인 연동 (`reid/models/extractor/model.py`)

**Files:**
- Modify: `reid/models/extractor/model.py`
- Modify: `config.yaml`
- Modify: `reid/cfg/default.yaml`
- Test: `tests/test_register_quality.py`

- [ ] **Step 1: 실패하는 통합 테스트 작성 (`tests/test_register_quality.py`)**

```python
import os
import cv2
import numpy as np
import pytest
from pathlib import Path
from reid.models.extractor.model import ExtractorModel
from reid.models.extractor.embedding import EmbeddingStore
from reid.core.config import get_config

class DummyDetectorBox:
    def __init__(self, x1, y1, x2, y2, conf=0.9):
        self.xyxy = [x1, y1, x2, y2]
        self.conf = conf
        self.track_id = 1
    def crop(self, img):
        return img[int(self.y1):int(self.y2), int(self.x1):int(self.x2)]
    @property
    def x1(self): return self.xyxy[0]
    @property
    def y1(self): return self.xyxy[1]
    @property
    def x2(self): return self.xyxy[2]
    @property
    def y2(self): return self.xyxy[3]

class DummyDetectorResults:
    def __init__(self, img, boxes):
        self.orig_img = img
        self.boxes = boxes

class DummyDetector:
    def __init__(self, boxes=None):
        self._boxes = boxes
    def predict(self, im):
        if isinstance(im, (str, Path)):
            im = cv2.imread(str(im))
        h, w = im.shape[:2]
        boxes = self._boxes if self._boxes is not None else [DummyDetectorBox(10, 10, w - 10, h - 10, conf=0.92)]
        return DummyDetectorResults(im, boxes)

def test_register_strict_filtering_and_profile_creation(tmp_path, monkeypatch):
    # Setup test dataset directory with 1 sharp and 1 blurry image
    cat_dir = tmp_path / "dataset" / "Nabi"
    cat_dir.mkdir(parents=True)
    
    # Sharp image
    np.random.seed(42)
    sharp_img = np.random.randint(0, 255, (200, 200, 3), dtype=np.uint8)
    cv2.imwrite(str(cat_dir / "sharp.jpg"), sharp_img)
    
    # Blurry/solid image (should be rejected by Strict Gate)
    blur_img = np.full((200, 200, 3), 128, dtype=np.uint8)
    cv2.imwrite(str(cat_dir / "blur.jpg"), blur_img)
    
    db_path = str(tmp_path / "test.db")
    cfg = get_config()
    cfg.db_path = db_path
    cfg.reg_blur_threshold = 30.0
    cfg.reg_min_crop_size = 64
    cfg.reg_min_det_conf = 0.60
    
    # Mock extractor predictor
    class DummyExtractor(ExtractorModel):
        def _load_model(self, path): self.model = None
        def _get_trainer(self): pass
        def _get_validator(self): pass
        def _get_predictor(self):
            class Pred:
                def predict_batch(self, paths):
                    return np.random.randn(len(paths), 128).astype(np.float32)
            return Pred()
            
    extractor = DummyExtractor(db_path=db_path, cfg=cfg)
    extractor.detector = DummyDetector()
    
    # Run register
    extractor.register(source=str(tmp_path / "dataset"), label="Nabi")
    
    # Verify only sharp.jpg registered in DB
    cursor = extractor.store.conn.cursor()
    cursor.execute("SELECT image_path, quality_score FROM embeddings WHERE label = 'Nabi'")
    rows = cursor.fetchall()
    assert len(rows) == 1
    assert "sharp.jpg" in rows[0][0]
    
    # Verify identity_profiles created
    prof = extractor.store.get_identity_profile("Nabi")
    assert prof is not None
    assert prof.sample_count == 1
    assert prof.status_level != "UNCHECKED"
    extractor.store.close()
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `pytest tests/test_register_quality.py -v`
Expected: FAIL

- [ ] **Step 3: `reid/models/extractor/model.py` 수정**

`register` 및 `register_batch_images`에 YOLO 검출기 크롭, `RegistrationQualityInspector` 선별, 메타데이터 적재 및 `identity_profiles` 생성 로직을 통합합니다.

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `pytest tests/test_register_quality.py -v`
Expected: PASS

---

### Task 4: CLI 명령어 확장 및 리포트 렌더링 (`reid/cli.py`)

**Files:**
- Modify: `reid/cli.py`
- Test: `tests/test_cli_quality.py`

- [ ] **Step 1: 실패하는 CLI 테스트 작성 (`tests/test_cli_quality.py`)**

```python
import sys
import pytest
from reid.cli import main
from reid.models.extractor.embedding import EmbeddingStore
from reid.core.quality import SuitabilityReport, StatusLevel

def test_cli_list_with_suitability(tmp_path, monkeypatch, caplog):
    db_file = tmp_path / "test.db"
    store = EmbeddingStore(str(db_file))
    
    report = SuitabilityReport(
        label="Nabi",
        sample_count=3,
        total_score=88.0,
        quality_avg=85.0,
        consistency_score=25.0,
        diversity_score=20.0,
        status_level=StatusLevel.EXCELLENT,
        recommendations=["최적 등록 상태입니다."]
    )
    store.save_identity_profile(report)
    store.close()
    
    monkeypatch.setattr(sys, "argv", ["reid", "list", f"db_path={db_file}"])
    
    import logging
    with caplog.at_level(logging.INFO):
        main()
        
    assert "Nabi" in caplog.text
    assert "88.0" in caplog.text or "EXCELLENT" in caplog.text

def test_cli_inspect_label(tmp_path, monkeypatch, caplog):
    db_file = tmp_path / "test.db"
    store = EmbeddingStore(str(db_file))
    
    report = SuitabilityReport(
        label="Lulu",
        sample_count=2,
        total_score=62.0,
        quality_avg=70.0,
        consistency_score=20.0,
        diversity_score=10.0,
        status_level=StatusLevel.WARN,
        recommendations=["시점 편향: 측면 사진을 추가해 주세요."]
    )
    store.save_identity_profile(report)
    store.close()
    
    monkeypatch.setattr(sys, "argv", ["reid", "inspect", "label=Lulu", f"db_path={db_file}"])
    
    import logging
    with caplog.at_level(logging.INFO):
        main()
        
    assert "Lulu" in caplog.text
    assert "시점 편향" in caplog.text
    assert "WARN" in caplog.text
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `pytest tests/test_cli_quality.py -v`
Expected: FAIL with `Unknown mode: inspect` or missing output

- [ ] **Step 3: `reid/cli.py` 수정**

1. `reid list`: `store.list_identity_profiles()`와 결합하여 라벨별 적합도 점수 및 `[STATUS]` 뱃지 출력 (`UNCHECKED` 지원)
2. `reid inspect`: `label` 인자를 받아 해당 개체의 세부 4대 점수 및 추천 가이드 출력
3. `reid migrate`: 특징 재추출 시 단일 패스로 품질 점수 및 프로필 일괄 갱신 연동

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `pytest tests/test_cli_quality.py -v`
Expected: PASS

---

### Task 5: 전체 통합 검증 및 회귀 테스트

- [ ] **Step 1: 전체 pytest 스위트 실행**

Run: `pytest tests/ -v`
Expected: All tests PASS (기존 테스트 및 신규 테스트 전체 통과)

- [ ] **Step 2: 실제 CLI 동작 검증**

Run: `reid list`
Expected: 정상적으로 DB 상태 및 요약 출력 확인

---

## Execution Handoff

이 구현 계획은 `dev/lumi_docs/superpowers/plans/2026-08-15-RegistrationQualityAndSuitabilityScoringPlan.md`에 저장되었습니다.

두 가지 실행 방식 중 선택하실 수 있습니다:

1. **Subagent-Driven (권장)**: 각 태스크마다 서브에이전트를 생성하여 TDD 방식으로 구현 및 리뷰 진행
2. **Inline Execution**: 현재 세션에서 `executing-plans`를 사용하여 태스크를 순차적으로 구현

어떤 방식으로 진행하시겠습니까?
