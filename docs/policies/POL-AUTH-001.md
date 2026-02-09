# POL-AUTH-001: Server Authority Mandate

TYPE: POLICY
STATUS: RESOLVED
SCOPE: GLOBAL
MODULE: M1 — Network & Authority
AI_ACTION_ALLOWED: 1

## STATEMENT

Server MUST validate cooldown, fire rate, and hit detection. All critical game decisions occur server-side.

## SOURCE

Bible M1: "Server validates cooldown / fire rate / hit detection"
Bible M1: "Client cannot alter cost / fake hits / shoot faster than allowed"

## CURRENT COMPLIANCE

PARTIAL. Multiplayer mode uses server authority. Single-player mode runs entirely client-side (game.js lines 13262-13317).

## ALLOWED ACTIONS

- Reference this policy when designing game architecture
- Evaluate single-player proposals against this mandate

## FORBIDDEN ACTIONS

- Do not approve client-side authority for real-money game logic
- Do not bypass server validation for any game outcome
