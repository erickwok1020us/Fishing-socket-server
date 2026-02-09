# SPEC-UI-SKIN — UI Skin System Specification

STATUS: APPROVED | TIER: 3 (ACTIVE) | v1.0 | 2026-02-09
SOURCE: PLAYBOOK-DOC Section 10 (UI Skin System)

## PURPOSE

Define the visual theming system for all documentation and dashboard interfaces related to the 3D Fish Shooting Game project.

## SKIN PALETTE

| Element | Value | Usage |
|---------|-------|-------|
| Primary | #1a73e8 | Headers, links, primary actions |
| Secondary | #4477aa | Sub-headers, secondary info |
| Success | #34a853 | PASSED gates, RESOLVED status |
| Warning | #fbbc04 | PARTIAL status, pending items |
| Danger | #ea4335 | FAILED gates, RED LINES, violations |
| Background | #ffffff | Document background |
| Surface | #f8f9fa | Code blocks, tables |
| Text Primary | #202124 | Body text |
| Text Secondary | #5f6368 | Captions, metadata |

## STATUS BADGE COLORS

| Status | Color | Icon |
|--------|-------|------|
| RESOLVED | Green (#34a853) | Circle |
| UNRESOLVED | Red (#ea4335) | Circle |
| PARTIAL | Yellow (#fbbc04) | Circle |
| PASSED | Green (#34a853) | Checkmark |
| FAILED | Red (#ea4335) | X |
| BLOCKED | Gray (#9aa0a6) | Lock |
| DRAFT | Blue (#1a73e8) | Pencil |
| APPROVED | Green (#34a853) | Shield |

## TIER BADGE COLORS

| Tier | Color | Label |
|------|-------|-------|
| TIER 1: IMMUTABLE | Red (#ea4335) | Red Lines, Policies |
| TIER 2: LOCKED | Orange (#fa7b17) | Approved Decisions |
| TIER 3: ACTIVE | Blue (#1a73e8) | Specs, Active Docs |
| TIER 4: ARCHIVE | Gray (#9aa0a6) | Historical, Deprecated |

## MODULE BADGE COLORS

| Module | Color | Label |
|--------|-------|-------|
| M1 | #4285f4 | Network & Authority |
| M2 | #34a853 | Economy & RTP |
| M3 | #fbbc04 | Crypto Fairness |
| M4 | #ea4335 | Anti-Cheat |
| M5 | #a142f4 | Audit & Receipts |
| M6 | #24c1e0 | Release & Immutability |

## TYPOGRAPHY

| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 | System Sans | 24px | Bold |
| H2 | System Sans | 20px | Bold |
| H3 | System Sans | 16px | Semi-bold |
| Body | System Sans | 14px | Normal |
| Code | Monospace | 13px | Normal |
| Caption | System Sans | 12px | Normal |

## LAYOUT RULES

1. Two-column layout for all documentation (per Writing Law #2)
2. Maximum 2 pages per document (per Writing Law #1)
3. Tables preferred over prose for structured data
4. Code blocks use Surface background with 1px border
5. Status badges appear in top-right of document header

## ICONOGRAPHY

Use text-based indicators in Markdown documents:
- PASSED: `[PASS]`
- FAILED: `[FAIL]`
- PARTIAL: `[PARTIAL]`
- BLOCKED: `[BLOCKED]`

---
LINKED IN SPINE-INDEX: YES
