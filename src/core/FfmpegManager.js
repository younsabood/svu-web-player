import { FFmpeg } from '@ffmpeg/ffmpeg';

class FfmpegManager {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.isLoaded = false;
    this.jobCounter = 0;
  }

  getLoadConfig() {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
    return {
      coreURL: `${baseURL}/ffmpeg-core.js`,
      wasmURL: `${baseURL}/ffmpeg-core.wasm`,
    };
  }

  attachDefaultLogger(ffmpegInstance) {
    ffmpegInstance.on('log', ({ message }) => {
      console.log(`[FFmpeg-Core] ${message}`);
    });
  }

  async load() {
    if (this.isLoaded) {
      console.log("[FfmpegManager] FFmpeg is already loaded. Skipping.");
      return;
    }
    
    console.log("[FfmpegManager] Loading FFmpeg WebAssembly core from CDN...");
    try {
        this.attachDefaultLogger(this.ffmpeg);
        await this.ffmpeg.load(this.getLoadConfig());

        this.isLoaded = true;
        console.log("[FfmpegManager] FFmpeg successfully loaded and initialized!");
    } catch (err) {
        console.error("[FfmpegManager] Failed to load FFmpeg.wasm:", err);
        throw err;
    }
  }

  /**
   * Decodes TrueSpeech WAV to browser-playable PCM WAV bytes.
   * @param {Uint8Array} trueSpeechData - The WAV file bytes from AudioExtractor
   * @returns {Uint8Array} - PCM WAV bytes
   */
  async decodeTrueSpeechToPcmWav(trueSpeechData) {
    console.log(`[FfmpegManager] Starting TrueSpeech conversion. Input size: ${trueSpeechData.length} bytes`);
    if (!this.isLoaded) await this.load();

    const jobId = ++this.jobCounter;
    const inputName = `input_ts_${jobId}.wav`;
    const outputName = `output_pcm_${jobId}.wav`;

    try {
        console.log(`[FfmpegManager] Writing ${inputName} to MEMFS`);
        // Write input to MEMFS
        await this.ffmpeg.writeFile(inputName, trueSpeechData);

        console.log(`[FfmpegManager] Executing FFmpeg conversion command...`);
        // Match the Python player: decode to PCM WAV at 8kHz mono.
        await this.ffmpeg.exec([
          '-y',
          '-i', inputName,
          '-acodec', 'pcm_s16le',
          '-ac', '1',
          '-ar', '8000',
          outputName
        ]);

        console.log(`[FfmpegManager] Conversion complete. Reading ${outputName} from MEMFS...`);
        const fileData = await this.ffmpeg.readFile(outputName);
        return new Uint8Array(fileData);
    } catch (err) {
        console.error(`[FfmpegManager] Error during TrueSpeech to PCM conversion:`, err);
        throw err;
    } finally {
        await this.cleanup([inputName, outputName]);
    }
  }

  async convertTrueSpeechToPlayableFormat(trueSpeechData) {
    const pcmWav = await this.decodeTrueSpeechToPcmWav(trueSpeechData);
    console.log(`[FfmpegManager] Generating Blob URL for ${pcmWav.length} bytes of PCM WAV data...`);
    const blob = new Blob([pcmWav.buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  async createSession(options = {}) {
    const ffmpeg = new FFmpeg();

    if (options.onLog) {
      ffmpeg.on('log', options.onLog);
    } else {
      this.attachDefaultLogger(ffmpeg);
    }

    if (options.onProgress) {
      ffmpeg.on('progress', options.onProgress);
    }

    await ffmpeg.load(this.getLoadConfig());
    return ffmpeg;
  }

  terminateSingleton() {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
    }
    this.ffmpeg = new FFmpeg();
    this.isLoaded = false;
  }

  /**
   * Optional cleanup
   */
  async cleanup(filenames) {
    for (const name of filenames) {
      try {
        await this.ffmpeg.deleteFile(name);
      } catch {
        /* ignore */
      }
    }
  }
}

// Export singleton instance since FFmpeg WebWorker should generally be shared
const ffmpegManager = new FfmpegManager();
export default ffmpegManager;
