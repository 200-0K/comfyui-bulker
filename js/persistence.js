import { createState, serializeState } from "./state.js";

const STORAGE_KEY = "bulker.session.v1";

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createState();
    }

    return createState(JSON.parse(raw));
  } catch (error) {
    console.warn("[bulker] Failed to load state", error);
    return createState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState(state)));
  } catch (error) {
    console.warn("[bulker] Failed to save state", error);
  }
}
