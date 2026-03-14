class CanvasRenderer {
  constructor(canvasElement, width = 1280, height = 1024) {
    this.canvas = canvasElement;
    this.displayCtx = this.canvas.getContext('2d');
    
    // Internal accumulator buffer
    this.bufferCanvas = document.createElement('canvas');
    this.bufferCanvas.width = width;
    this.bufferCanvas.height = height;
    this.ctx = this.bufferCanvas.getContext('2d', { willReadFrequently: true });
    
    this.width = width;
    this.height = height;
    
    this.clearScale();
  }

  clearScale() {
     this.ctx.fillStyle = '#000000';
     this.ctx.fillRect(0, 0, this.width, this.height);
  }

  // Draw bufferCanvas to displayCanvas with dynamic clipping
  flush(cropBounds = null) {
    if (!this.displayCtx) return;

    if (cropBounds) {
      if (this.canvas.width !== cropBounds.width || this.canvas.height !== cropBounds.height) {
        this.canvas.width = Math.max(1, cropBounds.width);
        this.canvas.height = Math.max(1, cropBounds.height);
      }
      this.displayCtx.drawImage(
        this.bufferCanvas, 
        cropBounds.x, cropBounds.y, cropBounds.width, cropBounds.height, 
        0, 0, cropBounds.width, cropBounds.height
      );
    } else {
      if (this.canvas.width !== this.width || this.canvas.height !== this.height) {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
      }
      this.displayCtx.drawImage(this.bufferCanvas, 0, 0);
    }
  }

  renderFrame(tiles, palette) {
    if (!tiles) return;

    for (const tile of tiles) {
      this.blitTile(tile, palette);
    }
  }

  blitTile(tile, palette) {
    const { x, y, width, height, bpp, tileData: pixels } = tile;
    
    if (width <= 0 || height <= 0 || x >= this.width || y >= this.height) return;

    // Boundary checks
    const targetW = Math.min(width, this.width - x);
    const targetH = Math.min(height, this.height - y);

    if (targetW <= 0 || targetH <= 0) return;

    const imageData = this.ctx.createImageData(targetW, targetH);
    const out = imageData.data;

    let srcIdx = 0;
    let dstIdx = 0;

    if (bpp === 1) { // 8-bit indexed
      for (let r = 0; r < targetH; r++) {
        srcIdx = r * width; // source row start
        for (let c = 0; c < targetW; c++) {
          const colorIdx = pixels[srcIdx + c];
          out[dstIdx + 0] = palette[colorIdx * 3 + 0]; // R
          out[dstIdx + 1] = palette[colorIdx * 3 + 1]; // G
          out[dstIdx + 2] = palette[colorIdx * 3 + 2]; // B
          out[dstIdx + 3] = 255; // Alpha
          dstIdx += 4;
        }
      }
    } else if (bpp === 3) { // 24-bit BGR
      for (let r = 0; r < targetH; r++) {
        srcIdx = r * width * 3;
        for (let c = 0; c < targetW; c++) {
          const b = pixels[srcIdx + c * 3 + 0];
          const g = pixels[srcIdx + c * 3 + 1];
          const rd = pixels[srcIdx + c * 3 + 2];
          out[dstIdx + 0] = rd;
          out[dstIdx + 1] = g;
          out[dstIdx + 2] = b;
          out[dstIdx + 3] = 255;
          dstIdx += 4;
        }
      }
    } else if (bpp === 2) { // 16-bit RGB555
      const dv = new DataView(pixels.buffer, pixels.byteOffset, pixels.byteLength);
      for (let r = 0; r < targetH; r++) {
        let dvIdx = (r * width) * 2;
        for (let c = 0; c < targetW; c++) {
          // Read 16-bit little endian
          const val = dv.getUint16(dvIdx, true);
          dvIdx += 2;
          
          out[dstIdx + 0] = ((val >> 10) & 0x1f) << 3; // R
          out[dstIdx + 1] = ((val >> 5) & 0x1f) << 3;  // G
          out[dstIdx + 2] = (val & 0x1f) << 3;         // B
          out[dstIdx + 3] = 255;
          dstIdx += 4;
        }
      }
    }

    this.ctx.putImageData(imageData, x, y);
  }
}

export default CanvasRenderer;
