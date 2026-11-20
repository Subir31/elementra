import { useCallback, useLayoutEffect, useRef, useState } from 'react'

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

/**
 * useState that persists to localStorage and fails soft when storage is unavailable.
 * The first render always uses the fallback, so server-rendered HTML hydrates
 * cleanly; the saved value is read before the browser paints.
 */
export function useStoredState<T>(key: string, fallback: T, validate: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(fallback)
  const init = useRef({ fallback, validate })

  useLayoutEffect(() => {
    setValue(readStored(key, init.current.fallback, init.current.validate))
  }, [key])

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      if (v !== prev) writeStored(key, v)
      return v
    })
  }, [key])

  return [value, update] as const
}
