# 설계 명세 — 트랙 상태를 임베딩 누적에서 매칭 결과 누적으로 전환

**작성일** 2026-08-28
**경로 분류** Architectural (매칭 입력 자체가 바뀌는 구조 변경)
**선행 문서** `dev/notes/2026-08-27-session-summary.md` §3, `dev/notes/2026-08-22-similarity-diagnosis.md` §5
**대상 파일** `reid/core/tracker.py`, `reid/models/reid/predict.py`, `reid/cfg/default.yaml`, `reid/core/config.py`, `tests/test_tracking.py`
**제안 브랜치** `refactor/track-score-fusion`

---

## 1. 목표

한 문장: **트랙이 임베딩을 누적하는 대신 매칭 결과를 누적한다.**

이로써 (a) 트랙 상태가 개체 교체에 오염되지 않고, (b) 개체가 바뀌면 즉시 인지된다.

---

## 2. 문제

`2026-08-27-session-summary.md` §3.1의 관찰: **장면이 바뀌어도 이전 개체 라벨이 유지된다.**
라벨 표시만 굳는 게 아니라 매칭 입력 자체가 오염된다.

### 2.1 원인 (코드 위치)

| # | 원인 | 위치 |
|---|---|---|
| 1 | 매칭 대상이 현재 프레임이 아니라 트랙 누적 평균이다 | `predict.py:191` `self.matcher.match(mean_emb)` |
| 2 | 축출 규칙이 옛 개체를 보호한다 — 새 관측의 유사도가 기존 최저보다 **높을 때만** 교체 | `tracker.py:48-57` |
| 3 | Locked 상태는 `lock_interval`(60프레임) 동안 캐시된 결과를 재사용한다 | `tracker.py:15-23`, `predict.py:114-121` |

개체가 바뀌면 새 개체의 유사도는 대개 더 낮으므로 2번에 의해 **새 관측이 버퍼에 들어가지 못한다.**
평균은 옛 개체에 고정되고, 최근 3장 FIFO 슬롯만 회전하므로 유사도는 흔들리되 top-1 라벨은 뒤집히지 않는다.
이것이 "유사도는 계속 변하는데 라벨만 안 변한다"는 관찰과 정합한다.

### 2.2 명세 작성 중 추가로 확인한 두 가지

**(a) 버퍼가 덮는 시간 범위가 직관보다 훨씬 길다.**
`add_observation`은 매칭이 실행되는 프레임에서만 호출된다(`predict.py:205`). 캐시 히트 프레임은
`frame_count += 1`만 한다(`predict.py:120`). 따라서 저장된 10개는 직전 10프레임이 아니라
**최근 10번의 매칭 프레임**이다. Locked 상태면 60프레임에 한 번이므로 버퍼가 최대 600프레임,
30fps 기준 **20초**를 덮는다. 원인 2에 의해 오래된 항목이 보존되면 실제 범위는 더 길어진다.

**(b) 축출 랭킹이 개별 관측의 품질을 반영하지 않는다.**
`obs["similarity"]`는 그 관측 자체의 유사도가 아니다. `predict.py:191`에서 *평균 임베딩*을 매칭한
결과를 그대로 `add_observation`에 넘기므로(`:205`), 개별 관측에 "그 시점 평균의 DB 유사도"가 붙는다.
"좋은 관측을 남긴다"는 설계 의도가 구현에서 성립하지 않는다.

---

## 3. 설계 판단

### 3.1 누적 평균은 왜 있었나 — 이득은 실재한다

`2026-08-22-similarity-diagnosis.md` §5, `ci_50` 고정 · 같은 크롭:

| 설정 | white_01 AUC | lulu_03 AUC |
|---|---|---|
| 기준 (누적 없음) | 0.9876 | 0.8871 |
| 누적 단순평균 (창 10) | 0.9961 | 0.8963 |
| **누적 가중평균 blur×면적 (창 10)** | **0.9946** | **0.9022** |
| 누적 단순평균 (창 3) | 0.9901 | 0.8921 |

작지만 일관된 이득(+0.015 AUC)이다. **다만 저 측정은 고양이 한 마리짜리 순수 트랙에서 잰 값이다.**
트랙이 오염되면 같은 메커니즘이 정확히 반대로 작동한다.

따라서 판단은 "누적 평균이 쓸모없다"가 아니라
**"트랙이 identity-pure 할 때만 이득인데, 순수성을 보장하는 장치가 코드에 하나도 없다"** 이다.

### 3.2 왜 score-level fusion 인가

지금 코드는 **feature-level fusion**(임베딩을 평균낸 뒤 한 번 식별)이다.
대안은 **score-level fusion**(매 프레임 식별한 뒤 결과를 시간축으로 융합)이다.

| 사례 | 트랙 외형 표현 | 이 문제와의 관련 |
|---|---|---|
| DeepSORT (Wojke 2017) | 최근 100개 feature gallery, 매칭은 평균이 아니라 **최소 코사인 거리** | 평균을 의도적으로 피한다 |
| BoT-SORT (2022), StrongSORT (2023) | **EMA** `f ← α·f + (1-α)·f_new` | 지수 감쇠라 오염이 유한 시간에 씻긴다. 현행 축출 규칙은 반대로 **영구 보존** |
| Deep OC-SORT (2023) *Dynamic Appearance* | EMA의 α를 검출 신뢰도로 변조 | 현행 blur×면적 가중치와 같은 발상이나, 저쪽은 **갱신 게이트**로 씀 |
| 단일객체추적 template update (distractor-aware 계열) | — | **"점수가 높을 때만 갱신"은 표적이 바뀌면 회복 불가**가 알려진 실패 모드. §2.1의 원인 2가 정확히 이것 |
| 영상 ReID (MARS 계열), QAN (Liu 2017) | 트랙릿 시간 평균 / 품질가중 풀링 | **트랙릿이 identity-pure 하다는 전제** 위에 성립 |

> 위 표는 기억에 근거한 정리다. 특정 수치(α=0.9, gallery budget=100)를 구현에 직접 쓸 일은 없으나,
> 후속 작업에서 EMA를 도입한다면 원문 확인이 필요하다.

### 3.3 대안 비교

| 대안 | 내용 | 신규 임계값 | 채택 여부 |
|---|---|---|---|
| **A. score-level fusion** | 매칭 입력을 현재 프레임으로, 트랙은 매칭 결과를 누적 | 0개 (창 크기만) | **채택** |
| B. EMA + 리셋 게이트 | `observations`를 EMA 하나로 대체, 급락 시 리셋 | α, 리셋 임계값 2개 | 기각 — 찍은 숫자 2개 |
| C. §3.4 원안 (1+2) | 현행 구조 + 급락 임계값 + 축출 조건 제거 | 급락 임계값 1개 | 기각 — 임계값 근거 없고 §2.2(a) 구조 문제 잔존 |

A를 택하는 이유:
- 찍어야 할 유사도 임계값이 없다. 트랙 내 프레임↔평균 유사도의 실측 분포가 어느 노트에도 없고,
  영상으로 그 값을 고르는 것은 `2026-08-27-session-summary.md` §2가 실증한 과적합 함정이다.
- §2.1의 원인 1·2와 §2.2의 (a)·(b)가 개별 패치가 아니라 **구조적으로** 사라진다.
- 개체 교체 감지가 "라벨 비교"라는 자명한 규칙이 된다.

---

## 4. 아키텍처

```
[현재]  프레임 임베딩 ─┐
                      ├─→ 가중평균 ─→ matcher.match ─→ 라벨
        관측 버퍼 10개 ─┘                                 └─→ 관측 버퍼에 되먹임 (오염 경로)

[변경]  프레임 임베딩 ───→ matcher.match ─→ 프레임 라벨 ─→ 투표 창(최근 N개) ─→ 표시 라벨
                                              └─→ 표시 라벨과 불일치 시 창 비움
```

되먹임 고리가 끊긴다. 임베딩은 어디에도 축적되지 않으므로 **오염될 상태 자체가 존재하지 않는다.**

---

## 5. 데이터 구조 — `TrackState`

| 항목 | 현재 | 변경 후 |
|---|---|---|
| 누적 대상 | `observations: List[{embedding, similarity, frame_idx, weight}]` (≤10) | `votes: Deque[MatchResult]` (maxlen=`vote_window`) |
| 표시값 | `match_result` = 마지막 매칭 결과 | `committed: Optional[MatchResult]` = 투표 융합 결과 |
| 표시용 임베딩 | `get_mean_embedding()` 이 매번 계산 | `last_embedding: Optional[np.ndarray]` — 마지막 프레임 임베딩 1개를 단순 보관 |
| 갱신 진입점 | `add_observation(embedding, match_res, ...)` | `record_match(embedding, match_res, thresholds) -> None` |
| 유지 | `state`, `frame_count`, `last_match_frame`, `should_match`, `update_state` | 동일 |

`MatchResult`(`core/types.py:26`)는 `(cat_id, similarity, is_known)`을 이미 갖고 있어 그대로 담는다.
**새 타입을 만들지 않는다.**

§2.2(b)의 결함이 여기서 함께 사라진다 — 저장하는 유사도가 그 프레임 자신의 매칭 결과가 된다.

---

## 6. 시간 융합 규칙

`faiss.py:98-109`의 kNN voting과 **동일한 규칙을 시간축에 적용**한다. 저장소 안에서 규칙이 하나로 통일된다.

```text
fuse(votes) -> MatchResult:
    known = [v for v in votes if v.is_known]
    if len(known) * 2 < len(votes):            # known 이 절반 미만 (동수는 known 으로 인정)
        return MatchResult("Unknown", 0.0, is_known=False)
    라벨별로 similarity 를 합산한다
    best  = 합계가 최대인 라벨
    return MatchResult(best, best 라벨의 평균 similarity, is_known=True)
```

`votes`가 비어 있으면 `committed`는 `None`이며, 호출부는 `MatchResult("Unknown", 0.0, False)`를 쓴다.

**known 절반 게이트가 필요한 이유**: `FaissMatcher.match`는 임계값 미달 시 `cat_id="Unknown"`으로
뭉개므로 원래 라벨을 잃는다(`faiss.py:111-114`). 따라서 Unknown 결과를 라벨로 투표시킬 수 없다.
대신 "known 이 절반 이상인가"라는 게이트로만 쓴다. 미등록 개체가 지속되면 known 이 절반을 못 채워
Unknown 이 유지된다. `vote_window: 5` 기준으로 known 이 3개 이상이어야 라벨이 선다.

**동점 처리**: 합계가 같으면 `votes`에서 **더 최근에 등장한 라벨**을 택한다.

**숫자에 대한 고백**: "절반(0.5)"은 다수결이라 근거를 댈 수 있다. `vote_window`는 찍은 숫자다.
다만 유사도 임계값과 성격이 다르다 — 물리적 의미가 "전환 지연 몇 회의 매칭"으로 해석되는
**지연 예산**이지, 성능 수치를 보고 되돌려 조절할 대상이 아니다. 기본값 **5**로 시작한다.

---

## 7. 개체 교체 감지

```text
record_match(embedding, now, thresholds):
    switched = (now.is_known
                and committed is not None and committed.is_known
                and now.cat_id != committed.cat_id)

    if switched:
        votes.clear()

    votes.append(now)
    committed        = fuse(votes)
    last_embedding   = embedding

    if switched:
        state = "Unknown"                            # 강등을 이번 프레임에 확정한다
    else:
        update_state(committed.similarity, ...)      # 평소 경로

    last_match_frame = frame_count
    frame_count     += 1
```

**전환이 감지된 프레임에서는 `update_state` 를 건너뛴다.** 그러지 않으면 창을 비운 직후
`committed` 가 새 라벨 하나뿐이라 `similarity` 가 `th_lock` 을 넘을 수 있고, 방금 내린 강등이
같은 프레임에서 되돌아간다. 강등의 목적은 다음 매칭을 10프레임 뒤로 앞당기는 것이므로
한 프레임은 Unknown 으로 유지되어야 한다. 다음 매칭부터 평소 경로로 복귀한다.

**patience 없이 1회 불일치로 즉시 전환한다.**

노이즈 1회에 창이 비는 취약점이 있으나, 완화책이 새 장치 없이 나온다.
불일치 시 `state`를 Unknown 으로 내리면 재매칭 간격이 `unknown_interval`(10프레임)로 좁혀진다
(`tracker.py:17-18`). 확신이 없을 때 자주 보게 되고, 노이즈였다면 다음 몇 번의 매칭으로
원래 라벨이 창을 되찾는다.

이것이 §2.1 원인 3(Locked 60프레임 캐시)에 대한 답이다. **캐시 간격 자체는 건드리지 않되,
틀렸을 가능성이 보이는 순간 Locked 에서 내려온다.**

---

## 8. 상태 머신과의 접점

`update_state`에 넘기는 similarity 를 **`committed.similarity`** 로 한다 (현재 프레임 단독값이 아니라).

- Locked 는 "확신" 상태이므로 시간 융합된 값으로 판정하는 것이 맞다.
- 단일 프레임의 노이즈로 Lock 이 튀는 것을 막는다.
- §7의 불일치 감지만이 이를 우회해 강제로 Unknown 으로 내린다.

`th_candidate` / `th_lock` / `th_hysteresis` / 각 interval 은 **전부 그대로 둔다.**

---

## 9. `predict.py` 변경

| 위치 | 현재 | 변경 후 |
|---|---|---|
| `:191` 매칭 입력 | `mean_emb` (누적 가중평균) | `embedding` (현재 프레임) |
| `:159-187` 가중평균 계산 | blur×면적 가중치로 최대 11개 평균 | **삭제** |
| `:194-205` 관측 저장 | `update_state` → 가중치 재계산 → `add_observation` | `record_match(embedding, now, ...)` 한 번 |
| `:116-121` 캐시 히트 | `match_result` + `get_mean_embedding()` | `committed` + 마지막 프레임 임베딩 |
| `:91-97` 품질 필터 실패 | `cached.match_result` + 평균 임베딩 | `cached.committed` + 마지막 프레임 임베딩 |
| `:212` `results.embeddings` | 평균 임베딩 | 현재 프레임 임베딩 |

`cv2.Laplacian` 호출이 매칭 프레임마다 2회씩 돌던 것이 0회가 된다. 부수적 성능 이득이다.

`TrackState`는 캐시 히트·품질 실패 경로에서 돌려줄 **마지막 프레임 임베딩 1개**를 보관한다
(`last_embedding`). 누적이 아니라 단순 보관이므로 오염 경로가 아니다.

> `results.embeddings`는 저장소 안에 **소비처가 없다**(대입만 있고 읽는 곳 없음, `grep` 확인).
> 죽은 출력이지만 이번 범위 밖이라 지우지 않고, 값만 더 정직한 것으로 채운다.

---

## 10. 설정

| 키 | 조치 | 기본값 |
|---|---|---|
| `vote_window` | **신설** — `default.yaml` + `Config` 데이터클래스 양쪽 | `5` |
| `use_weighted_mean` | **삭제** — 평균이 사라져 쓸 곳이 없음 | — |
| threshold_* / *_interval / `k` / `max_tracks` | 변경 없음 | — |

`use_weighted_mean` 삭제 후에도 `config.yaml`(gitignore 대상)에 남은 키는 `Config.load` 가
`hasattr` 로 걸러 조용히 무시한다(`config.py:140`). 오류는 나지 않는다. §15-3 참조.

---

## 11. 삭제 대상

- `TrackState.observations`, `get_mean_embedding`, `add_observation`의 축출 규칙 전체
- `TrackStateManager.get_match` / `update_track`의 `use_weighted` 인자
- `predict.py`의 blur×면적 가중치 계산 블록 2곳

**남기는 것**: `TrackStateManager`의 LRU 축출과 `max_tracks`, 그리고 클래스 docstring 의
`TODO(트랙 병합)`. 후자는 여전히 유효한 미해결 과제다.

---

## 12. 테스트 전략

GPU 의존·비결정성이 없고 전부 CPU 수초 내에 끝나므로 **TDD 예외 규정(`dev/workflow.md` §4)을 적용하지 않는다.**

### 12.1 신설

| 테스트 | 검증 내용 |
|---|---|
| `test_vote_fusion_sums_similarity` | 창 `[A .8, A .8, B .9]` → A (합 1.6 > 0.9) |
| `test_vote_fusion_unknown_gate` | known 2 / unknown 3 → `Unknown` |
| `test_vote_fusion_tie_prefers_recent` | 합계 동점 → 더 최근 라벨 |
| `test_identity_switch_clears_votes` | 라벨 불일치 → 창 초기화 + `state == "Unknown"` |
| `test_identity_switch_survives_high_similarity` | 불일치 프레임의 새 라벨 유사도가 `th_lock` 을 넘어도 `state` 가 Unknown 으로 유지됨 |
| `test_match_uses_current_frame_embedding` | `matcher.match` 호출 인자가 현재 프레임 임베딩임 |
| `test_cache_hit_returns_committed` | 캐시 히트 시 `committed` 반환 |

### 12.2 수정

- `test_track_state_manager` (`test_tracking.py:144`) — observations 상한 assert → votes 상한
- `test_new_optimization_configs` (`test_tracking.py:429`) — `use_weighted_mean` assert 제거

### 12.3 삭제

- `test_smart_eviction` (`test_tracking.py:403`) — 검증 대상 규칙이 사라짐
- `test_tracker_weighted_mean_embedding` (`test_tracking.py:463`) — 가중평균이 사라짐

### 12.4 그린 베이스라인

착수 전 `.venv/bin/python -m pytest -q` 전체 통과를 확인한다.

---

## 13. 수동 검증 (참고 실행)

두 축으로 실행한다. 오프라인 스크립트는 `dev/notes/2026-08-28-score-fusion/`에 둔다.

| 영상 | 재는 것 | 읽는 법 |
|---|---|---|
| `lulu_03`, `white_01` (단일 개체) | 순수 트랙에서 **지불하는 비용** | 소폭 하락은 **예상된 지불**이지 실패가 아니다 |
| `momo_chuchu_01`, `chuchu_lulu_01`, `momo_titi_chuchu_01` (다개체) | 노리는 **이득** | 트랙별 라벨 전환 횟수 · 지배 라벨 프레임 점유율. **개선이 없으면 설계가 틀린 것** |

`2026-08-22` 노트는 단일 개체 영상만 썼다. 트랙 오염은 다개체 영상에서만 실제로 일어나므로
이번에 처음으로 해당 자산(`datasets/cream_heroes/`)을 쓴다.

**측정의 한계를 미리 못 박는다.**
- 다개체 영상에 프레임 단위 정답 라벨이 없다. 라벨 안정성 지표와 육안 확인이 전부이며,
  정확도 자체는 정량화하지 못한다.
- 이 실행의 목적은 **"나빠지지 않았는지"** 확인이지 **"좋아졌는지"** 측정이 아니다.
  `2026-08-27-session-summary.md` §2.1이 실증한 대로 이 측정의 해상도는 ±7%p 수준이다.
- **숫자를 보고 `vote_window`를 되돌려 조절하지 않는다.** 그것이 §2가 경고한 과적합이다.

---

## 14. 범위 밖 (후속 작업)

| 항목 | 이유 |
|---|---|
| `with_reid` / 트래커 교체 | 근본 원인(ID 스위치) 쪽 처방이나 훨씬 큰 작업. 아래 §14.1 |
| `unknown_interval` 기본값 조정 (`session-summary` §3.3) | §7의 Unknown 강등이 같은 문제를 건드린다. 그 효과를 본 뒤 판단 |
| 라벨 게이트를 통과한 임베딩만 평균 | 누적평균 이득을 지키는 절충안이나 "매칭→라벨→게이트→평균→매칭" 순환이 생긴다. 손실이 실제 문제가 되면 그때 (YAGNI) |
| 하이퍼파라미터 재조정 (`session-summary` §4) | 학습 쪽 처방이라 무관 |
| 끊긴 트랙의 사후 병합 (`tracker.py`의 TODO) | 별개 과제 |

### 14.1 `with_reid` 조사 결과 (후속 작업용 메모)

- **현재 트래커 `fasttrack`은 `with_reid`를 지원하지 않는다.** `fast_tracker.py:104` 에서
  `FASTTracker(BYTETracker)` 이고, ReID 훅은 `botsort` / `tracktrack` / `deepocsort` 에만 있다
  (`trackers/track.py:62`). 쓰려면 트래커부터 교체해야 하며, `fasttrack.yaml` 의 가림 처리
  노브(`occ_*`)를 포기하는 거래다.
- 두 경로가 있다.
  - `model: auto` — YOLO Detect 레이어 입력 피처를 pre-hook 으로 가로챈다(`track.py:64-75`).
    **추가 모델 없음, 추출 비용 ≈ 0.** 검출용 피처라 동종 개체 구분력은 약하나 IoU 단독보다 낫다.
  - `model: <경로>` — 외부 ReID 모델. `weights/mega_descriptor.onnx`(이미 `export()` 존재)를 꽂을 수 있다.
- **외부 모델 경로의 비용이 결정적이다.** `trackers/utils/reid.py` 의 `ReID.__call__` 은
  **매 프레임 모든 검출 박스**에 인코더를 돌린다. 우리 상태 머신은 Locked 면 60프레임에 한 번만
  추출하는데 트래커 인코더는 그 절감을 무시한다. Swin 기반이라 실시간성 손실 위험이 크고,
  **같은 크롭을 두 번 추출**하게 된다.
- **전처리도 다르다.** ultralytics 는 `save_one_box(gain=1.02, pad=10)` 로 자르고 `imgsz`(기본 224,
  ONNX 정적 shape 이면 그 값)로 리사이즈한다. 우리는 `box.crop()` + 384 다. 같은 모델이라도
  다른 입력을 본다.
- **권장 순서**: 본 작업(A)을 먼저 해서 트랙이 오염돼도 견디게 만든다. ID 스위치의 피해가 줄면
  `with_reid` 의 시급성도 내려간다. 그다음 싼 첫 수는 **`tracktrack` + `model: auto`** 다
  (추가 모델 없이 트래커 yaml 교체 수준이라 실험 비용이 낮고, `min_track_len: 3` 과 TAI 가
  `session-summary` §3.2 의 "약한 검출마다 새 ID" 문제도 함께 건드린다).

---

## 15. 리스크

1. **순수 트랙에서 정확도 손실.** §3.1이 잰 +0.015 AUC 를 잃을 수 있다.
   시간 투표가 이를 메우는지는 §13의 단일 개체 영상으로 확인한다. 메우지 못하더라도
   오염 내성과 맞바꾼 것이므로 그 자체가 실패 판정은 아니다.
2. **다개체 영상에 정답 라벨이 없어** 이득을 정량화하지 못한다.
3. **`config.yaml:23` 에 `use_weighted_mean: True` 가 실제로 있다 (확인 완료).**
   `Config.load` 는 `hasattr` 로 걸러 미지의 키를 조용히 무시하므로(`config.py:140`) 오류는 나지 않는다.
   기능상 영향은 없으나 죽은 설정이 남는다. `config.yaml` 은 gitignore 대상인 사용자 로컬 영역이므로
   **에이전트가 임의로 지우지 않고 착수 시 사용자에게 확인한다.**
4. **`vote_window` 가 지연 예산이므로**, 값이 크면 개체 교체 전환이 느려지고 작으면 노이즈에 흔들린다.
   §7의 Unknown 강등이 후자를 완화하지만 완전히 없애지는 못한다.

---

## 16. 성공 기준

- 신설·수정 테스트를 포함한 `pytest` 전체 통과 (실패 0건)
- 다개체 영상에서 트랙별 라벨 전환 횟수가 감소하고 지배 라벨 점유율이 상승
- 단일 개체 영상에서 급격한 하락이 없음. §3.1 표의 AUC 기준으로 0.05 를 넘는 하락은 재검토 사유로 본다
  (그보다 작은 변동은 `session-summary` §2.1 이 실증한 측정 해상도 안이라 판단 근거로 쓰지 않는다)

---

## 추록 A — 트랙 생명주기 책임 통합과 DEBUG 로깅 (2026-08-29)

본 계획 완료 후 사용자 지적으로 추가한 변경. **원 명세의 범위 밖이다.**

### A.1 지적된 문제

Phase B 에서 추출한 `ReIdPredictor._ensure_track` 과 `TrackStateManager.update_track` 이
"없으면 생성 + 용량 초과 시 축출" 로직을 각자 갖고 있었다. 트랙 생명주기는 매니저의 책임인데
예측기가 그 일을 대신하고 있었다 — SOLID 위반이다.

### A.2 `update_track` 으로 대체할 수 없었던 이유

`update_track` 은 `embedding` 과 `match_res` 를 요구하는데, `_ensure_track` 이 호출되는
`_plan_extraction`(Pass 1) 시점에는 둘 다 없다. 파이프라인이 "생성"과 "기록"을 배치 추출
경계로 갈라 쓰기 때문이다.

```
Pass 1  _plan_extraction   트랙 객체 필요 -> should_match() 로 추출 여부 결정
          v (배치 추출 경계)
Pass 2  _resolve_matches   임베딩·매칭 결과 확보 -> record_match()
```

### A.3 조치

`ensure()` 를 `TrackStateManager` 로 올리고 `update_track` 이 그것을 부르게 했다.

```python
def ensure(self, track_id) -> TrackState:      # 생성 · 축출 · LRU 갱신 — 단일 구현
def update_track(self, ...) -> None:
    self.ensure(track_id).record_match(...)
```

- 생성·축출 구현이 하나로 통일됐다 (`_ensure_track` 삭제)
- 예측기가 `manager.tracks` 내부를 만지는 곳이 4군데 -> 2군데(`reset`, `_cached_result`)로 줄었다

### A.4 함께 고친 잠재 버그 — 활성 트랙의 LRU 미갱신

`_ensure_track` 은 기존 트랙의 LRU 순서를 갱신하지 않았다. 매칭 경로(Pass 2)에서도
`get_match` 를 부르지 않으므로, **캐시 히트가 아닌 매칭 경로만 타는 트랙은 아무리 활성이어도
"가장 오래 안 쓴 트랙"으로 남아 축출될 수 있었다.** 갱신은 캐시 히트 경로에서만 일어났다.

이는 본 작업 이전부터 있던 동작이다(변경 전 `predict.py` 도 같은 모양). `ensure()` 에
move-to-end 를 넣어 함께 고쳤다.

**이 부분은 순수 리팩터링이 아니라 동작 변경이다.** 축출 순서가 바뀐다.
다만 보유 영상 5개는 `max_tracks=1000` 에 닿지 않아 측정 JSON 이 변경 전과 바이트 단위로
일치했다 — 즉 관측 가능한 차이는 없었다.

### A.5 DEBUG 로깅 추가

`reid/core/tracker.py` 에 `from reid.utils import LOGGER` 를 두고 네 사건을 남긴다.

| 사건 | 위치 | 예시 |
|---|---|---|
| 트랙 생성 | `ensure` | `Track 5 created (vote_window=5, tracked=3/1000)` |
| LRU 축출 | `ensure` | `Track 2 evicted (LRU, max_tracks=1000)` |
| 개체 교체 | `record_match` | `Track 5 identity switch Nabi -> Mimi (frame sim 0.912); votes cleared, demoted to Unknown` |
| 라벨/상태 변화 | `record_match` | `Track 5 label Nabi -> Unknown (fused 0.412, votes 5, state Locked -> Unknown)` |

**매 매칭마다 찍지 않고 라벨이나 상태가 실제로 바뀔 때만 남긴다.** 노이즈를 줄이기 위해서다.
라벨 변화 로그는 이번 세션에서 `diagnose_unknown_gate.py` 를 따로 짜서 알아내야 했던
`known <-> Unknown` 전이를 그대로 찍어준다.

### A.6 검증

- 신설 테스트 5개 (`ensure` 생성/LRU 갱신, `update_track` 위임, 교체 로그, 생명주기 로그)
- `pytest` **198 passed** (193 + 5)
- 영상 5개 측정 JSON 이 통합 전과 바이트 단위 일치
