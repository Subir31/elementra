import { useCallback, useEffect, useRef, useState } from 'react'

export function readStored<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  try {
    const rawValue = localStorage.getItem(key)
    if (rawValue == null) return fallback
    const parsed: unknown = JSON.parse(rawValue)
    return validate(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be full or blocked (private mode); progress is a convenience.
  }
}

/** useState that persists to localStorage and fails soft when storage is unavailable. */
export function useStoredState<T>(key: string, fallback: T, validate: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback, validate))
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    writeStored(key, value)
  }, [key, value])

  const update = useCallback((next: T | ((prev: T) => T)) => setValue(next), [])
  return [value, update] as const
}
