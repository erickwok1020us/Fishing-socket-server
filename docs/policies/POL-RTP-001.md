# POL-RTP-001: Per-Weapon RTP Target

TYPE: POLICY
STATUS: RESOLVED
SCOPE: GLOBAL
MODULE: M2 — Economy & RTP
AI_ACTION_ALLOWED: 1

## STATEMENT

RTP is per-weapon: 1x=91%, 3x=93%, 5x=94%, 8x=95%. Higher-cost weapons yield better return rate.

## SOURCE

DEC-M2-001 (User directive 2026-02-09): "RTP 先保留目前設定"
Current code: fish3DGameEngine.js lines 230-235, game.js lines 777-779

## BIBLE OVERRIDE

This policy overrides Bible M2: "Perfect-hit RTP = 99%". The user explicitly chose to keep current per-weapon RTP values.

## CURRENT COMPLIANCE

COMPLIANT. Code already implements these values.

## ALLOWED ACTIONS

- Reference this policy when evaluating RTP-related decisions
- Use per-weapon values as targets in RTP simulator (DEC-M2-004)

## FORBIDDEN ACTIONS

- Do not change RTP values without new user directive
- Do not revert to 99% without explicit approval
