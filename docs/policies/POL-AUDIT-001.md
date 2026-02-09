# POL-AUDIT-001: Receipt Requirements

TYPE: POLICY
STATUS: RESOLVED
SCOPE: GLOBAL
MODULE: M5 — Audit & Receipts
AI_ACTION_ALLOWED: 1

## STATEMENT

Every FishDeath MUST emit a receipt containing: fish_id, total_damage, player_damage[], payout_total, payout_split[], finisher_bonus, rules_hash, proof_reference.

## SOURCE

Bible M5: "Every FishDeath emits: { fish_id, total_damage, player_damage[], payout_total, payout_split[], finisher_bonus, rules_hash, proof_reference }"

## CURRENT COMPLIANCE

NON-COMPLIANT. fishKilled event exists but is missing: total_damage, player_damage[], finisher_bonus, rules_hash, proof_reference.

## ALLOWED ACTIONS

- Reference when designing receipt schema
- Use as validation checklist for M5 implementation

## FORBIDDEN ACTIONS

- Do not emit incomplete receipts
- Do not omit any required field
