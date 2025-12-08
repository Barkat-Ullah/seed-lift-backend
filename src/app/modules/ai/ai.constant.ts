// utils/limit.ts
import NodeCache from 'node-cache';

const limitCache = new NodeCache();

export const DAILY_LIMIT = 200;
const KEY = 'daily_requests';

export const RequestLimiter = {
  increment: () => {
    const current = limitCache.get<number>(KEY) || 0;
    const next = current + 1;
    limitCache.set(KEY, next, 60 * 60 * 24);
    return next;
  },

  getCount: () => limitCache.get<number>(KEY) || 0,
  isExceeded: () => (limitCache.get<number>(KEY) || 0) >= DAILY_LIMIT,
  reset: () => limitCache.del(KEY),
};


const cache = new NodeCache({
  stdTTL: 60 * 60 * 24, 
  checkperiod: 120,
});

export const Cache = {
  get: (key: string) => cache.get(key),
  set: (key: string, value: any, ttl = 86400) => cache.set(key, value, ttl),
  has: (key: string) => cache.has(key),
};
