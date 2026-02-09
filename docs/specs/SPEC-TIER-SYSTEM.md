# SPEC-TIER-SYSTEM — 4-Tier Document Classification

STATUS: APPROVED | TIER: 1 (IMMUTABLE) | v1.0 | 2026-02-09
SOURCE: PLAYBOOK-DOC Section 8 (Tier System)

## PURPOSE

Define the 4-tier document classification system that governs mutability, review requirements, and lifecycle of all project documents.

## TIER DEFINITIONS

| Tier | Name | Mutability | Review Required | Documents |
|------|------|-----------|-----------------|-----------|
| 1 | IMMUTABLE | Cannot change without new version | Full team + audit trail | Red Lines (RL-XXX), Core Policies (POL-XXX) |
| 2 | LOCKED | Change requires formal decision | Decision record + approval | Approved Decisions (DEC-XXX), Test Gates |
| 3 | ACTIVE | Can be updated with review | Peer review | Specs (SPEC-XXX), Templates, Session Logs |
| 4 | ARCHIVE | Read-only historical record | None (frozen) | Deprecated docs, old versions |

## TIER 1: IMMUTABLE

Rules that NEVER change without creating a new version:
- All Red Lines (RL-001 through RL-014)
- Core Policies (POL-XXX)
- This tier classification document itself

**Change Process:**
1. Create new DEC-XXX proposing the change
2. Full review by all stakeholders
3. If approved, create new version (v2.0)
4. Old version moves to TIER 4 (ARCHIVE)
5. Update SPINE-INDEX with new version

## TIER 2: LOCKED

Approved decisions and configurations that require formal process to modify:
- All Decision documents (DEC-XXX) once RESOLVED
- TEST-GATES.md
- AI-DECISION-MATRIX.md

**Change Process:**
1. Create new DEC-XXX referencing the original
2. Document rationale for change
3. Approval from document owner
4. Update original document + SPINE-INDEX

## TIER 3: ACTIVE

Living documents that evolve with the project:
- Specification documents (SPEC-XXX)
- Templates (SESSION-LOG, RISK-REGISTER)
- SPINE-INDEX.md (master registry)
- AI-ENTRY.md

**Change Process:**
1. Edit directly
2. Peer review (or self-review for minor changes)
3. Update version number
4. Commit with descriptive message

## TIER 4: ARCHIVE

Historical documents preserved for reference:
- Superseded versions of any document
- Deprecated specifications
- Completed session logs older than 90 days

**Rules:**
- NEVER modify archived documents
- Clearly mark as `STATUS: ARCHIVED`
- Keep in `docs/archive/` directory
- Include reference to replacement document

## DOCUMENT LIFECYCLE

```
DRAFT (Tier 3) → REVIEW → APPROVED (Tier 2/3) → [if immutable] LOCKED (Tier 1)
                                                 → [if superseded] ARCHIVED (Tier 4)
```

## CURRENT CLASSIFICATION

| Document | Tier | Rationale |
|----------|------|-----------|
| RL-001 to RL-014 | 1 | Red Lines are immutable by definition |
| POL-XXX (all 9) | 1 | Core policies from Bible |
| DEC-XXX (all 20) | 2 | Resolved decisions, locked |
| TEST-GATES.md | 2 | Gate criteria locked after approval |
| AI-DECISION-MATRIX.md | 2 | Binary logic locked |
| SPEC-UI-SKIN | 3 | Active specification |
| SPEC-VOICE-FIRST | 3 | Active specification |
| SPEC-ART-STYLE | 3 | Active specification |
| SPEC-TIER-SYSTEM | 1 | Classification rules are immutable |
| SESSION-LOG template | 3 | Active template |
| RISK-REGISTER template | 3 | Active template |
| SPINE-INDEX.md | 3 | Living index |
| AI-ENTRY.md | 3 | Living entry point |

---
LINKED IN SPINE-INDEX: YES
