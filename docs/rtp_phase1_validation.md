# RTP Phase 1.1 Validation Guide

Reference: RTP System Bible v1.1

## Quick Validation

```bash
node docs/rtp_phase1_smoke_test.js
```

## Key Metrics to Verify

| Metric | Expected | Fail Condition |
|--------|----------|----------------|
| T1 RTP convergence (10k shots) | 90% +/- 2% | Outside [88%, 92%] |
| T2 RTP convergence (10k shots) | 92% +/- 2% | Outside [90%, 94%] |
| T3 RTP convergence (10k shots) | 93% +/- 2% | Outside [91%, 95%] |
| T4 RTP convergence (10k shots) | 94% +/- 2% | Outside [92%, 96%] |
| T5 RTP convergence (10k shots) | 94.5% +/- 2% | Outside [92.5%, 96.5%] |
| T6 RTP convergence (10k shots) | 95% +/- 2% | Outside [93%, 97%] |
| Hard pity trigger | sum_cost >= N1_fp AND budget >= reward_fp | Pity never fires or fires early |
| budget_remaining_fp | Always >= 0 after kill | Goes negative |
| Multi-target budget conservation | sum(budget_i_fp) == budget_total_fp | Mismatch |
| reward_fp source | Static TIER_CONFIG lookup only | Runtime computation |
| 8x laser cost deduction | Exactly once per fire event | Multiple deductions |

## Validation Sections (per RTP Bible)

### S0: Precision & Scaling
- MONEY_SCALE = 1000
- RTP_SCALE = 10000
- WEIGHT_SCALE = 1000000
- PROGRESS_SCALE = 1000000
- P_SCALE = 1000000
- All arithmetic uses Math.floor (no floating point in settlement path)

### Why pityCompFp is needed

Hard pity at N1 truncates the geometric distribution: ~30% of fish are force-killed at exactly N1 instead of dying naturally. This lowers E[shots] below N1/K, inflating RTP above the tier target. Each tier's `pityCompFp` (LOCKED in TIER_CONFIG) scales P_base down so that E[shots] = N1/K even with truncation. The values are derived once from `(1-(1-u/N1)^N1)/u = 1/K`; they are static constants, not runtime-solved.

### S1: Model (K=1.2, Hard Pity)
- reward_fp = static lookup from TIER_CONFIG
- Hard pity: sum_cost_fp >= N1_fp AND budget_remaining_fp >= reward_fp
- pityReached flag persists across hits for deferred pity

### S2: Weapon Matrix
| Weapon | Cost | Type | Settlement |
|--------|------|------|------------|
| 1x | 1 | projectile | handleSingleTargetHit |
| 3x | 3 (3x1) | spread/3 pellets | handleSingleTargetHit per pellet, shared state |
| 5x | 5 | rocket/AOE | handleMultiTargetHit batch, max 8 targets |
| 8x | 8 | laser/instant ray | handleMultiTargetHit batch, max 6 targets |

### S3: Tier Config (frozen values)
| Tier | RTP_fp | N1 | N1_fp | reward_fp |
|------|--------|----|-------|-----------|
| T1 | 9000 | 6 | 6000 | 4500 |
| T2 | 9200 | 10 | 10000 | 7666 |
| T3 | 9300 | 16 | 16000 | 12400 |
| T4 | 9400 | 30 | 30000 | 23500 |
| T5 | 9450 | 45 | 45000 | 35437 |
| T6 | 9500 | 120 | 120000 | 95000 |

### S4: Single-Target Flow
1. budget_total_fp = floor(weapon_cost_fp * RTP_tier_fp / RTP_SCALE)
2. budget_remaining_fp += budget_total_fp; sum_cost_fp += weapon_cost_fp
3. Budget gate: budget_remaining_fp < reward_fp -> no kill
4. Hard pity check: sum_cost_fp >= N1_fp AND budget_remaining_fp >= reward_fp -> force kill
5. P_base = min(1, budget_total / reward); progress = sum_cost / N1; A = P_base/2; P = min(1, P_base + A*progress)
6. CSPRNG roll: rand < P -> kill; budget_remaining_fp -= reward_fp

### S5: Shotgun (3x)
- 3 pellets each cost=1, shared state key=(player_id, fish_id)
- Each pellet goes through full S4 flow
- If killed mid-pellet, remaining pellets miss (state.killed check)

### S6: Multi-Target (AOE/Laser)

#### S6.1 Deterministic Hit Selection (sort → truncate → settle)

| Weapon | Sort Primary | Sort Tie-Break | Cap | Constant |
|--------|-------------|----------------|-----|----------|
| 5x Rocket (AOE) | distance ASC | fishId.localeCompare() ASC | 8 | AOE_MAX_TARGETS |
| 8x Laser | hitOrder ASC (= distance to cannon) | fishId.localeCompare() ASC | 6 | LASER_MAX_TARGETS |

**Pipeline:** raw candidates → sort(primary, tie-break) → slice(0, cap) → compute weights/budget → settle

> CRITICAL: Weights and budget are computed ONLY on the post-truncation list.
> This ensures density does not penalize individual fish — each fish's budget_i
> depends only on the capped set, not on how many fish were in the scene.

#### S6.2 Cap Constants — Single Source of Truth (SSOT)

```
Server: src/modules/RTPPhase1.js
  AOE_MAX_TARGETS = 8
  LASER_MAX_TARGETS = 6

Game Engine: fish3DGameEngine.js
  Imports from RTPPhase1.js (MUST NOT hardcode)

Client (if hit preview exists):
  MUST read from server config sync or shared constants.
  If client shows "20 fish hit" but server only settles 8,
  players will perceive a bug. Client preview MUST respect
  the same cap values as server.
```

#### S6.3 Weight & Budget Allocation
- AOE: weight_i = 1/max(distance_i, 1) (closer fish get more budget)
- Laser: weight_i = 1/(hitOrder_i + 1) (first-hit fish gets most budget)
- Normalized: weight_i_fp = floor(rawWeight_i * WEIGHT_SCALE / rawSum), last gets remainder
- Budget conservation: Σbudget_i_fp == budget_total_fp (last target gets remainder)
- Cost allocation: cost_i_fp = floor(weapon_cost_fp * weight_i_fp / WEIGHT_SCALE)
- Each fish gets independent CSPRNG roll

### S7: Server Authority
- Fire deducts cost once
- All collisions server-side
- kill_event_id = UUID (unique per kill)

## How to Run Tests

```bash
# Smoke test (fast, basic sanity)
node docs/rtp_phase1_smoke_test.js

# T5 regression: cap + budget normalization (99 assertions, ~90s)
npm run rtp:t5
```

The smoke test verifies:
1. Single-target T1 pity triggers at N1=6 shots
2. Multi-target budget conservation (sum = total)
3. reward_fp matches static config for all tiers
4. RTP convergence over 10k simulated shots per tier

T5 regression verifies:
1. Hard-fail cap enforcement (100 fish → always ≤ cap)
2. Deterministic ordering (same input → same output)
3. Budget conservation (Σbudget_i_fp == budget_total_fp)
4. Truncation invariant (Σweight post-truncation == WEIGHT_SCALE)
5. RTP_shot ≤ target+2pp across density matrix (Sparse/Normal/Dense/Extreme)
6. N-sweep hitCount=1..cap
7. Extreme density (N=20/50/100) proves cap works
8. Mixed-tier scenarios
9. Single-target vs multi-target N=1 parity

### PR Checklist

When submitting changes that touch RTP settlement, paste T5 summary:
```
npm run rtp:t5
# Expected: PASS=N FAIL=0
# Include: MC shots, max RTP_shot drift, seed info
```
