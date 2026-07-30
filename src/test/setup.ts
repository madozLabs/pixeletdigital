import "@testing-library/jest-dom/vitest";

// Node >=22 defines a global `localStorage` accessor that returns undefined
// unless the process is started with --localstorage-file. Because it's
// configurable, it shadows jsdom's own window.localStorage before jsdom can
// install a working one. Replace it with a minimal in-memory Storage so
// components that read localStorage (e.g. sidebar-collapsed persistence)
// work the same in tests as they do in a real browser.
class MemoryStorage implements Storage {
  #store = new Map<string, string>();

  get length(): number {
    return this.#store.size;
  }

  clear(): void {
    this.#store.clear();
  }

  getItem(key: string): string | null {
    return this.#store.has(key) ? this.#store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.#store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#store.set(key, String(value));
  }
}

for (const target of [globalThis, window]) {
  Object.defineProperty(target, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}
