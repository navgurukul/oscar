import { load } from "@tauri-apps/plugin-store";

async function getStore() {
  return load("app-settings.json", { defaults: {} });
}

export async function loadSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const store = await getStore();
    const value = await store.get<T>(key);
    return value !== undefined && value !== null ? value : fallback;
  } catch {
    return fallback;
  }
}

export async function saveSetting<T>(key: string, value: T): Promise<void> {
  try {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
  } catch (error) {
    console.warn("[store] save failed:", error);
  }
}

export { getStore };
