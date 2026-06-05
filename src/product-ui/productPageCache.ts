export interface ProductPageCacheRecord<T> {
  savedAt: string;
  data: T;
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function readProductPageCache<T>(key: string): ProductPageCacheRecord<T> | null {
  try {
    if (!canUseStorage()) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductPageCacheRecord<T>;
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeProductPageCache<T>(key: string, data: T) {
  try {
    if (!canUseStorage()) return;
    const record: ProductPageCacheRecord<T> = {
      savedAt: new Date().toISOString(),
      data,
    };
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // 缓存只用于减少二次进入卡顿，失败时不能影响真实后端流程。
  }
}

export function productPageCacheLabel(record: ProductPageCacheRecord<unknown> | null) {
  if (!record?.savedAt) return '无缓存';
  try {
    return new Date(record.savedAt).toLocaleString();
  } catch {
    return record.savedAt;
  }
}
