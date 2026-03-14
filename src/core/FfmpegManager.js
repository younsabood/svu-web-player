import { FFmpeg } from '@ffmpeg/ffmpeg';

class FfmpegManager {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.isLoaded = false;
  }

  async load() {
    if (this.isLoaded) {
      console.log("[FfmpegManager] FFmpeg is already loaded. Skipping.");
      return;
    }
    
    console.log("[FfmpegManager] Loading FFmpeg WebAssembly core from CDN...");
    try {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
        this.ffmpeg.on('log', ({ message }) => {
          console.log(`[FFmpeg-Core] ${message}`);
        });

        await this.ffmpeg.load({
          coreURL: `${baseURL}/ffmpeg-core.js`,
          wasmURL: `${baseURL}/ffmpeg-core.wasm`,
        });

        this.isLoaded = true;
        console.log("[FfmpegManager] FFmpeg successfully loaded and initialized!");
    } catch (err) {
        console.error("[FfmpegManager] Failed to load FFmpeg.wasm:", err);
        throw err;
    }
  }

  /**
   * Converts TrueSpeech WAV to playable MP3/AAC/PCM for the browser
   * @param {Uint8Array} trueSpeechData - The WAV file bytes from AudioExtractor
   * @returns {string} - Object URL to the decoded audio file
   */
  async convertTrueSpeechToPlayableFormat(trueSpeechData) {
    console.log(`[FfmpegManager] Starting TrueSpeech conversion. Input size: ${trueSpeechData.length} bytes`);
    if (!this.isLoaded) await this.load();

    const inputName = 'input_ts.wav';
    const outputName = 'output.mp3';

    try {
        console.log(`[FfmpegManager] Writing ${inputName} to MEMFS`);
        // Write input to MEMFS
        await this.ffmpeg.writeFile(inputName, trueSpeechData);

        console.log(`[FfmpegManager] Executing FFmpeg conversion command...`);
        // Convert TrueSpeech to MP3: 8000Hz, 1 channel
        await this.ffmpeg.exec([
          '-y',
          '-i', inputName,
          '-acodec', 'libmp3lame',
          '-ar', '44100', // Upsample for better browser compatibility
          outputName
        ]);

        console.log(`[FfmpegManager] Conversion complete. Reading ${outputName} from MEMFS...`);
        // Read back
        const fileData = await this.ffmpeg.readFile(outputName);
        const data = new Uint8Array(fileData);
        
        console.log(`[FfmpegManager] Generating Blob URL for ${data.length} bytes of MP3 data...`);
        // Create Blob URL
        const blob = new Blob([data.buffer], { type: 'audio/mp3' });
        return URL.createObjectURL(blob);
    } catch (err) {
        console.error(`[FfmpegManager] Error during TrueSpeech to MP3 conversion:`, err);
        throw err;
    }
  }

  /**
   * Optional cleanup
   */
  async cleanup(filenames) {
    for (const name of filenames) {
      try {
        await this.ffmpeg.deleteFile(name);
      } catch (e) {
        /* ignore */
      }
    }
  }
}

// Export singleton instance since FFmpeg WebWorker should generally be shared
const ffmpegManager = new FfmpegManager();
export default ffmpegManager;
