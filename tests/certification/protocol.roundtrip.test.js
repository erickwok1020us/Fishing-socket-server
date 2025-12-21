/**
 * Protocol Round-Trip Tests
 * 
 * Tests serialize + deserialize for each packet type to ensure
 * binary encoding/decoding is correct and reversible.
 */

const crypto = require('crypto');
const { 
    serializePacket,
    serializeShotFired,
    serializeHitResult,
    serializeBalanceUpdate,
    serializeFishSpawn,
    serializeFishDeath,
    serializePlayerJoin,
    serializePlayerLeave,
    serializeTimeSyncPong,
    serializeError
} = require('../../src/protocol/serializer');
const { 
    deserializePacket,
    DeserializationError
} = require('../../src/protocol/deserializer');
const { PacketId, PROTOCOL_VERSION } = require('../../src/protocol/packets');

const encryptionKey = crypto.randomBytes(32);
const hmacKey = crypto.randomBytes(32);

describe('Protocol Round-Trip Tests', () => {
    let nonce = 0;
    
    beforeEach(() => {
        nonce++;
    });
    
    test('SHOT_FIRED round-trip', () => {
        const original = {
            playerId: 'player-12345678',
            weaponId: 3,
            targetX: 10.5,
            targetY: 20.5,
            targetZ: 30.5,
            directionX: 0.5,
            directionY: 0.6,
            directionZ: 0.7,
            shotSequenceId: 12345,
            timestamp: Date.now()
        };
        
        const packet = serializeShotFired(original, encryptionKey, hmacKey, nonce);
        const result = deserializePacket(packet, encryptionKey, hmacKey, nonce - 1);
        
        expect(result.packetId).toBe(PacketId.SHOT_FIRED);
        expect(result.payload.playerId.trim()).toBe(original.playerId);
        expect(result.payload.weaponId).toBe(original.weaponId);
        expect(result.payload.shotSequenceId).toBe(original.shotSequenceId);
    });
    
    test('HIT_RESULT round-trip', () => {
        const original = {
            shotSequenceId: 12345,
            hits: [{ fishId: 'fish-001', damage: 10, newHealth: 90 }],
            totalDamage: 10,
            totalReward: 5,
            newBalance: 995,
            fishRemovedIds: [],
            timestamp: Date.now()
        };
        
        const packet = serializeHitResult(original, encryptionKey, hmacKey, nonce);
        const result = deserializePacket(packet, encryptionKey, hmacKey, nonce - 1);
        
        expect(result.packetId).toBe(PacketId.HIT_RESULT);
        expect(result.payload.shotSequenceId).toBe(original.shotSequenceId);
        expect(result.payload.totalDamage).toBe(original.totalDamage);
    });
    
    test('BALANCE_UPDATE round-trip', () => {
        const original = {
            playerId: 'player-12345678',
            balance: 1000.50,
            change: -5,
            reason: 'shot',
            timestamp: Date.now()
        };
        
        const packet = serializeBalanceUpdate(original, encryptionKey, hmacKey, nonce);
        const result = deserializePacket(packet, encryptionKey, hmacKey, nonce - 1);
        
        expect(result.packetId).toBe(PacketId.BALANCE_UPDATE);
        expect(result.payload.playerId.trim()).toBe(original.playerId);
        expect(result.payload.change).toBe(original.change);
    });
    
    test('FISH_SPAWN round-trip', () => {
        const original = {
            fishId: 'fish-001',
            type: 1,
            x: 10.5,
            y: 20.5,
            z: 30.5,
            hp: 100,
            maxHp: 100,
            reward: 10,
            velocityX: 1.0,
            velocityY: 0.0,
            velocityZ: 0.5,
            isBoss: false,
            timestamp: Date.now()
        };
        
        const packet = serializeFishSpawn(original, encryptionKey, hmacKey, nonce);
        const result = deserializePacket(packet, encryptionKey, hmacKey, nonce - 1);
        
        expect(result.packetId).toBe(PacketId.FISH_SPAWN);
        expect(result.payload.fishId.trim()).toBe(original.fishId);
        expect(result.payload.hp).toBe(original.hp);
    });
    
    test('FISH_DEATH round-trip', () => {
        const original = {
            fishId: 'fish-001',
            killedBy: 'player-12345678',
            reward: 10,
            timestamp: Date.now()
        };
        
        const packet = serializeFishDeath(original, encryptionKey, hmacKey, nonce);
        const result = deserializePacket(packet, encryptionKey, hmacKey, nonce - 1);
        
        expect(result.packetId).toBe(PacketId.FISH_DEATH);
        expect(result.payload.fishId.trim()).toBe(original.fishId);
        expect(result.payload.reward).toBe(original.reward);
    });
    
    test('PLAYER_JOIN round-trip', () => {
        const original = {
            playerId: 'player-12345678',
            playerName: 'TestPlayer',
            position: 0,
            balance: 1000,
            weapon: 1,
            timestamp: Date.now()
        };
        
        const packet = serializePlayerJoin(original, encryptionKey, hmacKey, nonce);
        const result = deserializePacket(packet, encryptionKey, hmacKey, nonce - 1);
        
        expect(result.packetId).toBe(PacketId.PLAYER_JOIN);
        expect(result.payload.playerId.trim()).toBe(original.playerId);
        expect(result.payload.balance).toBe(original.balance);
    });
    
    test('PLAYER_LEAVE round-trip', () => {
        const original = {
            playerId: 'player-12345678',
            reason: 'disconnect',
            timestamp: Date.now()
        };
        
        const packet = serializePlayerLeave(original, encryptionKey, hmacKey, nonce);
        const result = deserializePacket(packet, encryptionKey, hmacKey, nonce - 1);
        
        expect(result.packetId).toBe(PacketId.PLAYER_LEAVE);
        expect(result.payload.playerId.trim()).toBe(original.playerId);
    });
    
    test('TIME_SYNC_PONG round-trip', () => {
        const original = {
            seq: 12345,
            serverTime: Date.now(),
            clientSendTime: Date.now() - 100
        };
        
        const packet = serializeTimeSyncPong(original, encryptionKey, hmacKey, nonce);
        const result = deserializePacket(packet, encryptionKey, hmacKey, nonce - 1);
        
        expect(result.packetId).toBe(PacketId.TIME_SYNC_PONG);
        expect(result.payload.seq).toBe(original.seq);
    });
    
    test('ERROR round-trip', () => {
        const original = {
            code: 0x01,
            message: 'Test error',
            timestamp: Date.now()
        };
        
        const packet = serializeError(original, encryptionKey, hmacKey, nonce);
        const result = deserializePacket(packet, encryptionKey, hmacKey, nonce - 1);
        
        expect(result.packetId).toBe(PacketId.ERROR);
        expect(result.payload.code).toBe(original.code);
    });
});

describe('Protocol Security Tests', () => {
    let nonce = 1000;
    
    test('rejects invalid checksum', () => {
        const original = {
            playerId: 'player-12345678',
            balance: 1000,
            change: -5,
            reason: 'shot',
            timestamp: Date.now()
        };
        
        const packet = serializeBalanceUpdate(original, encryptionKey, hmacKey, nonce++);
        packet[10] ^= 0xFF;
        
        expect(() => {
            deserializePacket(packet, encryptionKey, hmacKey, nonce - 2);
        }).toThrow(DeserializationError);
    });
    
    test('rejects invalid HMAC', () => {
        const original = {
            playerId: 'player-12345678',
            balance: 1000,
            change: -5,
            reason: 'shot',
            timestamp: Date.now()
        };
        
        const packet = serializeBalanceUpdate(original, encryptionKey, hmacKey, nonce++);
        packet[packet.length - 1] ^= 0xFF;
        
        expect(() => {
            deserializePacket(packet, encryptionKey, hmacKey, nonce - 2);
        }).toThrow(DeserializationError);
    });
    
    test('rejects nonce replay', () => {
        const original = {
            playerId: 'player-12345678',
            balance: 1000,
            change: -5,
            reason: 'shot',
            timestamp: Date.now()
        };
        
        const currentNonce = nonce++;
        const packet = serializeBalanceUpdate(original, encryptionKey, hmacKey, currentNonce);
        
        deserializePacket(packet, encryptionKey, hmacKey, currentNonce - 1);
        
        expect(() => {
            deserializePacket(packet, encryptionKey, hmacKey, currentNonce);
        }).toThrow(DeserializationError);
    });
    
    test('rejects wrong encryption key', () => {
        const original = {
            playerId: 'player-12345678',
            balance: 1000,
            change: -5,
            reason: 'shot',
            timestamp: Date.now()
        };
        
        const packet = serializeBalanceUpdate(original, encryptionKey, hmacKey, nonce++);
        const wrongKey = crypto.randomBytes(32);
        
        expect(() => {
            deserializePacket(packet, wrongKey, hmacKey, nonce - 2);
        }).toThrow(DeserializationError);
    });
});

describe('Protocol Header Tests', () => {
    test('header is 19 bytes (PDF specification)', () => {
        const { HEADER_SIZE } = require('../../src/protocol/packets');
        expect(HEADER_SIZE).toBe(19);
    });
    
    test('protocol version is 2', () => {
        expect(PROTOCOL_VERSION).toBe(2);
    });
    
    test('packet IDs are uint16', () => {
        expect(PacketId.SHOT_FIRED).toBe(0x0010);
        expect(PacketId.HIT_RESULT).toBe(0x0011);
        expect(PacketId.BALANCE_UPDATE).toBe(0x0012);
    });
});
