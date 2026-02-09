# POL-DIST-001: HP Distribution Rules

TYPE: POLICY
STATUS: RESOLVED
SCOPE: GLOBAL
MODULE: M3 — Crypto Fairness / Distribution Design
AI_ACTION_ALLOWED: 1

## STATEMENT

HP range: moderate +-20-35% of mean. Center-weighted distribution. Bosses: high volatility. No exploitably low HP outliers.

## SOURCE

Bible Distribution Design:
- "Moderate HP range (+-20-35% of mean)"
- "Center-weighted distribution"
- "Bosses: High volatility"
- "No exploitably low HP outliers"

## CURRENT COMPLIANCE

PARTIAL. Fish HP ranges exist in config but distribution shape not explicitly center-weighted.

## ALLOWED ACTIONS

- Reference when designing HP derivation function
- Use as constraint for DEC-M3-003

## FORBIDDEN ACTIONS

- Do not create HP distributions with exploitable outliers
- Do not exceed +-35% range for normal fish
