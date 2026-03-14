export default class SmartCropper {
    constructor(frameWidth, frameHeight) {
      this.frameWidth = frameWidth;
      this.frameHeight = frameHeight;
      
      this.minX = frameWidth;
      this.minY = frameHeight;
      this.maxX = 0;
      this.maxY = 0;
      
      this.initialized = false;
      this.framesAnalyzed = 0;
      this.warmupFrames = 15;
      
      this.threshold = 12; // Slightly higher to avoid compression noise
      this.margin = 3;    // Tighter margin for professional look
      this.expansions = 0;
    }
  
    detectContentBounds(imageData) {
      const { width, height, data } = imageData;
      
      let minX = width, minY = height, maxX = 0, maxY = 0;
      let hasContent = false;
  
      // Step controls performance checking every Nth pixel.
      // 4 gives extremely good performance while preserving high accuracy
      const step = 4; 
  
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const i = (y * width + x) * 4;
          // RGB channels
          const val = Math.max(data[i], data[i+1], data[i+2]);
          if (val > this.threshold) {
            hasContent = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
  
      if (!hasContent) {
        return null;
      }
  
      return { minX, minY, maxX, maxY };
    }
  
    updateBounds(imageData) {
      const content = this.detectContentBounds(imageData);
      if (!content) return false; // Do not update bounds or increment frames if completely empty
      
      this.framesAnalyzed++;
  
      let expanded = false;
  
      if (!this.initialized) {
        this.minX = Math.max(0, content.minX - this.margin);
        this.minY = Math.max(0, content.minY - this.margin);
        this.maxX = Math.min(this.frameWidth, content.maxX + this.margin);
        this.maxY = Math.min(this.frameHeight, content.maxY + this.margin);
        this.initialized = true;
        expanded = true;
      } else {
        const newMinX = Math.max(0, content.minX - this.margin);
        const newMinY = Math.max(0, content.minY - this.margin);
        const newMaxX = Math.min(this.frameWidth, content.maxX + this.margin);
        const newMaxY = Math.min(this.frameHeight, content.maxY + this.margin);
  
        if (newMinX < this.minX) { this.minX = newMinX; expanded = true; this.expansions++; }
        if (newMinY < this.minY) { this.minY = newMinY; expanded = true; this.expansions++; }
        if (newMaxX > this.maxX) { this.maxX = newMaxX; expanded = true; this.expansions++; }
        if (newMaxY > this.maxY) { this.maxY = newMaxY; expanded = true; this.expansions++; }
      }
  
      return expanded;
    }
  
    getBounds() {
      return {
        x: this.minX,
        y: this.minY,
        width: this.maxX - this.minX,
        height: this.maxY - this.minY
      };
    }
  }
