/**
 * Binary Protocol Serializer
 * 
 * Serializes game data into binary packets following the PDF specification.
 * Handles encryption, HMAC, and packet structure.
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
    
    header.writeUInt8(packetId, offset);
    offset += 1;
    
    header.writeUInt32BE(payloadLength, offset);
    offset += 4;
    
    header.writeUInt32BE(0, offset);
    offset += 4;
    
    const nonceHigh = Math.floor(nonce / 0x100000000);
    const nonceLow = nonce % 0x100000000;
    header.writeUInt16BE(nonceHigh & 0xFFFF, offset);
    offset += 2;
    header.writeUInt32BE(nonceLow, offset);
    
    return header;
}

function encryptPayload(plaintext, encryptionKey, nonce) {
    const iv = Buffer.alloc(NONCE_SIZE);
    const nonceHigh = Math.floor(nonce / 0x100000000);
    const nonceLow = nonce % 0x100000000;
    iv.writeUInt32BE(0, 0);
    iv.writeUInt16BE(nonceHigh & 0xFFFF, 4);
    iv.writeUInt32BE(nonceLow, 6);
    iv.writeUInt16BE(0, 10);
    
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
    const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
    
    const { encrypted, authTag } = encryptPayload(payloadBuffer, encryptionKey, nonce);
    
    const header = createHeader(packetId, encrypted.length, nonce);
    
    const dataForChecksum = Buffer.concat([
        header.slice(0, 6),
        encrypted,
        authTag
    ]);
    const checksum = calculateCRC32(dataForChecksum);
    header.writeUInt32BE(checksum, 6);
    
    const dataForHMAC = Buffer.concat([header, encrypted, authTag]);
    const hmacValue = computeHMAC(dataForHMAC, hmacKey);
    
    return Buffer.concat([header, encrypted, authTag, hmacValue]);
}

function serializeShotFired(data, encryptionKey, hmacKey, nonce) {
    const payload = {
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
    };
    return serializePacket(PacketId.SHOT_FIRED, payload, encryptionKey, hmacKey, nonce);
}

function serializeHitResult(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        shotSequenceId: data.shotSequenceId,
        hits: data.hits || [],
        totalDamage: data.totalDamage || 0,
        totalReward: data.totalReward || 0,
        newBalance: data.newBalance,
        fishRemovedIds: data.fishRemovedIds || [],
        timestamp: data.timestamp || Date.now()
    };
    return serializePacket(PacketId.HIT_RESULT, payload, encryptionKey, hmacKey, nonce);
}

function serializeBalanceUpdate(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        playerId: data.playerId,
        balance: data.balance,
        change: data.change || 0,
        reason: data.reason || 'update',
        timestamp: data.timestamp || Date.now()
    };
    return serializePacket(PacketId.BALANCE_UPDATE, payload, encryptionKey, hmacKey, nonce);
}

function serializeRoomSnapshot(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        roomId: data.roomId,
        serverTime: data.serverTime || Date.now(),
        bossTimer: data.bossTimer || 0,
        fish: data.fish || [],
        players: data.players || [],
        bullets: data.bullets || [],
        removedFishIds: data.removedFishIds || [],
        newFish: data.newFish || []
    };
    return serializePacket(PacketId.ROOM_SNAPSHOT, payload, encryptionKey, hmacKey, nonce);
}

function serializeFishSpawn(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        fishId: data.fishId,
        type: data.type,
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
    };
    return serializePacket(PacketId.FISH_SPAWN, payload, encryptionKey, hmacKey, nonce);
}

function serializeFishDeath(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        fishId: data.fishId,
        killedBy: data.killedBy,
        reward: data.reward,
        rewardDistribution: data.rewardDistribution || [],
        timestamp: data.timestamp || Date.now()
    };
    return serializePacket(PacketId.FISH_DEATH, payload, encryptionKey, hmacKey, nonce);
}

function serializeBossSpawn(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        fishId: data.fishId,
        type: data.type,
        x: data.x,
        y: data.y,
        z: data.z,
        hp: data.hp,
        maxHp: data.maxHp,
        reward: data.reward,
        timestamp: data.timestamp || Date.now()
    };
    return serializePacket(PacketId.BOSS_SPAWN, payload, encryptionKey, hmacKey, nonce);
}

function serializeBossDeath(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        fishId: data.fishId,
        totalReward: data.totalReward,
        rewardDistribution: data.rewardDistribution || [],
        timestamp: data.timestamp || Date.now()
    };
    return serializePacket(PacketId.BOSS_DEATH, payload, encryptionKey, hmacKey, nonce);
}

function serializePlayerJoin(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        playerId: data.playerId,
        playerName: data.playerName,
        position: data.position,
        balance: data.balance,
        weapon: data.weapon,
        timestamp: data.timestamp || Date.now()
    };
    return serializePacket(PacketId.PLAYER_JOIN, payload, encryptionKey, hmacKey, nonce);
}

function serializePlayerLeave(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        playerId: data.playerId,
        reason: data.reason || 'disconnect',
        timestamp: data.timestamp || Date.now()
    };
    return serializePacket(PacketId.PLAYER_LEAVE, payload, encryptionKey, hmacKey, nonce);
}

function serializeRoomState(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        roomId: data.roomId,
        roomCode: data.roomCode,
        state: data.state,
        players: data.players || [],
        hostId: data.hostId,
        maxPlayers: data.maxPlayers || 4,
        timestamp: data.timestamp || Date.now()
    };
    return serializePacket(PacketId.ROOM_STATE, payload, encryptionKey, hmacKey, nonce);
}

function serializeTimeSyncPong(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        seq: data.seq,
        serverTime: data.serverTime || Date.now(),
        clientSendTime: data.clientSendTime
    };
    return serializePacket(PacketId.TIME_SYNC_PONG, payload, encryptionKey, hmacKey, nonce);
}

function serializeError(data, encryptionKey, hmacKey, nonce) {
    const payload = {
        code: data.code,
        message: data.message || '',
        timestamp: data.timestamp || Date.now()
    };
    return serializePacket(PacketId.ERROR, payload, encryptionKey, hmacKey, nonce);
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
    serializeError
};
