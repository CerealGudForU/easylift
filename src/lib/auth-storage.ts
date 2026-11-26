// Web/PWA: the browser's own localStorage (avoids loading SQLite's WASM build on web).
export const authStorage = typeof window === 'undefined' ? undefined : window.localStorage;
