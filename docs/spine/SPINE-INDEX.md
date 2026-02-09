# SPINE-INDEX — Master Decision Registry

STATUS: ACTIVE | v1.0 | 2026-02-09
SOURCE: 3D Fish Shooting Game Development Bible v4.2 (Modules M1-M6)

## DECISIONS

| ID | TYPE | STATUS | SCOPE | DESCRIPTION |
|----|------|--------|-------|-------------|
| DEC-M1-001 | DECISION | UNRESOLVED | GLOBAL | Single-player mode: require server authority or allow client-side? |
| DEC-M1-002 | DECISION | UNRESOLVED | LOCAL | Anti-replay mechanism: use HMAC+nonce for Socket.IO or only BinaryWebSocket? |
| DEC-M1-003 | DECISION | UNRESOLVED | LOCAL | Bounded lag compensation: max acceptable latency window (ms)? |
| DEC-M2-001 | DECISION | UNRESOLVED | GLOBAL | RTP target: Bible says 99% perfect-hit, code uses 91-95% per weapon. Which is correct? |
| DEC-M2-002 | DECISION | UNRESOLVED | LOCAL | Finisher pool: implement 2-10% finisher bonus or 100% contribution-based? |
| DEC-M2-003 | DECISION | UNRESOLVED | LOCAL | Reward rounding: which remainder policy (last-player, round-robin, house)? |
| DEC-M2-004 | DECISION | UNRESOLVED | GLOBAL | RTP simulator: 1M kill simulation required before launch? |
| DEC-M3-001 | DECISION | UNRESOLVED | GLOBAL | ZK HP proofs: implement for MVP or defer to post-launch? |
| DEC-M3-002 | DECISION | UNRESOLVED | LOCAL | Seed commit scheme: server-only seed or player commit-reveal mixed entropy? |
| DEC-M3-003 | DECISION | UNRESOLVED | LOCAL | HP derivation function: HP = f(seed, fishType, spawnIndex, roomId) formula? |
| DEC-M4-001 | DECISION | UNRESOLVED | LOCAL | Statistical anomaly detection: which algorithms and thresholds? |
| DEC-M4-002 | DECISION | UNRESOLVED | LOCAL | Quarantine rooms: implement for single-player or multiplayer only? |
| DEC-M4-003 | DECISION | UNRESOLVED | LOCAL | Silent punishment policy: current code silently drops shots — change to explicit rejection? |
| DEC-M5-001 | DECISION | UNRESOLVED | GLOBAL | Audit receipts: implement FishDeath receipt schema for single-player? |
| DEC-M5-002 | DECISION | UNRESOLVED | LOCAL | Hash-chain receipts: storage backend (in-memory, SQLite, external DB)? |
| DEC-M5-003 | DECISION | UNRESOLVED | LOCAL | Verifier tool: client-side JS or separate service? |
| DEC-M6-001 | DECISION | UNRESOLVED | GLOBAL | Signed config: implement config signing for MVP? |
| DEC-M6-002 | DECISION | UNRESOLVED | LOCAL | Rules hash versioning: auto-increment or manual version bumps? |
| DEC-TECH-001 | DECISION | UNRESOLVED | GLOBAL | Single-player tech stack: local Node.js server, WebWorker, or embedded WASM? |
| DEC-TECH-002 | DECISION | UNRESOLVED | GLOBAL | Integration strategy: Shadow Mode -> Soft Enforcement -> Full Enforcement phasing? |

## POLICIES

| ID | TYPE | STATUS | SCOPE | DESCRIPTION |
|----|------|--------|-------|-------------|
| POL-RTP-001 | POLICY | RESOLVED | GLOBAL | Perfect-hit RTP = 99% (Bible M2 specification) |
| POL-AUTH-001 | POLICY | RESOLVED | GLOBAL | Server validates cooldown / fire rate / hit detection (Bible M1) |
| POL-RNG-001 | POLICY | RESOLVED | GLOBAL | All RNG for game outcomes occurs exclusively on backend using CSPRNG (Bible M1) |
| POL-FAIR-001 | POLICY | RESOLVED | GLOBAL | Client cannot alter cost / fake hits / shoot faster than allowed (Bible M1) |
| POL-ECON-001 | POLICY | RESOLVED | GLOBAL | Reward split: 90-98% by contribution, 2-10% finisher pool (Bible M2) |
| POL-AUDIT-001 | POLICY | RESOLVED | GLOBAL | Every FishDeath emits receipt with proof_reference and rules_hash (Bible M5) |
| POL-IMMUT-001 | POLICY | RESOLVED | GLOBAL | Operator cannot change fairness rules without new version (Bible M6) |
| POL-PSYCH-001 | POLICY | RESOLVED | GLOBAL | No hidden difficulty scaling, no fake near-miss, no player-specific odds (Bible Psychology) |
| POL-DIST-001 | POLICY | RESOLVED | GLOBAL | HP range: moderate +-20-35% of mean, center-weighted distribution (Bible Distribution) |

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

## CURRENT IMPLEMENTATION STATUS (Audit 2026-02-09)

| Module | Impl% | Blocking Decisions |
|--------|-------|--------------------|
| M1 Network & Authority | ~40% | DEC-M1-001, DEC-M1-002, DEC-M1-003 |
| M2 Economy & RTP | ~15% | DEC-M2-001, DEC-M2-002, DEC-M2-003, DEC-M2-004 |
| M3 Crypto Fairness | 0% | DEC-M3-001, DEC-M3-002, DEC-M3-003 |
| M4 Anti-Cheat | ~30% | DEC-M4-001, DEC-M4-002, DEC-M4-003 |
| M5 Audit & Receipts | 0% | DEC-M5-001, DEC-M5-002, DEC-M5-003 |
| M6 Release & Immutability | 0% | DEC-M6-001, DEC-M6-002 |

## FILE INDEX

| Path | Type | Description |
|------|------|-------------|
| /docs/ai/AI-ENTRY.md | ENTRY | Mandatory AI starting point |
| /docs/ai/AI-DECISION-MATRIX.md | MATRIX | Binary decision logic (A-G) |
| /docs/spine/SPINE-INDEX.md | INDEX | This file |
| /docs/decisions/DEC-M1-001.md | DECISION | Server authority for single-player |
| /docs/decisions/DEC-M2-001.md | DECISION | RTP target value |
| /docs/decisions/DEC-M3-001.md | DECISION | ZK HP for MVP |
| /docs/decisions/DEC-TECH-001.md | DECISION | Single-player tech stack |
| /docs/decisions/DEC-TECH-002.md | DECISION | Integration phasing strategy |
| /docs/policies/POL-RTP-001.md | POLICY | Perfect-hit RTP = 99% |
| /docs/policies/POL-AUTH-001.md | POLICY | Server authority mandate |
| /docs/policies/POL-RNG-001.md | POLICY | CSPRNG-only RNG |
| /docs/policies/POL-FAIR-001.md | POLICY | Client cannot cheat |
| /docs/policies/POL-ECON-001.md | POLICY | Reward split rules |
| /docs/policies/POL-AUDIT-001.md | POLICY | Receipt requirements |
| /docs/policies/POL-IMMUT-001.md | POLICY | Immutability guarantee |
| /docs/policies/POL-PSYCH-001.md | POLICY | Psychology red lines |
| /docs/policies/POL-DIST-001.md | POLICY | HP distribution rules |
| /docs/redlines/RL-001.md | RED_LINE | No cost alteration |
| /docs/redlines/RL-002.md | RED_LINE | No fire rate exploit |
| /docs/redlines/RL-003.md | RED_LINE | No RNG alteration |
| /docs/redlines/RL-004.md | RED_LINE | No HP alteration |
| /docs/redlines/RL-005.md | RED_LINE | No silent punishment |
| /docs/redlines/RL-006.md | RED_LINE | No hidden difficulty |
| /docs/redlines/RL-007.md | RED_LINE | No fake near-miss |
| /docs/redlines/RL-008.md | RED_LINE | No player-specific odds |
| /docs/redlines/RL-009.md | RED_LINE | No operator rigging |
| /docs/redlines/RL-010.md | RED_LINE | No last-hit stealing |
| /docs/redlines/RL-011.md | RED_LINE | No profitable client cheat |
| /docs/redlines/RL-012.md | RED_LINE | No silent tamper |
| /docs/redlines/RL-013.md | RED_LINE | No exploitable HP outliers |
| /docs/redlines/RL-014.md | RED_LINE | No dev without 95% spec certainty |
| /docs/gates/TEST-GATES.md | GATES | Test gates for M1-M6 |
