# TEST-GATES — Module Implementation Gates

STATUS: ACTIVE | v3.0 | 2026-02-09
SOURCE: Bible M1-M6 + User Directive (95% certainty before development)

## GATE SYSTEM

No module implementation may begin until its gate is PASSED.
Gates are evaluated in order. A failed gate blocks all subsequent gates.

---

## GATE 0: SPEC CERTAINTY (Blocks ALL development)

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| All DECISIONS resolved | 0 UNRESOLVED in SPINE-INDEX | PASS (20/20 RESOLVED) |
| All POLICIES confirmed | All POL-XXX STATUS = RESOLVED | PASS (9/9) |
| All RED LINES documented | All RL-XXX STATUS = RESOLVED | PASS (14/14) |
| Tech stack decided | DEC-TECH-001 = RESOLVED | PASS (Option A: Render backend) |
| Integration phase decided | DEC-TECH-002 = RESOLVED | PASS (Shadow -> Soft -> Full) |

**STATUS: PASSED** — Development may proceed to Phase 1 (Shadow Mode)

---

## GATE 1: M1 — Network & Authority

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| DEC-M1-001 resolved | Server authority model chosen | PASS (server-authoritative) |
| DEC-M1-002 resolved | Anti-replay scope defined | PASS (both protocols) |
| DEC-M1-003 resolved | Lag compensation window defined | PASS (200ms) |
| Cooldown validation test | Server rejects shots within cooldown | PASS |
| Fire rate test | Token bucket rejects burst > limit | PASS |
| Hit detection test | Server-side collision returns correct result | PASS |
| Anti-replay test | Replayed nonce is rejected | PASS |
| Single-player authority test | Single-player shots validated by server | PASS |

**STATUS: PASSED** — All 5 test scripts pass

### Test Scripts Required
```
test/gates/m1-cooldown.test.js      — Send shots within cooldown, assert rejection
test/gates/m1-firerate.test.js      — Burst 50 shots in 1s, assert rate-limited
test/gates/m1-hitdetect.test.js     — Send hit with wrong position, assert rejection
test/gates/m1-antireplay.test.js    — Replay nonce, assert rejection
test/gates/m1-singleplayer.test.js  — Single-player shot, assert server-validated
```

---

## GATE 2: M2 — Economy & RTP

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| DEC-M2-001 resolved | RTP target confirmed | PASS (per-weapon: 91-95%) |
| DEC-M2-002 resolved | Finisher pool decision | PASS (0% single-player) |
| DEC-M2-003 resolved | Remainder policy decision | PASS (last player, no change) |
| DEC-M2-004 resolved | Simulator requirement confirmed | PASS (1M kills +/- 0.5%) |
| RTP formula implemented | Payout matches per-weapon RTP | PASS |
| Reward split test | Contribution % + finisher % = 100% of payout | PASS |
| Rounding test | Sum of splits = payout exactly (zero remainder leak) | PASS |
| RTP simulation | 1M kills per weapon: RTP within target +/- 0.5% | PASS |

**STATUS: PASSED** — All 4 test scripts pass

### Test Scripts Required
```
test/gates/m2-rtp-formula.test.js     — Verify payout = cost x weaponRTP
test/gates/m2-reward-split.test.js    — Kill fish, verify contribution split
test/gates/m2-rounding.test.js        — 10000 kills, verify zero remainder leak
test/gates/m2-rtp-simulation.test.js  — 1M kills per weapon, verify RTP within tolerance
```

---

## GATE 3: M3 — Crypto Fairness (Seed Commitment)

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| DEC-M3-001 resolved | Scope decided | PASS (seed commit only, ZK deferred) |
| DEC-M3-002 resolved | Seed scheme decided | PASS (server-only CSPRNG + SHA-256) |
| DEC-M3-003 resolved | HP derivation function defined | PASS (HMAC-SHA256) |
| Seed commit test | Server publishes commitment before spawn | PASS |
| HP derivation test | HP = HMAC-SHA256(seed, params) is deterministic | PASS |
| Commitment verify test | Published commitment matches revealed seed | PASS |

**STATUS: PASSED** — All 3 test scripts pass

### Test Scripts Required
```
test/gates/m3-seed-commit.test.js    — Verify commitment published before fish spawn
test/gates/m3-hp-derivation.test.js  — Same inputs = same HP (deterministic)
test/gates/m3-commitment.test.js     — Reveal seed, verify matches published hash
```

---

## GATE 4: M4 — Anti-Cheat

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| DEC-M4-001 resolved | Anomaly detection chosen | PASS (Z-score, 3 sigma) |
| DEC-M4-002 resolved | Quarantine scope decided | PASS (multiplayer only) |
| DEC-M4-003 resolved | Silent punishment fixed | PASS (explicit rejection) |
| Fire rate detection test | Impossible fire rate detected and logged | PASS |
| Replay detection test | Replay attempts detected and counted | PASS |
| Statistical anomaly test | Anomalous hit rate flagged | PASS |
| Explicit rejection test | All rejections send error to client | PASS (RL-005 fixed) |
| Enforcement logging test | All enforcement actions appear in logs | PASS |

**STATUS: PASSED** — All 5 test scripts pass

### Test Scripts Required
```
test/gates/m4-firerate-detect.test.js   — Impossible rate -> detected
test/gates/m4-replay-detect.test.js     — Replayed nonce -> detected
test/gates/m4-anomaly-detect.test.js    — Abnormal hit rate -> flagged
test/gates/m4-explicit-reject.test.js   — Rate-limited shot -> error event sent to client
test/gates/m4-enforcement-log.test.js   — All rejections logged with evidence
```

---

## GATE 5: M5 — Audit & Receipts

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| DEC-M5-001 resolved | Receipt scope decided | PASS (simplified, commitment as proof) |
| DEC-M5-002 resolved | Storage backend chosen | PASS (append-only file log) |
| DEC-M5-003 resolved | Verifier tool type decided | PASS (client-side JS) |
| Receipt schema test | FishDeath emits all required fields | PASS |
| Hash-chain test | Each receipt includes hash of previous | PASS |
| Chain integrity test | Verify full chain from genesis to latest | PASS |
| Verifier test | Independent verifier confirms receipt validity | PASS |

**STATUS: PASSED** — All 3 test scripts pass

### Test Scripts Required
```
test/gates/m5-receipt-schema.test.js   — Kill fish, verify all fields present
test/gates/m5-hash-chain.test.js       — Kill 100 fish, verify chain integrity
test/gates/m5-verifier.test.js         — Feed receipts to verifier, confirm pass
```

---

## GATE 6: M6 — Release & Immutability

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| DEC-M6-001 resolved | Config hash method decided | PASS (SHA-256, no signing) |
| DEC-M6-002 resolved | Version scheme decided | PASS (auto-increment) |
| Config hash test | Config hash computed deterministically | PASS |
| Version bump test | Config change -> version auto-increments | PASS |
| Receipt hash test | Every receipt includes current rules_hash | PASS |
| Tamper detect test | Modified config -> hash mismatch detected | PASS |

**STATUS: PASSED** — All 4 test scripts pass

### Test Scripts Required
```
test/gates/m6-config-hash.test.js     — Same config = same hash (deterministic)
test/gates/m6-version-bump.test.js    — Change config, verify version increments
test/gates/m6-receipt-hash.test.js    — Kill fish, verify receipt contains rules_hash
test/gates/m6-tamper-detect.test.js   — Modify config at runtime, verify detection
```

---

## SUMMARY

| Gate | Status | Tests | Notes |
|------|--------|-------|-------|
| G0 SPEC | PASSED | — | 100% spec certainty achieved |
| G1 M1 | PASSED | 5/5 | Server authority + cooldown + anti-replay |
| G2 M2 | PASSED | 4/4 | Per-weapon RTP verified via 1M simulation |
| G3 M3 | PASSED | 3/3 | Seed commitment + HMAC-SHA256 HP derivation |
| G4 M4 | PASSED | 5/5 | RL-005 fixed, Z-score anomaly detection |
| G5 M5 | PASSED | 3/3 | Receipt schema + hash-chain + verifier |
| G6 M6 | PASSED | 4/4 | Config hash + auto-versioning + tamper detect |

**Total: 24/24 gate tests PASS (115 assertions across 24 test suites)**

## IMPLEMENTATION ORDER (per DEC-TECH-002: Phase 1 Shadow Mode)

1. **M1** — Server authority for single-player (1-player room via Socket.IO)
2. **M4** — Fix RL-005 violation (explicit rejection, highest priority bug)
3. **M6** — Config hash computation (needed by M5)
4. **M3** — Seed commitment scheme (needed by M5)
5. **M2** — Per-weapon RTP enforcement server-side
6. **M5** — Receipt generation + hash-chain
