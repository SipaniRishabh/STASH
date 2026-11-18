// Browser-only persistence. Every access is wrapped: storage can be blocked (private mode, cleared data).
import { useEffect, useState } from "react";

const P = "jobber:";

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(P + key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(P + key);
    else localStorage.setItem(P + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: app still works for this session */
  }
}

export function useStored(key, fallback) {
  const [v, setV] = useState(() => load(key, fallback));
  useEffect(() => save(key, v), [key, v]);
  return [v, setV];
}

export function forgetEverything() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
