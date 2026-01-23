/**
 * Safe Storage Utilities
 *
 * Provides safe localStorage/sessionStorage access that gracefully handles
 * restricted environments (incognito mode, disabled cookies, SSR, etc.)
 */

type StorageType = 'local' | 'session';

function getStorage(type: StorageType): Storage | null {
  if (typeof window === 'undefined') return null;
  return type === 'local' ? window.localStorage : window.sessionStorage;
}

/**
 * Safely get an item from storage.
 * Returns null if storage is unavailable or access is denied.
 */
export function safeGetItem(key: string, storage: StorageType = 'local'): string | null {
  try {
    const store = getStorage(storage);
    if (!store) return null;
    return store.getItem(key);
  } catch (error) {
    console.warn(`[SafeStorage] Failed to get "${key}" from ${storage}Storage:`, error);
    return null;
  }
}

/**
 * Safely set an item in storage.
 * Returns true if successful, false if storage is unavailable or access is denied.
 */
export function safeSetItem(key: string, value: string, storage: StorageType = 'local'): boolean {
  try {
    const store = getStorage(storage);
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[SafeStorage] Failed to set "${key}" in ${storage}Storage:`, error);
    return false;
  }
}

/**
 * Safely remove an item from storage.
 * Returns true if successful, false if storage is unavailable or access is denied.
 */
export function safeRemoveItem(key: string, storage: StorageType = 'local'): boolean {
  try {
    const store = getStorage(storage);
    if (!store) return false;
    store.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[SafeStorage] Failed to remove "${key}" from ${storage}Storage:`, error);
    return false;
  }
}
