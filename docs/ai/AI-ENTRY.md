# AI-ENTRY — Mandatory Starting Point

STATUS: ACTIVE | v1.0 | 2026-02-09

## RULES

1. This file is the ONLY entry point. Start here.
2. Decisions are NEVER stored in model context.
3. Check decision state in SPINE-INDEX.md before ANY action.
4. UNRESOLVED (0) = STOP. Do not proceed.
5. RESOLVED (1) = Action allowed per atomic doc.
6. Never re-evaluate RESOLVED decisions.
7. Never infer intent. Execute only what is explicitly allowed.
8. If not indexed, it does not exist.

## NAVIGATION

1. Read this file (AI-ENTRY.md)
2. Read /docs/spine/SPINE-INDEX.md
3. Load ONLY the single relevant atomic document
4. Evaluate AI-DECISION-MATRIX.md before acting
5. Never load multiple decisions at once

## DECISION MODEL

See /docs/ai/AI-DECISION-MATRIX.md for binary logic (A-G variables).

## SOURCE OF TRUTH

- Game Bible: 3D Fish Shooting Game Development Bible v4.2
- Backend Repo: github.com/erickwok1020us/Fishing-socket-server
- Frontend Repo: github.com/erickwok1020us/3D-Fish-Shooting-
