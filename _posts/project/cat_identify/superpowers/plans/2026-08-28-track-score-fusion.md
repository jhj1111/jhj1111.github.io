# 트랙 score-level fusion 전환 — 구현 계획

> **실행 방식**: `superpowers:executing-plans` (에이전트가 순차 실행). 각 단계는 체크박스로 추적한다.
> 서브에이전트 병렬 실행은 `dev/workflow.md` §4에 따라 사용자가 명시적으로 요청할 때만 쓴다.

**Goal**: 트랙이 임베딩을 누적하는 대신 매칭 결과를 누적하게 하여, 개체 교체에 트랙 상태가 오염되지 않고 교체를 즉시 인지하게 한다.

**Architecture**: `TrackState`가 관측 임베딩 버퍼 대신 최근 매칭 결과 창(`votes`)을 들고, 라벨별 유사도 합으로 표시 라벨(`committed`)을 정한다. 매칭 입력은 누적 평균이 아니라 현재 프레임 임베딩이다. 현재 프레임 라벨이 `committed`와 다르면 창을 비우고 상태를 Unknown으로 강등해 재매칭 주기를 좁힌다.

**Tech Stack**: Python 3.12, numpy, faiss, pytest 9.1.1, ultralytics 8.4.121

**Spec**: `dev/specs/2026-08-28-track-score-fusion.md`

## Global Constraints (이 저장소 규칙 — `dev/workflow.md`)

- **작업 도중 커밋 금지.** 모든 태스크가 끝날 때까지 워킹 트리에 변경을 쌓는다. 각 태스크는 "검증"으로 끝난다.
- **브랜치는 사용자가 생성한다.** 제안: `refactor/track-score-fusion`. 생성 전에는 착수하지 않는다.
- **작업 문서는 `dev/` 하위에만** 쓴다. 임시 파일은 저장소에 만들지 않고 스크래치패드를 쓴다.
- **실패하는 테스트 없이 프로덕션 코드를 쓰지 않는다.** 학습 코드 TDD 예외는 이 작업에 해당 없음 (전부 CPU 수초).
- **증거 없는 완료 선언 금지.** 통과 주장에는 이번 턴에 실행한 명령의 출력이 따라야 한다.
- 테스트 실행: `.venv/bin/python -m pytest -q`
- 기본값 변경은 `reid/cfg/default.yaml`과 `reid/core/config.py`의 `Config` 데이터클래스 **양쪽**에 반영한다.
- `config.yaml`, `weights/`, `embeddings/`, `datasets/`, `results/`는 gitignore 대상이며 `config.yaml`은 사용자 로컬 영역이므로 에이전트가 임의로 수정하지 않는다.

---

## 파일 구조

| 파일 | 책임 | 조치 |
|---|---|---|
| `reid/core/tracker.py` | 트랙별 시간 상태. 투표 창 · 융합 · 교체 감지 · 상태 전이 | 수정 (`TrackState` 재정의) |
| `reid/models/reid/predict.py` | 검출 → 품질 → 스케줄 → 추출 → 매칭 오케스트레이션 | 수정 (매칭 입력 전환, Phase B에서 분해) |
| `reid/cfg/default.yaml` | 설정 기본값 | 수정 (`vote_window` 신설, `use_weighted_mean` 삭제) |
| `reid/core/config.py` | `Config` 데이터클래스 | 수정 (동일) |
| `tests/test_tracking.py` | 트래커·예측기 단위 테스트 | 수정 (신설 6 · 수정 2 · 삭제 2) |
| `dev/notes/2026-08-28-score-fusion/track_stability.py` | 영상에서 트랙별 라벨 안정성을 재는 오프라인 스크립트 | **신설** |
| `dev/notes/2026-08-28-score-fusion/README.md` | 측정 결과와 판단 | **신설** |

**Phase A** (Task 1–7) 동작 변경 → **Phase B** (Task 8) 순수 리팩터링.
Phase B를 뒤에 두는 이유: `inference`에서 가장 덩어리진 `:159-187`·`:198-203`(가중평균·blur 계산 ~35줄)이 Phase A에서 **삭제되는 코드**다. 먼저 추출하면 뺀 함수를 곧바로 지우게 된다. 또한 Phase B는 테스트를 한 줄도 바꾸지 않고 전부 통과하는 것이 안전 증명이 된다.

---

## Task 1: 그린 베이스라인과 변경 전 측정치 확보

**Files:**
- Create: `dev/notes/2026-08-28-score-fusion/track_stability.py`
- Create: `dev/notes/2026-08-28-score-fusion/README.md`

**Interfaces:**
- Produces: `track_stability.py` — CLI로 영상 하나를 받아 트랙별 라벨 안정성 JSON을 표준출력에 낸다. Task 7에서 변경 후 수치를 같은 스크립트로 다시 잰다.

- [ ] **Step 1: 그린 베이스라인 확인**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건. 실패가 있으면 **여기서 멈추고 사용자에게 보고한다.** 기존 실패를 안고 착수하면 이후 회귀를 구분할 수 없다.

- [ ] **Step 2: 측정 스크립트 작성**

`dev/notes/2026-08-28-score-fusion/track_stability.py`:

```python
"""영상에서 트랙별 라벨 안정성을 잰다.

정답 라벨이 없으므로 정확도는 재지 못한다. 대신 한 트랙 안에서 라벨이 몇 번
뒤집히는지(switches)와 지배 라벨이 그 트랙의 몇 %를 차지하는지(dominance)를 센다.
트랙 오염이 줄면 switches 가 줄고 dominance 가 오른다.

사용법:
    PYTHONPATH=. .venv/bin/python dev/notes/2026-08-28-score-fusion/track_stability.py \
        datasets/cream_heroes/momo_chuchu_01.mp4 > before_momo_chuchu_01.json
"""
import json
import sys
from collections import Counter, defaultdict

from reid.container import build_detector, build_extractor, build_matcher
from reid.core.config import get_config
from reid.models.reid.predict import ReIdPredictor


def main(video_path: str) -> None:
    cfg = get_config()
    cfg.show = False          # 창을 띄우지 않는다
    cfg.save_path = None
    cfg.verbose = "WARNING"

    predictor = ReIdPredictor(
        build_detector(cfg), build_extractor(cfg), build_matcher(cfg), cfg
    )

    # 트랙별 프레임 라벨 이력
    seq = defaultdict(list)

    def on_frame(idx, total, res):
        for i, box in enumerate(res.boxes):
            if box.track_id is None or i >= len(res.match_results):
                continue
            seq[box.track_id].append(res.match_results[i].cat_id)

    predictor.predict(source=video_path, on_frame=on_frame)

    tracks = {}
    for track_id, labels in seq.items():
        switches = sum(1 for a, b in zip(labels, labels[1:]) if a != b)
        counts = Counter(labels)
        top_label, top_n = counts.most_common(1)[0]
        tracks[str(track_id)] = {
            "frames": len(labels),
            "switches": switches,
            "dominant_label": top_label,
            "dominance": round(top_n / len(labels), 4),
            "distinct_labels": len(counts),
        }

    total_frames = sum(t["frames"] for t in tracks.values())
    summary = {
        "video": video_path,
        "tracks": len(tracks),
        "total_track_frames": total_frames,
        "total_switches": sum(t["switches"] for t in tracks.values()),
        # 프레임 수로 가중한 평균 지배율. 트랙 하나짜리 꼬리에 휘둘리지 않는다.
        "weighted_dominance": round(
            sum(t["dominance"] * t["frames"] for t in tracks.values()) / total_frames, 4
        ) if total_frames else 0.0,
    }
    json.dump({"summary": summary, "per_track": tracks}, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main(sys.argv[1])
```

- [ ] **Step 3: 스크립트가 도는지 짧은 영상 하나로 확인**

Run:
```bash
PYTHONPATH=. .venv/bin/python dev/notes/2026-08-28-score-fusion/track_stability.py \
    datasets/cream_heroes/lulu_03.mp4 | head -20
```
Expected: `summary` 블록이 나오고 `tracks` > 0. 예외로 죽으면 여기서 멈추고 원인을 보고한다.

- [ ] **Step 4: 변경 전 5개 영상 측정치 캡처**

Run:
```bash
mkdir -p dev/notes/2026-08-28-score-fusion/before
for v in lulu_03 white_01 momo_chuchu_01 chuchu_lulu_01 momo_titi_chuchu_01; do
  PYTHONPATH=. .venv/bin/python dev/notes/2026-08-28-score-fusion/track_stability.py \
    "datasets/cream_heroes/$v.mp4" > "dev/notes/2026-08-28-score-fusion/before/$v.json"
done
grep -h '"total_switches"\|"weighted_dominance"\|"video"' dev/notes/2026-08-28-score-fusion/before/*.json
```
Expected: 5개 JSON 생성. 이 수치가 Task 7의 비교 대상이다.

- [ ] **Step 5: README 뼈대 작성**

`dev/notes/2026-08-28-score-fusion/README.md`에 스크립트 사용법과 **읽는 법**을 적는다 (스펙 §13에서 그대로 옮긴다):
- 단일 개체 영상(lulu_03, white_01)의 소폭 하락은 **예상된 지불**이지 실패가 아니다
- 다개체 영상(momo_chuchu_01 등)에서 개선이 없으면 **설계가 틀린 것**이다
- **숫자를 보고 `vote_window`를 되돌려 조절하지 않는다**

- [ ] **Step 6: 검증**

Run: `ls dev/notes/2026-08-28-score-fusion/before/ && git status --short`
Expected: JSON 5개. `git status`에 `reid/` 변경이 없어야 한다 (아직 프로덕션 코드를 건드리지 않았다).

---

## Task 2: `TrackState` 투표 창과 융합 규칙

**Files:**
- Modify: `reid/core/tracker.py:5-79` (`TrackState`)
- Test: `tests/test_tracking.py`

**Interfaces:**
- Produces:
  - `TrackState(track_id: int, vote_window: int = 5)`
  - `TrackState.votes: Deque[MatchResult]` (maxlen=`vote_window`)
  - `TrackState.committed: Optional[MatchResult]`
  - `TrackState.last_embedding: Optional[np.ndarray]`
  - `TrackState.fuse_votes() -> MatchResult`
- Consumes: `reid.core.types.MatchResult(cat_id: str, similarity: float, is_known: bool = True)`

- [ ] **Step 1: 실패 테스트 4개 작성**

`tests/test_tracking.py` 끝에 추가:

```python
def test_vote_fusion_sums_similarity():
    """라벨별 유사도 합이 큰 쪽이 이긴다. faiss 의 kNN voting 과 같은 규칙이다."""
    import pytest
    from reid.core.tracker import TrackState
    from reid.core.types import MatchResult

    state = TrackState(track_id=1, vote_window=5)
    state.votes.extend([
        MatchResult(cat_id="A", similarity=0.8),
        MatchResult(cat_id="A", similarity=0.8),
        MatchResult(cat_id="B", similarity=0.9),
    ])

    fused = state.fuse_votes()
    assert fused.cat_id == "A"                      # 1.6 > 0.9
    assert fused.similarity == pytest.approx(0.8)   # 해당 라벨의 평균
    assert fused.is_known is True


def test_vote_fusion_unknown_gate():
    """known 이 절반 미만이면 Unknown 이다. faiss 가 미달 라벨을 뭉개므로 투표시킬 수 없다."""
    from reid.core.tracker import TrackState
    from reid.core.types import MatchResult

    state = TrackState(track_id=1, vote_window=5)
    state.votes.extend([
        MatchResult(cat_id="A", similarity=0.9),
        MatchResult(cat_id="A", similarity=0.9),
        MatchResult(cat_id="Unknown", similarity=0.0, is_known=False),
        MatchResult(cat_id="Unknown", similarity=0.0, is_known=False),
        MatchResult(cat_id="Unknown", similarity=0.0, is_known=False),
    ])

    fused = state.fuse_votes()
    assert fused.cat_id == "Unknown"
    assert fused.is_known is False


def test_vote_fusion_tie_prefers_recent():
    """합계가 같으면 창에서 더 최근에 등장한 라벨을 택한다."""
    from reid.core.tracker import TrackState
    from reid.core.types import MatchResult

    state = TrackState(track_id=1, vote_window=5)
    state.votes.extend([
        MatchResult(cat_id="A", similarity=0.7),
        MatchResult(cat_id="B", similarity=0.7),
    ])

    assert state.fuse_votes().cat_id == "B"


def test_vote_fusion_empty_window_is_unknown():
    """창이 비어 있으면 Unknown 이다."""
    from reid.core.tracker import TrackState

    fused = TrackState(track_id=1).fuse_votes()
    assert fused.cat_id == "Unknown"
    assert fused.similarity == 0.0
    assert fused.is_known is False
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_tracking.py -k "vote_fusion" -q`
Expected: 4건 FAIL. 사유는 `TypeError: __init__() got an unexpected keyword argument 'vote_window'` 또는 `AttributeError: 'TrackState' object has no attribute 'votes'`.

- [ ] **Step 3: 최소 구현**

`reid/core/tracker.py`의 import와 `TrackState.__init__` · `fuse_votes`를 교체한다.

```python
from collections import deque
from typing import Any, Deque, Dict, List, Optional, Tuple
import numpy as np
from reid.core.types import MatchResult


class TrackState:
    """트랙 하나의 시간 상태.

    임베딩을 누적하지 않는다. 매 매칭 프레임의 결과(MatchResult)를 창에 쌓고
    라벨별 유사도 합으로 표시 라벨을 정한다. 임베딩을 누적하면 개체가 바뀌었을 때
    평균이 옛 개체에 고정되어 라벨이 뒤집히지 않는다.
    """

    def __init__(self, track_id: int, vote_window: int = 5):
        self.track_id = track_id
        self.votes: Deque[MatchResult] = deque(maxlen=vote_window)
        self.committed: Optional[MatchResult] = None
        self.last_embedding: Optional[np.ndarray] = None
        self.frame_count = 0
        self.state = "Unknown"  # "Unknown", "Candidate", "Locked"
        self.last_match_frame = -9999

    def fuse_votes(self) -> MatchResult:
        """최근 매칭 결과를 라벨별 유사도 합으로 융합한다.

        faiss.py 의 kNN voting 과 같은 규칙을 시간축에 적용한 것이다.
        matcher 는 임계값 미달 시 라벨을 "Unknown" 으로 뭉개므로 그 결과는
        라벨로 투표시키지 않고 "known 이 절반 이상인가" 라는 게이트로만 쓴다.
        """
        if not self.votes:
            return MatchResult(cat_id="Unknown", similarity=0.0, is_known=False)

        known = [v for v in self.votes if v.is_known]
        if len(known) * 2 < len(self.votes):
            return MatchResult(cat_id="Unknown", similarity=0.0, is_known=False)

        sims: Dict[str, List[float]] = {}
        for v in known:
            sims.setdefault(v.cat_id, []).append(v.similarity)

        # 합계가 같으면 더 최근에 등장한 라벨을 택한다.
        recency = {v.cat_id: i for i, v in enumerate(known)}
        best = max(sims, key=lambda label: (sum(sims[label]), recency[label]))
        return MatchResult(
            cat_id=best,
            similarity=sum(sims[best]) / len(sims[best]),
            is_known=True,
        )
```

`should_match`와 `update_state`는 **그대로 둔다.** `observations` / `add_observation` / `get_mean_embedding`은 Task 3·4에서 정리하므로 아직 지우지 않는다 (기존 테스트가 아직 참조한다).

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_tracking.py -k "vote_fusion" -q`
Expected: 4 passed.

- [ ] **Step 5: 검증 (커밋하지 않는다)**

Run: `.venv/bin/python -m pytest tests/ -q 2>&1 | tail -30`

Expected: **실패가 발생하는 것이 정상이다.** `__init__`에서 `self.observations`를 더 이상 만들지 않으므로, `add_observation`을 부르는 경로가 전부 `AttributeError: 'TrackState' object has no attribute 'observations'`로 깨진다. 해당하는 것:
- `test_smart_eviction`, `test_tracker_weighted_mean_embedding` — Task 3 Step 5에서 삭제한다
- `test_track_state_manager` — Task 4에서 새 계약으로 고친다
- `ReIdPredictor.inference`의 매칭 경로를 구동하는 테스트 전부 — Task 5에서 해소한다

**확인 방법**: 실패 목록을 뽑아 보관하고, Task 6 Step 6에서 이 목록이 전부 사라졌는지 대조한다.

```bash
.venv/bin/python -m pytest tests/ -q 2>&1 | grep -E "^(FAILED|ERROR)" | sort > /tmp/claude-1000/-home-eins-project-ws-lumipet-identification-test/54688190-d887-48fd-b684-ee4b5ab9fb4a/scratchpad/t2_failures.txt
wc -l /tmp/claude-1000/-home-eins-project-ws-lumipet-identification-test/54688190-d887-48fd-b684-ee4b5ab9fb4a/scratchpad/t2_failures.txt
```

실패 사유가 위 `AttributeError`가 **아닌** 것이 하나라도 있으면 멈추고 보고한다.

---

## Task 3: `record_match` — 개체 교체 감지와 강등

**Files:**
- Modify: `reid/core/tracker.py` (`TrackState`에 메서드 추가, `add_observation` 제거)
- Test: `tests/test_tracking.py`

**Interfaces:**
- Consumes: Task 2의 `votes`, `committed`, `last_embedding`, `fuse_votes()`
- Produces: `TrackState.record_match(embedding: np.ndarray, match_res: MatchResult, th_candidate: float, th_lock: float, th_hysteresis: float) -> None`

- [ ] **Step 1: 실패 테스트 3개 작성**

```python
def test_record_match_promotes_on_agreement():
    """같은 라벨이 반복되면 평소 경로로 상태가 올라간다."""
    import numpy as np
    from reid.core.tracker import TrackState
    from reid.core.types import MatchResult

    state = TrackState(track_id=1, vote_window=5)
    emb = np.ones(4, dtype=np.float32)
    for _ in range(3):
        state.record_match(emb, MatchResult(cat_id="Nabi", similarity=0.90), 0.70, 0.85, 0.55)

    assert state.committed.cat_id == "Nabi"
    assert state.state == "Locked"          # 0.90 >= th_lock
    assert state.frame_count == 3
    assert np.allclose(state.last_embedding, emb)


def test_identity_switch_clears_votes():
    """현재 프레임 라벨이 표시 라벨과 다르면 창을 비우고 Unknown 으로 강등한다."""
    import numpy as np
    from reid.core.tracker import TrackState
    from reid.core.types import MatchResult

    state = TrackState(track_id=1, vote_window=5)
    emb = np.ones(4, dtype=np.float32)
    for _ in range(3):
        state.record_match(emb, MatchResult(cat_id="Nabi", similarity=0.90), 0.70, 0.85, 0.55)

    state.record_match(emb, MatchResult(cat_id="Mimi", similarity=0.75), 0.70, 0.85, 0.55)

    assert len(state.votes) == 1            # 창이 비워지고 새 결과만 남는다
    assert state.committed.cat_id == "Mimi"
    assert state.state == "Unknown"


def test_identity_switch_survives_high_similarity():
    """전환 프레임에서는 update_state 를 건너뛴다.

    창을 비운 직후 committed 는 새 라벨 하나뿐이라 유사도가 th_lock 을 넘을 수 있다.
    그때 update_state 를 부르면 방금 내린 강등이 같은 프레임에서 되돌아가고,
    재매칭을 앞당기려던 목적이 무효가 된다.
    """
    import numpy as np
    from reid.core.tracker import TrackState
    from reid.core.types import MatchResult

    state = TrackState(track_id=1, vote_window=5)
    emb = np.ones(4, dtype=np.float32)
    for _ in range(3):
        state.record_match(emb, MatchResult(cat_id="Nabi", similarity=0.90), 0.70, 0.85, 0.55)
    assert state.state == "Locked"

    state.record_match(emb, MatchResult(cat_id="Mimi", similarity=0.95), 0.70, 0.85, 0.55)

    assert state.state == "Unknown"         # 0.95 >= th_lock 이어도 강등이 유지된다
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_tracking.py -k "record_match or identity_switch" -q`
Expected: 3건 FAIL, `AttributeError: 'TrackState' object has no attribute 'record_match'`.

- [ ] **Step 3: 최소 구현**

`reid/core/tracker.py`에서 `add_observation`과 `get_mean_embedding`을 **삭제**하고 그 자리에 넣는다:

```python
    def record_match(
        self,
        embedding: np.ndarray,
        match_res: MatchResult,
        th_candidate: float,
        th_lock: float,
        th_hysteresis: float,
    ) -> None:
        """매칭 결과를 창에 기록하고 표시 라벨과 상태를 갱신한다."""
        switched = (
            match_res.is_known
            and self.committed is not None
            and self.committed.is_known
            and match_res.cat_id != self.committed.cat_id
        )
        if switched:
            self.votes.clear()

        self.votes.append(match_res)
        self.committed = self.fuse_votes()
        self.last_embedding = embedding

        if switched:
            # 강등을 이번 프레임에 확정한다. 창을 비운 직후의 높은 유사도로
            # update_state 를 부르면 방금 내린 강등이 되돌아간다.
            self.state = "Unknown"
        else:
            self.update_state(self.committed.similarity, th_candidate, th_lock, th_hysteresis)

        self.last_match_frame = self.frame_count
        self.frame_count += 1
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_tracking.py -k "record_match or identity_switch" -q`
Expected: 3 passed.

- [ ] **Step 5: 죽은 테스트 삭제**

`tests/test_tracking.py`에서 삭제한다. 검증 대상 규칙 자체가 사라졌으므로 고칠 것이 없다.
- `test_smart_eviction` (`:403`) — 축출 규칙이 사라짐
- `test_tracker_weighted_mean_embedding` (`:463`) — 가중평균이 사라짐

- [ ] **Step 6: 검증**

Run: `.venv/bin/python -m pytest tests/ -q 2>&1 | grep -E "^(FAILED|ERROR)" | sort`

Expected: 실패 사유가 `AttributeError: ... 'observations'` 에서 `AttributeError: ... 'add_observation'` 으로 **바뀌기만** 한다. 실패하는 테스트 집합은 Task 2 Step 5에서 보관한 목록에서 삭제한 2개(`test_smart_eviction`, `test_tracker_weighted_mean_embedding`)를 뺀 것과 같아야 한다.

```bash
diff <(.venv/bin/python -m pytest tests/ -q 2>&1 | grep -E "^(FAILED|ERROR)" | sort) \
     <(grep -v "test_smart_eviction\|test_tracker_weighted_mean_embedding" \
       /tmp/claude-1000/-home-eins-project-ws-lumipet-identification-test/54688190-d887-48fd-b684-ee4b5ab9fb4a/scratchpad/t2_failures.txt)
```

새로 늘어난 실패가 있으면 멈추고 보고한다. `test_track_state_manager`는 Task 4에서, 나머지 예측기 테스트는 Task 5에서 해소된다.

---

## Task 4: `TrackStateManager` 정리

**Files:**
- Modify: `reid/core/tracker.py:81-118` (`TrackStateManager`)
- Test: `tests/test_tracking.py:144` (`test_track_state_manager`)

**Interfaces:**
- Consumes: Task 3의 `record_match`
- Produces:
  - `TrackStateManager(max_tracks: int = 1000, vote_window: int = 5)`
  - `TrackStateManager.get_match(track_id: int) -> Optional[Tuple[np.ndarray, MatchResult]]`
  - `TrackStateManager.update_track(track_id, embedding, match_res, th_candidate, th_lock, th_hysteresis) -> None`

- [ ] **Step 1: 기존 테스트를 새 계약으로 고쳐 실패시킨다**

`tests/test_tracking.py`의 `test_track_state_manager`를 통째로 교체한다. `MagicMock` 매치 결과를 실제 `MatchResult`로 바꾼다 — 융합 규칙이 `is_known`과 `cat_id`를 읽으므로 Mock 은 의미 없는 통과를 만든다.

```python
def test_track_state_manager():
    from reid.core.tracker import TrackStateManager
    from reid.core.types import MatchResult
    import numpy as np

    TH = (0.70, 0.85, 0.55)
    manager = TrackStateManager(max_tracks=2, vote_window=5)
    emb1 = np.ones(512)

    # 1. 갱신과 히트. 반환 임베딩은 마지막 프레임 임베딩 그대로다 (평균이 아니다)
    manager.update_track(1, emb1, MatchResult(cat_id="Nabi", similarity=0.85), *TH)
    cached = manager.get_match(1)
    assert cached is not None
    assert np.allclose(cached[0], emb1)
    assert cached[1].cat_id == "Nabi"

    # 2. 미스
    assert manager.get_match(99) is None

    # 3~4. 용량이 찬 상태에서 기존 트랙을 갱신해도 축출되지 않는다
    emb2 = np.ones(512) * 2
    manager.update_track(2, emb2, MatchResult(cat_id="Mimi", similarity=0.85), *TH)
    manager.update_track(2, emb2 * 1.5, MatchResult(cat_id="Mimi", similarity=0.85), *TH)
    assert manager.get_match(1) is not None   # 트랙 1 접근 → 최근 사용으로 이동
    assert len(manager.tracks) == 2

    # 트랙 3 추가 → 가장 오래 안 쓴 트랙 2가 축출된다
    emb3 = np.ones(512) * 3
    manager.update_track(3, emb3, MatchResult(cat_id="Coco", similarity=0.85), *TH)
    assert manager.get_match(2) is None
    assert manager.get_match(1) is not None
    assert manager.get_match(3) is not None

    # 5. 투표 창은 상한을 넘지 않는다
    state = manager.tracks[1]
    for _ in range(20):
        state.record_match(np.ones(512), MatchResult(cat_id="Nabi", similarity=0.85), *TH)
    assert len(state.votes) == 5
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_tracking.py::test_track_state_manager -q`
Expected: FAIL — `TypeError: __init__() got an unexpected keyword argument 'vote_window'` 또는 `update_track()` 인자 개수 불일치.

- [ ] **Step 3: 최소 구현**

```python
class TrackStateManager:
    """모든 트랙의 상태를 관리하고 LRU 로 축출한다.

    TODO(트랙 병합): 한 개체가 여러 트랙으로 쪼개지면 누적 이력이 매번 버려진다.
    lulu_03(고양이 1마리)에서 트래커 파라미터 조정 후에도 트랙 5개로 갈렸고, 최대 트랙의
    프레임 점유율은 40%에 그쳤다. IoU 연관만으로는 가림·이탈 구간을 잇지 못한다.
    끊긴 트랙을 사후 병합하는 방안을 별도 작업으로 다룬다.
    측정 근거는 dev/notes/2026-08-22-similarity-diagnosis.md §9.
    """
    def __init__(self, max_tracks: int = 1000, vote_window: int = 5):
        self.tracks: Dict[int, TrackState] = {}
        self.max_tracks = max_tracks
        self.vote_window = vote_window

    def get_match(self, track_id: int) -> Optional[Tuple[np.ndarray, MatchResult]]:
        """표시 라벨과 마지막 프레임 임베딩을 돌려주고 LRU 순서를 갱신한다."""
        if track_id in self.tracks and self.tracks[track_id].committed is not None:
            state = self.tracks.pop(track_id)
            self.tracks[track_id] = state
            return state.last_embedding, state.committed
        return None

    def update_track(
        self,
        track_id: int,
        embedding: np.ndarray,
        match_res: MatchResult,
        th_candidate: float,
        th_lock: float,
        th_hysteresis: float,
    ) -> None:
        """트랙 상태를 갱신한다. 용량이 차면 가장 오래 안 쓴 트랙을 축출한다."""
        if track_id not in self.tracks and len(self.tracks) >= self.max_tracks:
            self.tracks.pop(next(iter(self.tracks)))

        if track_id not in self.tracks:
            self.tracks[track_id] = TrackState(track_id, vote_window=self.vote_window)
        else:
            state = self.tracks.pop(track_id)
            self.tracks[track_id] = state

        self.tracks[track_id].record_match(
            embedding, match_res, th_candidate, th_lock, th_hysteresis
        )
```

> **관찰 (고치지 않는다)**: `update_track`은 프로덕션 코드에서 호출되지 않는다. `predict.py:108-113`이 같은 "없으면 생성 + LRU 축출" 로직을 직접 구현해 두었기 때문이다. 이 중복 정리는 이번 작업 범위 밖이므로 언급만 하고 남긴다.

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_tracking.py::test_track_state_manager -q`
Expected: PASS.

- [ ] **Step 5: 검증**

Run:
```bash
.venv/bin/python -c "import reid.core.tracker" && \
.venv/bin/python -m pytest tests/ -q 2>&1 | grep -E "^(FAILED|ERROR)" | sort
```

Expected: import 오류 없음. 남은 실패는 **`ReIdPredictor.inference`를 구동하는 테스트들뿐**이다 (`predict.py`가 아직 `add_observation`·`get_mean_embedding`을 부른다). `test_track_state_manager`가 목록에서 사라져야 한다. Task 5에서 전부 해소한다.

---

## Task 5: `predict.py` 매칭 입력을 현재 프레임으로 전환

**Files:**
- Modify: `reid/models/reid/predict.py:22-23, 91-97, 108-121, 148-208, 212`
- Test: `tests/test_tracking.py`

**Interfaces:**
- Consumes: Task 3의 `record_match`, Task 4의 `TrackStateManager(max_tracks, vote_window)`
- Produces: `ReIdPredictor.vote_window: int`

- [ ] **Step 1: 실패 테스트 2개 작성**

```python
def test_match_uses_current_frame_embedding():
    """매칭 입력은 누적 평균이 아니라 그 프레임의 임베딩이어야 한다."""
    from reid.models.reid.predict import ReIdPredictor
    from reid.core.types import Results, BBox, MatchResult
    from reid.core.config import Config
    from unittest.mock import MagicMock
    import numpy as np

    detector, extractor, matcher = MagicMock(), MagicMock(), MagicMock()
    extractor.store.get_all.return_value = (np.array([]), [])
    extractor.cfg.imgsz = 384
    extractor.predict.return_value = np.ones(512)

    cfg = Config()
    cfg.blur_threshold = 0.0        # 품질 필터 비활성
    cfg.candidate_interval = 1      # 매 프레임 재매칭
    cfg.lock_interval = 1
    cfg.unknown_interval = 1

    predictor = ReIdPredictor(detector, extractor, matcher, cfg)

    e1 = np.zeros(512); e1[0] = 1.0     # 프레임 1 임베딩
    e2 = np.zeros(512); e2[1] = 1.0     # 프레임 2 임베딩 — 직교
    extractor.predict_batch = MagicMock(side_effect=[np.array([e1]), np.array([e2])])
    matcher.match.return_value = MatchResult(cat_id="Nabi", similarity=0.90)

    img = np.zeros((200, 200, 3), dtype=np.uint8)
    box = BBox(x1=0, y1=0, x2=100, y2=100, track_id=5)
    detector.predict.return_value = Results(orig_img=img, path="", boxes=[box])

    predictor.inference(img)
    predictor.inference(img)

    # 누적 평균이었다면 두 번째 호출 인자는 (e1+e2)/√2 였을 것이다
    second_arg = matcher.match.call_args_list[1][0][0]
    assert np.allclose(second_arg, e2)


def test_cache_hit_returns_committed():
    """매칭이 안 도는 프레임은 융합된 표시 라벨을 그대로 돌려준다."""
    from reid.models.reid.predict import ReIdPredictor
    from reid.core.types import Results, BBox, MatchResult
    from reid.core.config import Config
    from unittest.mock import MagicMock
    import numpy as np

    detector, extractor, matcher = MagicMock(), MagicMock(), MagicMock()
    extractor.store.get_all.return_value = (np.array([]), [])
    extractor.cfg.imgsz = 384
    extractor.predict.return_value = np.ones(512)
    extractor.predict_batch = MagicMock(side_effect=lambda crops: np.ones((len(crops), 512)))

    cfg = Config()
    cfg.blur_threshold = 0.0
    cfg.lock_interval = 60          # 한 번 Locked 되면 오래 캐시한다
    predictor = ReIdPredictor(detector, extractor, matcher, cfg)

    img = np.zeros((200, 200, 3), dtype=np.uint8)
    box = BBox(x1=0, y1=0, x2=100, y2=100, track_id=7)
    detector.predict.return_value = Results(orig_img=img, path="", boxes=[box])
    matcher.match.return_value = MatchResult(cat_id="Nabi", similarity=0.95)

    predictor.inference(img)                        # 1회차: 매칭 실행 → Locked
    state = predictor.track_state_manager.tracks[7]
    assert state.state == "Locked"

    matcher.match.reset_mock()
    res = predictor.inference(img)                  # 2회차: 캐시 히트
    matcher.match.assert_not_called()
    assert res.match_results[0] is state.committed
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_tracking.py -k "current_frame_embedding or cache_hit_returns_committed" -q`
Expected: 2건 FAIL. `AttributeError: 'TrackState' object has no attribute 'add_observation'`.

- [ ] **Step 3: 구현 — `__init__`에 `vote_window` 추가**

`reid/models/reid/predict.py:22-23`을 교체:

```python
        max_tracks = getattr(self.cfg, "max_tracks", 1000)
        self.vote_window = getattr(self.cfg, "vote_window", 5)
        self.track_state_manager = TrackStateManager(
            max_tracks=max_tracks, vote_window=self.vote_window
        )
```

- [ ] **Step 4: 구현 — 품질 필터 실패 경로 (`:90-98`)**

```python
            if not is_valid:
                cached = self.track_state_manager.tracks.get(track_id) if track_id is not None else None
                if cached is not None and cached.committed is not None:
                    box_match_results[idx] = cached.committed
                    box_embeddings[idx] = (
                        cached.last_embedding
                        if cached.last_embedding is not None
                        else np.zeros(self.extractor_dim, dtype=np.float32)
                    )
                else:
                    box_match_results[idx] = MatchResult(cat_id="Unknown", similarity=0.0, is_known=False)
                    box_embeddings[idx] = np.zeros(self.extractor_dim, dtype=np.float32)
                continue
```

- [ ] **Step 5: 구현 — 트랙 생성과 캐시 히트 경로 (`:107-121`)**

```python
            run_matching = True
            state_obj = None
            if track_id is not None:
                if track_id not in self.track_state_manager.tracks:
                    if len(self.track_state_manager.tracks) >= self.track_state_manager.max_tracks:
                        first_key = next(iter(self.track_state_manager.tracks))
                        self.track_state_manager.tracks.pop(first_key)
                    self.track_state_manager.tracks[track_id] = TrackState(
                        track_id, vote_window=self.vote_window
                    )
                state_obj = self.track_state_manager.tracks[track_id]
                run_matching = state_obj.should_match(self.candidate_interval, self.lock_interval, self.unknown_interval)

            if not run_matching and state_obj is not None and state_obj.committed is not None:
                self.track_state_manager.get_match(track_id)
                box_match_results[idx] = state_obj.committed
                box_embeddings[idx] = (
                    state_obj.last_embedding
                    if state_obj.last_embedding is not None
                    else np.zeros(self.extractor_dim, dtype=np.float32)
                )
                state_obj.frame_count += 1
                continue
```

- [ ] **Step 6: 구현 — Pass 2 교체 (`:146-208`)**

`# Unflatten and average embeddings per box` 주석부터 `box_embeddings[idx] = mean_emb` 까지를 통째로 교체한다. 가중평균 블록과 blur 재계산 블록이 모두 사라진다.

```python
            # Unflatten and pool embeddings per box
            curr_offset = 0
            for i, (idx, crops_list, track_id, state_obj) in enumerate(needs_extraction):
                count = crop_counts[i]
                box_embs = flat_embeddings[curr_offset : curr_offset + count]
                curr_offset += count

                # Mean pooling over multiple scales
                embedding = np.mean(box_embs, axis=0)
                norm = np.linalg.norm(embedding)
                if norm > 1e-6:
                    embedding = embedding / norm

                # 매칭 입력은 그 프레임의 임베딩이다. 트랙 이력은 임베딩이 아니라
                # 매칭 결과로 누적되므로 개체가 바뀌어도 입력이 오염되지 않는다.
                with self.profiler.profile("matcher"):
                    match_res = self.matcher.match(embedding)

                if state_obj is not None:
                    state_obj.record_match(
                        embedding,
                        match_res,
                        self.th_candidate,
                        self.th_lock,
                        self.th_hysteresis,
                    )
                    match_res = state_obj.committed

                box_match_results[idx] = match_res
                box_embeddings[idx] = embedding
```

`import cv2`는 파일 안 다른 곳에서 쓰이지 않으면 함께 지운다. `grep -n "cv2\." reid/models/reid/predict.py`로 확인한다.

- [ ] **Step 7: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_tracking.py -q`
Expected: 전부 통과. `test_state_machine_transitions`가 실패하면 멈춘다 — 그 테스트는 `matcher.match`가 매 프레임 같은 유사도를 돌려주므로 융합 결과도 같아야 하고, 라벨이 계속 "Nabi"라 전환도 일어나지 않는다.

- [ ] **Step 8: 검증**

Run: `.venv/bin/python -m pytest tests/ -q`
Expected: `test_new_optimization_configs`의 `use_weighted_mean` assert 만 남아 통과한다 (아직 설정을 안 지웠으므로 통과). 다른 실패가 있으면 보고한다.

---

## Task 6: 설정 키 정리

**Files:**
- Modify: `reid/cfg/default.yaml:24, 41-46`
- Modify: `reid/core/config.py:33, 51-56`
- Test: `tests/test_tracking.py:429` (`test_new_optimization_configs`)

**Interfaces:**
- Produces: `Config.vote_window: int = 5`

- [ ] **Step 1: 테스트를 새 계약으로 고쳐 실패시킨다**

`test_new_optimization_configs`에서 `assert cfg.use_weighted_mean is True` 줄을 삭제하고 아래를 추가한다:

```python
    assert cfg.vote_window == 5
    assert not hasattr(cfg, "use_weighted_mean")
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/python -m pytest tests/test_tracking.py::test_new_optimization_configs -q`
Expected: FAIL — `AttributeError: 'Config' object has no attribute 'vote_window'`.

- [ ] **Step 3: 구현**

`reid/core/config.py`:
- `:33` `use_weighted_mean: bool = True` 삭제
- `:56` `unknown_interval: int = 10` 다음 줄에 `vote_window: int = 5  # 트랙 라벨 투표 창. 개체 교체 전환 지연 예산이다` 추가

`reid/cfg/default.yaml`:
- `:24` `use_weighted_mean: True` 삭제
- `:46` `unknown_interval: 10` 다음 줄에 추가:
```yaml
vote_window: 5      # 트랙 라벨 투표 창(매칭 횟수). 개체 교체 전환 지연 예산이다
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/python -m pytest tests/test_tracking.py::test_new_optimization_configs -q`
Expected: PASS.

- [ ] **Step 5: 남은 참조 확인**

Run: `grep -rn "use_weighted_mean\|get_mean_embedding\|add_observation\|observations" reid/ tests/ --include=*.py`
Expected: 출력 없음. 남아 있으면 지운다.

- [ ] **Step 6: 검증**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건. **이 출력을 그대로 보고한다.**

> `config.yaml:23`에 `use_weighted_mean: True`가 남아 있다. `Config.load`가 `hasattr`로 걸러 조용히 무시하므로(`config.py:140`) 오류는 없고 기능 영향도 없다. 사용자 로컬 영역이므로 **에이전트가 지우지 않고 완료 보고에 언급한다.**

---

## Task 7: 변경 후 측정과 판단 기록

**Files:**
- Modify: `dev/notes/2026-08-28-score-fusion/README.md`
- Create: `dev/notes/2026-08-28-score-fusion/after/*.json`

- [ ] **Step 1: 변경 후 5개 영상 측정**

Run:
```bash
mkdir -p dev/notes/2026-08-28-score-fusion/after
for v in lulu_03 white_01 momo_chuchu_01 chuchu_lulu_01 momo_titi_chuchu_01; do
  PYTHONPATH=. .venv/bin/python dev/notes/2026-08-28-score-fusion/track_stability.py \
    "datasets/cream_heroes/$v.mp4" > "dev/notes/2026-08-28-score-fusion/after/$v.json"
done
```
Expected: JSON 5개 생성.

- [ ] **Step 2: 비교표 생성**

Run:
```bash
PYTHONPATH=. .venv/bin/python - <<'PY'
import json, pathlib
base = pathlib.Path("dev/notes/2026-08-28-score-fusion")
print(f"{'video':24} {'switches':>18} {'weighted_dominance':>22} {'tracks':>12}")
for v in ["lulu_03","white_01","momo_chuchu_01","chuchu_lulu_01","momo_titi_chuchu_01"]:
    b = json.loads((base/"before"/f"{v}.json").read_text())["summary"]
    a = json.loads((base/"after"/f"{v}.json").read_text())["summary"]
    print(f"{v:24} {b['total_switches']:>8} -> {a['total_switches']:<7}"
          f" {b['weighted_dominance']:>10} -> {a['weighted_dominance']:<9}"
          f" {b['tracks']:>5} -> {a['tracks']:<5}")
PY
```
Expected: 5행 비교표.

- [ ] **Step 3: README에 결과와 판단 기록**

스펙 §13의 읽는 법을 그대로 적용해 판단을 적는다.
- **다개체 영상(momo_chuchu_01, chuchu_lulu_01, momo_titi_chuchu_01)에서 `total_switches` 감소 또는 `weighted_dominance` 상승이 없으면 설계가 틀린 것이다.** 그 경우 결과를 그대로 보고하고 사용자 판단을 기다린다 — 임의로 `vote_window`를 조절하지 않는다.
- 단일 개체 영상(lulu_03, white_01)의 소폭 악화는 **예상된 지불**이다. 스펙 §16 기준으로 심각도를 판단한다.
- **`tracks` 수가 크게 변하면 주의한다.** 이 값은 트래커가 만든 트랙 수라 이번 변경과 무관해야 한다. 크게 변했다면 측정이 잘못됐거나 비결정성이 섞인 것이므로 원인을 밝힌 뒤 나머지 수치를 해석한다.

- [ ] **Step 4: 검증**

Run: `.venv/bin/python -m pytest -q && git status --short`
Expected: 실패 0건. 변경 파일 목록에 `reid/core/tracker.py`, `reid/models/reid/predict.py`, `reid/cfg/default.yaml`, `reid/core/config.py`, `tests/test_tracking.py`가 있어야 한다 (`dev/`는 gitignore 대상이라 나타나지 않는다).

---

## Task 8 (Phase B): `inference` 분해 — 순수 리팩터링

**Files:**
- Modify: `reid/models/reid/predict.py`
- Test: **변경 없음.** 테스트를 한 줄도 바꾸지 않고 전부 통과하는 것이 이 태스크의 안전 증명이다.

**Interfaces:**
- Produces (모두 `ReIdPredictor`의 비공개 메서드):
  - `_cached_result(self, track_id: Optional[int]) -> Tuple[MatchResult, np.ndarray]`
  - `_ensure_track(self, track_id: int) -> TrackState`
  - `_plan_extraction(self, results, img_pixels, box_match_results, box_embeddings) -> List[Tuple[int, List[np.ndarray], Optional[int], Optional[TrackState]]]`
  - `_extract_batch(self, needs_extraction) -> Tuple[np.ndarray, List[int]]`
  - `_resolve_matches(self, needs_extraction, flat_embeddings, crop_counts, box_match_results, box_embeddings) -> None`

- [ ] **Step 1: 리팩터링 전 그린 확인과 타입 임포트 보강**

Run: `.venv/bin/python -m pytest tests/ -q`
Expected: 실패 0건. **이 출력이 리팩터링의 기준선이다.**

이어서 `reid/models/reid/predict.py:2`의 타입 임포트를 넓힌다. 새 메서드 시그니처가 `List` · `Tuple`을 쓴다.

```python
from typing import Any, List, Optional, Tuple
```

Run: `.venv/bin/python -c "import reid.models.reid.predict"`
Expected: 오류 없음.

- [ ] **Step 2: 캐시 반환 로직을 `_cached_result`로 추출**

품질 필터 실패 경로(Task 5 Step 4)와 캐시 히트 경로(Task 5 Step 5)가 같은 3줄 분기를 중복한다. 하나로 뺀다.

```python
    def _cached_result(self, track_id: Optional[int]) -> Tuple[MatchResult, np.ndarray]:
        """캐시된 표시 라벨과 마지막 프레임 임베딩. 없으면 Unknown 과 영벡터."""
        cached = self.track_state_manager.tracks.get(track_id) if track_id is not None else None
        if cached is not None and cached.committed is not None and cached.last_embedding is not None:
            return cached.committed, cached.last_embedding
        return (
            MatchResult(cat_id="Unknown", similarity=0.0, is_known=False),
            np.zeros(self.extractor_dim, dtype=np.float32),
        )
```

두 호출부를 `box_match_results[idx], box_embeddings[idx] = self._cached_result(track_id)`로 바꾼다.

> **주의**: 캐시 히트 경로는 `_cached_result` 호출 뒤에도 `self.track_state_manager.get_match(track_id)`(LRU 갱신)와 `state_obj.frame_count += 1`을 그대로 유지해야 한다. 이 둘을 빠뜨리면 동작이 바뀐다.

- [ ] **Step 3: 그린 확인**

Run: `.venv/bin/python -m pytest tests/ -q`
Expected: 실패 0건. 실패하면 Step 2를 되돌리고 원인을 밝힌다.

- [ ] **Step 4: 트랙 생성 로직을 `_ensure_track`으로 추출**

```python
    def _ensure_track(self, track_id: int) -> TrackState:
        """트랙 상태를 얻거나 만든다. 용량이 차면 가장 오래된 트랙을 축출한다."""
        tracks = self.track_state_manager.tracks
        if track_id not in tracks:
            if len(tracks) >= self.track_state_manager.max_tracks:
                tracks.pop(next(iter(tracks)))
            tracks[track_id] = TrackState(track_id, vote_window=self.vote_window)
        return tracks[track_id]
```

- [ ] **Step 5: 그린 확인**

Run: `.venv/bin/python -m pytest tests/ -q`
Expected: 실패 0건.

- [ ] **Step 6: Pass 1을 `_plan_extraction`으로 추출**

`for idx, box in enumerate(results.boxes):` 루프 **전체**를 아래 골격으로 옮긴다. 루프 본문은 Task 5 이후의 코드를 그대로 쓰되 `continue` 대신 흐름이 같도록 유지한다. `box_match_results` / `box_embeddings`는 인자로 받아 **제자리에서** 채운다 (반환하지 않는다).

```python
    def _plan_extraction(
        self,
        results: Results,
        img_pixels: Any,
        box_match_results: List[Optional[MatchResult]],
        box_embeddings: List[Optional[np.ndarray]],
    ) -> List[Tuple[int, List[np.ndarray], Optional[int], Optional[TrackState]]]:
        """품질과 재매칭 주기를 보고 추출이 필요한 박스만 골라낸다.

        추출이 불필요한 박스(품질 미달 · 캐시 히트)는 여기서 결과를 채우고 빠진다.
        """
        needs_extraction = []

        for idx, box in enumerate(results.boxes):
            track_id = box.track_id
            crop = box.crop(img_pixels)

            with self.profiler.profile("quality_filter"):
                is_valid = self.quality_filter.is_valid(crop)

            if not is_valid:
                box_match_results[idx], box_embeddings[idx] = self._cached_result(track_id)
                continue

            if getattr(self.cfg, "use_alignment", True):
                crop = align_crop(crop, method=getattr(self.cfg, "alignment_method", "moments"))

            run_matching = True
            state_obj = None
            if track_id is not None:
                state_obj = self._ensure_track(track_id)
                run_matching = state_obj.should_match(
                    self.candidate_interval, self.lock_interval, self.unknown_interval
                )

            if not run_matching and state_obj is not None and state_obj.committed is not None:
                self.track_state_manager.get_match(track_id)      # LRU 순서 갱신
                box_match_results[idx], box_embeddings[idx] = self._cached_result(track_id)
                state_obj.frame_count += 1                        # 캐시 프레임도 주기에 센다
                continue

            if getattr(self.cfg, "use_multi_scale_crop", True):
                factors = getattr(self.cfg, "multi_scale_factors", [0.85, 1.0, 1.15])
                crops_to_extract = get_multi_scale_crops(img_pixels, box, factors)
                if getattr(self.cfg, "use_alignment", True):
                    crops_to_extract = [
                        align_crop(c, method=getattr(self.cfg, "alignment_method", "moments"))
                        for c in crops_to_extract
                    ]
            else:
                crops_to_extract = [crop]

            needs_extraction.append((idx, crops_to_extract, track_id, state_obj))

        return needs_extraction
```

> **주의**: `get_match` 호출과 `frame_count += 1` 두 줄은 반드시 남아야 한다. 전자는 LRU 순서, 후자는 재매칭 주기를 좌우한다. 빠뜨리면 동작이 바뀐다.

- [ ] **Step 7: 그린 확인**

Run: `.venv/bin/python -m pytest tests/ -q`
Expected: 실패 0건.

- [ ] **Step 8: Pass 2를 `_extract_batch` + `_resolve_matches`로 분리**

```python
    def _extract_batch(
        self,
        needs_extraction: List[Tuple[int, List[np.ndarray], Optional[int], Optional[TrackState]]],
    ) -> Tuple[np.ndarray, List[int]]:
        """박스마다 다른 개수의 크롭을 한 배치로 평탄화해 추출한다."""
        flat_crops = []
        crop_counts = []
        for _, crops_list, _, _ in needs_extraction:
            flat_crops.extend(crops_list)
            crop_counts.append(len(crops_list))

        with self.profiler.profile("extractor"):
            flat_embeddings = self.extractor.predict_batch(flat_crops)

        return flat_embeddings, crop_counts

    def _resolve_matches(
        self,
        needs_extraction: List[Tuple[int, List[np.ndarray], Optional[int], Optional[TrackState]]],
        flat_embeddings: np.ndarray,
        crop_counts: List[int],
        box_match_results: List[Optional[MatchResult]],
        box_embeddings: List[Optional[np.ndarray]],
    ) -> None:
        """배치 결과를 박스별로 되돌리고, 그 프레임 임베딩으로 매칭한다."""
        curr_offset = 0
        for i, (idx, _crops_list, _track_id, state_obj) in enumerate(needs_extraction):
            count = crop_counts[i]
            box_embs = flat_embeddings[curr_offset : curr_offset + count]
            curr_offset += count

            # Mean pooling over multiple scales
            embedding = np.mean(box_embs, axis=0)
            norm = np.linalg.norm(embedding)
            if norm > 1e-6:
                embedding = embedding / norm

            # 매칭 입력은 그 프레임의 임베딩이다. 트랙 이력은 임베딩이 아니라
            # 매칭 결과로 누적되므로 개체가 바뀌어도 입력이 오염되지 않는다.
            with self.profiler.profile("matcher"):
                match_res = self.matcher.match(embedding)

            if state_obj is not None:
                state_obj.record_match(
                    embedding, match_res,
                    self.th_candidate, self.th_lock, self.th_hysteresis,
                )
                match_res = state_obj.committed

            box_match_results[idx] = match_res
            box_embeddings[idx] = embedding
```

`_resolve_matches`의 본문은 Task 5 Step 6과 **동일한 코드**다. 로직을 새로 쓰지 말고 그대로 옮긴다.

- [ ] **Step 9: 그린 확인**

Run: `.venv/bin/python -m pytest tests/ -q`
Expected: 실패 0건.

- [ ] **Step 10: `inference` 최종 형태 확인**

`inference`는 아래 골격만 남아야 한다.

```python
    def inference(self, im: Any) -> Results:
        """검출 → 품질·스케줄 판정 → 배치 추출 → 매칭."""
        with self.profiler.profile("detection"):
            results = self.detector_predictor(im, streaming=self.streaming)
        img_pixels = results.orig_img

        n_boxes = len(results.boxes)
        box_match_results: List[Optional[MatchResult]] = [None] * n_boxes
        box_embeddings: List[Optional[np.ndarray]] = [None] * n_boxes

        needs_extraction = self._plan_extraction(
            results, img_pixels, box_match_results, box_embeddings
        )
        if needs_extraction:
            flat_embeddings, crop_counts = self._extract_batch(needs_extraction)
            self._resolve_matches(
                needs_extraction, flat_embeddings, crop_counts,
                box_match_results, box_embeddings,
            )

        results.match_results = box_match_results
        if any(emb is not None for emb in box_embeddings):
            results.embeddings = np.vstack(box_embeddings)
        return results
```

Run: `.venv/bin/python -c "import inspect, reid.models.reid.predict as m; print(len(inspect.getsource(m.ReIdPredictor.inference).splitlines()))"`
Expected: 25줄 이하 (변경 전 146줄).

- [ ] **Step 11: 최종 검증**

Run: `.venv/bin/python -m pytest -q`
Expected: 실패 0건. **Task 1 Step 1의 베이스라인과 같은 통과 건수여야 한다** (신설 9 · 삭제 2 만큼의 차이는 예상됨).

- [ ] **Step 12: 영상 동작이 안 바뀌었는지 확인**

Run:
```bash
PYTHONPATH=. .venv/bin/python dev/notes/2026-08-28-score-fusion/track_stability.py \
    datasets/cream_heroes/momo_chuchu_01.mp4 \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['summary'])"
diff <(python3 -c "import json;print(json.load(open('dev/notes/2026-08-28-score-fusion/after/momo_chuchu_01.json'))['summary'])") /dev/stdin
```
Expected: Task 7 Step 1의 `after` 수치와 **동일**. 순수 리팩터링이므로 한 자리도 달라지면 안 된다. 다르면 Step 2–8 중 어디서 동작이 바뀐 것이므로 되짚는다.

---

## 완료 보고 (Task 8 이후)

`dev/workflow.md` §6에 따라:

1. `git status` / `git diff --stat` 을 첨부해 변경 파일과 목적을 요약한다
2. Task 7의 before/after 비교표를 함께 낸다
3. `config.yaml:23`의 죽은 `use_weighted_mean` 키를 언급한다 (에이전트가 지우지 않았음)
4. **사용자가 코드를 확인할 때까지 커밋하지 않는다**
5. 커밋 요청을 받으면 논리적 단계로 나눈다:
   - `refactor(tracker): accumulate match results instead of embeddings` — `reid/core/tracker.py`, `reid/models/reid/predict.py`
   - `feat(config): add vote_window and drop use_weighted_mean` — `reid/cfg/default.yaml`, `reid/core/config.py`
   - `test(tracker): cover vote fusion and identity switching` — `tests/test_tracking.py`
   - `refactor(predict): split inference into scheduling, extraction, matching` — Phase B 분량
