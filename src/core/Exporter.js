import ffmpegManager from './FfmpegManager';
import CanvasRenderer from './CanvasRenderer';
import { withRetry } from './utils';
import SmartCropper from './SmartCropper';

const isAbortLikeError = (error, signal) => {
  const message = String(error?.message || error || '');
  return Boolean(
    signal?.aborted ||
    error?.name === 'AbortError' ||
    /abort|terminated/i.test(message)
  );
};

class Exporter {
  static getOptimalCrop(parser) {
    const cropper = new SmartCropper(parser.screenWidth, parser.screenHeight);
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = parser.screenWidth;
    tempCanvas.height = parser.screenHeight;
    const tempRenderer = new CanvasRenderer(tempCanvas, parser.screenWidth, parser.screenHeight);
    tempRenderer.clearScale();
    
    // Scan frames incrementally to find the visual content bounds
    // Python version scans first 50 frames fully.
    const scanLimit = Math.min(60, parser.totalFrames);
    console.log(`[Exporter] Scanning first ${scanLimit} frames for visual content...`);
    
    for (let i = 0; i < scanLimit; i++) {
        const tiles = parser.getFrameTiles(i);
        if (tiles) tempRenderer.renderFrame(tiles, parser.palette);
        
        // Every 5 frames or frame 0, update the cropper
        if (i === 0 || i % 5 === 0) {
            const imageData = tempRenderer.ctx.getImageData(0, 0, parser.screenWidth, parser.screenHeight);
            cropper.updateBounds(imageData);
        }
    }
    
    const bounds = cropper.getBounds();
    let { x, y, width, height } = bounds;
    
    // Fallback to full screen if no content detected
    if (width <= 0 || height <= 0 || !cropper.initialized) {
        console.warn("[Exporter] No content detected in initial scan, falling back to full screen.");
        return { x: 0, y: 0, width: parser.screenWidth, height: parser.screenHeight };
    }

    // Pad a bit like Python's margin = 5, but keep it within screen
    const margin = 2;
    x = Math.max(0, x - margin);
    y = Math.max(0, y - margin);
    width = Math.min(parser.screenWidth - x, width + (margin * 2));
    height = Math.min(parser.screenHeight - y, height + (margin * 2));

    // Ensure even width/height for H.264
    if (width % 2 !== 0) width -= 1;
    if (height % 2 !== 0) height -= 1;
    
    console.log(`[Exporter] Detected Crop: ${width}x${height} at (${x},${y})`);
    return { x, y, width, height };
  }

  static async exportToMp4(parser, audioUrl, onProgress, signal) {
    const ffmpeg = await ffmpegManager.createSession({
      onProgress: ({ progress }) => {
        if (onProgress) {
          onProgress(60 + (progress * 40));
        }
      },
    });
    const abortExport = () => {
      ffmpeg.terminate();
    };
    signal?.addEventListener('abort', abortExport, { once: true });

    const crop = this.getOptimalCrop(parser);

    // Use a hidden canvas for rendering export frames
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = parser.screenWidth;
    exportCanvas.height = parser.screenHeight;
    const renderer = new CanvasRenderer(exportCanvas, parser.screenWidth, parser.screenHeight);
    
    // Clear and prepare
    renderer.clearScale();

    // Duration calculation - MUST match LrecParser duration
    const totalDurationS = parser.durationMs / 1000.0;
    // Input framerate for FFmpeg to reconstruct the timeline correctly
    const inputFps = totalDurationS > 0.1 ? (parser.totalFrames / totalDurationS) : 30;
    
    console.log(`[Exporter] Exporting ${parser.totalFrames} frames at ${inputFps.toFixed(4)} FPS. Total Duration: ${totalDurationS.toFixed(2)}s`);

    const outputFileName = 'output_final.mp4';
    let audioFileName = null;
    try {
      // Build FFmpeg command args
      // We use rawvideo format piped via MEMFS or stdin (here we use individual frames via writeFile is slow, 
      // but FFmpeg WASM works better with writing the stream to a virtual file or concatenating).
      
      // OPTIMIZATION: Instead of writing 1000s of files (which crashes MEMFS), 
      // we'll combine frames into a single raw byte stream if possible or write them in chunks.
      // For WASM simplicity, we'll write JPEGs but ENSURE we wait for rendering.
      
      // Actually, to avoid the 'no image' bug, we MUST ensure renderer.ctx.putImageData has finished.
      // In JS, putImageData is sync, but canvas.toBlob can be async.
      
      for (let i = 0; i < parser.totalFrames; i++) {
        if (signal?.aborted) throw new Error('Export aborted by user');

        const tiles = parser.getFrameTiles(i);
        renderer.renderFrame(tiles, parser.palette);
        
        // Flush the accumulator buffer to the display canvas and apply crop
        renderer.flush(crop);
        
        // Ensure the frame is fully drawn before capturing
        const frameBlob = await new Promise(resolve => {
          // JPEG is faster to encode than PNG but can have artifacts
          exportCanvas.toBlob(resolve, 'image/jpeg', 0.9);
        });
        
        if (!frameBlob) {
          throw new Error('Failed to generate export frame');
        }

        const arrayBuffer = await frameBlob.arrayBuffer();
        await ffmpeg.writeFile(`f_${i.toString().padStart(6, '0')}.jpg`, new Uint8Array(arrayBuffer), { signal });

        if (onProgress && i % 10 === 0) {
          onProgress((i / parser.totalFrames) * 60); // 0-60% for frame generation
        }
      }

      // Handle Audio
      let hasAudio = false;
      if (audioUrl) {
        try {
          const audioBlob = await withRetry(() => fetch(audioUrl).then(r => r.blob()), 3, 1000, signal);
          const audioBuffer = await audioBlob.arrayBuffer();
          const isWav = /wav/i.test(audioBlob.type || '');
          audioFileName = isWav ? 'audio.wav' : 'audio.mp3';
          await ffmpeg.writeFile(audioFileName, new Uint8Array(audioBuffer), { signal });
          hasAudio = true;
        } catch (error) {
          console.warn("[Exporter] Audio extraction failed for export, skipping audio", error);
        }
      }

      // FFmpeg Encoding Args - Using image2 sequence
      const ffmpegArgs = [
        '-y',
        '-framerate', String(inputFps),
        '-start_number', '0',
        '-i', 'f_%06d.jpg',
      ];

      if (hasAudio && audioFileName) {
        ffmpegArgs.push('-i', audioFileName);
      }

      // H.264 Encoding settings matching Python as much as possible
      // Using 'medium' instead of 'ultrafast' for significantly better quality/compression
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-preset', 'medium', // Balance between speed and compression
        '-crf', '23',        // Higher quality than 25
        '-b:v', '0',         // Constant Rate Factor mode
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart'
      );

      if (hasAudio) {
        ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k'); // Improved audio bitrate
      }

      ffmpegArgs.push(outputFileName);

      await ffmpeg.exec(ffmpegArgs, -1, { signal });

      const data = await ffmpeg.readFile(outputFileName, 'binary', { signal });
      const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
      return URL.createObjectURL(mp4Blob);

    } catch (error) {
      if (isAbortLikeError(error, signal)) {
        throw new Error('Export aborted by user');
      }
      console.error("[Exporter] Export Failed:", error);
      throw error;
    } finally {
      signal?.removeEventListener('abort', abortExport);
      // Cleanup MEMFS to prevent memory leaks
      try {
        for (let i = 0; i < parser.totalFrames; i++) {
          ffmpeg.deleteFile(`f_${i.toString().padStart(6, '0')}.jpg`).catch(() => {});
        }
        if (audioFileName) {
          ffmpeg.deleteFile(audioFileName).catch(() => {});
        }
        ffmpeg.deleteFile(outputFileName).catch(() => {});
      } catch {
        // Cleanup is best-effort only.
      }
      try {
        ffmpeg.terminate();
      } catch {
        // Worker may already be terminated after cancellation.
      }
    }
  }
}

export default Exporter;
