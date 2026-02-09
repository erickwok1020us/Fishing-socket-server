# SPEC-VOICE-FIRST — Voice-First Interface Guide

STATUS: APPROVED | TIER: 3 (ACTIVE) | v1.0 | 2026-02-09
SOURCE: PLAYBOOK-DOC Section 11 (Voice-First Interface)

## PURPOSE

Define guidelines for voice-first interaction patterns when using AI assistants to navigate and modify the governance documentation system.

## CORE PRINCIPLE

Every document and decision in the system must be discoverable and actionable through voice commands or short text prompts. No mouse-clicking or file-browsing required.

## COMMAND PATTERNS

### Navigation Commands

| Command | Action | Example |
|---------|--------|---------|
| "Show me [DOC-ID]" | Open specific document | "Show me DEC-M1-001" |
| "What decisions are unresolved?" | Query SPINE-INDEX for UNRESOLVED | Filter SPINE-INDEX |
| "Show all red lines" | List all RL-XXX documents | Filter by type RED_LINE |
| "What's the status of M3?" | Show Gate 3 + related decisions | Query TEST-GATES + decisions |
| "Show me the spine" | Open SPINE-INDEX.md | Direct navigation |

### Decision Commands

| Command | Action | Example |
|---------|--------|---------|
| "Resolve [DEC-ID] as [option]" | Update decision status | "Resolve DEC-M3-001 as Option B" |
| "Create decision for [topic]" | Generate new DEC-XXX | "Create decision for WebSocket encryption" |
| "What blocks Gate [N]?" | Show unresolved items for gate | "What blocks Gate 3?" |

### Query Commands

| Command | Action | Example |
|---------|--------|---------|
| "What changed since [date]?" | Show recent modifications | Session log query |
| "What risks are active?" | List active RISK-XXX | Filter RISK docs |
| "Show RTP policy" | Navigate to POL-RTP-001 | Direct lookup |
| "What does RL-005 say?" | Show red line content | Direct lookup |

## AI ENTRY POINT

All AI interactions MUST start from `docs/ai/AI-ENTRY.md`. This file provides:
1. System overview
2. Navigation instructions
3. Link to SPINE-INDEX
4. Link to AI-DECISION-MATRIX

## RESPONSE FORMAT

AI responses should follow this structure:
1. **Direct answer** (1-2 sentences)
2. **Evidence** (link to source document)
3. **Action items** (if any changes needed)

## DISAMBIGUATION RULES

| Ambiguous Input | Resolution |
|-----------------|------------|
| "M1" | Module 1 (Network & Authority) |
| "RTP" | POL-RTP-001 or DEC-M2-001 depending on context |
| "red line" | Ask which RL-XXX or list all |
| "gate" | Ask which Gate (0-6) |

## ANTI-PATTERNS

1. Never require file path knowledge to find a document
2. Never require remembering document IDs — search by topic
3. Never give multi-paragraph answers when a table suffices
4. Never modify documents without confirming the change first

---
LINKED IN SPINE-INDEX: YES
