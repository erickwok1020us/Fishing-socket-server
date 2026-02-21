# Economic Audit Report

**Generated**: 2026-02-15T12:17:37.085Z
**Simulation**: 5 minutes, auto-attack, weapon rotation [1x,1x,1x,3x,5x,5x,8x]
**Start balance**: 1000

## Summary

| Metric | Value |
|--------|-------|
| Final balance | 1.86 |
| Balance delta | -998.14 |
| Fires | 801 |
| Hits | 1077 |
| Kills | 169 |
| Hit rate | 134.46% |
| Kill rate | 21.10% |
| Total cost\_fire | 2739.00 |
| Total payout | 1740.86 |
| **Realized RTP (per-fire)** | **63.56%** |
| Balance check | 1000 - 2739.00 + 1740.86 = 1.86 (actual: 1.86) |
| Payout/min | 348.17 |
| Cost/min | 547.80 |
| Net/min | -199.63 |
| Max hit\_list length | 6 |
| Despawn state leaks | 69 |

## Invariant Checks

| # | Rule | Status | Detail |
|---|------|--------|--------|
| INV-1 | cost\_fire increases with fire\_count | **PASS** | avg_cost_per_fire=3.4195 |
| INV-2 | kill\_event\_id never pays twice | **PASS** | dup_kill_event_ids=0 |
| INV-3 | fishId never pays twice | **PASS** | dup_fish_payouts=0 |
| INV-4 | multi-target respects cap (AOE≤8, Laser≤6) | **PASS** | cap_breaches=0, max_hit_list=6 |
| INV-5 | fish despawn clears RTP state | **FAIL** | despawn_state_leaks=69 |

## Per-Weapon Breakdown

| Weapon | Fires | Kills | Cost | Payout | RTP |
|--------|-------|-------|------|--------|-----|
| 1x | 345 | 14 | 345.00 | 131.06 | 37.99% |
| 3x | 114 | 7 | 342.00 | 77.37 | 22.62% |
| 5x | 228 | 55 | 1140.00 | 621.34 | 54.50% |
| 8x | 114 | 93 | 912.00 | 911.09 | 99.90% |

## Per-Tier Breakdown

| Tier | Kills | Payout | Avg Reward |
|------|-------|--------|------------|
| T1 | 73 | 328.50 | 4.50 |
| T2 | 49 | 375.63 | 7.67 |
| T3 | 19 | 235.60 | 12.40 |
| T4 | 21 | 493.50 | 23.50 |
| T5 | 6 | 212.62 | 35.44 |
| T6 | 1 | 95.00 | 95.00 |

## Top 20 Fish by Payout

| # | FishId | Species | Tier | Reward |
|---|--------|---------|------|--------|
| 1 | 221 | blueWhale | T6 | 95 |
| 2 | 186 | hammerheadShark | T5 | 35.437 |
| 3 | 210 | hammerheadShark | T5 | 35.437 |
| 4 | 238 | hammerheadShark | T5 | 35.437 |
| 5 | 280 | hammerheadShark | T5 | 35.437 |
| 6 | 297 | marlin | T5 | 35.437 |
| 7 | 287 | hammerheadShark | T5 | 35.437 |
| 8 | 37 | mantaRay | T4 | 23.5 |
| 9 | 46 | yellowfinTuna | T4 | 23.5 |
| 10 | 59 | mahiMahi | T4 | 23.5 |
| 11 | 66 | mantaRay | T4 | 23.5 |
| 12 | 72 | mahiMahi | T4 | 23.5 |
| 13 | 85 | mahiMahi | T4 | 23.5 |
| 14 | 86 | yellowfinTuna | T4 | 23.5 |
| 15 | 100 | mantaRay | T4 | 23.5 |
| 16 | 93 | mahiMahi | T4 | 23.5 |
| 17 | 102 | mantaRay | T4 | 23.5 |
| 18 | 140 | mahiMahi | T4 | 23.5 |
| 19 | 136 | yellowfinTuna | T4 | 23.5 |
| 20 | 165 | mantaRay | T4 | 23.5 |

## Balance Curve (5-second snapshots)

| t(s) | Balance | Cost | Payout | Net | Fires | Kills |
|------|---------|------|--------|-----|-------|-------|
| 5 | 977.73 | 50 | 27.73 | -22.27 | 16 | 3 |
| 10 | 964.13 | 99 | 63.13 | -35.87 | 31 | 7 |
| 15 | 937.46 | 150 | 87.46 | -62.54 | 46 | 11 |
| 20 | 920.13 | 203 | 123.13 | -79.87 | 61 | 14 |
| 25 | 896.19 | 256 | 152.19 | -103.81 | 76 | 18 |
| 30 | 895.69 | 312 | 207.69 | -104.31 | 91 | 24 |
| 35 | 877.92 | 362 | 239.92 | -122.08 | 107 | 28 |
| 40 | 845.59 | 411 | 256.59 | -154.41 | 122 | 31 |
| 45 | 850.56 | 462 | 312.56 | -149.44 | 137 | 35 |
| 50 | 830.06 | 515 | 345.06 | -169.94 | 152 | 38 |
| 55 | 834.36 | 568 | 402.36 | -165.64 | 167 | 43 |
| 60 | 812.02 | 626 | 438.02 | -187.98 | 184 | 46 |
| 65 | 795.69 | 678 | 473.69 | -204.31 | 200 | 49 |
| 70 | 754.35 | 736 | 490.35 | -245.65 | 216 | 52 |
| 75 | 722.92 | 792 | 514.92 | -277.08 | 231 | 55 |
| 80 | 699.92 | 843 | 542.92 | -300.08 | 248 | 57 |
| 85 | 667.42 | 899 | 566.42 | -332.58 | 264 | 58 |
| 90 | 650.09 | 952 | 602.09 | -349.91 | 279 | 61 |
| 95 | 618.75 | 1009 | 627.75 | -381.25 | 295 | 66 |
| 100 | 594.58 | 1062 | 656.58 | -405.42 | 312 | 71 |
| 105 | 577.25 | 1115 | 692.25 | -422.75 | 327 | 74 |
| 110 | 552.25 | 1168 | 720.25 | -447.75 | 342 | 76 |
| 115 | 543.38 | 1226 | 769.38 | -456.62 | 359 | 82 |
| 120 | 528.35 | 1278 | 806.35 | -471.65 | 375 | 86 |
| 125 | 491.51 | 1336 | 827.51 | -508.49 | 391 | 90 |
| 130 | 464.35 | 1392 | 856.35 | -535.65 | 406 | 95 |
| 135 | 436.85 | 1443 | 879.85 | -563.15 | 423 | 96 |
| 140 | 404.35 | 1499 | 903.35 | -595.65 | 439 | 97 |
| 145 | 391.28 | 1552 | 943.28 | -608.72 | 454 | 99 |
| 150 | 378.95 | 1609 | 987.95 | -621.05 | 470 | 104 |
| 155 | 338.12 | 1662 | 1000.12 | -661.88 | 487 | 106 |
| 160 | 297.28 | 1715 | 1012.28 | -702.72 | 502 | 108 |
| 165 | 279.72 | 1768 | 1047.72 | -720.28 | 517 | 109 |
| 170 | 258.68 | 1826 | 1084.68 | -741.32 | 534 | 113 |
| 175 | 242.35 | 1878 | 1120.35 | -757.65 | 550 | 116 |
| 180 | 222.65 | 1936 | 1158.65 | -777.35 | 566 | 121 |
| 185 | 178.82 | 1992 | 1170.82 | -821.18 | 581 | 123 |
| 190 | 188.92 | 2043 | 1231.92 | -811.08 | 598 | 129 |
| 195 | 163.58 | 2099 | 1262.58 | -836.42 | 614 | 133 |
| 200 | 122.75 | 2152 | 1274.75 | -877.25 | 629 | 135 |
| 205 | 110.42 | 2209 | 1319.42 | -889.58 | 645 | 140 |
| 210 | 57.42 | 2262 | 1319.42 | -942.58 | 662 | 140 |
| 215 | 16.58 | 2315 | 1331.58 | -983.42 | 677 | 142 |
| 220 | 87.65 | 2368 | 1455.65 | -912.35 | 692 | 147 |
| 225 | 85.65 | 2426 | 1511.65 | -914.35 | 709 | 151 |
| 230 | 54.81 | 2478 | 1532.81 | -945.19 | 725 | 155 |
| 235 | 44.65 | 2536 | 1580.65 | -955.35 | 741 | 157 |
| 240 | 28.82 | 2592 | 1620.82 | -971.18 | 756 | 161 |
| 245 | 17.75 | 2643 | 1660.75 | -982.25 | 773 | 163 |
| 250 | 41.86 | 2699 | 1740.86 | -958.14 | 789 | 169 |
| 255 | 1.86 | 2739 | 1740.86 | -998.14 | 801 | 169 |
| 260 | 1.86 | 2739 | 1740.86 | -998.14 | 801 | 169 |
| 265 | 1.86 | 2739 | 1740.86 | -998.14 | 801 | 169 |
| 270 | 1.86 | 2739 | 1740.86 | -998.14 | 801 | 169 |
| 275 | 1.86 | 2739 | 1740.86 | -998.14 | 801 | 169 |
| 280 | 1.86 | 2739 | 1740.86 | -998.14 | 801 | 169 |
| 285 | 1.86 | 2739 | 1740.86 | -998.14 | 801 | 169 |
| 290 | 1.86 | 2739 | 1740.86 | -998.14 | 801 | 169 |
| 295 | 1.86 | 2739 | 1740.86 | -998.14 | 801 | 169 |
| 300 | 1.86 | 2739 | 1740.86 | -998.14 | 801 | 169 |
| 300 | 1.86 | 2739 | 1740.86 | -998.14 | 801 | 169 |

## Invariant Violations (detail)

```json
[
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 10,
    "ts": 1015183.333333298
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 7,
    "ts": 1015349.9999999643
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 11,
    "ts": 1015799.9999999632
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 30,
    "ts": 1020116.6666666198
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 23,
    "ts": 1020616.6666666187
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 24,
    "ts": 1024766.666666609
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 28,
    "ts": 1024766.666666609
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 16,
    "ts": 1027399.9999999362
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 15,
    "ts": 1029816.6666665972
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 26,
    "ts": 1035249.9999999179
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 22,
    "ts": 1049149.9999998896
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 61,
    "ts": 1053516.6666665766
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 36,
    "ts": 1054333.333333247
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 79,
    "ts": 1066999.9999999728
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 58,
    "ts": 1067699.999999976
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 83,
    "ts": 1067733.3333333095
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 6,
    "ts": 1068349.999999979
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 77,
    "ts": 1072016.6666666628
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 94,
    "ts": 1078250.0000000251
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 33,
    "ts": 1081016.6666667047
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 95,
    "ts": 1091683.333333421
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 82,
    "ts": 1096200.0000001087
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 19,
    "ts": 1098050.0000001173
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 101,
    "ts": 1099666.6666667915
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 110,
    "ts": 1100366.6666667948
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 111,
    "ts": 1101266.666666799
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 123,
    "ts": 1107416.6666668276
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 121,
    "ts": 1109633.3333335046
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 109,
    "ts": 1109700.0000001716
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 132,
    "ts": 1116533.3333335367
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 128,
    "ts": 1120850.0000002235
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 108,
    "ts": 1123016.6666669003
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 146,
    "ts": 1127150.0000002529
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 162,
    "ts": 1133416.6666669487
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 170,
    "ts": 1136250.0000002952
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 148,
    "ts": 1136750.0000002976
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 143,
    "ts": 1138833.3333336406
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 177,
    "ts": 1144183.3333336655
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 159,
    "ts": 1149483.3333336902
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 190,
    "ts": 1151233.3333336983
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 141,
    "ts": 1154816.6666670484
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 180,
    "ts": 1161483.333333746
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 183,
    "ts": 1162033.3333337486
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 193,
    "ts": 1170066.6666671194
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 206,
    "ts": 1170350.000000454
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 211,
    "ts": 1171816.6666671275
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 195,
    "ts": 1180383.333333834
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 227,
    "ts": 1184316.6666671857
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 225,
    "ts": 1185516.6666671913
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 215,
    "ts": 1186966.666667198
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 213,
    "ts": 1190433.3333338809
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 222,
    "ts": 1195600.0000005716
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 171,
    "ts": 1209233.3333339684
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 237,
    "ts": 1216450.0000006687
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 251,
    "ts": 1220000.0000006852
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 249,
    "ts": 1222666.6666673643
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 261,
    "ts": 1222716.6666673645
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 198,
    "ts": 1224216.6666673715
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 275,
    "ts": 1229750.0000007306
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 284,
    "ts": 1235633.3333340914
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 202,
    "ts": 1242316.6666674558
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 303,
    "ts": 1246300.0000008077
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 293,
    "ts": 1256083.3333341866
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 304,
    "ts": 1258483.3333341978
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 307,
    "ts": 1259650.0000008699
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 319,
    "ts": 1261866.6666675468
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 302,
    "ts": 1262716.6666675508
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 309,
    "ts": 1271766.666667593
  },
  {
    "type": "DESPAWN_STATE_LEAK",
    "fishId": 312,
    "ts": 1277383.3333342858
  }
]
```

## 1% Event Samples

```json
[
  {
    "type": "Fire",
    "weapon": "1x",
    "cost_fp": 1000,
    "ts": 1004649.9999999892
  },
  {
    "type": "Fire",
    "weapon": "5x",
    "cost_fp": 5000,
    "ts": 1013183.3333333026
  },
  {
    "type": "Fire",
    "weapon": "8x",
    "cost_fp": 8000,
    "ts": 1050649.9999998966
  },
  {
    "type": "Fire",
    "weapon": "1x",
    "cost_fp": 1000,
    "ts": 1095050.0000001034
  },
  {
    "type": "Fire",
    "weapon": "3x",
    "cost_fp": 3000,
    "ts": 1121950.0000002286
  }
]
```

## Client-Side Findings (code review)

During code review of `3D-Fish-Shooting-Devin/game.js`, the following **client-side balance leaks** were identified:

### LEAK-1: Coin-fly animation adds balance ON TOP of server balanceUpdate

- **game.js:8027**: `gameState.balance += this.coin.reward;` — when GLB coin reaches cannon
- **game.js:8322**: `gameState.balance += this.reward;` — fallback coin path
- **game.js:9239**: `gameState.balance = data.balance;` — server authoritative set

The server sends `balanceUpdate` with `balance` (absolute) and `change` (delta).
The client sets `gameState.balance = data.balance` (correct), but the coin-fly VFX
also does `gameState.balance += this.coin.reward` when the coin animation finishes.
If the server balanceUpdate arrives BEFORE the coin lands, the client balance becomes
`server_balance + coin_reward` — a **double-credit**.

**Impact**: Every kill reward is potentially added TWICE to the displayed balance.
Over 2 minutes of rapid firing with many kills, this can easily produce +5000.

### LEAK-2: autoFireAtFish deducts cost locally (double deduction, then server corrects)

- **game.js:10905**: `gameState.balance -= weapon.cost;` in `autoFireAtFish()`
- Server also deducts in `handleShoot()` and sends `balanceUpdate` with new absolute balance

This causes a brief double-deduction that is corrected when the server's balanceUpdate
arrives and resets balance to the authoritative value. Not a net leak, but creates visual
jitter and can interact with LEAK-1 timing.

### LEAK-3: Single-player coin reward when win=0

- **game.js:13929**: `spawnCoinFlyToScore(deathPosition, coinCount, win > 0 ? win : fishReward);`
- When `win=0` (RTP roll failed), coins still fly with `fishReward` value
- Coin arrival triggers `gameState.balance += this.coin.reward` with non-zero reward

**Impact**: In single-player mode, every fish death awards the full `fishReward`
via coin animation regardless of the RTP roll result.

### Recommended Fixes

1. **Remove client-side balance += in coin animations** (lines 8027, 8322).
   Balance should ONLY be set by server `balanceUpdate` events.
2. **Remove local cost deduction in autoFireAtFish** (line 10905).
   Server is authoritative; client should wait for `balanceUpdate`.
3. **Fix single-player coin reward**: pass `win` (not `fishReward`) to
   `spawnCoinFlyToScore` so coins carry 0 reward when RTP roll fails.
