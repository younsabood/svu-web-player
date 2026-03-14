import { describe, expect, it } from 'vitest';
import {
  AUDIO_CACHE_PREFIX,
  STORAGE_LIMIT_BYTES,
  THUMB_CACHE_PREFIX,
  classifyStorageKey,
  formatStorageSize,
  getAudioCacheKey,
  getLectureStorageId,
  getThumbnailCacheKey,
} from '../src/lib/storageManager.js';

describe('storageManager helpers', () => {
  it('builds stable lecture ids from filenames before volatile ids', () => {
    expect(getLectureStorageId({ filename: 'lecture01.lrec', id: 'session_5' })).toBe('lecture01.lrec');
    expect(getLectureStorageId({ localFile: { name: 'local-file.lrec' } })).toBe('local-file.lrec');
  });

  it('creates predictable cache keys for lecture assets', () => {
    expect(getAudioCacheKey('lecture01.lrec')).toBe(`${AUDIO_CACHE_PREFIX}lecture01.lrec`);
    expect(getThumbnailCacheKey('lecture01.lrec')).toBe(`${THUMB_CACHE_PREFIX}lecture01.lrec`);
  });

  it('classifies removable storage keys by priority', () => {
    expect(classifyStorageKey('audio_pcm_timed_v2_lecture01.lrec')).toMatchObject({ kind: 'temp-audio', priority: 0 });
    expect(classifyStorageKey('thumb_lecture01.lrec')).toMatchObject({ kind: 'temp-thumbnail', priority: 1 });
    expect(classifyStorageKey('svu_links_course_session')).toMatchObject({ kind: 'temp-metadata', priority: 2 });
    expect(classifyStorageKey('lecture01.lrec')).toMatchObject({ kind: 'lecture', priority: 3 });
  });

  it('formats the configured storage limit in human readable units', () => {
    expect(formatStorageSize(STORAGE_LIMIT_BYTES)).toBe('200.0 MB');
  });
});
