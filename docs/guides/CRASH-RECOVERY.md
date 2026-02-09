# CRASH-RECOVERY — What To Do If You Get Lost

STATUS: ACTIVE | TIER: 3 (ACTIVE) | v1.0 | 2026-02-09
SOURCE: PLAYBOOK-DOC Section 8 (Tier 3: Active Documents)

## PURPOSE

Step-by-step recovery guide when you lose context, can't find something, or the documentation system feels broken. Follow these steps in order.

## STEP 1: START FROM AI-ENTRY

Open `docs/ai/AI-ENTRY.md`. This is always your starting point. If this file is missing or corrupted, the system is broken — escalate immediately.

## STEP 2: READ THE SPINE

Open `docs/spine/SPINE-INDEX.md`. This is the master registry of everything. Every document, decision, policy, and red line is listed here.

- If your document is not in SPINE-INDEX, it does not exist
- If a decision is not RESOLVED, you cannot act on it

## STEP 3: CHECK THE DECISION MATRIX

Open `docs/ai/AI-DECISION-MATRIX.md`. Evaluate variables A through G for your situation. Follow the binary logic exactly.

## STEP 4: LOCATE YOUR DOCUMENT

Use the FILE INDEX section of SPINE-INDEX to find file paths:

| Looking for | Path |
|-------------|------|
| A decision | `docs/decisions/DEC-XXX.md` |
| A policy | `docs/policies/POL-XXX.md` |
| A red line | `docs/redlines/RL-XXX.md` |
| Test gates | `docs/gates/TEST-GATES.md` |
| A template | `docs/templates/` |
| A specification | `docs/specs/SPEC-XXX.md` |
| Build status | `docs/dashboard/BUILD-DASHBOARD.md` |

## STEP 5: IF SOMETHING IS MISSING

1. Check if it was archived: `docs/archive/`
2. Check git history: `git log --oneline -- docs/`
3. If truly missing: create it using the appropriate template from `docs/templates/`
4. Add it to SPINE-INDEX immediately

## COMMON PROBLEMS

| Problem | Solution |
|---------|----------|
| Can't find a document | Search SPINE-INDEX by ID or keyword |
| Decision seems wrong | Check DEC-XXX — if RESOLVED, do NOT re-decide. Create new DEC if needed |
| Red line violated | STOP everything. Read the RL-XXX. Fix before continuing |
| Test gate failing | Check TEST-GATES.md for specific failure. Run `npm test` locally |
| Don't know where to start | Always start at AI-ENTRY.md |
| Conflicting information | SPINE-INDEX is truth. If a doc contradicts SPINE, SPINE wins |
| Need to make a change | Evaluate AI-DECISION-MATRIX first. If AI_ACTION_ALLOWED = 0, STOP AND ASK |

## EMERGENCY CONTACTS

| Role | Who |
|------|-----|
| Project Owner | @erickwok1020us |
| Backend Repo | github.com/erickwok1020us/Fishing-socket-server |
| Frontend Repo | github.com/erickwok1020us/3D-Fish-Shooting- |

## RECOVERY CHECKLIST

- [ ] AI-ENTRY.md exists and is readable
- [ ] SPINE-INDEX.md lists all documents
- [ ] All DEC-XXX files exist (20 total)
- [ ] All POL-XXX files exist (9 total)
- [ ] All RL-XXX files exist (14 total)
- [ ] TEST-GATES.md is current
- [ ] AI-DECISION-MATRIX.md has A-G variables
- [ ] `npm test` passes all gate tests

---
LINKED IN SPINE-INDEX: YES
