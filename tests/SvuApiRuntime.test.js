import { describe, expect, it, vi } from 'vitest';
import { normalizeSvuAction, runSvuMetadataAction } from '../src/server/svu_api_runtime.js';

const createMockClient = () => ({
  initialize: vi.fn(async () => ['init']),
  restoreState: vi.fn(async () => undefined),
  selectTerm: vi.fn(async () => ['term']),
  selectProgram: vi.fn(async () => ['program']),
  selectCourse: vi.fn(async () => ['course']),
  selectTutor: vi.fn(async () => ['tutor']),
  selectClass: vi.fn(async () => ['class']),
  fetchSessionLinks: vi.fn(async () => ['links']),
});

describe('svu_api_runtime', () => {
  it('normalizes action values from arrays and strings', () => {
    expect(normalizeSvuAction(['term'])).toBe('term');
    expect(normalizeSvuAction('class/extra')).toBe('class');
  });

  it('initializes before loading programs for a term', async () => {
    const client = createMockClient();
    const searchParams = new URLSearchParams({ val: 'F24' });

    const result = await runSvuMetadataAction({ client, action: 'term', searchParams });

    expect(result).toEqual(['term']);
    expect(client.initialize).toHaveBeenCalledTimes(1);
    expect(client.selectTerm).toHaveBeenCalledWith('F24');
  });

  it('restores prior state before loading courses and classes', async () => {
    const client = createMockClient();

    await runSvuMetadataAction({
      client,
      action: 'program',
      searchParams: new URLSearchParams({ term: 'F24', val: 'BIMM' }),
    });
    await runSvuMetadataAction({
      client,
      action: 'class',
      searchParams: new URLSearchParams({
        term: 'F24',
        program: 'BIMM',
        course: 'PM',
        tutor: 'DR1',
        val: 'A',
      }),
    });

    expect(client.restoreState).toHaveBeenNthCalledWith(1, 'F24');
    expect(client.selectProgram).toHaveBeenCalledWith('BIMM');
    expect(client.restoreState).toHaveBeenNthCalledWith(2, 'F24', 'BIMM', 'PM', 'DR1');
    expect(client.selectClass).toHaveBeenCalledWith('A', 'PM');
  });

  it('restores full session context before fetching links', async () => {
    const client = createMockClient();
    const session = {
      term: 'F24',
      program: 'BIMM',
      course_id: 'PM',
      tutor: 'DR1',
      class_name: 'A',
      event_argument: 'Select$1',
    };

    await runSvuMetadataAction({
      client,
      action: 'links',
      searchParams: new URLSearchParams({ session: JSON.stringify(session) }),
    });

    expect(client.restoreState).toHaveBeenCalledWith('F24', 'BIMM', 'PM', 'DR1', 'A');
    expect(client.fetchSessionLinks).toHaveBeenCalledWith(session);
  });
});
