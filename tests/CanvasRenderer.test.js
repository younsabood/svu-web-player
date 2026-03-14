import { describe, it, expect, vi } from 'vitest';
import CanvasRenderer from '../src/core/CanvasRenderer';

describe('CanvasRenderer', () => {
  it('should initialize and request 2D context with willReadFrequently', () => {
    const mockContext = {
      fillRect: vi.fn(),
      putImageData: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(100) })),
      scale: vi.fn(),
    };
    
    const mockCanvas = {
      getContext: vi.fn(() => mockContext),
      width: 0,
      height: 0,
    };

    const renderer = new CanvasRenderer(mockCanvas, 800, 600);
    
    expect(mockCanvas.width).toBe(800);
    expect(mockCanvas.height).toBe(600);
    expect(mockCanvas.getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true });
    
    // Test base clear
    renderer.clearScale();
    expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
  });
});
