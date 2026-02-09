# POL-IMMUT-001: Immutability Guarantee

TYPE: POLICY
STATUS: RESOLVED
SCOPE: GLOBAL
MODULE: M6 — Release & Immutability
AI_ACTION_ALLOWED: 1

## STATEMENT

Operator CANNOT change fairness rules without creating a new version. Rules hash MUST be included in every receipt.

## SOURCE

Bible M6: "Signed config, Rules hash versioning, Rules hash included in every receipt"
Bible M6: "Operator cannot change fairness rules without new version"

## CURRENT COMPLIANCE

NON-COMPLIANT. No config signing, no rules hash versioning, no rules hash in receipts.

## ALLOWED ACTIONS

- Reference when designing config management
- Use as constraint for DEC-M6-001, DEC-M6-002

## FORBIDDEN ACTIONS

- Do not allow runtime config changes without version bump
