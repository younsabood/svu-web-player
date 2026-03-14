import { describe, it, expect } from 'vitest';
import AudioExtractor from '../src/core/AudioExtractor';

const readAscii = (bytes, offset, length) =>
  String.fromCharCode(...bytes.slice(offset, offset + length));

const createPcmWav = (samples, sampleRate = 4) =>
  AudioExtractor.buildPcmWav(Int16Array.from(samples), sampleRate, 1);

describe('AudioExtractor', () => {
  it('should return null for empty chunks', () => {
    expect(AudioExtractor.buildTrueSpeechWav([])).toBeNull();
    expect(AudioExtractor.buildTrueSpeechWav(null)).toBeNull();
  });

  it('should build a valid TrueSpeech WAV RIFF header', () => {
    // Mock 2 chunks of 256 bytes each
    const chunk1 = new Uint8Array(256).fill(1);
    const chunk2 = new Uint8Array(256).fill(2);
    const chunks = [chunk1, chunk2];

    const wavBytes = AudioExtractor.buildTrueSpeechWav(chunks);
    
    // Header is 78 bytes, data is 512 bytes -> 590 bytes total
    expect(wavBytes.length).toBe(590);

    const view = new DataView(wavBytes.buffer);

    // RIFF check
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe('RIFF');
    
    // File size Check = 590 - 8 = 582
    expect(view.getUint32(4, true)).toBe(582);

    // WAVE check
    expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe('WAVE');

    // fmt chunk check
    expect(String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15))).toBe('fmt ');
    
    // Format = 0x0022 (TrueSpeech)
    expect(view.getUint16(20, true)).toBe(0x0022);

    // Channels = 1
    expect(view.getUint16(22, true)).toBe(1);

    // Sample Rate = 8000
    expect(view.getUint32(24, true)).toBe(8000);

    // Check data chunk header
    expect(String.fromCharCode(view.getUint8(70), view.getUint8(71), view.getUint8(72), view.getUint8(73))).toBe('data');
    
    // Data size = 512
    expect(view.getUint32(74, true)).toBe(512);

    // Check payload values
    expect(wavBytes[78]).toBe(1); // Start of chunk 1
    expect(wavBytes[78 + 256]).toBe(2); // Start of chunk 2
  });

  it('should rebuild PCM with silence based on chunk timestamps', () => {
    const chunks = [
      { timestamp: 0, data: new Uint8Array(256).fill(1) },
      { timestamp: 2000, data: new Uint8Array(256).fill(2) },
    ];
    const decodedPcm = createPcmWav([100, 101, 102, 103, 200, 201, 202, 203], 4);

    const timedPcm = AudioExtractor.buildTimedPcmWav(chunks, decodedPcm, 3000);
    const view = new DataView(timedPcm.buffer, timedPcm.byteOffset, timedPcm.byteLength);

    expect(readAscii(timedPcm, 0, 4)).toBe('RIFF');
    expect(readAscii(timedPcm, 8, 4)).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(4);
    expect(view.getUint32(40, true)).toBe(24);

    const samples = Array.from(new Int16Array(timedPcm.buffer, timedPcm.byteOffset + 44, 12));
    expect(samples).toEqual([100, 101, 102, 103, 0, 0, 0, 0, 200, 201, 202, 203]);
  });
});
