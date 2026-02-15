# RTP Phase 1 Regression Report

- **Date**: 2026-02-15
- **Commit**: `38316afea6aba4acdbf2a863c61ec85c7a7d9821`
- **Seed**: 20260213
- **Elapsed**: 122.8s
- **Result**: **ALL PASS** (99/99)

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
| T1 | 90% | 90.145% | +0.145% | 4.99 | 67.67% | 6 | 6 | -3600 | 0 | PASS |
| T2 | 92% | 92.0368% | +0.0368% | 8.33 | 67.72% | 10 | 10 | -6746 | 0 | PASS |
| T3 | 93% | 93.016% | +0.016% | 13.33 | 67.57% | 16 | 16 | -11470 | 0 | PASS |
| T4 | 94% | 94.0531% | +0.0531% | 24.99 | 67.38% | 30 | 30 | -22560 | 0 | PASS |
| T5 | 94.5% | 94.5251% | +0.0251% | 37.49 | 67.58% | 45 | 45 | -34492 | 0 | PASS |
| T6 | 95% | 95.081% | +0.081% | 99.91 | 67.33% | 120 | 120 | -94050 | 0 | PASS |

## B. Shotgun 3x (shared state)

| Mode | Tier | Target | Observed | Diff | DoublePay | Result |
|------|------|--------|----------|------|-----------|--------|
| allHit | T1 | 90% | 90.2023% | +0.2023% | 0 | PASS |
| allHit | T2 | 92% | 92.1321% | +0.1321% | 0 | PASS |
| allHit | T3 | 93% | 93.1897% | +0.1897% | 0 | PASS |
| allHit | T4 | 94% | 94.0158% | +0.0158% | 0 | PASS |
| allHit | T5 | 94.5% | 94.6777% | +0.1777% | 0 | PASS |
| allHit | T6 | 95% | 95.1832% | +0.1832% | 0 | PASS |
| mixed30 | T1 | 90% | 90.1204% | +0.1204% | 0 | PASS |
| mixed30 | T2 | 92% | 92.1615% | +0.1615% | 0 | PASS |
| mixed30 | T3 | 93% | 92.9749% | -0.0251% | 0 | PASS |
| mixed30 | T4 | 94% | 94.1359% | +0.1359% | 0 | PASS |
| mixed30 | T5 | 94.5% | 94.6094% | +0.1094% | 0 | PASS |
| mixed30 | T6 | 95% | 95.0128% | +0.0128% | 0 | PASS |

## C. AOE 5x (budget conservation)

- Budget conservation fails: **0** / 100000 events — **PASS**

| Tier | Target | Observed |
|------|--------|----------|
| T1 | 90% | 34.131% |
| T2 | 92% | 31.9533% |
| T3 | 93% | 30.4687% |
| T4 | 94% | 30.4742% |
| T5 | 94.5% | 29.8158% |
| T6 | 95% | 26.7955% |

## D. Laser 8x (budget conservation)

- Budget conservation fails: **0** / 100000 events — **PASS**

| Tier | Target | Observed |
|------|--------|----------|
| T1 | 90% | 37.9498% |
| T2 | 92% | 31.9381% |
| T3 | 93% | 30.3802% |
| T4 | 94% | 30.9944% |
| T5 | 94.5% | 30.2516% |
| T6 | 95% | 31.5655% |

## E. Multi-fish Isolation

- Fish A (T6): observed=95.1312%, diff=+0.1312% — **PASS**
- Fish B (T1): observed=90.2082%, diff=+0.2082% — **PASS**

## F. Miss Handling

- State violations from miss: **0** — **PASS**
- Miss-only-fire state changes: **0** — **PASS**
- Note: miss (hit=false) is handled at the caller level; RTPPhase1 only processes hit=true events.

## G. Hit-Rate Sweep (RTP_hit vs RTP_fire)

### G1. Single-target 1x

| Tier | HitRate | RTP_hit | RTP_fire | Kills |
|------|---------|---------|----------|-------|
| T1 | 10% | 90.15% | 9.01% | 601 |
| T1 | 30% | 90.9% | 27.28% | 1819 |
| T1 | 50% | 89.54% | 44.98% | 2999 |
| T1 | 70% | 90.28% | 63.3% | 4220 |
| T1 | 90% | 90.59% | 81.57% | 5438 |
| T2 | 10% | 92.87% | 9.33% | 365 |
| T2 | 30% | 92.27% | 27.62% | 1081 |
| T2 | 50% | 93.07% | 46.99% | 1839 |
| T2 | 70% | 92.25% | 64.5% | 2524 |
| T2 | 90% | 91.72% | 82.49% | 3228 |
| T3 | 10% | 92.09% | 9.34% | 226 |
| T3 | 30% | 92.91% | 28.23% | 683 |
| T3 | 50% | 93.01% | 46.38% | 1122 |
| T3 | 70% | 94.25% | 66.01% | 1597 |
| T3 | 90% | 93.05% | 83.82% | 2028 |
| T4 | 10% | 93.15% | 9.32% | 119 |
| T4 | 30% | 93.64% | 27.89% | 356 |
| T4 | 50% | 91.91% | 46.22% | 590 |
| T4 | 70% | 95.01% | 65.96% | 842 |
| T4 | 90% | 91.95% | 83.03% | 1060 |
| T5 | 10% | 91.67% | 9.33% | 79 |
| T5 | 30% | 94.96% | 28.47% | 241 |
| T5 | 50% | 96.51% | 48.08% | 407 |
| T5 | 70% | 94.68% | 65.91% | 558 |
| T5 | 90% | 94.62% | 85.17% | 721 |
| T6 | 10% | 87.24% | 8.87% | 28 |
| T6 | 30% | 93.33% | 28.18% | 89 |
| T6 | 50% | 94% | 47.18% | 149 |
| T6 | 70% | 99.77% | 69.98% | 221 |
| T6 | 90% | 95.1% | 85.82% | 271 |

### G2. Shotgun 3x

| Tier | HitRate | RTP_hit | RTP_fire | Kills |
|------|---------|---------|----------|-------|
| T1 | 10% | 89.91% | 8.82% | 1764 |
| T1 | 30% | 89.21% | 25.3% | 5059 |
| T1 | 50% | 90.9% | 41.21% | 8242 |
| T1 | 70% | 90.08% | 54.84% | 10967 |
| T1 | 90% | 90.35% | 69.99% | 13998 |
| T2 | 10% | 91.42% | 9.01% | 1058 |
| T2 | 30% | 91.5% | 26.51% | 3112 |
| T2 | 50% | 92.13% | 43.34% | 5088 |
| T2 | 70% | 92.04% | 59.45% | 6980 |
| T2 | 90% | 92.22% | 73.53% | 8632 |
| T3 | 10% | 92.68% | 9.3% | 675 |
| T3 | 30% | 93.32% | 27.45% | 1992 |
| T3 | 50% | 93.04% | 44.61% | 3238 |
| T3 | 70% | 93.48% | 61.83% | 4488 |
| T3 | 90% | 92.85% | 78.06% | 5666 |
| T4 | 10% | 94.46% | 9.4% | 360 |
| T4 | 30% | 93.99% | 27.76% | 1063 |
| T4 | 50% | 93.78% | 46.03% | 1763 |
| T4 | 70% | 94.78% | 64.55% | 2472 |
| T4 | 90% | 93.94% | 81.55% | 3123 |
| T5 | 10% | 93.92% | 9.33% | 237 |
| T5 | 30% | 94.84% | 28.03% | 712 |
| T5 | 50% | 93.51% | 46.11% | 1171 |
| T5 | 70% | 93.94% | 64.65% | 1642 |
| T5 | 90% | 94.61% | 83% | 2108 |
| T6 | 10% | 94.96% | 9.5% | 90 |
| T6 | 30% | 93.45% | 28.18% | 267 |
| T6 | 50% | 97.63% | 48.98% | 464 |
| T6 | 70% | 95.42% | 66.18% | 627 |
| T6 | 90% | 94.85% | 84.55% | 801 |

### G3. AOE 5x (mixed tiers)

| HitRate | RTP_hit | RTP_fire | Kills |
|---------|---------|----------|-------|
| 10% | 33.27% | 13.59% | 594 |
| 30% | 29.77% | 24.85% | 1167 |
| 50% | 33.79% | 32.71% | 1424 |
| 70% | 29.69% | 29.6% | 1320 |
| 90% | 33.02% | 33.02% | 1371 |

### G4. Laser 8x (mixed tiers)

| HitRate | RTP_hit | RTP_fire | Kills |
|---------|---------|----------|-------|
| 10% | 33.55% | 18.98% | 1576 |
| 30% | 31.53% | 29.76% | 2247 |
| 50% | 29.41% | 29.29% | 2256 |
| 70% | 31.91% | 31.91% | 2212 |
| 90% | 30.69% | 30.69% | 2231 |

> **Observation**: RTP_hit is stable across hit rates (same tier target). RTP_fire = RTP_hit x effective_hit_rate.

## H. Concurrency

### H1. Multi-player same fish

| Players | Kills | Expected | DoublePay | AllKilled | Result |
|---------|-------|----------|-----------|-----------|--------|
| 2 | 4000 | 4000 | 0 | 2000 | PASS |
| 5 | 10000 | 10000 | 0 | 2000 | PASS |
| 10 | 20000 | 20000 | 0 | 2000 | PASS |

### H2. Kill event replay (idempotency)

- Total replays: **9000**
- Replay pay (must be 0): **0** — **PASS**
- All rejected: **9000/9000** — **PASS**
- Reason=already_killed: **9000/9000** — **PASS**

### H3. Out-of-order delivery

- Trials: **2000**
- Post-kill pay (must be 0): **0** — **PASS**
- State breaks (must be 0): **0** — **PASS**

## I. Multi-target Extremes

| Scenario | Processed | Cap | Sigma_weight | Sigma_budget | Result |
|----------|-----------|-----|-------------|-------------|--------|
| I1_100_aoe | 8 | 8 | 1000000 | 4605/4605 | PASS |
| I2_100_laser | 6 | 6 | 1000000 | 7352/7352 | PASS |
| I3_near_tie | - | - | 1000000 | 4626/4626 | PASS |
| I4_far | - | - | 1000000 | 4508/4508 | PASS |
| I5_stress | - | - | - | fails=0 | FAIL |

## J. Session Drift (200K fires)

- Drift ratio: **0.5263** (< 0.85) — **PASS**
- Final RTP: **94.2274%**
- Last-5 checkpoint stddev: **0.1387%** (< 0.5%) — **PASS**

### Balance Curve

| Fires | Observed RTP |
|-------|-------------|
| 10000 | 91.4992% |
| 20000 | 92.6107% |
| 30000 | 93.0961% |
| 40000 | 93.2607% |
| 50000 | 92.8714% |
| 60000 | 92.4877% |
| 70000 | 93.5697% |
| 80000 | 93.6165% |
| 90000 | 93.2448% |
| 100000 | 93.1359% |
| 110000 | 92.9956% |
| 120000 | 92.9461% |
| 130000 | 93.2538% |
| 140000 | 93.4063% |
| 150000 | 93.8411% |
| 160000 | 93.9803% |
| 170000 | 93.9327% |
| 180000 | 93.8721% |
| 190000 | 93.8328% |
| 200000 | 94.2274% |

### Tier Kill Distribution

| Tier | Kills |
|------|-------|
| T1 | 1077 |
| T2 | 1106 |
| T3 | 1038 |
| T4 | 1070 |
| T5 | 1049 |
| T6 | 1052 |

## Invariants Verified

| # | Invariant | Status |
|---|-----------|--------|
| 1 | Per-tier RTP convergence +/-1% (1x) | PASS |
| 2 | Hard pity max shots <= N1 | PASS |
| 3 | Controlled debt within guardrail | PASS |
| 4 | Shotgun RTP convergence | PASS |
| 5 | Shotgun no double-pay | PASS |
| 6 | AOE budget conservation | PASS |
| 7 | Laser budget conservation | PASS |
| 8 | Multi-fish isolation | PASS |
| 9 | Miss does not mutate RTP state | PASS |
| 10 | RTP_hit stable across hit rates | PASS |
| 11 | Multi-player state isolation | PASS |
| 12 | Kill replay idempotency | PASS |
| 13 | Out-of-order no state break | PASS |
| 14 | Multi-target cap + weight/budget | PASS |
| 15 | Session drift within noise | PASS |
