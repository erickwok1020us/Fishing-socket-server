# Binary Protocol Specification v2

This document describes the binary WebSocket protocol used for the 3D Fish Shooting Game certification-compliant implementation.

## Overview

The protocol uses a fixed-size binary header followed by an encrypted payload. All multi-byte integers use big-endian byte order.

## Protocol Version

Current version: **2**

## Header Format (19 bytes) - Exact PDF Specification

| Offset | Size | Type | Field | Description |
|--------|------|------|-------|-------------|
| 0 | 1 | uint8 | protocolVersion | Protocol version (2) |
| 1 | 2 | uint16 | packetId | Packet type identifier |
| 3 | 4 | uint32 | payloadLength | Length of encrypted payload |
| 7 | 4 | uint32 | checksum | CRC32 of header (first 7 bytes) + encrypted payload + GCM tag |
| 11 | 8 | uint64 | nonce | Monotonically increasing nonce |

## Security Pipeline

All packets (except initial handshake) follow this processing order:

### Sending
1. Serialize payload to binary format
2. Encrypt payload with AES-256-GCM using session key
3. Compute CRC32 checksum
4. Compute HMAC-SHA256 over header + encrypted payload + GCM tag
5. Concatenate: header + encrypted payload + GCM tag (16 bytes) + HMAC (32 bytes)

### Receiving
1. Parse header (19 bytes)
2. Validate protocol version
3. Validate packet ID against whitelist
4. Validate payload size against limits
5. Verify CRC32 checksum
6. Verify HMAC-SHA256
7. Decrypt AES-256-GCM payload
8. Validate nonce (must be strictly increasing)
9. Deserialize binary payload

## Packet Types

### Handshake & Session (0x0001 - 0x000F)

| ID | Name | Direction | Description |
|----|------|-----------|-------------|
| 0x0001 | HANDSHAKE_REQUEST | C->S | Client initiates ECDH key exchange |
| 0x0002 | HANDSHAKE_RESPONSE | S->C | Server completes ECDH key exchange |
| 0x0003 | SESSION_INIT | S->C | Session initialization data |
| 0x0004 | SESSION_ACK | C->S | Client acknowledges session |

### Game Actions (0x0010 - 0x001F)

| ID | Name | Direction | Description |
|----|------|-----------|-------------|
| 0x0010 | SHOT_FIRED | C->S | Player fires a shot |
| 0x0011 | HIT_RESULT | S->C | Server reports hit detection result |
| 0x0012 | BALANCE_UPDATE | S->C | Player balance changed |
| 0x0013 | WEAPON_SWITCH | C->S | Player switches weapon |

### Fish State (0x0020 - 0x002F)

| ID | Name | Direction | Description |
|----|------|-----------|-------------|
| 0x0020 | ROOM_SNAPSHOT | S->C | Full room state snapshot |
| 0x0021 | FISH_SPAWN | S->C | New fish spawned |
| 0x0022 | FISH_DEATH | S->C | Fish killed |
| 0x0023 | FISH_UPDATE | S->C | Fish state update |

### Boss Events (0x0030 - 0x003F)

| ID | Name | Direction | Description |
|----|------|-----------|-------------|
| 0x0030 | BOSS_SPAWN | S->C | Boss fish spawned |
| 0x0031 | BOSS_DEATH | S->C | Boss fish killed |
| 0x0032 | BOSS_DAMAGE | S->C | Boss damage update |

### Player Events (0x0040 - 0x004F)

| ID | Name | Direction | Description |
|----|------|-----------|-------------|
| 0x0040 | PLAYER_JOIN | S->C | Player joined room |
| 0x0041 | PLAYER_LEAVE | S->C | Player left room |
| 0x0042 | PLAYER_MOVEMENT | C->S | Player movement update |

### Room Management (0x0050 - 0x005F)

| ID | Name | Direction | Description |
|----|------|-----------|-------------|
| 0x0050 | ROOM_CREATE | C->S | Create new room |
| 0x0051 | ROOM_JOIN | C->S | Join existing room |
| 0x0052 | ROOM_LEAVE | C->S | Leave room |
| 0x0053 | ROOM_STATE | S->C | Room state update |
| 0x0054 | GAME_START | C->S | Host starts game |

### Time Sync (0x0060 - 0x006F)

| ID | Name | Direction | Description |
|----|------|-----------|-------------|
| 0x0060 | TIME_SYNC_PING | C->S | Client time sync request |
| 0x0061 | TIME_SYNC_PONG | S->C | Server time sync response |

### System (0x00F0 - 0x00FF)

| ID | Name | Direction | Description |
|----|------|-----------|-------------|
| 0x00F0 | ERROR | S->C | Error notification |
| 0x00FF | DISCONNECT | S->C | Disconnect notification |

## Payload Schemas

### HANDSHAKE_REQUEST (98 bytes)
| Offset | Size | Type | Field |
|--------|------|------|-------|
| 0 | 1 | uint8 | protocolVersion |
| 1 | 65 | bytes | clientPublicKey (P-256 uncompressed) |
| 66 | 32 | bytes | clientNonce |

### HANDSHAKE_RESPONSE (145 bytes)
| Offset | Size | Type | Field |
|--------|------|------|-------|
| 0 | 65 | bytes | serverPublicKey (P-256 uncompressed) |
| 65 | 32 | bytes | serverNonce |
| 97 | 32 | bytes | salt (for HKDF) |
| 129 | 16 | string | sessionId (null-padded) |

### SHOT_FIRED (53 bytes)
| Offset | Size | Type | Field |
|--------|------|------|-------|
| 0 | 16 | string | playerId |
| 16 | 1 | uint8 | weaponId |
| 17 | 4 | float32 | targetX |
| 21 | 4 | float32 | targetY |
| 25 | 4 | float32 | targetZ |
| 29 | 4 | float32 | directionX |
| 33 | 4 | float32 | directionY |
| 37 | 4 | float32 | directionZ |
| 41 | 4 | uint32 | shotSequenceId |
| 45 | 8 | uint64 | timestamp |

### BALANCE_UPDATE (37 bytes)
| Offset | Size | Type | Field |
|--------|------|------|-------|
| 0 | 16 | string | playerId |
| 16 | 8 | float64 | balance |
| 24 | 4 | int32 | change |
| 28 | 1 | uint8 | reasonCode |
| 29 | 8 | uint64 | timestamp |

### FISH_SPAWN (54 bytes)
| Offset | Size | Type | Field |
|--------|------|------|-------|
| 0 | 8 | string | fishId |
| 8 | 1 | uint8 | fishType |
| 9 | 4 | float32 | x |
| 13 | 4 | float32 | y |
| 17 | 4 | float32 | z |
| 21 | 4 | uint32 | hp |
| 25 | 4 | uint32 | maxHp |
| 29 | 4 | uint32 | reward |
| 33 | 4 | float32 | velocityX |
| 37 | 4 | float32 | velocityY |
| 41 | 4 | float32 | velocityZ |
| 45 | 1 | uint8 | flags (bit 0: isBoss) |
| 46 | 8 | uint64 | timestamp |

### FISH_DEATH (36 bytes)
| Offset | Size | Type | Field |
|--------|------|------|-------|
| 0 | 8 | string | fishId |
| 8 | 16 | string | killedBy (playerId) |
| 24 | 4 | uint32 | reward |
| 28 | 8 | uint64 | timestamp |

## Key Derivation (ECDH + HKDF)

Session keys are derived using ECDH key exchange followed by HKDF:

1. Client generates ephemeral ECDH keypair (P-256/prime256v1)
2. Client sends clientPublicKey + clientNonce in HANDSHAKE_REQUEST
3. Server generates ephemeral ECDH keypair
4. Server computes sharedSecret = ECDH(serverPrivateKey, clientPublicKey)
5. Server generates random salt (32 bytes)
6. Server computes transcriptHash = SHA256(clientPublicKey || serverPublicKey || clientNonce || serverNonce || protocolVersion)
7. Server derives keys using HKDF-SHA256:
   - IKM = sharedSecret
   - salt = random 32 bytes
   - info = transcriptHash || "fishshoot-v2 session keys"
   - output = 64 bytes (first 32 = encryptionKey, next 32 = hmacKey)
8. Server sends serverPublicKey + serverNonce + salt in HANDSHAKE_RESPONSE
9. Client performs same derivation to obtain identical keys

## Nonce Rules

- Nonces must be strictly monotonically increasing
- Server and client maintain separate nonce counters
- Nonce replay is rejected and connection is terminated
- Nonce is used as IV for AES-256-GCM (padded to 12 bytes)

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 0x01 | INVALID_PACKET | Malformed packet |
| 0x02 | INVALID_CHECKSUM | CRC32 mismatch |
| 0x03 | INVALID_HMAC | HMAC verification failed |
| 0x04 | DECRYPTION_FAILED | AES-GCM decryption failed |
| 0x05 | INVALID_NONCE | Nonce replay or out of order |
| 0x06 | UNKNOWN_PACKET_ID | Unrecognized packet type |
| 0x07 | PAYLOAD_TOO_LARGE | Payload exceeds maximum size |
| 0x10 | INVALID_SESSION | Session not found or expired |
| 0x11 | INVALID_ROOM | Room not found |
| 0x12 | ROOM_FULL | Room at maximum capacity |

## Maximum Sizes

| Limit | Value |
|-------|-------|
| Max payload size | 65535 bytes |
| Max fish per snapshot | 100 |
| Max players per snapshot | 4 |
| Max bullets per snapshot | 200 |
| Session timeout | 30 minutes |
