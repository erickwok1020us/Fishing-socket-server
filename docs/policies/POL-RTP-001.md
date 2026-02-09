# POL-RTP-001: Perfect-Hit RTP = 99%

TYPE: POLICY
STATUS: RESOLVED
SCOPE: GLOBAL
MODULE: M2 — Economy & RTP
AI_ACTION_ALLOWED: 1

## STATEMENT

Perfect-hit RTP MUST equal 99%. If a player hits every shot optimally, the long-term return to player converges to 99%.

## SOURCE

Bible M2: "Target: Perfect-hit RTP = 99%"
Bible M2: "Payout = 0.99 x BulletCost x ExpectedBullets"

## CURRENT COMPLIANCE

NON-COMPLIANT. Code uses 91-95% per weapon (fish3DGameEngine.js lines 230-235, game.js lines 777-779).

## ALLOWED ACTIONS

- Reference this policy when evaluating RTP-related decisions
- Use 99% as the target in RTP simulator design

## FORBIDDEN ACTIONS

- Do not set RTP target below 99% for perfect-hit scenarios
- Do not approve economic models that violate this target
