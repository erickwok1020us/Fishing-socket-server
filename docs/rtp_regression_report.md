# RTP Phase 1 Regression Report

- **Date**: 2026-02-14
- **Commit**: `8985a3cf5c4474d946a70c1b169ff04e7c7ca393`
- **Seed**: 20260213
- **Elapsed**: 550.4s
- **Result**: **ALL PASS** (48/48)

## SSOT Reference

| Tier | RTP target | N1 | reward_fp | pityCompFp |
|------|-----------|-----|-----------|------------|
| T1 | 90% | 6 | 4500 | 367403 |
| T2 | 92% | 10 | 7666 | 343881 |
| T3 | 93% | 16 | 12400 | 331913 |
| T4 | 94% | 30 | 23500 | 323159 |
| T5 | 94.5% | 45 | 35437 | 319944 |
| T6 | 95% | 120 | 95000 | 316012 |

## A. Single-target 1x (per-tier)

| Tier | Target | Observed | Diff | AvgShots | PityRate | MaxShots | N1 | MinBudget | DebtBreaches | Result |
|------|--------|----------|------|----------|---------|----------|-----|-----------|-------------|--------|
| T1 | 90% | 90.0895% | +0.0895% | 5 | 67.78% | 6 | 6 | -3600 | 0 | PASS |
| T2 | 92% | 92.0461% | +0.0461% | 8.33 | 67.69% | 10 | 10 | -6746 | 0 | PASS |
| T3 | 93% | 93.0779% | +0.0779% | 13.32 | 67.6% | 16 | 16 | -11470 | 0 | PASS |
| T4 | 94% | 94.1169% | +0.1169% | 24.97 | 67.45% | 30 | 30 | -22560 | 0 | PASS |
| T5 | 94.5% | 94.5681% | +0.0681% | 37.47 | 67.48% | 45 | 45 | -34492 | 0 | PASS |
| T6 | 95% | 95.1407% | +0.1407% | 99.85 | 67.33% | 120 | 120 | -94050 | 0 | PASS |

## B. Shotgun 3x (shared state)

| Mode | Tier | Target | Observed | Diff | DoublePay | Result |
|------|------|--------|----------|------|-----------|--------|
| allHit | T1 | 90% | 90.0773% | +0.0773% | 0 | PASS |
| allHit | T2 | 92% | 92.1182% | +0.1182% | 0 | PASS |
| allHit | T3 | 93% | 93.1607% | +0.1607% | 0 | PASS |
| allHit | T4 | 94% | 94.0646% | +0.0646% | 0 | PASS |
| allHit | T5 | 94.5% | 94.5852% | +0.0852% | 0 | PASS |
| allHit | T6 | 95% | 95.1177% | +0.1177% | 0 | PASS |
| mixed30 | T1 | 90% | 90.1032% | +0.1032% | 0 | PASS |
| mixed30 | T2 | 92% | 92.0901% | +0.0901% | 0 | PASS |
| mixed30 | T3 | 93% | 93.0367% | +0.0367% | 0 | PASS |
| mixed30 | T4 | 94% | 94.0631% | +0.0631% | 0 | PASS |
| mixed30 | T5 | 94.5% | 94.5748% | +0.0748% | 0 | PASS |
| mixed30 | T6 | 95% | 95.0851% | +0.0851% | 0 | PASS |

## C. AOE 5x (budget conservation)

- Budget conservation fails: **0** / 300000 events — **PASS**

> **Note on per-tier RTP**: Multi-target observed RTP per-tier appears low (~30%) because each fish only receives a weighted fraction of the total weapon cost. The primary invariant here is budget conservation (Σbudget_i_fp == budget_total_fp), not per-fish RTP convergence. Single-target tests (A/B) verify per-tier RTP convergence.

| Tier | Target | Observed |
|------|--------|----------|
| T1 | 90% | 34.1686% |
| T2 | 92% | 31.4568% |
| T3 | 93% | 30.6739% |
| T4 | 94% | 30.7425% |
| T5 | 94.5% | 30.1426% |
| T6 | 95% | 27.3391% |

## D. Laser 8x (budget conservation)

- Budget conservation fails: **0** / 300000 events — **PASS**

> **Note**: Same caveat as AOE — per-tier RTP reflects weighted fraction, not full-cost convergence.

| Tier | Target | Observed |
|------|--------|----------|
| T1 | 90% | 38.0269% |
| T2 | 92% | 31.6276% |
| T3 | 93% | 30.4279% |
| T4 | 94% | 30.1719% |
| T5 | 94.5% | 30.4749% |
| T6 | 95% | 31.092% |

## E. Multi-fish Isolation

- Fish A (T6): observed=95.1434%, diff=+0.1434% — **PASS**
- Fish B (T1): observed=90.1182%, diff=+0.1182% — **PASS**

## F. Miss Handling

- State violations from miss: **0** — **PASS**
- Miss-only-fire state changes: **0** — **PASS**
- Note: miss (hit=false) is handled at the caller level (fish3DGameEngine / multiplayer handler); RTPPhase1 only processes hit=true events. Fire cost deduction is external.

## Invariants Verified

| Invariant | Status |
|-----------|--------|
| Per-tier RTP convergence ±1% (1x) | PASS |
| Hard pity max shots ≤ N1 | PASS |
| Controlled debt within guardrail | PASS |
| Shotgun RTP convergence | PASS |
| Shotgun no double-pay | PASS |
| AOE budget conservation (Σbudget_i == budget_total) | PASS |
| Laser budget conservation (Σbudget_i == budget_total) | PASS |
| Multi-fish isolation (state key = player_id:fish_id) | PASS |
| Miss does not mutate RTP state | PASS |
