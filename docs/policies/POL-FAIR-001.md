# POL-FAIR-001: Client Cannot Cheat

TYPE: POLICY
STATUS: RESOLVED
SCOPE: GLOBAL
MODULE: M1 — Network & Authority
AI_ACTION_ALLOWED: 1

## STATEMENT

Client CANNOT alter cost, fake hits, or shoot faster than allowed. All game-critical computations are server-authoritative.

## SOURCE

Bible M1: "Must Guarantee: Client cannot alter cost / fake hits / shoot faster than allowed"

## CURRENT COMPLIANCE

PARTIAL. Multiplayer enforces via server. Single-player has no enforcement (client controls all logic).

## ALLOWED ACTIONS

- Reference this policy in architecture decisions
- Reject any design that allows client-side game outcome determination

## FORBIDDEN ACTIONS

- Do not approve client-authoritative game logic for real-money play
