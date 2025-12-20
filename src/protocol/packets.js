/**
 * Binary Protocol Packet Definitions
 * 
 * Based on PDF Technical Specification Section 4.3 & 6
 * All client-server communication uses secure WebSocket (wss://) and custom binary protocol.
 * JSON communication is strictly forbidden for real-time game state and actions.
 * 
 * Packet Structure:
 * [Header (16 bytes)] + [Encrypted Payload] + [GCM Tag (16 bytes)] + [HMAC (32 bytes)]
 * 
 * Header Structure (16 bytes):
 * - protocolVersion: uint8 (1 byte)
 * - packetId: uint8 (1 byte)
 * - payloadLength: uint32 (4 bytes, big-endian)
 * - checksum: uint32 (4 bytes, CRC32)
 * - nonce: uint48 (6 bytes, monotonically increasing)
 */

const PROTOCOL_VERSION = 1;

const PacketId = {
    HANDSHAKE_REQUEST: 0x01,
    HANDSHAKE_RESPONSE: 0x02,
    SESSION_INIT: 0x03,
    SESSION_ACK: 0x04,
    
    SHOT_FIRED: 0x10,
    HIT_RESULT: 0x11,
    BALANCE_UPDATE: 0x12,
    WEAPON_SWITCH: 0x13,
    
    ROOM_SNAPSHOT: 0x20,
    FISH_SPAWN: 0x21,
    FISH_DEATH: 0x22,
    FISH_UPDATE: 0x23,
    
    BOSS_SPAWN: 0x30,
    BOSS_DEATH: 0x31,
    BOSS_DAMAGE: 0x32,
    
    PLAYER_JOIN: 0x40,
    PLAYER_LEAVE: 0x41,
    PLAYER_MOVEMENT: 0x42,
    
    ROOM_CREATE: 0x50,
    ROOM_JOIN: 0x51,
    ROOM_LEAVE: 0x52,
    ROOM_STATE: 0x53,
    GAME_START: 0x54,
    
    TIME_SYNC_PING: 0x60,
    TIME_SYNC_PONG: 0x61,
    
    ERROR: 0xF0,
    DISCONNECT: 0xFF
};

const PacketIdWhitelist = new Set(Object.values(PacketId));

const PayloadSizeLimits = {
    [PacketId.HANDSHAKE_REQUEST]: { min: 32, max: 256 },
    [PacketId.HANDSHAKE_RESPONSE]: { min: 64, max: 512 },
    [PacketId.SESSION_INIT]: { min: 16, max: 128 },
    [PacketId.SESSION_ACK]: { min: 8, max: 64 },
    
    [PacketId.SHOT_FIRED]: { min: 24, max: 128 },
    [PacketId.HIT_RESULT]: { min: 16, max: 1024 },
    [PacketId.BALANCE_UPDATE]: { min: 8, max: 32 },
    [PacketId.WEAPON_SWITCH]: { min: 4, max: 16 },
    
    [PacketId.ROOM_SNAPSHOT]: { min: 32, max: 65536 },
    [PacketId.FISH_SPAWN]: { min: 32, max: 256 },
    [PacketId.FISH_DEATH]: { min: 16, max: 128 },
    [PacketId.FISH_UPDATE]: { min: 16, max: 4096 },
    
    [PacketId.BOSS_SPAWN]: { min: 32, max: 256 },
    [PacketId.BOSS_DEATH]: { min: 16, max: 512 },
    [PacketId.BOSS_DAMAGE]: { min: 16, max: 128 },
    
    [PacketId.PLAYER_JOIN]: { min: 16, max: 256 },
    [PacketId.PLAYER_LEAVE]: { min: 8, max: 64 },
    [PacketId.PLAYER_MOVEMENT]: { min: 24, max: 64 },
    
    [PacketId.ROOM_CREATE]: { min: 8, max: 128 },
    [PacketId.ROOM_JOIN]: { min: 8, max: 128 },
    [PacketId.ROOM_LEAVE]: { min: 4, max: 32 },
    [PacketId.ROOM_STATE]: { min: 32, max: 4096 },
    [PacketId.GAME_START]: { min: 4, max: 64 },
    
    [PacketId.TIME_SYNC_PING]: { min: 8, max: 32 },
    [PacketId.TIME_SYNC_PONG]: { min: 16, max: 48 },
    
    [PacketId.ERROR]: { min: 4, max: 256 },
    [PacketId.DISCONNECT]: { min: 4, max: 64 }
};

const HEADER_SIZE = 16;
const GCM_TAG_SIZE = 16;
const HMAC_SIZE = 32;
const NONCE_SIZE = 12;

const ErrorCodes = {
    INVALID_PACKET: 0x01,
    INVALID_CHECKSUM: 0x02,
    INVALID_HMAC: 0x03,
    DECRYPTION_FAILED: 0x04,
    INVALID_NONCE: 0x05,
    INVALID_SESSION: 0x06,
    INSUFFICIENT_BALANCE: 0x07,
    INVALID_WEAPON: 0x08,
    INVALID_ROOM: 0x09,
    ROOM_FULL: 0x0A,
    RATE_LIMITED: 0x0B,
    UNKNOWN_PACKET_ID: 0x0C,
    PAYLOAD_TOO_LARGE: 0x0D,
    PAYLOAD_TOO_SMALL: 0x0E
};

function isValidPacketId(packetId) {
    return PacketIdWhitelist.has(packetId);
}

function getPayloadSizeLimits(packetId) {
    return PayloadSizeLimits[packetId] || { min: 0, max: 65536 };
}

function isValidPayloadSize(packetId, size) {
    const limits = getPayloadSizeLimits(packetId);
    return size >= limits.min && size <= limits.max;
}

module.exports = {
    PROTOCOL_VERSION,
    PacketId,
    PacketIdWhitelist,
    PayloadSizeLimits,
    HEADER_SIZE,
    GCM_TAG_SIZE,
    HMAC_SIZE,
    NONCE_SIZE,
    ErrorCodes,
    isValidPacketId,
    getPayloadSizeLimits,
    isValidPayloadSize
};
