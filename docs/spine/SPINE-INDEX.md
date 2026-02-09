# SPINE-INDEX — Master Decision Registry

STATUS: ACTIVE | v2.0 | 2026-02-09
SOURCE: 3D Fish Shooting Game Development Bible v4.2 (Modules M1-M6)

## DECISIONS

| ID | TYPE | STATUS | SCOPE | RESOLUTION SUMMARY |
|----|------|--------|-------|--------------------|
| DEC-M1-001 | DECISION | RESOLVED | GLOBAL | Server authority for single-player: YES (connect to backend via Socket.IO) |
| DEC-M1-002 | DECISION | RESOLVED | LOCAL | Anti-replay on BOTH Socket.IO and BinaryWebSocket |
| DEC-M1-003 | DECISION | RESOLVED | LOCAL | Lag compensation: 200ms maximum window |
| DEC-M2-001 | DECISION | RESOLVED | GLOBAL | Keep per-weapon RTP: 1x=91%, 3x=93%, 5x=94%, 8x=95% (overrides Bible 99%) |
| DEC-M2-002 | DECISION | RESOLVED | LOCAL | Finisher pool: 0% single-player, configurable 2-10% multiplayer |
| DEC-M2-003 | DECISION | RESOLVED | LOCAL | Remainder: last player gets it (current implementation, no change) |
| DEC-M2-004 | DECISION | RESOLVED | GLOBAL | RTP simulator: 1M kills per weapon, target +/- 0.5% |
| DEC-M3-001 | DECISION | RESOLVED | GLOBAL | Seed commitment only for MVP, full ZK deferred to post-launch |
| DEC-M3-002 | DECISION | RESOLVED | LOCAL | Server-only CSPRNG seed with SHA-256 commitment |
| DEC-M3-003 | DECISION | RESOLVED | LOCAL | HP = HMAC-SHA256(seed, fishType+spawnIndex+roomId) mod hpRange |
| DEC-M4-001 | DECISION | RESOLVED | LOCAL | Z-score on hit rate (flag if > 3 sigma) |
| DEC-M4-002 | DECISION | RESOLVED | LOCAL | Quarantine: skip for single-player, defer to multiplayer |
| DEC-M4-003 | DECISION | RESOLVED | LOCAL | Explicit rejection with error event (fixes RL-005 violation) |
| DEC-M5-001 | DECISION | RESOLVED | GLOBAL | Simplified receipts for single-player (commitment hash as proof_reference) |
| DEC-M5-002 | DECISION | RESOLVED | LOCAL | Append-only JSON-lines file log |
| DEC-M5-003 | DECISION | RESOLVED | LOCAL | Client-side JS verifier in browser |
| DEC-M6-001 | DECISION | RESOLVED | GLOBAL | SHA-256 hash of config (no signing for MVP) |
| DEC-M6-002 | DECISION | RESOLVED | LOCAL | Auto-increment version on hash change |
| DEC-TECH-001 | DECISION | RESOLVED | GLOBAL | Connect to Render backend (single-player = 1-player room) |
| DEC-TECH-002 | DECISION | RESOLVED | GLOBAL | Shadow -> Soft -> Full Enforcement (Bible 3-phase strategy) |

## POLICIES

| ID | TYPE | STATUS | SCOPE | DESCRIPTION |
|----|------|--------|-------|-------------|
| POL-RTP-001 | POLICY | RESOLVED | GLOBAL | Per-weapon RTP: 1x=91%, 3x=93%, 5x=94%, 8x=95% (user override of Bible 99%) |
| POL-AUTH-001 | POLICY | RESOLVED | GLOBAL | Server validates cooldown / fire rate / hit detection (Bible M1) |
| POL-RNG-001 | POLICY | RESOLVED | GLOBAL | All RNG for game outcomes occurs exclusively on backend using CSPRNG (Bible M1) |
| POL-FAIR-001 | POLICY | RESOLVED | GLOBAL | Client cannot alter cost / fake hits / shoot faster than allowed (Bible M1) |
| POL-ECON-001 | POLICY | RESOLVED | GLOBAL | Reward split: 90-98% by contribution, 2-10% finisher pool (Bible M2) |
| POL-AUDIT-001 | POLICY | RESOLVED | GLOBAL | Every FishDeath emits receipt with proof_reference and rules_hash (Bible M5) |
| POL-IMMUT-001 | POLICY | RESOLVED | GLOBAL | Operator cannot change fairness rules without new version (Bible M6) |
| POL-PSYCH-001 | POLICY | RESOLVED | GLOBAL | No hidden difficulty scaling, no fake near-miss, no player-specific odds (Bible Psychology) |
| POL-DIST-001 | POLICY | RESOLVED | GLOBAL | HP range: moderate +/-20-35% of mean, center-weighted distribution (Bible Distribution) |

## RED LINES

| ID | TYPE | STATUS | SCOPE | DESCRIPTION |
|----|------|--------|-------|-------------|
| RL-001 | RED_LINE | RESOLVED | GLOBAL | Client CANNOT alter cost or fake hits |
| RL-002 | RED_LINE | RESOLVED | GLOBAL | Client CANNOT shoot faster than allowed |
| RL-003 | RED_LINE | RESOLVED | GLOBAL | No altering RNG from client side |
| RL-004 | RED_LINE | RESOLVED | GLOBAL | No altering HP from client side |
| RL-005 | RED_LINE | RESOLVED | GLOBAL | No silent punishment (must log all enforcement) |
| RL-006 | RED_LINE | RESOLVED | GLOBAL | No hidden difficulty scaling |
| RL-007 | RED_LINE | RESOLVED | GLOBAL | No fake near-miss manipulation |
| RL-008 | RED_LINE | RESOLVED | GLOBAL | No player-specific odds |
| RL-009 | RED_LINE | RESOLVED | GLOBAL | No operator rigging |
| RL-010 | RED_LINE | RESOLVED | GLOBAL | No last-hit stealing |
| RL-011 | RED_LINE | RESOLVED | GLOBAL | No profitable client cheat possible |
| RL-012 | RED_LINE | RESOLVED | GLOBAL | No silent tamper |
| RL-013 | RED_LINE | RESOLVED | GLOBAL | No exploitably low HP outliers |
| RL-014 | RED_LINE | RESOLVED | GLOBAL | Do not develop until 95% sure of all specs |

## SPEC CERTAINTY STATUS

| Category | Total | Resolved | Percentage |
|----------|-------|----------|------------|
| DECISIONS | 20 | 20 | 100% |
| POLICIES | 9 | 9 | 100% |
| RED LINES | 14 | 14 | 100% |
| **TOTAL** | **43** | **43** | **100%** |

**SPEC CERTAINTY: 100% — ALL DECISIONS RESOLVED. DEVELOPMENT MAY PROCEED.**

## IMPLEMENTATION ROADMAP (per DEC-TECH-002)

### Phase 1: Shadow Mode
1. M1: Server authority for single-player (1-player room)
2. M2: Apply per-weapon RTP server-side (shadow comparison)
3. M3: Seed commitment (publish hash, no verification)
4. M4: Statistical monitoring (log only, no enforcement)
5. M5: Generate receipts (log only, no UI)
6. M6: Compute config hash

### Phase 2: Soft Enforcement
1. M1: Enforce cooldown, fire rate, hit detection
2. M2: RTP applied to actual rewards
3. M3: Seed commitment active
4. M4: Explicit rejections active
5. M5: Receipts stored in hash-chain
6. M6: Config hash in receipts

### Phase 3: Full Enforcement
1. M1: Full authority with lag compensation
2. M2: RTP simulator validation passed
3. M3: Seed reveal + client verification
4. M4: Anomaly detection + disconnect
5. M5: Client verifier UI
6. M6: Version enforcement

## FILE INDEX

| Path | Type | Description |
|------|------|-------------|
| /docs/ai/AI-ENTRY.md | ENTRY | Mandatory AI starting point |
| /docs/ai/AI-DECISION-MATRIX.md | MATRIX | Binary decision logic (A-G) |
| /docs/spine/SPINE-INDEX.md | INDEX | This file |
| /docs/decisions/DEC-*.md | DECISION | 20 decision documents (all RESOLVED) |
| /docs/policies/POL-*.md | POLICY | 9 policy documents (all RESOLVED) |
| /docs/redlines/RL-*.md | RED_LINE | 14 red line documents (all RESOLVED) |
| /docs/gates/TEST-GATES.md | GATES | Test gates for M1-M6 |
