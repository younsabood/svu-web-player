import pako from 'pako';

// Constants
export const FLAG_COMPRESSED = 0x2;
export const FLAG_EMBEDDED = 0x400;

class LrecParser {
  constructor(arrayBuffer) {
    this.buffer = arrayBuffer;
    this.data = new Uint8Array(arrayBuffer);
    this.view = new DataView(arrayBuffer);
    
    // Detect timestamp format (first byte 0 = global timestamp)
    this.hasGlobalTimestamp = this.data[0] === 0;
    
    // Defaults matching Python
    this.screenWidth = 1280;
    this.screenHeight = 1024;
    this.palette = this.createDefaultPalette();
    
    this.frameIndex = []; // { chunkOffset, timestamp, payloadOffset, payloadSize, inflatedSize, isCompressed }
    this.audioChunks = []; // array of Uint8Arrays representing TrueSpeech data
    
    this.durationMs = 0;
  }

  createDefaultPalette() {
    const palette = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
        palette[i * 3 + 0] = (i * 7) % 256;  // R
        palette[i * 3 + 1] = (i * 11) % 256; // G
        palette[i * 3 + 2] = (i * 13) % 256; // B
    }
    return palette;
  }

  parsePalette(payload) {
    if (payload.length < 2 || payload[0] !== 2) return this.createDefaultPalette();
    const palette = new Uint8Array(256 * 3);
    
    // Default black
    for (let i = 0; i < 256 * 3; i++) palette[i] = 0;

    let idx = 0;
    // BGR extraction
    for (let i = 1; i < payload.length - 2; i += 4) {
      if (idx >= 256) break;
      const b = payload[i];
      const g = payload[i+1];
      const r = payload[i+2];
      palette[idx * 3 + 0] = r;
      palette[idx * 3 + 1] = g;
      palette[idx * 3 + 2] = b;
      idx++;
    }
    return palette;
  }

  // Reads 3 bytes Little Endian
  readInt24LE(offset) {
    return this.data[offset] | (this.data[offset + 1] << 8) | (this.data[offset + 2] << 16);
  }

  indexFile(onProgress) {
    if (!this.data || this.data.length === 0) {
      console.warn("[LrecParser] Cannot index: empty data buffer");
      return;
    }
    
    console.log(`[LrecParser] Starting indexing. Total size: ${this.data.length} bytes`);
    
    try {
      this.frameIndex = [];
      this.audioChunks = [];
      let offset = 0;
      const fileSize = this.data.length;
      let chunkIdx = 0;
      
      while (offset < fileSize) {
        const chunkStart = offset;
        if (chunkStart + 16 > fileSize) break;
        
        const currentPtr = this.hasGlobalTimestamp ? chunkStart + 8 : chunkStart;
        if (currentPtr + 16 > fileSize) break;
        
        let timestamp = 0;
        if (this.hasGlobalTimestamp) {
          const tsLow = this.view.getUint32(chunkStart, true);
          const tsHigh = this.view.getUint32(chunkStart + 4, true);
          // Combine low and high 32-bit parts into a 64-bit timestamp (ms)
          timestamp = Number((BigInt(tsHigh) << 32n) | BigInt(tsLow));
        }
        
        const size = this.readInt24LE(currentPtr + 2) - 11;
        const control = this.view.getUint16(currentPtr + 5, true);
        const flags = this.view.getUint16(currentPtr + 7, true);
        const inflatedSize = this.readInt24LE(currentPtr + 13);
        
        const isEmbedded = (flags & FLAG_EMBEDDED) === FLAG_EMBEDDED;
        const isCompressed = (flags & FLAG_COMPRESSED) === FLAG_COMPRESSED;
        
        if (isEmbedded) {
          const x2 = this.view.getUint16(currentPtr + 18, true);
          const h2Index = currentPtr + 16 + x2;
          if (h2Index + 5 <= fileSize) {
            const h2Size = this.readInt24LE(h2Index + 2) - 11;
            if (h2Size - 5 === 256) {
                const audioStart = currentPtr + x2 + 36 + 1;
                if (audioStart + 256 <= fileSize) {
                  this.audioChunks.push({
                    timestamp,
                    data: this.data.slice(audioStart, audioStart + 256)
                  });
                }
                offset = audioStart + 256;
            } else {
              offset = currentPtr + 16 + size;
            }
          } else {
            break;
          }
        } else {
          const payloadOffset = currentPtr + 16;
          offset = currentPtr + 16 + size;
          
          if (size > 0) {
            if (this.data[payloadOffset] === 2) {
              this.palette = this.parsePalette(this.data.slice(payloadOffset, payloadOffset + size));
            }
            
            if (control === 3) {
              this.frameIndex.push({
                chunkOffset: chunkStart,
                timestamp,
                offset: payloadOffset,
                size: size,
                inflatedSize,
                isCompressed
              });
            }
          }
        }
        
        chunkIdx++;
        if (offset <= chunkStart) break;
        
        if (onProgress && chunkIdx % 1000 === 0) {
          onProgress(offset, fileSize);
        }
      }
      
      if (this.frameIndex.length > 0 || this.audioChunks.length > 0) {
        let firstTs = Infinity;
        if (this.frameIndex.length > 0) firstTs = Math.min(firstTs, this.frameIndex[0].timestamp);
        if (this.audioChunks.length > 0) firstTs = Math.min(firstTs, this.audioChunks[0].timestamp);
        
        if (firstTs === Infinity) firstTs = 0;
        
        // Normalize video frames
        this.frameIndex.forEach(f => {
          f.timestamp -= firstTs;
        });
        
        // Normalize audio chunks
        this.audioChunks.forEach(c => {
          c.timestamp -= firstTs;
        });
        
        if (this.frameIndex.length > 0) {
          this.durationMs = this.frameIndex[this.frameIndex.length - 1].timestamp;
        } else if (this.audioChunks.length > 0) {
          this.durationMs = this.audioChunks[this.audioChunks.length - 1].timestamp;
        }
        
        console.log(`[LrecParser] Timestamps Normalized (Audio+Video): 0ms to ${this.durationMs}ms. Start offset was: ${firstTs}ms`);
      }
      
      console.log(`[LrecParser] Indexing complete. Found ${this.frameIndex.length} video frames and ${this.audioChunks.length} audio chunks. Duration: ${this.durationMs}ms`);

    } catch (err) {
      console.error("[LrecParser] Critical error during indexFile:", err);
    }
  }

  getFrameTiles(frameIdx) {
    if (frameIdx < 0 || frameIdx >= this.totalFrames) {
        console.warn(`[LrecParser] Requested out-of-bounds frame: ${frameIdx}`);
        return [];
    }

    const frame = this.frameIndex[frameIdx];
    let payload = this.data.slice(frame.offset, frame.offset + frame.size);

    if (payload.length < 4) return [];

    let decompressed;
    try {
        if (frame.isCompressed) {
            // pako.inflateRaw(..., { windowBits: -15 }) is equivalent to python zlib.decompress(bytes, -15)
            // Python slices off the first 2 bytes, so we do payload.subarray(2)
            decompressed = pako.inflateRaw(payload.subarray(2));
        } else {
            decompressed = payload.length > 21 ? payload.subarray(1) : payload;
        }
    } catch (err) {
        console.error(`[LrecParser] Zlib Decompression failed for frame ${frameIdx}:`, err);
        return [];
    }

    if (decompressed.length < 21) return [];

    const tiles = [];
    const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
    let offset = 0;

    try {
        while (offset + 21 <= decompressed.length) { // 21 byte tile header
            const x = view.getUint32(offset + 1, true);
            const y = view.getUint32(offset + 5, true);
            const width = view.getUint32(offset + 9, true);
            const height = view.getUint32(offset + 13, true);
            const pixelLength = view.getUint32(offset + 17, true);
            
            offset += 21;

            if (pixelLength <= 0 || offset + pixelLength > decompressed.length) {
                break;
            }

            const area = width * height;
            const bpp = area > 0 ? Math.floor(pixelLength / area) : 1;

            const tileData = decompressed.slice(offset, offset + pixelLength);
            offset += pixelLength;

            tiles.push({ x, y, width, height, pixelLength, bpp, tileData });
        }
    } catch (err) {
        console.error(`[LrecParser] Error parsing tile coordinates for frame ${frameIdx}:`, err);
    }

    return tiles;
  }

  get totalFrames() {
    return this.frameIndex.length;
  }
}

export default LrecParser;
