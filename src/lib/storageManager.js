import localforage from 'localforage';

export const STORAGE_LIMIT_BYTES = 200 * 1024 * 1024;

export const STORAGE_REGISTRY_KEY = 'svu_storage_registry_v1';
export const AUDIO_CACHE_PREFIX = 'audio_pcm_timed_v2_';
export const THUMB_CACHE_PREFIX = 'thumb_';

const MANAGED_PREFIXES = ['svu_class_', 'svu_enriched_', 'svu_links_'];
const TEMP_KINDS = new Set(['temp-audio', 'temp-thumbnail', 'temp-metadata']);
const textEncoder = new TextEncoder();

let registryQueue = Promise.resolve();

const withRegistryLock = async (task) => {
  const queuedTask = registryQueue.then(task, task);
  registryQueue = queuedTask.catch(() => undefined);
  return queuedTask;
};

const sumSizes = (entries) =>
  entries.reduce((total, entry) => total + (Number.isFinite(entry?.size) ? entry.size : 0), 0);

const normalizeRegistry = (registry) =>
  registry && typeof registry === 'object' && !Array.isArray(registry) ? registry : {};

const getRegistryUnsafe = async () =>
  normalizeRegistry(await localforage.getItem(STORAGE_REGISTRY_KEY));

const saveRegistryUnsafe = async (registry) =>
  localforage.setItem(STORAGE_REGISTRY_KEY, registry);

const estimateStoredValueSize = (value) => {
  if (value == null) return 0;
  if (value instanceof Blob) return value.size;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (typeof value === 'string') return textEncoder.encode(value).length;

  try {
    return textEncoder.encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
};

export const formatStorageSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';

  const gigabytes = bytes / (1024 * 1024 * 1024);
  if (gigabytes >= 1) {
    return `${gigabytes.toFixed(2)} GB`;
  }

  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) {
    return `${megabytes.toFixed(1)} MB`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
};

export const getLectureStorageId = (fileLike = {}) => {
  const lectureId = [
    fileLike.storageId,
    fileLike.filename,
    fileLike.localFile?.name,
    fileLike.name,
    fileLike.id,
  ].find((value) => typeof value === 'string' && value.trim());

  return lectureId?.trim() || 'unknown_lecture';
};

export const getAudioCacheKey = (lectureId) => `${AUDIO_CACHE_PREFIX}${lectureId}`;
export const getThumbnailCacheKey = (lectureId) => `${THUMB_CACHE_PREFIX}${lectureId}`;

export const classifyStorageKey = (key) => {
  const normalizedKey = String(key || '').trim();

  if (!normalizedKey || normalizedKey === STORAGE_REGISTRY_KEY) {
    return { managed: false, removable: false, kind: 'system', groupId: null, priority: 99 };
  }

  if (normalizedKey.startsWith(AUDIO_CACHE_PREFIX)) {
    return {
      managed: true,
      removable: true,
      kind: 'temp-audio',
      groupId: normalizedKey.slice(AUDIO_CACHE_PREFIX.length),
      priority: 0,
    };
  }

  if (normalizedKey.startsWith(THUMB_CACHE_PREFIX)) {
    return {
      managed: true,
      removable: true,
      kind: 'temp-thumbnail',
      groupId: normalizedKey.slice(THUMB_CACHE_PREFIX.length),
      priority: 1,
    };
  }

  if (MANAGED_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))) {
    return {
      managed: true,
      removable: true,
      kind: 'temp-metadata',
      groupId: null,
      priority: 2,
    };
  }

  if (normalizedKey.toLowerCase().endsWith('.lrec')) {
    return {
      managed: true,
      removable: true,
      kind: 'lecture',
      groupId: normalizedKey,
      priority: 3,
    };
  }

  return { managed: false, removable: false, kind: 'other', groupId: null, priority: 99 };
};

const toRegistryEntry = (key, value, previousEntry = null, overrides = {}) => {
  const classification = classifyStorageKey(key);
  const now = Date.now();

  if (!classification.managed && !overrides.forceManage) {
    return null;
  }

  return {
    key,
    kind: overrides.kind || classification.kind,
    groupId: overrides.groupId ?? classification.groupId ?? null,
    removable: overrides.removable ?? classification.removable ?? true,
    priority: overrides.priority ?? classification.priority ?? 99,
    size: overrides.size ?? estimateStoredValueSize(value),
    lastAccessedAt: overrides.lastAccessedAt ?? previousEntry?.lastAccessedAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
};

const writeRegistryEntry = async (key, value, overrides = {}) => withRegistryLock(async () => {
  const registry = await getRegistryUnsafe();
  const nextEntry = toRegistryEntry(key, value, registry[key], overrides);

  if (!nextEntry) {
    delete registry[key];
  } else {
    registry[key] = nextEntry;
  }

  await saveRegistryUnsafe(registry);
  return registry[key] ?? null;
});

const deleteRegistryKeys = async (keys) => withRegistryLock(async () => {
  const registry = await getRegistryUnsafe();
  let changed = false;

  keys.forEach((key) => {
    if (registry[key]) {
      delete registry[key];
      changed = true;
    }
  });

  if (changed) {
    await saveRegistryUnsafe(registry);
  }
});

export const syncStorageRegistry = async () => {
  if (typeof localforage.ready === 'function') await localforage.ready();

  return withRegistryLock(async () => {
    const registry = await getRegistryUnsafe();
    const keys = await localforage.keys();
    const presentKeys = new Set(keys);
    let changed = false;

    Object.keys(registry).forEach((key) => {
      if (!presentKeys.has(key) || key === STORAGE_REGISTRY_KEY) {
        delete registry[key];
        changed = true;
      }
    });

    for (const key of keys) {
      if (key === STORAGE_REGISTRY_KEY) continue;

      const previousEntry = registry[key] ?? null;
      const classification = classifyStorageKey(key);

      if (!classification.managed && !previousEntry) {
        continue;
      }

      if (
        previousEntry &&
        previousEntry.kind === classification.kind &&
        previousEntry.groupId === classification.groupId &&
        previousEntry.priority === classification.priority &&
        Number.isFinite(previousEntry.size)
      ) {
        continue;
      }

      const value = await localforage.getItem(key);
      const nextEntry = toRegistryEntry(key, value, previousEntry);

      if (nextEntry) {
        registry[key] = nextEntry;
      } else {
        delete registry[key];
      }

      changed = true;
    }

    if (changed) {
      await saveRegistryUnsafe(registry);
    }

    return registry;
  });
};

export const getStorageStats = async ({ refresh = true } = {}) => {
  if (typeof localforage.ready === 'function') await localforage.ready();
  const registry = refresh ? await syncStorageRegistry() : await getRegistryUnsafe();
  const entries = Object.values(registry);

  const lectureEntries = entries.filter((entry) => entry.kind === 'lecture');
  const temporaryEntries = entries.filter((entry) => TEMP_KINDS.has(entry.kind));

  const totalBytes = sumSizes(entries);
  const lectureBytes = sumSizes(lectureEntries);
  const temporaryBytes = sumSizes(temporaryEntries);

  return {
    totalBytes,
    lectureBytes,
    temporaryBytes,
    lectureCount: lectureEntries.length,
    temporaryCount: temporaryEntries.length,
    limitBytes: STORAGE_LIMIT_BYTES,
  };
};

export const getStoredLectureSummaries = async () => {
  const registry = await syncStorageRegistry();
  const entriesByKey = new Map(Object.entries(registry));
  const keys = await localforage.keys();

  return keys
    .filter((key) => key.toLowerCase().endsWith('.lrec'))
    .map((key) => {
      const entry = entriesByKey.get(key);
      return {
        filename: key,
        storageId: key,
        size: entry?.size ?? 0,
        lastAccessedAt: entry?.lastAccessedAt ?? 0,
      };
    })
    .sort((left, right) => (right.lastAccessedAt || 0) - (left.lastAccessedAt || 0));
};

export const getManagedItem = async (key, overrides = {}) => {
  if (typeof localforage.ready === 'function') await localforage.ready();
  const value = await localforage.getItem(key);

  if (value != null) {
    await writeRegistryEntry(key, value, {
      ...overrides,
      lastAccessedAt: Date.now(),
    });
  }

  return value;
};

export const touchManagedKeys = async (keys) => {
  if (typeof localforage.ready === 'function') await localforage.ready();

  for (const key of keys) {
    if (!key) continue;
    const value = await localforage.getItem(key);
    if (value != null) {
      await writeRegistryEntry(key, value, {
        lastAccessedAt: Date.now(),
      });
    }
  }
};

export const setManagedItem = async (key, value, overrides = {}) => {
  if (typeof localforage.ready === 'function') await localforage.ready();
  await localforage.setItem(key, value);
  await writeRegistryEntry(key, value, {
    ...overrides,
    lastAccessedAt: Date.now(),
  });
  return value;
};

export const removeManagedItem = async (key) => {
  if (typeof localforage.ready === 'function') await localforage.ready();
  await localforage.removeItem(key);
  await deleteRegistryKeys([key]);
};

export const clearTemporaryStorage = async ({ preserveLectureIds = [] } = {}) => {
  if (typeof localforage.ready === 'function') await localforage.ready();

  const preservedIds = new Set(preserveLectureIds.filter(Boolean));
  const registry = await syncStorageRegistry();
  const candidates = Object.values(registry)
    .filter((entry) => TEMP_KINDS.has(entry.kind))
    .filter((entry) => !entry.groupId || !preservedIds.has(entry.groupId))
    .sort((left, right) =>
      (left.priority - right.priority) ||
      ((left.lastAccessedAt || 0) - (right.lastAccessedAt || 0))
    );

  const deletedKeys = [];
  let freedBytes = 0;

  for (const candidate of candidates) {
    await localforage.removeItem(candidate.key);
    deletedKeys.push(candidate.key);
    freedBytes += candidate.size || 0;
  }

  if (deletedKeys.length > 0) {
    await deleteRegistryKeys(deletedKeys);
  }

  return {
    deletedKeys,
    freedBytes,
    ...(await getStorageStats()),
  };
};

export const removeLectureAssets = async (lectureId, { aliases = [] } = {}) => {
  if (typeof localforage.ready === 'function') await localforage.ready();

  const candidateIds = new Set([lectureId, ...aliases].filter(Boolean));
  const registry = await syncStorageRegistry();
  const explicitKeys = new Set();

  candidateIds.forEach((id) => {
    explicitKeys.add(id);
    explicitKeys.add(getAudioCacheKey(id));
    explicitKeys.add(getThumbnailCacheKey(id));
  });

  Object.values(registry).forEach((entry) => {
    if (candidateIds.has(entry.key) || (entry.groupId && candidateIds.has(entry.groupId))) {
      explicitKeys.add(entry.key);
    }
  });

  const deletedKeys = [];
  let freedBytes = 0;

  for (const key of explicitKeys) {
    const value = await localforage.getItem(key);
    if (value == null) continue;

    freedBytes += estimateStoredValueSize(value);
    await localforage.removeItem(key);
    deletedKeys.push(key);
  }

  if (deletedKeys.length > 0) {
    await deleteRegistryKeys(deletedKeys);
  }

  return {
    deletedKeys,
    freedBytes,
    ...(await getStorageStats()),
  };
};

export const pruneStorageToLimit = async ({ activeLectureId = null } = {}) => {
  if (typeof localforage.ready === 'function') await localforage.ready();

  const registry = await syncStorageRegistry();
  const allEntries = Object.values(registry).filter((entry) => entry.removable);
  let totalBytes = sumSizes(allEntries);

  if (totalBytes <= STORAGE_LIMIT_BYTES) {
    return {
      didPrune: false,
      deletedKeys: [],
      freedBytes: 0,
      totalBytes,
      limitBytes: STORAGE_LIMIT_BYTES,
    };
  }

  const candidates = allEntries
    .filter((entry) => entry.key !== activeLectureId && entry.groupId !== activeLectureId)
    .sort((left, right) =>
      (left.priority - right.priority) ||
      ((left.lastAccessedAt || 0) - (right.lastAccessedAt || 0))
    );

  const deletedKeys = [];
  let freedBytes = 0;

  for (const candidate of candidates) {
    await localforage.removeItem(candidate.key);
    deletedKeys.push(candidate.key);
    freedBytes += candidate.size || 0;
    totalBytes -= candidate.size || 0;

    if (totalBytes <= STORAGE_LIMIT_BYTES) {
      break;
    }
  }

  if (deletedKeys.length > 0) {
    await deleteRegistryKeys(deletedKeys);
  }

  return {
    didPrune: deletedKeys.length > 0,
    deletedKeys,
    freedBytes,
    totalBytes: Math.max(totalBytes, 0),
    limitBytes: STORAGE_LIMIT_BYTES,
  };
};
