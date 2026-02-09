# SPEC-ART-STYLE — Art Style Formatting Standard

STATUS: APPROVED | TIER: 3 (ACTIVE) | v1.0 | 2026-02-09
SOURCE: PLAYBOOK-DOC Section 12 (Art Style Formatting)

## PURPOSE

Define formatting standards for all documentation in the 3D Fish Shooting Game governance system. Ensures visual consistency and readability across all documents.

## DOCUMENT STRUCTURE

Every document MUST follow this structure:

```
# [DOC-ID] — [Title]

STATUS: [status] | TIER: [N] | v[X.Y] | [DATE]
SOURCE: [origin reference]

## [Section 1]
[Content]

## [Section 2]
[Content]

---
LINKED IN SPINE-INDEX: YES/NO
```

## HEADER FORMAT

Line 1: `# [TYPE]-[MODULE]-[SEQ] — [Human-Readable Title]`
Line 2: Empty
Line 3: `STATUS: [RESOLVED|UNRESOLVED|DRAFT|APPROVED] | TIER: [1-4] | v[X.Y] | [YYYY-MM-DD]`
Line 4: `SOURCE: [Bible section | User directive | Session ID]`

## NAMING CONVENTIONS

| Type | Format | Example |
|------|--------|---------|
| Decision | DEC-[MODULE]-[SEQ] | DEC-M1-001 |
| Policy | POL-[DOMAIN]-[SEQ] | POL-RTP-001 |
| Red Line | RL-[SEQ] | RL-005 |
| Specification | SPEC-[TOPIC] | SPEC-UI-SKIN |
| Risk | RISK-[SEQ] | RISK-001 |
| Session Log | SESSION-LOG-[SEQ] | SESSION-LOG-001 |
| Test Gate | Gate [N] | Gate 3 |

## TABLE FORMAT

All structured data MUST use Markdown tables:

```markdown
| Column A | Column B | Column C |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
```

Rules:
- Header row always bold (implicit in Markdown)
- Alignment: left for text, right for numbers
- No empty cells — use "N/A" or "-"

## CODE BLOCK FORMAT

- Use triple backticks with language identifier
- Keep code blocks under 20 lines
- Add filename comment on first line for file-specific code

```javascript
// fish3DServer.js
const example = 'format';
```

## STATUS INDICATORS

Use text-based indicators consistently:

| Indicator | Meaning | Usage |
|-----------|---------|-------|
| PASS | Test/gate passed | TEST-GATES.md |
| FAIL | Test/gate failed | TEST-GATES.md |
| PARTIAL | Partially complete | TEST-GATES.md |
| PENDING | Not yet tested | TEST-GATES.md |
| RESOLVED | Decision made | SPINE-INDEX.md |
| UNRESOLVED | Decision pending | SPINE-INDEX.md |

## CROSS-REFERENCE FORMAT

When referencing other documents:
- Inline: `(see DEC-M1-001)` or `(per RL-005)`
- Table: Use document ID directly in cells
- Links: `[DEC-M1-001](../decisions/DEC-M1-001.md)`

## WRITING LAWS (from PLAYBOOK-DOC)

1. MAX 2 PAGES per document
2. TWO-COLUMN LAYOUT where possible
3. SMALL FONT (8-9pt equivalent) — dense content
4. TABLES > PROSE for structured data
5. BOLD HEADERS for scanability
6. NO FLUFF — every sentence must earn its place
7. EXAMPLES REQUIRED for every rule
8. UPDATE NOW, NOT LATER
9. LINK EVERYTHING to SPINE-INDEX
10. SINGLE SOURCE OF TRUTH in Git

## FILE ORGANIZATION

```
docs/
  ai/              — AI entry point and decision matrix
  spine/           — SPINE-INDEX (master registry)
  decisions/       — DEC-XXX decision documents
  policies/        — POL-XXX policy documents
  redlines/        — RL-XXX red line documents
  gates/           — TEST-GATES.md
  templates/       — Reusable document templates
  specs/           — SPEC-XXX specification documents
  archive/         — TIER 4 archived documents
```

---
LINKED IN SPINE-INDEX: YES
