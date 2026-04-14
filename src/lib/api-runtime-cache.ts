type CacheEntry<T> = {
  data: T;
  expiry: number;
};

type RuntimeCacheStore = Map<string, CacheEntry<unknown>>;

const DEFAULT_TTL_MS = 30_000;
const CACHE_NS = "__bgosApiRuntimeCache__";

function getStore(): RuntimeCacheStore {
  const g = globalThis as typeof globalThis & { [CACHE_NS]?: RuntimeCacheStore };
  if (!g[CACHE_NS]) g[CACHE_NS] = new Map<string, CacheEntry<unknown>>();
  return g[CACHE_NS]!;
}

export function getApiCache<T>(key: string): T | null {
  const item = getStore().get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    getStore().delete(key);
    return null;
  }
  return item.data as T;
}

export function setApiCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  getStore().set(key, { data, expiry: Date.now() + ttlMs });
}

export function deleteApiCache(key: string): void {
  getStore().delete(key);
}

export function deleteApiCacheByPrefix(prefix: string): void {
  const store = getStore();
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
