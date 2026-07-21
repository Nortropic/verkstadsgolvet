/**
 * Enkel in-memory TTL-cache. Railway kör en långlivad Node-process (`next start`),
 * så modul-nivå-cachen överlever mellan requests. Skyddar GitHubs rate limit
 * (5000/h autentiserat) när flera flikar/paneler pollar.
 */
type Entry = { expires: number; value: unknown };

const store = new Map<string, Entry>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;

  const value = await fn();
  store.set(key, { expires: now + ttlMs, value });
  return value;
}

export function invalidate(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
