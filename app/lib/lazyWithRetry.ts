import { lazy, type ComponentType } from 'react';

const CHUNK_LOAD_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed/i;

export function lazyWithRetry<T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>,
  key: string,
) {
  return lazy(async () => {
    try {
      const module = await importer();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`lazy-retry:${key}`);
      }
      return module;
    } catch (error) {
      if (
        typeof window !== 'undefined'
        && error instanceof Error
        && CHUNK_LOAD_ERROR.test(error.message)
      ) {
        const markerKey = `lazy-retry:${key}`;
        const hasRetried = sessionStorage.getItem(markerKey) === '1';

        if (!hasRetried) {
          sessionStorage.setItem(markerKey, '1');
          window.location.reload();
          return new Promise(() => {});
        }
      }

      throw error;
    }
  });
}
