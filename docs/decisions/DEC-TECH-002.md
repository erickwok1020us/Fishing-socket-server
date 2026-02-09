# DEC-TECH-002: Integration Phasing Strategy

TYPE: DECISION
STATUS: RESOLVED
SCOPE: GLOBAL
MODULE: CROSS-MODULE
AI_ACTION_ALLOWED: 1

## RESOLUTION

**Option A: Follow Bible phases exactly (Shadow -> Soft -> Full Enforcement)**

Implementation follows the Bible's 3-phase integration strategy for lowest risk.

RESOLVED BY: Technical analysis — phased rollout is safest for complex system with 6 interdependent modules

## RATIONALE

- Bible explicitly defines this strategy — following it maintains spec compliance
- Shadow Mode allows validation without affecting players
- Soft Enforcement catches issues before full lockdown
- Phased approach reduces blast radius of bugs
- Each phase has clear entry/exit criteria

## PHASE DEFINITIONS

### Phase 1: Shadow Mode
- All M1-M6 modules compute results but do NOT enforce
- Compare shadow results with live game outcomes
- Log discrepancies for analysis
- Player experience unchanged
- Duration: until discrepancy rate < 0.1%

### Phase 2: Soft Enforcement
- M1 authority + cooldown enforced
- M2 RTP applied to rewards
- M4 anti-cheat active (explicit rejections)
- M5 receipts logged (not yet shown to players)
- M3 seed commitment active (not yet verified by client)
- M6 config hash computed
- Duration: until 1M kills pass RTP validation

### Phase 3: Full Enforcement
- All modules fully active and enforced
- Client-side receipt verification enabled
- Seed commitment + reveal active
- UI shows fairness receipts
- Config immutability enforced

## IMPLEMENTATION NOTES

- Phase flags in server config: { phase: 1|2|3 }
- Phase transition requires manual approval (no auto-promotion)
- Each phase transition is a new config version (DEC-M6-002)
