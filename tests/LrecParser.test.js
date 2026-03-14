import { describe, it, expect } from 'vitest';
import LrecParser from '../src/core/LrecParser';

describe('LrecParser', () => {
  it('should initialize correctly with empty buffer', () => {
    const buffer = new ArrayBuffer(0);
    const parser = new LrecParser(buffer);

    expect(parser.hasGlobalTimestamp).toBe(false); // Default empty byte is undefined -> false? Actually data[0] is undefined, so it's false.
    expect(parser.screenWidth).toBe(1280);
    expect(parser.screenHeight).toBe(1024);
    expect(parser.frameIndex).toEqual([]);
    expect(parser.audioChunks).toEqual([]);
  });

  it('should parse palette correctly', () => {
    const buffer = new ArrayBuffer(100);
    const parser = new LrecParser(buffer);

    // Mock palette payload
    const payload = new Uint8Array([2, 255, 0, 0, 0, 0, 255, 0]); // Type 2, BGR: Red(0,0,255), Green(0,255,0)
    
    const palette = parser.parsePalette(payload);
    
    // First color: Red
    expect(palette[0]).toBe(0); // R
    expect(palette[1]).toBe(0); // G
    expect(palette[2]).toBe(255); // B
    
    // Second color: Green
    expect(palette[3]).toBe(0); // R
    expect(palette[4]).toBe(255); // G
    expect(palette[5]).toBe(0); // B
  });

  it('should index file securely without crashing on invalid data', () => {
    const buffer = new ArrayBuffer(50);
    const view = new DataView(buffer);
    // Create dummy data
    view.setUint8(0, 1); // Not global timestamp
    
    const parser = new LrecParser(buffer);
    expect(() => parser.indexFile()).not.toThrow();
    expect(parser.frameIndex.length).toBe(0);
  });
});
