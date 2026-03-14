import { describe, expect, it } from 'vitest';
import {
  createSessionPlaceholder,
  extractSessionDisplayTitle,
  resolveSessionTitles,
  sanitizeSessionTitle,
} from '../src/core/sessionMetadata.js';

describe('sessionMetadata', () => {
  it('builds lowercase fallback placeholders from order or index', () => {
    expect(createSessionPlaceholder({ order: '3' }, 0)).toBe('s3');
    expect(createSessionPlaceholder({}, 4)).toBe('s5');
  });

  it('rejects broken undefined titles from SVU metadata', () => {
    expect(sanitizeSessionTitle('BMN101 - undefined جلسة')).toBe('');
    expect(sanitizeSessionTitle('   ')).toBe('');
  });

  it('extracts a display title from compound course titles', () => {
    expect(extractSessionDisplayTitle('BMN101 - Session 4', 's4')).toBe('Session 4');
    expect(extractSessionDisplayTitle('', 's4')).toBe('s4');
  });

  it('falls back to placeholders when link metadata is missing or broken', () => {
    expect(
      resolveSessionTitles({
        session: { order: '2' },
        index: 1,
        title: 'BMN101 - undefined جلسة',
      })
    ).toEqual({
      title: 's2',
      displayTitle: 's2',
      placeholderTitle: 's2',
    });
  });
});
