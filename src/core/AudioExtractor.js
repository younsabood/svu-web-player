class AudioExtractor {
  static TRUESPEECH_FORMAT = 0x0022;
  static CHANNELS = 1;
  static SAMPLE_RATE = 8000;
  static AVG_BYTES_PER_SEC = 1067;
  static BLOCK_ALIGN = 32;
  static BITS_PER_SAMPLE = 1;
  static EXTRA_SIZE = 32;

  /**
   * Reconstructs a valid TrueSpeech WAV file in-memory using the extracted raw chunks.
   * @param {Uint8Array[]} chunks - Array of objects {timestamp, data} from LrecParser
   * @param {number} totalDurationMs - The total duration of the lecture
   * @returns {Uint8Array} - Complete WAV file bytes
   */
  static buildTrueSpeechWav(chunks, totalDurationMs = 0) {
    if (!chunks || chunks.length === 0) {
      console.warn("[AudioExtractor] No audio chunks provided to buildTrueSpeechWav");
      return null;
    }

    // Insert silence for gaps and calculate total size
    const duration = Math.max(totalDurationMs, chunks.length > 0 ? chunks[chunks.length - 1].timestamp : 0);
    const estimatedTotalSize = Math.ceil((duration / 1000) * this.AVG_BYTES_PER_SEC) + 512;
    
    console.log(`[AudioExtractor] Reconstructing TrueSpeech WAV. Chunks: ${chunks.length}, Target Duration: ${duration}ms`);
    
    // We'll build the payload with padding
    const payload = new Uint8Array(estimatedTotalSize);
    let currentPayloadOffset = 0;
    let lastChunkEndMs = 0;

    for (const chunk of chunks) {
      const gapMs = chunk.timestamp - lastChunkEndMs;
      if (gapMs > 100) { // If gap > 100ms, insert silence
        let silenceBytes = Math.floor((gapMs / 1000) * this.AVG_BYTES_PER_SEC);
        // Align to TrueSpeech block size (32 bytes)
        silenceBytes = Math.floor(silenceBytes / 32) * 32;
        
        if (silenceBytes > 0 && currentPayloadOffset + silenceBytes < payload.length) {
          // Fill with 0 (Standard TrueSpeech silence/empty)
          payload.fill(0, currentPayloadOffset, currentPayloadOffset + silenceBytes);
          currentPayloadOffset += silenceBytes;
        }
      }
      
      if (currentPayloadOffset + chunk.data.length < payload.length) {
        payload.set(chunk.data, currentPayloadOffset);
        currentPayloadOffset += chunk.data.length;
      }
      
      // A 256-byte chunk at 1067 bps is approx 240ms
      lastChunkEndMs = chunk.timestamp + (256 / this.AVG_BYTES_PER_SEC) * 1000;
    }

    // Add trailing silence if the last chunk ends before the video duration
    const finalGapMs = duration - lastChunkEndMs;
    if (finalGapMs > 100) {
      let silenceBytes = Math.floor((finalGapMs / 1000) * this.AVG_BYTES_PER_SEC);
      silenceBytes = Math.floor(silenceBytes / 32) * 32;
      if (silenceBytes > 0 && currentPayloadOffset + silenceBytes <= payload.length) {
        payload.fill(0, currentPayloadOffset, currentPayloadOffset + silenceBytes);
        currentPayloadOffset += silenceBytes;
      }
    }

    const dataSize = currentPayloadOffset;
    const finalPayload = payload.subarray(0, dataSize);
    
    // Header size is constant for our TrueSpeech WAV
    // RIFF(4) + fileSize(4) + WAVE(4) + fmt (4) + fmtSize(4) + 
    // format(2) + channels(2) + sampleRate(4) + avgBytes(4) + blockAlign(2) + 
    // bitsPerSample(2) + extraSize(2) + extraData(32) + data(4) + dataSize(4) = 78 bytes
    const headerSize = 78;
    const fileSize = headerSize - 8 + dataSize;
    
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    // Helpers
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    let offset = 0;

    // RIFF chunk
    writeString(offset, 'RIFF'); offset += 4;
    view.setUint32(offset, fileSize, true); offset += 4;
    writeString(offset, 'WAVE'); offset += 4;

    // fmt chunk
    writeString(offset, 'fmt '); offset += 4;
    view.setUint32(offset, 50, true); offset += 4; // Chunk size (50 for TrueSpeech)
    view.setUint16(offset, this.TRUESPEECH_FORMAT, true); offset += 2;
    view.setUint16(offset, this.CHANNELS, true); offset += 2;
    view.setUint32(offset, this.SAMPLE_RATE, true); offset += 4;
    view.setUint32(offset, this.AVG_BYTES_PER_SEC, true); offset += 4;
    view.setUint16(offset, this.BLOCK_ALIGN, true); offset += 2;
    view.setUint16(offset, this.BITS_PER_SAMPLE, true); offset += 2;
    view.setUint16(offset, this.EXTRA_SIZE, true); offset += 2;
    
    // 32 bytes of extra data (zeroes usually suffice for TrueSpeech decoders)
    offset += 32;

    // data chunk
    writeString(offset, 'data'); offset += 4;
    view.setUint32(offset, dataSize, true); offset += 4;

    // Write the final payload
    u8.set(finalPayload, offset);

    console.log(`[AudioExtractor] WAV reconstruction complete. Output buffer size: ${u8.length} bytes`);
    return u8;
  }
}

export default AudioExtractor;
