# ANTI-DILUTION-LAWS — Boundaries You Cannot Cross

STATUS: RESOLVED | TIER: 1 (IMMUTABLE) | v1.0 | 2026-02-09
SOURCE: PLAYBOOK-DOC Section 6 (Red Lines)

## PURPOSE

Define hard limits for both technical metrics and documentation processes. If any threshold is breached, STOP everything and fix immediately.

## TECHNICAL RED LINES (Stop if Violated)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Boot success | <99.5% | STOP ROLLOUT |
| Voice accuracy | <97.5% | BLOCKED |
| Battery impact | >35% | BLOCKED |
| Security bypass | >0.1% | FIX REQUIRED |

## DOCUMENTATION RED LINES (Fix Immediately)

| Condition | Consequence |
|-----------|-------------|
| No log for 3+ days | Red flag — Someone isn't documenting |
| Spec without success criteria | Invalid spec — Rewrite it |
| High risk without mitigation | Escalate immediately |
| Blocker open >48h | Priority 0 — Drop everything else |
| Orphan doc found | Link it or DELETE it |
| Decision made in Slack only | Invalid — Create GitLab issue |

## PROCESS RED LINES (Never Do This)

| Rule | Rationale |
|------|-----------|
| Never commit directly to main without MR | Code review is mandatory |
| Never approve your own MR | Second pair of eyes required |
| Never skip code review for "small changes" | Small changes cause big bugs |
| Never delete without archiving first | History must be preserved |
| Never make breaking changes without announcement | Team must be informed |

## ENFORCEMENT

- Technical red lines: Automated monitoring where possible
- Documentation red lines: Weekly audit of SPINE-INDEX
- Process red lines: Enforced via branch protection and MR rules
- Violations are logged in RISK-REGISTER with severity HIGH

## RELATIONSHIP TO RL-XXX

This document covers documentation and process boundaries. For game-specific red lines (no client cheating, no silent punishment, etc.), see:
- RL-001 through RL-014 in `docs/redlines/`
- These are complementary, not overlapping

---
LINKED IN SPINE-INDEX: YES
