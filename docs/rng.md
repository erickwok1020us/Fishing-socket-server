# Random Number Generation (RNG) Specification

This document describes the random number generation systems used in the 3D Fish Shooting Game for certification compliance.

## Overview

The game uses two distinct RNG systems:
1. **CSPRNG (Cryptographically Secure)** - For all outcome-related randomness
2. **Seeded PRNG** - For deterministic fish spawning patterns (visual only)

## CSPRNG Implementation

### Source
All security-critical and outcome-related randomness uses Node.js `crypto.randomBytes()`, which is backed by the operating system's CSPRNG:
- Linux: `/dev/urandom` (getrandom syscall)
- Windows: CryptGenRandom

### Usage
CSPRNG is used for:
- Session key generation
- ECDH keypair generation
- Nonce generation
- Salt generation for HKDF
- Hit probability calculations
- Reward calculations
- Fish HP randomization within tier ranges

### Code Location
- `src/security/HKDF.js` - Key derivation salt and nonces
- `src/protocol/BinaryWebSocketServer.js` - Session IDs
- `fish3DGameEngine.js` - Hit calculations (via crypto.randomBytes)

## Seeded PRNG (Mulberry32)

### Purpose
Used for deterministic fish spawning patterns to ensure all clients see the same fish positions. This is purely visual and does not affect game outcomes.

### Algorithm
```javascript
class SeededRNG {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}
```

### Properties
- Period: 2^32
- Passes basic statistical tests (chi-square, runs)
- NOT cryptographically secure
- Deterministic given same seed

### Usage
- Fish spawn positions
- Fish movement patterns
- Fish type selection (weighted by spawn rates)

## Fish Spawning RNG

### Spawn Weight Distribution
Fish types are selected using weighted random selection:

| Tier | Category | Spawn Weight | Cumulative % |
|------|----------|--------------|--------------|
| 1 | Small | 40% | 40% |
| 2 | Common | 30% | 70% |
| 3 | Medium | 15% | 85% |
| 4 | Large | 10% | 95% |
| 5 | Rare | 4% | 99% |
| 6 | Boss | 1% | 100% |

### HP Randomization
Fish HP is randomized within tier-specific ranges using CSPRNG:

| Tier | HP Range |
|------|----------|
| 1 | 20-30 |
| 2 | 50-80 |
| 3 | 100-150 |
| 4 | 200-300 |
| 5 | 400-600 |
| 6 | 1000-2000 |

## RTP (Return to Player) Calculation

### Weapon RTP Values
| Weapon | Multiplier | Cost | RTP |
|--------|------------|------|-----|
| 1x | 1 | 1 | 91.5% |
| 3x | 3 | 3 | 94.5% |
| 5x | 5 | 5 | 97.5% |
| 8x | 8 | 8 | 99.5% |

### RTP Formula
```
RTP = (Total Rewards Paid) / (Total Bets Placed) * 100%
```

### Hit Probability
Hit probability is calculated server-side using CSPRNG:
```javascript
const hitRoll = crypto.randomBytes(4).readUInt32BE(0) / 0xFFFFFFFF;
const isHit = hitRoll < baseHitProbability * weaponModifier;
```

### Reward Calculation
Rewards are calculated based on:
1. Fish multiplier (tier-based)
2. Weapon multiplier
3. Damage contribution percentage (for multi-player kills)

```
playerReward = fishMultiplier * weaponMultiplier * (playerDamage / totalDamage)
```

## Auditability

### Logging
All RNG-related events are logged with:
- Timestamp
- Random value generated
- Context (hit check, spawn, reward)
- Player ID
- Room ID

### Verification
RTP can be verified by:
1. Running N shots (recommended: 1,000,000+)
2. Tracking total bets and rewards
3. Computing realized RTP
4. Verifying within tolerance (typically +/- 0.5%)

### Statistical Tests
The CSPRNG output should pass:
- Chi-square test for uniformity
- Runs test for independence
- Autocorrelation test

## Reseeding Policy

### CSPRNG
- No manual reseeding required
- OS handles entropy pool management
- Automatically reseeds from hardware RNG when available

### Seeded PRNG
- Reseeded on room creation
- Seed = current timestamp (Date.now())
- Same seed produces identical fish patterns

## Security Considerations

1. **Never use Math.random()** for outcome-related calculations
2. **Always use crypto.randomBytes()** for security-critical randomness
3. **Seeded PRNG is for visual consistency only**, not game outcomes
4. **RNG state is server-side only** - clients cannot predict outcomes
5. **All hit detection is server-authoritative** - client cannot manipulate results
