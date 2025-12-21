# Threat Model

This document describes the security threat model for the 3D Fish Shooting Game certification-compliant implementation.

## Assets

### High Value
1. **Player Balances** - Virtual currency that can be converted to real money
2. **Game Outcomes** - Hit detection, rewards, RTP calculations
3. **Session Keys** - AES-256 encryption and HMAC keys

### Medium Value
4. **Player Accounts** - Identity and session state
5. **Room State** - Game progress and player positions
6. **RNG State** - Random number generator state

### Low Value
7. **Fish Positions** - Visual game state
8. **Player Names** - Display names

## Trust Boundaries

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  Client Browser  |<--->|  WebSocket TLS   |<--->|  Game Server     |
|  (Untrusted)     |     |  (Transport)     |     |  (Trusted)       |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
                                                  +------------------+
                                                  |                  |
                                                  |  Game Engine     |
                                                  |  (Authoritative) |
                                                  |                  |
                                                  +------------------+
```

### Boundary 1: Client <-> Transport
- TLS 1.3 encryption
- Certificate validation
- No plaintext transmission

### Boundary 2: Transport <-> Server
- Binary protocol with AES-256-GCM
- HMAC-SHA256 integrity
- Nonce replay protection

### Boundary 3: Server <-> Engine
- Internal trusted boundary
- No network exposure
- Direct function calls

## Attacker Model

### Capabilities
1. **Network Observer** - Can observe encrypted traffic
2. **Active MITM** - Can intercept and modify traffic (if TLS compromised)
3. **Malicious Client** - Can send arbitrary packets
4. **Replay Attacker** - Can capture and replay packets
5. **Timing Attacker** - Can measure response times

### Goals
1. **Manipulate Outcomes** - Force hits, increase rewards
2. **Steal Balances** - Transfer funds to attacker
3. **Denial of Service** - Crash server or disrupt games
4. **Information Disclosure** - Learn other players' data
5. **Session Hijacking** - Take over another player's session

## Threats and Mitigations

### T1: Packet Tampering
**Threat**: Attacker modifies packet contents in transit
**Mitigations**:
- AES-256-GCM authenticated encryption
- HMAC-SHA256 over entire packet
- CRC32 checksum for quick rejection
**Residual Risk**: Low - Would require breaking AES-GCM or HMAC

### T2: Replay Attacks
**Threat**: Attacker captures and replays valid packets
**Mitigations**:
- Monotonically increasing nonce (uint64)
- Server rejects any nonce <= last seen nonce
- Connection terminated on replay detection
**Residual Risk**: Low - Nonce space is 2^64

### T3: Session Hijacking
**Threat**: Attacker obtains session keys
**Mitigations**:
- ECDH ephemeral key exchange (forward secrecy)
- HKDF key derivation with transcript binding
- Keys never transmitted, only derived
- Session timeout (30 minutes)
**Residual Risk**: Low - Would require ECDH break or server compromise

### T4: Client-Side Outcome Manipulation
**Threat**: Malicious client claims false hits/rewards
**Mitigations**:
- Server-authoritative hit detection
- Server calculates all rewards
- Client only sends input (shot direction)
- Server validates all state changes
**Residual Risk**: None - Client cannot affect outcomes

### T5: Rate Limiting Bypass
**Threat**: Attacker floods server with requests
**Mitigations**:
- Per-session rate limiting
- Per-IP rate limiting
- Weapon cooldown enforcement
- Connection limits per IP
**Residual Risk**: Medium - Distributed attacks possible

### T6: Timing Attacks
**Threat**: Attacker infers game state from response times
**Mitigations**:
- Constant-time HMAC comparison
- Fixed tick rate game loop
- Batched state updates
**Residual Risk**: Low - Limited information leakage

### T7: Protocol Downgrade
**Threat**: Attacker forces use of weaker protocol
**Mitigations**:
- Protocol version in header
- Server rejects version != 2
- No backward compatibility with v1
**Residual Risk**: None - Strict version enforcement

### T8: Denial of Service
**Threat**: Attacker exhausts server resources
**Mitigations**:
- Connection limits
- Payload size limits (65535 bytes)
- Session cleanup (30 minute timeout)
- Invalid packet rejection (fail fast)
**Residual Risk**: Medium - Resource exhaustion possible

### T9: Information Disclosure
**Threat**: Attacker learns other players' data
**Mitigations**:
- Per-session encryption keys
- Room-scoped broadcasts
- No cross-room data leakage
- Minimal error messages
**Residual Risk**: Low - Encrypted and scoped

### T10: RNG Prediction
**Threat**: Attacker predicts random outcomes
**Mitigations**:
- CSPRNG for all outcomes (crypto.randomBytes)
- RNG state server-side only
- No client-side outcome calculation
**Residual Risk**: None - CSPRNG is unpredictable

## Security Controls Summary

| Control | Implementation | Status |
|---------|---------------|--------|
| Transport Encryption | TLS 1.3 | Active |
| Payload Encryption | AES-256-GCM | Active |
| Integrity | HMAC-SHA256 | Active |
| Replay Protection | Monotonic Nonce | Active |
| Key Exchange | ECDH P-256 | Active |
| Key Derivation | HKDF-SHA256 | Active |
| Server Authority | All outcomes server-side | Active |
| Rate Limiting | Per-session/IP limits | Active |
| Input Validation | Whitelist packet IDs | Active |
| Size Limits | Max payload 65535 | Active |

## Incident Response

### Detection
- Log all security events (invalid HMAC, replay attempts, etc.)
- Monitor for unusual patterns (high error rates, connection spikes)
- Alert on repeated failures from same IP

### Response
1. **Invalid Packet**: Log and close connection
2. **Replay Attempt**: Log, close connection, flag IP
3. **Rate Limit Exceeded**: Temporary IP block
4. **Suspected Attack**: Manual review, potential permanent block

## Compliance

This implementation addresses the following certification requirements:
- Binary protocol (no JSON in runtime)
- ECDH key exchange (no direct key transmission)
- Server-authoritative outcomes
- CSPRNG for all randomness
- Comprehensive audit logging
- Replay protection
- Integrity verification
