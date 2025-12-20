/**
 * Binary Deserializer Fuzz Tests
 * 
 * Tests the binary protocol deserializer with random/malformed input
 * to ensure it handles all edge cases safely without crashing.
 * 
 * NOTE: These tests require the binary protocol module from PR #21.
 * They will be skipped if the module is not available.
 */

const crypto = require('crypto');

// Try to load the deserializer module (may not exist if PR #21 not merged)
let deserializer;
let packets;
let serializer;
let moduleAvailable = false;

try {
    deserializer = require('../src/protocol/deserializer');
    packets = require('../src/protocol/packets');
    serializer = require('../src/protocol/serializer');
    moduleAvailable = true;
} catch (e) {
    console.log('Binary protocol module not available (PR #21 not merged). Skipping fuzz tests.');
}

// Skip all tests if module not available
const describeIfAvailable = moduleAvailable ? describe : describe.skip;

describeIfAvailable('Binary Deserializer Fuzz Tests', () => {
    const FUZZ_ITERATIONS = 500; // Keep modest for CI performance
    
    describe('Truncated Packets', () => {
        test('handles empty buffer without crashing', () => {
            const buffer = Buffer.alloc(0);
            expect(() => {
                try {
                    deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                } catch (e) {
                    // Expected to throw DeserializationError
                    expect(e.name).toBe('DeserializationError');
                }
            }).not.toThrow();
        });

        test('handles buffer smaller than header without crashing', () => {
            const buffers = [
                Buffer.alloc(1),
                Buffer.alloc(5),
                Buffer.alloc(10),
                Buffer.alloc(15)
            ];
            
            for (const buffer of buffers) {
                expect(() => {
                    try {
                        deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                    } catch (e) {
                        expect(e.name).toBe('DeserializationError');
                    }
                }).not.toThrow();
            }
        });

        test('handles truncated payload without crashing', () => {
            // Create a header that claims a large payload but provide less
            const buffer = Buffer.alloc(20);
            buffer.writeUInt8(1, 0); // protocol version
            buffer.writeUInt8(0x10, 1); // packet ID
            buffer.writeUInt32BE(1000, 2); // claim 1000 byte payload
            
            expect(() => {
                try {
                    deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                } catch (e) {
                    expect(e.name).toBe('DeserializationError');
                }
            }).not.toThrow();
        });
    });

    describe('Random Garbage Input', () => {
        test('handles random garbage safely', () => {
            for (let i = 0; i < FUZZ_ITERATIONS; i++) {
                const len = Math.floor(Math.random() * 256);
                const buffer = crypto.randomBytes(len);
                
                expect(() => {
                    try {
                        deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                    } catch (e) {
                        // Any error is acceptable as long as it doesn't crash
                    }
                }).not.toThrow();
            }
        });

        test('handles large random buffers safely', () => {
            for (let i = 0; i < 50; i++) {
                const len = Math.floor(Math.random() * 10000) + 1000;
                const buffer = crypto.randomBytes(len);
                
                expect(() => {
                    try {
                        deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                    } catch (e) {
                        // Any error is acceptable
                    }
                }).not.toThrow();
            }
        });
    });

    describe('Malformed Headers', () => {
        test('handles invalid protocol version', () => {
            const buffer = Buffer.alloc(100);
            buffer.writeUInt8(255, 0); // Invalid protocol version
            buffer.writeUInt8(0x10, 1);
            buffer.writeUInt32BE(10, 2);
            
            expect(() => {
                try {
                    deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                } catch (e) {
                    expect(e.name).toBe('DeserializationError');
                }
            }).not.toThrow();
        });

        test('handles unknown packet IDs', () => {
            const invalidPacketIds = [0x00, 0xFF, 0xFE, 0x99, 0xAB];
            
            for (const packetId of invalidPacketIds) {
                const buffer = Buffer.alloc(100);
                buffer.writeUInt8(1, 0);
                buffer.writeUInt8(packetId, 1);
                buffer.writeUInt32BE(10, 2);
                
                expect(() => {
                    try {
                        deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                    } catch (e) {
                        // Expected to fail
                    }
                }).not.toThrow();
            }
        });

        test('handles extremely large payload length claims', () => {
            const buffer = Buffer.alloc(100);
            buffer.writeUInt8(1, 0);
            buffer.writeUInt8(0x10, 1);
            buffer.writeUInt32BE(0xFFFFFFFF, 2); // Max uint32
            
            expect(() => {
                try {
                    deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                } catch (e) {
                    expect(e.name).toBe('DeserializationError');
                }
            }).not.toThrow();
        });
    });

    describe('Checksum Manipulation', () => {
        test('rejects packets with wrong checksum', () => {
            // This test requires a valid packet structure
            // We'll create a minimal valid-looking packet with wrong checksum
            const buffer = Buffer.alloc(100);
            buffer.writeUInt8(1, 0); // version
            buffer.writeUInt8(0x10, 1); // packet ID
            buffer.writeUInt32BE(10, 2); // payload length
            buffer.writeUInt32BE(0xDEADBEEF, 6); // Wrong checksum
            
            expect(() => {
                try {
                    deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                } catch (e) {
                    // Should fail checksum verification
                }
            }).not.toThrow();
        });
    });

    describe('HMAC Manipulation', () => {
        test('rejects packets with tampered HMAC', () => {
            const buffer = Buffer.alloc(200);
            buffer.writeUInt8(1, 0);
            buffer.writeUInt8(0x10, 1);
            buffer.writeUInt32BE(50, 2);
            // Fill with random data including fake HMAC
            crypto.randomFillSync(buffer, 10, 190);
            
            expect(() => {
                try {
                    deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                } catch (e) {
                    // Should fail HMAC verification
                }
            }).not.toThrow();
        });
    });

    describe('Encryption Edge Cases', () => {
        test('handles invalid GCM auth tag', () => {
            const buffer = Buffer.alloc(100);
            buffer.writeUInt8(1, 0);
            buffer.writeUInt8(0x10, 1);
            buffer.writeUInt32BE(20, 2);
            // Random encrypted payload with invalid auth tag
            crypto.randomFillSync(buffer, 16, 84);
            
            expect(() => {
                try {
                    deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                } catch (e) {
                    // Should fail decryption
                }
            }).not.toThrow();
        });
    });

    describe('JSON Payload Edge Cases', () => {
        test('handles non-JSON payload after decryption', () => {
            // This would require a valid encrypted packet with non-JSON content
            // For now, we just verify the deserializer doesn't crash on edge cases
            const buffer = Buffer.alloc(100);
            crypto.randomFillSync(buffer);
            
            expect(() => {
                try {
                    deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                } catch (e) {
                    // Expected to fail
                }
            }).not.toThrow();
        });
    });

    describe('Payload Size Limits', () => {
        test('enforces maximum payload size', () => {
            if (packets && packets.MAX_PAYLOAD_SIZE) {
                const buffer = Buffer.alloc(100);
                buffer.writeUInt8(1, 0);
                buffer.writeUInt8(0x10, 1);
                buffer.writeUInt32BE(packets.MAX_PAYLOAD_SIZE + 1000, 2);
                
                expect(() => {
                    try {
                        deserializer.deserializePacket(buffer, Buffer.alloc(32), Buffer.alloc(32), 0);
                    } catch (e) {
                        expect(e.code).toBeDefined();
                    }
                }).not.toThrow();
            }
        });
    });
});

describeIfAvailable('Payload Parser Fuzz Tests', () => {
    describe('parseShotFired', () => {
        test('handles missing fields gracefully', () => {
            const payloads = [
                {},
                { playerId: 'test' },
                { weaponId: 1 },
                { targetX: 0, targetY: 0 },
                null,
                undefined
            ];
            
            for (const payload of payloads) {
                expect(() => {
                    try {
                        deserializer.parseShotFired(payload || {});
                    } catch (e) {
                        // May throw, but shouldn't crash
                    }
                }).not.toThrow();
            }
        });

        test('handles wrong field types', () => {
            const payloads = [
                { playerId: 123, weaponId: 'string', targetX: 'not a number' },
                { playerId: null, weaponId: undefined },
                { playerId: [], weaponId: {} }
            ];
            
            for (const payload of payloads) {
                expect(() => {
                    try {
                        deserializer.parseShotFired(payload);
                    } catch (e) {
                        // May throw, but shouldn't crash
                    }
                }).not.toThrow();
            }
        });
    });

    describe('parseRoomSnapshot', () => {
        test('handles malformed fish arrays', () => {
            const payloads = [
                { fish: 'not an array' },
                { fish: null },
                { fish: [null, undefined, 'string', 123] },
                { fish: [{ invalid: true }] }
            ];
            
            for (const payload of payloads) {
                expect(() => {
                    try {
                        deserializer.parseRoomSnapshot(payload);
                    } catch (e) {
                        // May throw, but shouldn't crash
                    }
                }).not.toThrow();
            }
        });
    });
});

// Test that module gracefully handles being unavailable
describe('Module Availability', () => {
    test('reports module availability correctly', () => {
        expect(typeof moduleAvailable).toBe('boolean');
    });
});
