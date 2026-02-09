# TEST-GATES — Module Implementation Gates

STATUS: ACTIVE | v2.0 | 2026-02-09
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
| Cooldown validation test | Server rejects shots within cooldown | PASS (multiplayer) |
| Fire rate test | Token bucket rejects burst > limit | PASS (multiplayer) |
| Hit detection test | Server-side collision returns correct result | PASS (multiplayer) |
| Anti-replay test | Replayed nonce is rejected | PARTIAL (BinaryWS only) |
| Single-player authority test | Single-player shots validated by server | PENDING |

**STATUS: READY FOR IMPLEMENTATION** — All decisions resolved, implementation can begin

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
| RTP formula implemented | Payout matches per-weapon RTP | PARTIAL (exists, needs server authority) |
| Reward split test | Contribution % + finisher % = 100% of payout | PENDING |
| Rounding test | Sum of splits = payout exactly (zero remainder leak) | PARTIAL |
| RTP simulation | 1M kills per weapon: RTP within target +/- 0.5% | PENDING |

**STATUS: READY FOR IMPLEMENTATION** — All decisions resolved

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
| Seed commit test | Server publishes commitment before spawn | PENDING |
| HP derivation test | HP = HMAC-SHA256(seed, params) is deterministic | PENDING |
| Commitment verify test | Published commitment matches revealed seed | PENDING |

**STATUS: READY FOR IMPLEMENTATION** — All decisions resolved

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
| Replay detection test | Replay attempts detected and counted | PARTIAL |
| Statistical anomaly test | Anomalous hit rate flagged | PENDING |
| Explicit rejection test | All rejections send error to client | PENDING (current code violates RL-005) |
| Enforcement logging test | All enforcement actions appear in logs | PARTIAL |

**STATUS: READY FOR IMPLEMENTATION** — Priority: fix RL-005 violation first

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
| Receipt schema test | FishDeath emits all required fields | PENDING |
| Hash-chain test | Each receipt includes hash of previous | PENDING |
| Chain integrity test | Verify full chain from genesis to latest | PENDING |
| Verifier test | Independent verifier confirms receipt validity | PENDING |

**STATUS: READY FOR IMPLEMENTATION**

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
| Config hash test | Config hash computed deterministically | PENDING |
| Version bump test | Config change -> version auto-increments | PENDING |
| Receipt hash test | Every receipt includes current rules_hash | PENDING |
| Tamper detect test | Modified config -> hash mismatch detected | PENDING |

**STATUS: READY FOR IMPLEMENTATION**

### Test Scripts Required
```
test/gates/m6-config-hash.test.js     — Same config = same hash (deterministic)
test/gates/m6-version-bump.test.js    — Change config, verify version increments
test/gates/m6-receipt-hash.test.js    — Kill fish, verify receipt contains rules_hash
test/gates/m6-tamper-detect.test.js   — Modify config at runtime, verify detection
```

---

## SUMMARY

| Gate | Status | Notes |
|------|--------|-------|
| G0 SPEC | PASSED | 100% spec certainty achieved |
| G1 M1 | READY | Implement single-player server authority first |
| G2 M2 | READY | RTP values confirmed, simulator needed |
| G3 M3 | READY | Seed commitment (no ZK for MVP) |
| G4 M4 | READY | Fix RL-005 violation as priority |
| G5 M5 | READY | Receipts + hash-chain + verifier |
| G6 M6 | READY | Config hash + auto-versioning |

## IMPLEMENTATION ORDER (per DEC-TECH-002: Phase 1 Shadow Mode)

1. **M1** — Server authority for single-player (1-player room via Socket.IO)
2. **M4** — Fix RL-005 violation (explicit rejection, highest priority bug)
3. **M6** — Config hash computation (needed by M5)
4. **M3** — Seed commitment scheme (needed by M5)
5. **M2** — Per-weapon RTP enforcement server-side
6. **M5** — Receipt generation + hash-chain
