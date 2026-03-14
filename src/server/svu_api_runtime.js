const requireSearchParam = (searchParams, name) => {
  const value = searchParams.get(name);
  if (!value) {
    throw new Error(`Missing "${name}" parameter`);
  }
  return value;
};

export const normalizeSvuAction = (action) => {
  if (Array.isArray(action)) {
    return action[0] || '';
  }
  return String(action || '')
    .split('/')
    .filter(Boolean)[0] || '';
};

const parseSessionInfo = (searchParams) => {
  const sessionParam = requireSearchParam(searchParams, 'session');
  const sessionInfo = JSON.parse(decodeURIComponent(sessionParam));

  if (
    !sessionInfo.term ||
    !sessionInfo.program ||
    !sessionInfo.course_id ||
    !sessionInfo.tutor ||
    !sessionInfo.class_name
  ) {
    throw new Error('Session context is incomplete');
  }

  return sessionInfo;
};

export const runSvuMetadataAction = async ({ client, action, searchParams }) => {
  switch (action) {
    case 'init':
      return client.initialize();

    case 'term': {
      const termValue = requireSearchParam(searchParams, 'val');
      await client.initialize();
      return client.selectTerm(termValue);
    }

    case 'program': {
      const term = requireSearchParam(searchParams, 'term');
      const programValue = requireSearchParam(searchParams, 'val');
      await client.restoreState(term);
      return client.selectProgram(programValue);
    }

    case 'course': {
      const term = requireSearchParam(searchParams, 'term');
      const program = requireSearchParam(searchParams, 'program');
      const courseValue = requireSearchParam(searchParams, 'val');
      await client.restoreState(term, program);
      return client.selectCourse(courseValue);
    }

    case 'tutor': {
      const term = requireSearchParam(searchParams, 'term');
      const program = requireSearchParam(searchParams, 'program');
      const course = requireSearchParam(searchParams, 'course');
      const tutorValue = requireSearchParam(searchParams, 'val');
      await client.restoreState(term, program, course);
      return client.selectTutor(tutorValue);
    }

    case 'class': {
      const term = requireSearchParam(searchParams, 'term');
      const program = requireSearchParam(searchParams, 'program');
      const course = requireSearchParam(searchParams, 'course');
      const tutor = requireSearchParam(searchParams, 'tutor');
      const classValue = requireSearchParam(searchParams, 'val');
      const courseId = searchParams.get('courseId') || course;
      await client.restoreState(term, program, course, tutor);
      return client.selectClass(classValue, courseId);
    }

    case 'links': {
      const sessionInfo = parseSessionInfo(searchParams);
      await client.restoreState(
        sessionInfo.term,
        sessionInfo.program,
        sessionInfo.course_id,
        sessionInfo.tutor,
        sessionInfo.class_name
      );
      return client.fetchSessionLinks(sessionInfo);
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
