# AI-DECISION-MATRIX — Binary Decision Logic

STATUS: ACTIVE | v1.0 | 2026-02-09

## VARIABLES (evaluate strictly as 0 or 1)

| Var | Question | Values |
|-----|----------|--------|
| A | Changes behavior? | 0/1 |
| B | Affects multiple modules? | 0/1 |
| C | System-wide impact? | 0/1 |
| D | Hard or irreversible change? | 0/1 |
| E | Policy or rule constrained? | 0/1 |
| F | Decision exists in SPINE-INDEX? | 0/1 |
| G | Decision is ACTIVE/RESOLVED? | 0/1 |

## DECISION RULES (no deviation allowed)

```
IF A = 0
  -> AI_ACTION_ALLOWED = 1

IF A = 1 AND C = 0 AND D = 0 AND E = 0
  -> AI_ACTION_ALLOWED = 1

IF A = 1 AND (C = 1 OR D = 1 OR E = 1) AND F = 1 AND G = 1
  -> AI_ACTION_ALLOWED = 1

IF A = 1 AND (C = 1 OR D = 1 OR E = 1) AND (F = 0 OR G = 0)
  -> AI_ACTION_ALLOWED = 0
  -> STOP AND ASK
```

## HARD RULES

1. Unknown values MUST be treated as 0
2. If AI_ACTION_ALLOWED = 0, execution is forbidden
3. RESOLVED decisions (G=1) must NEVER be re-decided
4. If a decision is not indexed in SPINE-INDEX, it does not exist
5. No interpretation, no heuristics, no prioritization
