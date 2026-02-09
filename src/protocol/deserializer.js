/**
 * Binary Protocol Deserializer - Version 2 (Certification Compliant)
 * 
 * Deserializes binary packets following the PDF specification Section 6.
 * Implements the mandatory security processing pipeline:
 * 1. Read Header
 * 2. Validate Payload Size and PacketId Whitelist
 * 3. Verify Checksum
 * 4. Verify HMAC
 * 5. Decrypt AES-GCM Payload
 * 6. Validate Nonce (Monotonic)
 * 7. Dispatch by PacketId
 * 
 * Protocol V2 Header (19 bytes) - Exact PDF Specification:
 * - protocolVersion: uint8 (1 byte)
 * - packetId: uint16 (2 bytes, big-endian)
 * - payloadLength: uint32 (4 bytes, big-endian)
 * - checksum: uint32 (4 bytes, CRC32)
 * - nonce: uint64 (8 bytes, big-endian)
 */

const crypto = require('crypto');
const { 
    PROTOCOL_VERSION, 
    PacketId, 
    HEADER_SIZE, 
    GCM_TAG_SIZE, 
    HMAC_SIZE,
    NONCE_SIZE,
    ErrorCodes,
    isValidPacketId,
    isValidPayloadSize
} = require('./packets');
const { calculateCRC32 } = require('./serializer');
const BinaryPayloads = require('./payloads/BinaryPayloads');

class DeserializationError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'DeserializationError';
    }
}

function parseHeader(buffer) {
    if (buffer.length < HEADER_SIZE) {
        throw new DeserializationError(ErrorCodes.INVALID_PACKET, 'Buffer too small for header');
    }
    
    let offset = 0;
    
    // uint8 protocolVersion (1 byte)
    const protocolVersion = buffer.readUInt8(offset);
    offset += 1;
    
    // uint16 packetId (2 bytes, big-endian)
    const packetId = buffer.readUInt16BE(offset);
    offset += 2;
    
    // uint32 payloadLength (4 bytes, big-endian)
    const payloadLength = buffer.readUInt32BE(offset);
    offset += 4;
    
    // uint32 checksum (4 bytes)
    const checksum = buffer.readUInt32BE(offset);
    offset += 4;
    
    // uint64 nonce (8 bytes, big-endian)
    const nonce = Number(buffer.readBigUInt64BE(offset));
    
    return {
        protocolVersion,
        packetId,
        payloadLength,
        checksum,
        nonce
    };
}

function verifyChecksum(buffer, header) {
    // Checksum covers: header bytes before checksum (7 bytes) + encrypted payload + GCM tag
    const headerWithoutChecksum = Buffer.alloc(7);
    buffer.copy(headerWithoutChecksum, 0, 0, 7);
    
    const encryptedPayloadStart = HEADER_SIZE;
    const encryptedPayloadEnd = HEADER_SIZE + header.payloadLength + GCM_TAG_SIZE;
    const encryptedPayloadWithTag = buffer.slice(encryptedPayloadStart, encryptedPayloadEnd);
    
    const dataForChecksum = Buffer.concat([headerWithoutChecksum, encryptedPayloadWithTag]);
    const calculatedChecksum = calculateCRC32(dataForChecksum);
    
    if (calculatedChecksum !== header.checksum) {
        throw new DeserializationError(ErrorCodes.INVALID_CHECKSUM, 'Checksum mismatch');
    }
    
    return true;
}

function verifyHMAC(buffer, header, hmacKey) {
    const dataEnd = HEADER_SIZE + header.payloadLength + GCM_TAG_SIZE;
    const dataForHMAC = buffer.slice(0, dataEnd);
    const receivedHMAC = buffer.slice(dataEnd, dataEnd + HMAC_SIZE);
    
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(dataForHMAC);
    const calculatedHMAC = hmac.digest();
    
    if (!crypto.timingSafeEqual(calculatedHMAC, receivedHMAC)) {
        throw new DeserializationError(ErrorCodes.INVALID_HMAC, 'HMAC verification failed');
    }
    
    return true;
}

function decryptPayload(buffer, header, encryptionKey) {
    const encryptedStart = HEADER_SIZE;
    const encryptedEnd = HEADER_SIZE + header.payloadLength;
    const tagStart = encryptedEnd;
    const tagEnd = tagStart + GCM_TAG_SIZE;
    
    const encrypted = buffer.slice(encryptedStart, encryptedEnd);
    const authTag = buffer.slice(tagStart, tagEnd);
    
    const iv = Buffer.alloc(NONCE_SIZE);
    const bigNonce = BigInt(header.nonce);
    iv.writeBigUInt64BE(bigNonce, 0);
    iv.writeUInt32BE(0, 8);
    
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted;
    } catch (err) {
        throw new DeserializationError(ErrorCodes.DECRYPTION_FAILED, 'Decryption failed: ' + err.message);
    }
}

function validateNonce(nonce, lastNonce) {
    if (nonce <= lastNonce) {
        throw new DeserializationError(ErrorCodes.INVALID_NONCE, 'Nonce must be strictly increasing');
    }
    return true;
}

function deserializePacket(buffer, encryptionKey, hmacKey, lastNonce = 0) {
    const minPacketSize = HEADER_SIZE + GCM_TAG_SIZE + HMAC_SIZE;
    if (buffer.length < minPacketSize) {
        throw new DeserializationError(ErrorCodes.INVALID_PACKET, 'Packet too small');
    }
    
    const header = parseHeader(buffer);
    
    if (header.protocolVersion !== PROTOCOL_VERSION) {
        throw new DeserializationError(ErrorCodes.INVALID_PACKET, 'Invalid protocol version');
    }
    
    if (!isValidPacketId(header.packetId)) {
        throw new DeserializationError(ErrorCodes.UNKNOWN_PACKET_ID, 'Unknown packet ID');
    }
    
    if (!isValidPayloadSize(header.packetId, header.payloadLength)) {
        throw new DeserializationError(ErrorCodes.PAYLOAD_TOO_LARGE, 'Invalid payload size');
    }
    
    const expectedSize = HEADER_SIZE + header.payloadLength + GCM_TAG_SIZE + HMAC_SIZE;
    if (buffer.length < expectedSize) {
        throw new DeserializationError(ErrorCodes.INVALID_PACKET, 'Incomplete packet');
    }
    
    verifyChecksum(buffer, header);
    
    verifyHMAC(buffer, header, hmacKey);
    
    const decrypted = decryptPayload(buffer, header, encryptionKey);
    
    validateNonce(header.nonce, lastNonce);
    
    let payload;
    if (header.packetId === PacketId.ROOM_STATE && decrypted.length > 0 && decrypted[0] === 0x7B) {
        try {
            payload = JSON.parse(decrypted.toString('utf8'));
        } catch (_) {
            const decoder = getBinaryDecoder(header.packetId);
            try {
                payload = decoder(decrypted);
            } catch (err) {
                throw new DeserializationError(ErrorCodes.INVALID_PACKET, 'Invalid binary payload: ' + err.message);
            }
        }
    } else {
        const decoder = getBinaryDecoder(header.packetId);
        try {
            payload = decoder(decrypted);
        } catch (err) {
            throw new DeserializationError(ErrorCodes.INVALID_PACKET, 'Invalid binary payload: ' + err.message);
        }
    }
    
    return {
        packetId: header.packetId,
        nonce: header.nonce,
        payload
    };
}

function getBinaryDecoder(packetId) {
    const decoders = {
        [PacketId.HANDSHAKE_REQUEST]: BinaryPayloads.decodeHandshakeRequest,
        [PacketId.HANDSHAKE_RESPONSE]: BinaryPayloads.decodeHandshakeResponse,
        [PacketId.SHOT_FIRED]: BinaryPayloads.decodeShotFired,
        [PacketId.HIT_RESULT]: BinaryPayloads.decodeHitResult,
        [PacketId.BALANCE_UPDATE]: BinaryPayloads.decodeBalanceUpdate,
        [PacketId.WEAPON_SWITCH]: BinaryPayloads.decodeWeaponSwitch,
        [PacketId.ROOM_SNAPSHOT]: BinaryPayloads.decodeRoomSnapshot,
        [PacketId.FISH_SPAWN]: BinaryPayloads.decodeFishSpawn,
        [PacketId.FISH_DEATH]: BinaryPayloads.decodeFishDeath,
        [PacketId.BOSS_SPAWN]: BinaryPayloads.decodeFishSpawn,
        [PacketId.BOSS_DEATH]: BinaryPayloads.decodeFishDeath,
        [PacketId.PLAYER_JOIN]: BinaryPayloads.decodePlayerJoin,
        [PacketId.PLAYER_LEAVE]: BinaryPayloads.decodePlayerLeave,
        [PacketId.ROOM_CREATE]: BinaryPayloads.decodeRoomCreate,
        [PacketId.ROOM_JOIN]: BinaryPayloads.decodeRoomJoin,
        [PacketId.ROOM_STATE]: BinaryPayloads.decodeRoomState,
        [PacketId.GAME_START]: BinaryPayloads.decodeGameStart,
        [PacketId.TIME_SYNC_PING]: BinaryPayloads.decodeTimeSyncPing,
        [PacketId.TIME_SYNC_PONG]: BinaryPayloads.decodeTimeSyncPong,
        [PacketId.ERROR]: BinaryPayloads.decodeError
    };
    return decoders[packetId] || ((buf) => buf);
}

function parseShotFired(payload) {
    return {
        playerId: payload.playerId,
        weaponId: payload.weaponId,
        targetX: payload.targetX,
        targetY: payload.targetY,
        targetZ: payload.targetZ,
        directionX: payload.directionX,
        directionY: payload.directionY,
        directionZ: payload.directionZ,
        shotSequenceId: payload.shotSequenceId,
        timestamp: payload.timestamp
    };
}

function parseHitResult(payload) {
    return {
        shotSequenceId: payload.shotSequenceId,
        hits: payload.hits || [],
        totalDamage: payload.totalDamage || 0,
        totalReward: payload.totalReward || 0,
        newBalance: payload.newBalance,
        fishRemovedIds: payload.fishRemovedIds || [],
        timestamp: payload.timestamp
    };
}

function parseBalanceUpdate(payload) {
    return {
        playerId: payload.playerId,
        balance: payload.balance,
        change: payload.change || 0,
        reason: payload.reason || 'update',
        timestamp: payload.timestamp
    };
}

function parseWeaponSwitch(payload) {
    return {
        playerId: payload.playerId,
        weaponId: payload.weaponId,
        timestamp: payload.timestamp
    };
}

function parseRoomSnapshot(payload) {
    return {
        roomId: payload.roomId,
        serverTime: payload.serverTime,
        bossTimer: payload.bossTimer || 0,
        fish: payload.fish || [],
        players: payload.players || [],
        bullets: payload.bullets || [],
        removedFishIds: payload.removedFishIds || [],
        newFish: payload.newFish || []
    };
}

function parseFishSpawn(payload) {
    return {
        fishId: payload.fishId,
        type: payload.type,
        x: payload.x,
        y: payload.y,
        z: payload.z,
        hp: payload.hp,
        maxHp: payload.maxHp,
        reward: payload.reward,
        velocityX: payload.velocityX,
        velocityY: payload.velocityY,
        velocityZ: payload.velocityZ,
        isBoss: payload.isBoss || false,
        timestamp: payload.timestamp
    };
}

function parseFishDeath(payload) {
    return {
        fishId: payload.fishId,
        killedBy: payload.killedBy,
        reward: payload.reward,
        rewardDistribution: payload.rewardDistribution || [],
        timestamp: payload.timestamp
    };
}

function parsePlayerJoin(payload) {
    return {
        playerId: payload.playerId,
        playerName: payload.playerName,
        position: payload.position,
        balance: payload.balance,
        weapon: payload.weapon,
        timestamp: payload.timestamp
    };
}

function parsePlayerLeave(payload) {
    return {
        playerId: payload.playerId,
        reason: payload.reason || 'disconnect',
        timestamp: payload.timestamp
    };
}

function parseRoomCreate(payload) {
    return {
        playerName: payload.playerName,
        isPublic: payload.isPublic !== false,
        timestamp: payload.timestamp
    };
}

function parseRoomJoin(payload) {
    return {
        roomCode: payload.roomCode,
        playerName: payload.playerName,
        timestamp: payload.timestamp
    };
}

function parseTimeSyncPing(payload) {
    return {
        seq: payload.seq,
        clientSendTime: payload.clientSendTime
    };
}

function parseError(payload) {
    return {
        code: payload.code,
        message: payload.message || '',
        timestamp: payload.timestamp
    };
}

function getPayloadParser(packetId) {
    const parsers = {
        [PacketId.SHOT_FIRED]: parseShotFired,
        [PacketId.HIT_RESULT]: parseHitResult,
        [PacketId.BALANCE_UPDATE]: parseBalanceUpdate,
        [PacketId.WEAPON_SWITCH]: parseWeaponSwitch,
        [PacketId.ROOM_SNAPSHOT]: parseRoomSnapshot,
        [PacketId.FISH_SPAWN]: parseFishSpawn,
        [PacketId.FISH_DEATH]: parseFishDeath,
        [PacketId.PLAYER_JOIN]: parsePlayerJoin,
        [PacketId.PLAYER_LEAVE]: parsePlayerLeave,
        [PacketId.ROOM_CREATE]: parseRoomCreate,
        [PacketId.ROOM_JOIN]: parseRoomJoin,
        [PacketId.TIME_SYNC_PING]: parseTimeSyncPing,
        [PacketId.ERROR]: parseError
    };
    return parsers[packetId] || ((p) => p);
}

module.exports = {
    DeserializationError,
    parseHeader,
    verifyChecksum,
    verifyHMAC,
    decryptPayload,
    validateNonce,
    deserializePacket,
    getBinaryDecoder,
    parseShotFired,
    parseHitResult,
    parseBalanceUpdate,
    parseWeaponSwitch,
    parseRoomSnapshot,
    parseFishSpawn,
    parseFishDeath,
    parsePlayerJoin,
    parsePlayerLeave,
    parseRoomCreate,
    parseRoomJoin,
    parseTimeSyncPing,
    parseError,
    getPayloadParser
};
