// Native: expo-sqlite provides a persistent localStorage (no 2 KB SecureStore limit).
import 'expo-sqlite/localStorage/install';

export const authStorage = globalThis.localStorage;
