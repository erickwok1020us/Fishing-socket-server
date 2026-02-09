# DEC-TECH-002: Integration Phasing Strategy

TYPE: DECISION
STATUS: UNRESOLVED
SCOPE: GLOBAL
MODULE: CROSS-MODULE
AI_ACTION_ALLOWED: 0

## QUESTION

Follow the Bible's 3-phase integration strategy (Shadow -> Soft -> Full) or implement all at once?

## CONTEXT

- Bible specifies phased rollout:
  - Phase 1 Shadow Mode: Modules compute but don't enforce, compare with live
  - Phase 2 Soft Enforcement: Enforce authority + cooldown, log receipts, ZK in background
  - Phase 3 Full Enforcement: Contribution rewards / receipts / proof verification all active
- Current state: Most modules at 0-40% implementation
- Single-player focus means lower risk for phased approach

## OPTIONS

| Option | Description | Risk | Timeline |
|--------|-------------|------|----------|
| A | Follow Bible phases exactly (Shadow -> Soft -> Full) | Lowest | Longest |
| B | Skip Shadow, go Soft -> Full (modules already partially exist) | Medium | Medium |
| C | Implement all at once (Full Enforcement from start) | Highest | Shortest if no bugs |

## DEPENDENCIES

- Requires: DEC-M1-001, DEC-TECH-001
- Affects: All M1-M6 implementation order and testing strategy

## ALLOWED ACTIONS

NONE. Decision must be resolved before implementation planning.

## FORBIDDEN ACTIONS

- Do not begin any module implementation
- Do not skip phases without explicit decision
