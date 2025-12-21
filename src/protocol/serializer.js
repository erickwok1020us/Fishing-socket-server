/**
 * Binary Protocol Serializer - Version 2 (Certification Compliant)
 * 
 * Serializes game data into binary packets following the PDF specification.
 * Handles encryption, HMAC, and packet structure.
 * 
 * Protocol V2 Header (20 bytes):
 * - protocolVersion: uint8 (1 byte)
 * - reserved: uint8 (1 byte)
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
    NONCE_SIZE
} = require('./packets');
const BinaryPayloads = require('./payloads/BinaryPayloads');

function calculateCRC32(buffer) {
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buffer.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createHeader(packetId, payloadLength, nonce) {
    const header = Buffer.alloc(HEADER_SIZE);
    let offset = 0;
    
    header.writeUInt8(PROTOCOL_VERSION, offset);
    offset += 1;
    
    header.writeUInt8(0, offset);
    offset += 1;
    
    header.writeUInt16BE(packetId, offset);
    offset += 2;
    
    header.writeUInt32BE(payloadLength, offset);
    offset += 4;
    
    header.writeUInt32BE(0, offset);
    offset += 4;
    
    const bigNonce = BigInt(nonce);
    header.writeBigUInt64BE(bigNonce, offset);
    
    return header;
}

function encryptPayload(plaintext, encryptionKey, nonce) {
    const iv = Buffer.alloc(NONCE_SIZE);
    const bigNonce = BigInt(nonce);
    iv.writeBigUInt64BE(bigNonce, 0);
    iv.writeUInt32BE(0, 8);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    return { encrypted, authTag };
}

function computeHMAC(data, hmacKey) {
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(data);
    return hmac.digest();
}

function serializePacket(packetId, payload, encryptionKey, hmacKey, nonce) {
    const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    
    const { encrypted, authTag } = encryptPayload(payloadBuffer, encryptionKey, nonce);
    
    const header = createHeader(packetId, encrypted.length, nonce);
    
    const dataForChecksum = Buffer.concat([
        header.slice(0, 8),
        encrypted,
        authTag
    ]);
    const checksum = calculateCRC32(dataForChecksum);
    header.writeUInt32BE(checksum, 8);
    
    const dataForHMAC = Buffer.concat([header, encrypted, authTag]);
    const hmacValue = computeHMAC(dataForHMAC, hmacKey);
    
    return Buffer.concat([header, encrypted, authTag, hmacValue]);
}

function serializeShotFired(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeShotFired({
        playerId: data.playerId,
        weaponId: data.weaponId,
        targetX: data.targetX,
        targetY: data.targetY,
        targetZ: data.targetZ,
        directionX: data.directionX,
        directionY: data.directionY,
        directionZ: data.directionZ,
        shotSequenceId: data.shotSequenceId,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.SHOT_FIRED, payload, encryptionKey, hmacKey, nonce);
}

function serializeHitResult(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeHitResult({
        shotSequenceId: data.shotSequenceId,
        hits: data.hits || [],
        totalDamage: data.totalDamage || 0,
        totalReward: data.totalReward || 0,
        newBalance: data.newBalance,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.HIT_RESULT, payload, encryptionKey, hmacKey, nonce);
}

function serializeBalanceUpdate(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeBalanceUpdate({
        playerId: data.playerId,
        balance: data.balance,
        change: data.change || 0,
        reason: data.reason || 0x04,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.BALANCE_UPDATE, payload, encryptionKey, hmacKey, nonce);
}

function serializeRoomSnapshot(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeRoomSnapshot({
        roomCode: data.roomCode || data.roomId,
        serverTime: data.serverTime || Date.now(),
        bossTimer: data.bossTimer || 0,
        fish: data.fish || [],
        players: data.players || []
    });
    return serializePacket(PacketId.ROOM_SNAPSHOT, payload, encryptionKey, hmacKey, nonce);
}

function serializeFishSpawn(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeFishSpawn({
        fishId: data.fishId,
        fishType: data.type || data.fishType,
        x: data.x,
        y: data.y,
        z: data.z,
        hp: data.hp,
        maxHp: data.maxHp,
        reward: data.reward,
        velocityX: data.velocityX,
        velocityY: data.velocityY,
        velocityZ: data.velocityZ,
        isBoss: data.isBoss || false,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.FISH_SPAWN, payload, encryptionKey, hmacKey, nonce);
}

function serializeFishDeath(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeFishDeath({
        fishId: data.fishId,
        killedBy: data.killedBy,
        reward: data.reward,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.FISH_DEATH, payload, encryptionKey, hmacKey, nonce);
}

function serializeBossSpawn(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeFishSpawn({
        fishId: data.fishId,
        fishType: data.type || data.fishType,
        x: data.x,
        y: data.y,
        z: data.z,
        hp: data.hp,
        maxHp: data.maxHp,
        reward: data.reward,
        velocityX: 0,
        velocityY: 0,
        velocityZ: 0,
        isBoss: true,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.BOSS_SPAWN, payload, encryptionKey, hmacKey, nonce);
}

function serializeBossDeath(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeFishDeath({
        fishId: data.fishId,
        killedBy: data.killedBy || '',
        reward: data.totalReward,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.BOSS_DEATH, payload, encryptionKey, hmacKey, nonce);
}

function serializePlayerJoin(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodePlayerJoin({
        playerId: data.playerId,
        playerName: data.playerName,
        position: data.position,
        balance: data.balance,
        weaponId: data.weapon || data.weaponId || 1,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.PLAYER_JOIN, payload, encryptionKey, hmacKey, nonce);
}

function serializePlayerLeave(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodePlayerLeave({
        playerId: data.playerId,
        reason: typeof data.reason === 'number' ? data.reason : 0x01,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.PLAYER_LEAVE, payload, encryptionKey, hmacKey, nonce);
}

function serializeRoomState(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeRoomState({
        roomCode: data.roomCode || data.roomId,
        state: data.state,
        players: data.players || [],
        hostId: data.hostId,
        maxPlayers: data.maxPlayers || 4,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.ROOM_STATE, payload, encryptionKey, hmacKey, nonce);
}

function serializeTimeSyncPong(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeTimeSyncPong({
        seq: data.seq,
        serverTime: data.serverTime || Date.now(),
        clientSendTime: data.clientSendTime
    });
    return serializePacket(PacketId.TIME_SYNC_PONG, payload, encryptionKey, hmacKey, nonce);
}

function serializeError(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeError({
        code: data.code,
        message: data.message || ''
    });
    return serializePacket(PacketId.ERROR, payload, encryptionKey, hmacKey, nonce);
}

function serializeHandshakeResponse(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeHandshakeResponse({
        serverPublicKey: data.serverPublicKey,
        serverNonce: data.serverNonce,
        salt: data.salt,
        sessionId: data.sessionId
    });
    return serializePacket(PacketId.HANDSHAKE_RESPONSE, payload, encryptionKey, hmacKey, nonce);
}

function serializeGameStart(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeGameStart({
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.GAME_START, payload, encryptionKey, hmacKey, nonce);
}

function serializeRoomCreate(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeRoomCreate({
        playerName: data.playerName,
        isPublic: data.isPublic,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.ROOM_CREATE, payload, encryptionKey, hmacKey, nonce);
}

function serializeRoomJoin(data, encryptionKey, hmacKey, nonce) {
    const payload = BinaryPayloads.encodeRoomJoin({
        roomCode: data.roomCode,
        playerName: data.playerName,
        timestamp: data.timestamp || Date.now()
    });
    return serializePacket(PacketId.ROOM_JOIN, payload, encryptionKey, hmacKey, nonce);
}

module.exports = {
    calculateCRC32,
    createHeader,
    encryptPayload,
    computeHMAC,
    serializePacket,
    serializeShotFired,
    serializeHitResult,
    serializeBalanceUpdate,
    serializeRoomSnapshot,
    serializeFishSpawn,
    serializeFishDeath,
    serializeBossSpawn,
    serializeBossDeath,
    serializePlayerJoin,
    serializePlayerLeave,
    serializeRoomState,
    serializeTimeSyncPong,
    serializeError,
    serializeHandshakeResponse,
    serializeGameStart,
    serializeRoomCreate,
    serializeRoomJoin
};
