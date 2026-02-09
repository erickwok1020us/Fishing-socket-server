# TEST-GATES — Module Implementation Gates

STATUS: ACTIVE | v1.0 | 2026-02-09
SOURCE: Bible M1-M6 + User Directive (95% certainty before development)

## GATE SYSTEM

No module implementation may begin until its gate is PASSED.
Gates are evaluated in order. A failed gate blocks all subsequent gates.

---

## GATE 0: SPEC CERTAINTY (Blocks ALL development)

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| All DECISIONS resolved | 0 UNRESOLVED in SPINE-INDEX | FAIL (20 UNRESOLVED) |
| All POLICIES confirmed | All POL-XXX STATUS = RESOLVED | PASS (9/9) |
| All RED LINES documented | All RL-XXX STATUS = RESOLVED | PASS (14/14) |
| Tech stack decided | DEC-TECH-001 = RESOLVED | FAIL |
| Integration phase decided | DEC-TECH-002 = RESOLVED | FAIL |

**STATUS: BLOCKED**

---

## GATE 1: M1 — Network & Authority

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| DEC-M1-001 resolved | Server authority model chosen | FAIL |
| DEC-M1-002 resolved | Anti-replay scope defined | FAIL |
| DEC-M1-003 resolved | Lag compensation window defined | FAIL |
| Cooldown validation test | Server rejects shots within cooldown | PASS (multiplayer) |
| Fire rate test | Token bucket rejects burst > limit | PASS (multiplayer) |
| Hit detection test | Server-side collision returns correct result | PASS (multiplayer) |
| Anti-replay test | Replayed nonce is rejected | PARTIAL (BinaryWS only) |
| Single-player authority test | Single-player shots validated by server | FAIL |

**STATUS: BLOCKED by DEC-M1-001**

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
| DEC-M2-001 resolved | RTP target confirmed (99% or per-weapon) | FAIL |
| DEC-M2-002 resolved | Finisher pool decision | FAIL |
| DEC-M2-003 resolved | Remainder policy decision | FAIL |
| DEC-M2-004 resolved | Simulator requirement confirmed | FAIL |
| RTP formula implemented | Payout matches Bible formula | FAIL |
| Reward split test | Contribution % + finisher % = 100% of payout | FAIL |
| Rounding test | Sum of splits = payout exactly (zero remainder leak) | PARTIAL |
| RTP simulation | 1M kills: RTP = target +/- 0.1% | FAIL |

**STATUS: BLOCKED by DEC-M2-001**

### Test Scripts Required
```
test/gates/m2-rtp-formula.test.js     — Verify payout = formula(cost, expectedBullets)
test/gates/m2-reward-split.test.js    — Multi-player kill, verify contribution + finisher = total
test/gates/m2-rounding.test.js        — 10000 kills, verify zero remainder leak
test/gates/m2-rtp-simulation.test.js  — 1M kills, verify RTP within tolerance
```

---

## GATE 3: M3 — Crypto Fairness (ZK HP)

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| DEC-M3-001 resolved | ZK scope decided (MVP or deferred) | FAIL |
| DEC-M3-002 resolved | Seed scheme decided | FAIL |
| DEC-M3-003 resolved | HP derivation function defined | FAIL |
| Seed commit test | Server publishes commitment before spawn | FAIL |
| HP derivation test | HP = f(seed, fishType, spawnIndex, roomId) is deterministic | FAIL |
| Commitment verify test | Published commitment matches revealed seed | FAIL |
| Kill proof test (if ZK) | Proof verifies correctly on client | FAIL |

**STATUS: BLOCKED by DEC-M3-001**

### Test Scripts Required
```
test/gates/m3-seed-commit.test.js    — Verify commitment published before fish spawn
test/gates/m3-hp-derivation.test.js  — Same inputs = same HP (deterministic)
test/gates/m3-commitment.test.js     — Reveal seed, verify matches published hash
test/gates/m3-zk-proof.test.js       — Generate proof, verify on simulated client
```

---

## GATE 4: M4 — Anti-Cheat

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| DEC-M4-001 resolved | Anomaly detection algorithms chosen | FAIL |
| DEC-M4-002 resolved | Quarantine scope decided | FAIL |
| DEC-M4-003 resolved | Silent punishment fixed | FAIL |
| Fire rate detection test | Impossible fire rate detected and logged | PASS |
| Replay detection test | Replay attempts detected and counted | PARTIAL |
| Statistical anomaly test | Anomalous hit rate flagged | FAIL |
| Explicit rejection test | All rejections send error to client (no silent drops) | FAIL |
| Enforcement logging test | All enforcement actions appear in logs | PARTIAL |

**STATUS: BLOCKED by DEC-M4-003 (RL-005 violation)**

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
| DEC-M5-001 resolved | Receipt scope for single-player decided | FAIL |
| DEC-M5-002 resolved | Storage backend chosen | FAIL |
| DEC-M5-003 resolved | Verifier tool type decided | FAIL |
| Receipt schema test | FishDeath emits all 8 required fields | FAIL |
| Hash-chain test | Each receipt includes hash of previous | FAIL |
| Chain integrity test | Verify full chain from genesis to latest | FAIL |
| Verifier test | Independent verifier confirms receipt validity | FAIL |

**STATUS: BLOCKED by DEC-M5-001**

### Test Scripts Required
```
test/gates/m5-receipt-schema.test.js   — Kill fish, verify all 8 fields present
test/gates/m5-hash-chain.test.js       — Kill 100 fish, verify chain integrity
test/gates/m5-verifier.test.js         — Feed receipts to verifier, confirm pass
```

---

## GATE 6: M6 — Release & Immutability

| Criteria | Pass Condition | Current |
|----------|---------------|---------|
| DEC-M6-001 resolved | Config signing method decided | FAIL |
| DEC-M6-002 resolved | Version scheme decided | FAIL |
| Config hash test | Config hash computed deterministically | FAIL |
| Version bump test | Config change -> version auto-increments | FAIL |
| Receipt hash test | Every receipt includes current rules_hash | FAIL |
| Tamper detect test | Modified config -> hash mismatch detected | FAIL |

**STATUS: BLOCKED by DEC-M6-001**

### Test Scripts Required
```
test/gates/m6-config-hash.test.js     — Same config = same hash (deterministic)
test/gates/m6-version-bump.test.js    — Change config, verify version increments
test/gates/m6-receipt-hash.test.js    — Kill fish, verify receipt contains rules_hash
test/gates/m6-tamper-detect.test.js   — Modify config at runtime, verify detection
```

---

## SUMMARY

| Gate | Status | Blocking Decisions | Priority |
|------|--------|-------------------|----------|
| G0 SPEC | BLOCKED | 20 decisions | HIGHEST |
| G1 M1 | BLOCKED | DEC-M1-001/002/003 | HIGH |
| G2 M2 | BLOCKED | DEC-M2-001/002/003/004 | HIGH |
| G3 M3 | BLOCKED | DEC-M3-001/002/003 | MEDIUM |
| G4 M4 | BLOCKED | DEC-M4-001/002/003 | HIGH (RL-005 violation) |
| G5 M5 | BLOCKED | DEC-M5-001/002/003 | MEDIUM |
| G6 M6 | BLOCKED | DEC-M6-001/002 | MEDIUM |

## CRITICAL PATH

The minimum decisions to unblock development (resolve in this order):

1. **DEC-M1-001** — Server authority for single-player (unblocks G1, G2, G3, G4, G5)
2. **DEC-TECH-001** — Tech stack for single-player (unblocks G0)
3. **DEC-M2-001** — RTP target (unblocks G2)
4. **DEC-M3-001** — ZK scope for MVP (unblocks G3)
5. **DEC-M4-003** — Fix silent punishment (unblocks G4, fixes RL-005 violation)
6. **DEC-TECH-002** — Integration phasing (unblocks G0)
