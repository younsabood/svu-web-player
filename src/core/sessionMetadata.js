const INVALID_TITLE_PATTERN = /\b(?:undefined|null|nan)\b/i;

export const getSessionSequence = (session, index = 0) => {
  const parsedOrder = Number.parseInt(String(session?.order ?? '').trim(), 10);
  if (Number.isFinite(parsedOrder) && parsedOrder > 0) {
    return parsedOrder;
  }

  return index + 1;
};

export const createSessionPlaceholder = (session, index = 0) =>
  `s${getSessionSequence(session, index)}`;

export const sanitizeSessionTitle = (title) => {
  if (typeof title !== 'string') {
    return '';
  }

  const cleanedTitle = title.replace(/\s+/g, ' ').trim();
  if (!cleanedTitle || INVALID_TITLE_PATTERN.test(cleanedTitle)) {
    return '';
  }

  return cleanedTitle;
};

export const extractSessionDisplayTitle = (title, fallbackTitle = '') => {
  const normalizedTitle = sanitizeSessionTitle(title);
  if (!normalizedTitle) {
    return fallbackTitle;
  }

  const segments = normalizedTitle
    .split(/\s+-\s+/)
    .map((segment) => sanitizeSessionTitle(segment))
    .filter(Boolean);

  return segments.at(-1) || fallbackTitle;
};

export const resolveSessionTitles = ({ session, index = 0, title, fallbackTitle = '' } = {}) => {
  const placeholderTitle = sanitizeSessionTitle(fallbackTitle) || createSessionPlaceholder(session, index);
  const resolvedTitle = sanitizeSessionTitle(title) || placeholderTitle;

  return {
    title: resolvedTitle,
    displayTitle: extractSessionDisplayTitle(resolvedTitle, placeholderTitle),
    placeholderTitle,
  };
};
