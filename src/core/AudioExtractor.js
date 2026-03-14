class AudioExtractor {
  static TRUESPEECH_FORMAT = 0x0022;
  static PCM_FORMAT = 0x0001;
  static CHANNELS = 1;
  static SAMPLE_RATE = 8000;
  static AVG_BYTES_PER_SEC = 1067;
  static BLOCK_ALIGN = 32;
  static BITS_PER_SAMPLE = 1;
  static EXTRA_SIZE = 32;
  static PCM_BITS_PER_SAMPLE = 16;

  /**
   * Reconstructs a valid TrueSpeech WAV file in-memory using the extracted raw chunks.
   * @param {Uint8Array[]} chunks - Array of objects {timestamp, data} from LrecParser
   * @param {number} totalDurationMs - The total duration of the lecture
   * @returns {Uint8Array} - Complete WAV file bytes
   */
  static buildTrueSpeechWav(chunks) {
    if (!chunks || chunks.length === 0) {
      console.warn("[AudioExtractor] No audio chunks provided to buildTrueSpeechWav");
      return null;
    }

    const normalizedChunks = this.normalizeChunks(chunks);
    const dataSize = normalizedChunks.reduce((total, chunk) => total + chunk.data.length, 0);
    const payload = new Uint8Array(dataSize);

    console.log(`[AudioExtractor] Reconstructing TrueSpeech WAV. Chunks: ${normalizedChunks.length}, Raw payload: ${dataSize} bytes`);

    let currentPayloadOffset = 0;
    for (const chunk of normalizedChunks) {
      payload.set(chunk.data, currentPayloadOffset);
      currentPayloadOffset += chunk.data.length;
    }
    
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
    u8.set(payload, offset);

    console.log(`[AudioExtractor] WAV reconstruction complete. Output buffer size: ${u8.length} bytes`);
    return u8;
  }

  static buildTimedPcmWav(chunks, decodedPcmWav, totalDurationMs = 0) {
    if (!chunks || chunks.length === 0 || !decodedPcmWav || decodedPcmWav.length === 0) {
      console.warn("[AudioExtractor] Missing chunks or decoded PCM WAV for buildTimedPcmWav");
      return null;
    }

    const normalizedChunks = this.normalizeChunks(chunks);
    const pcmInfo = this.parsePcmWav(decodedPcmWav);
    const totalFrames = Math.floor(pcmInfo.samples.length / pcmInfo.channels);

    if (totalFrames <= 0) {
      console.warn("[AudioExtractor] Decoded PCM WAV does not contain audio frames");
      return null;
    }

    const baseFramesPerChunk = Math.floor(totalFrames / normalizedChunks.length);
    if (baseFramesPerChunk <= 0) {
      console.warn("[AudioExtractor] Decoded PCM frames are smaller than chunk count, falling back to decoded PCM WAV");
      return decodedPcmWav;
    }

    const lastChunkFrames = totalFrames - (baseFramesPerChunk * (normalizedChunks.length - 1));
    const lastChunkEndMs = normalizedChunks[normalizedChunks.length - 1].timestamp +
      ((lastChunkFrames / pcmInfo.sampleRate) * 1000);
    const targetDurationMs = Math.max(totalDurationMs, lastChunkEndMs);
    const targetFrames = Math.max(
      Math.ceil((targetDurationMs * pcmInfo.sampleRate) / 1000),
      totalFrames
    );
    const timedSamples = new Int16Array(targetFrames * pcmInfo.channels);

    console.log(
      `[AudioExtractor] Rebuilding timed PCM WAV. Chunks: ${normalizedChunks.length}, ` +
      `Frames/Chunk: ${baseFramesPerChunk}, Target Duration: ${targetDurationMs}ms`
    );

    let sourceFrameOffset = 0;

    normalizedChunks.forEach((chunk, index) => {
      const chunkFrameCount = index === normalizedChunks.length - 1
        ? totalFrames - sourceFrameOffset
        : baseFramesPerChunk;
      const sourceSampleStart = sourceFrameOffset * pcmInfo.channels;
      const sourceSampleEnd = sourceSampleStart + (chunkFrameCount * pcmInfo.channels);
      const targetFrameOffset = Math.max(0, Math.round((chunk.timestamp * pcmInfo.sampleRate) / 1000));
      const targetSampleOffset = targetFrameOffset * pcmInfo.channels;

      if (sourceSampleStart >= pcmInfo.samples.length || targetSampleOffset >= timedSamples.length) {
        sourceFrameOffset += chunkFrameCount;
        return;
      }

      const chunkSamples = pcmInfo.samples.subarray(sourceSampleStart, sourceSampleEnd);
      const writableSamples = Math.min(chunkSamples.length, timedSamples.length - targetSampleOffset);
      timedSamples.set(chunkSamples.subarray(0, writableSamples), targetSampleOffset);
      sourceFrameOffset += chunkFrameCount;
    });

    return this.buildPcmWav(timedSamples, pcmInfo.sampleRate, pcmInfo.channels);
  }

  static normalizeChunks(chunks) {
    return chunks.map((chunk, index) => {
      if (chunk instanceof Uint8Array) {
        return {
          timestamp: index * ((chunk.length / this.AVG_BYTES_PER_SEC) * 1000),
          data: chunk,
        };
      }

      return {
        timestamp: chunk.timestamp ?? 0,
        data: chunk.data,
      };
    });
  }

  static parsePcmWav(wavBytes) {
    if (!wavBytes || wavBytes.length < 44) {
      throw new Error("PCM WAV buffer is too small");
    }

    const bytes = wavBytes instanceof Uint8Array ? wavBytes : new Uint8Array(wavBytes);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (this.readAscii(bytes, 0, 4) !== 'RIFF' || this.readAscii(bytes, 8, 4) !== 'WAVE') {
      throw new Error("Invalid WAV header");
    }

    let audioFormat = null;
    let channels = null;
    let sampleRate = null;
    let bitsPerSample = null;
    let dataOffset = -1;
    let dataSize = 0;
    let offset = 12;

    while (offset + 8 <= bytes.length) {
      const chunkId = this.readAscii(bytes, offset, 4);
      const chunkSize = view.getUint32(offset + 4, true);
      const chunkDataOffset = offset + 8;
      const nextOffset = chunkDataOffset + chunkSize + (chunkSize % 2);

      if (nextOffset > bytes.length) {
        break;
      }

      if (chunkId === 'fmt ' && chunkSize >= 16) {
        audioFormat = view.getUint16(chunkDataOffset, true);
        channels = view.getUint16(chunkDataOffset + 2, true);
        sampleRate = view.getUint32(chunkDataOffset + 4, true);
        bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
      } else if (chunkId === 'data') {
        dataOffset = chunkDataOffset;
        dataSize = chunkSize;
      }

      offset = nextOffset;
    }

    if (audioFormat !== this.PCM_FORMAT || bitsPerSample !== this.PCM_BITS_PER_SAMPLE || dataOffset < 0) {
      throw new Error("Decoded WAV is not PCM s16le");
    }

    return {
      audioFormat,
      channels,
      sampleRate,
      bitsPerSample,
      samples: new Int16Array(bytes.buffer, bytes.byteOffset + dataOffset, dataSize / 2),
    };
  }

  static buildPcmWav(samples, sampleRate = this.SAMPLE_RATE, channels = this.CHANNELS) {
    const dataSize = samples.byteLength;
    const headerSize = 44;
    const blockAlign = channels * (this.PCM_BITS_PER_SAMPLE / 8);
    const byteRate = sampleRate * blockAlign;
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    let offset = 0;
    writeString(offset, 'RIFF'); offset += 4;
    view.setUint32(offset, headerSize - 8 + dataSize, true); offset += 4;
    writeString(offset, 'WAVE'); offset += 4;
    writeString(offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, this.PCM_FORMAT, true); offset += 2;
    view.setUint16(offset, channels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, byteRate, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, this.PCM_BITS_PER_SAMPLE, true); offset += 2;
    writeString(offset, 'data'); offset += 4;
    view.setUint32(offset, dataSize, true); offset += 4;
    u8.set(new Uint8Array(samples.buffer, samples.byteOffset, dataSize), offset);

    return u8;
  }

  static readAscii(bytes, offset, length) {
    let value = '';
    for (let i = 0; i < length; i++) {
      value += String.fromCharCode(bytes[offset + i]);
    }
    return value;
  }
}

export default AudioExtractor;
