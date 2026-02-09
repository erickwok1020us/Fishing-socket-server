# POL-ECON-001: Reward Split Rules

TYPE: POLICY
STATUS: RESOLVED
SCOPE: GLOBAL
MODULE: M2 — Economy & RTP
AI_ACTION_ALLOWED: 1

## STATEMENT

Reward split: 90-98% by contribution, 2-10% finisher pool. Sum of splits MUST equal payout exactly.

## SOURCE

Bible M2: "Reward Split: 90-98% by contribution, 2-10% finisher pool"
Bible M2: "Rounding: Deterministic, sum of splits must equal payout exactly, use remainder policy"

## CURRENT COMPLIANCE

NON-COMPLIANT. Current code uses 100% contribution-based split with no finisher pool.

## ALLOWED ACTIONS

- Reference when designing reward distribution
- Use as constraint for DEC-M2-002

## FORBIDDEN ACTIONS

- Do not implement reward split without finisher pool consideration
