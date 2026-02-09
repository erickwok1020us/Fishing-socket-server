# POL-RNG-001: CSPRNG-Only RNG

TYPE: POLICY
STATUS: RESOLVED
SCOPE: GLOBAL
MODULE: M1 — Network & Authority
AI_ACTION_ALLOWED: 1

## STATEMENT

All RNG for game outcomes MUST occur exclusively on the backend using Cryptographically Secure Pseudo-Random Number Generator (CSPRNG). Client input MUST NEVER influence outcomes.

## SOURCE

Bible M1 / src/rng/CSPRNG.js: "Server-side only: All RNG for game outcomes occurs exclusively on backend"
"CSPRNG: Uses OS-backed cryptographic RNG (/dev/urandom on Linux)"
"Seed never exposed: Internal state is never sent to clients"

## CURRENT COMPLIANCE

PARTIAL. Backend has CSPRNG (src/rng/CSPRNG.js). Single-player uses Math.random() in browser (game.js line 13276).

## ALLOWED ACTIONS

- Reference this policy for any RNG-related design
- Backend CSPRNG module (src/rng/CSPRNG.js) is the approved RNG source

## FORBIDDEN ACTIONS

- Do not use Math.random() for any game outcome
- Do not expose RNG seed or state to clients
- Do not allow client-submitted randomness to determine outcomes
