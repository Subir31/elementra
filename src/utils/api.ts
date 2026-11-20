// Optional, read-only supplemental data. Every response is validated and
// bounded before it reaches the UI; the app works fully without it.

export interface ApiIsotope { stable: boolean; abundance: number | null; mass_number: number }
export interface ElementApiDetails {
  description?: string
  fun_fact?: string
  uses?: string
  named_after?: string
  isotopes?: ApiIsotope[]
}

const ELEMENTS_API_ORIGIN = 'https://api.periodictableofelements.org'
const WIKI_API_ORIGIN = 'https://en.wikipedia.org'
const API_TIMEOUT_MS = 8_000
const API_TEXT_LIMIT = 4_000
const API_MAX_ISOTOPES = 64

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function readStr(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.replace(/\s+/g, ' ').replace(/ -- /g, ' — ').trim()
  if (!s) return undefined
  return s.length <= max ? s : `${s.slice(0, max).trimEnd()}…`
}

function readNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function readInt(v: unknown, min: number, max: number): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined
}

export function parseElementDetails(v: unknown): ElementApiDetails | null {
  if (!isRecord(v)) return null
  const d: ElementApiDetails = {}
  const desc = readStr(v.description, API_TEXT_LIMIT); if (desc) d.description = desc
  const ff = readStr(v.fun_fact, API_TEXT_LIMIT); if (ff) d.fun_fact = ff
  const uses = readStr(v.uses, API_TEXT_LIMIT); if (uses) d.uses = uses
  const na = readStr(v.named_after, API_TEXT_LIMIT); if (na) d.named_after = na
  if (Array.isArray(v.isotopes)) {
    const seen = new Set<number>()
    const isos = v.isotopes.slice(0, API_MAX_ISOTOPES).flatMap(item => {
      if (!isRecord(item) || typeof item.stable !== 'boolean') return []
      const mn = readInt(item.mass_number, 1, 400)
      if (!mn || seen.has(mn)) return []
      seen.add(mn)
      const ra = readNum(item.abundance)
      const ab = ra !== undefined && ra >= 0 && ra <= 1 ? ra : null
      return [{ stable: item.stable, abundance: ab, mass_number: mn }]
    })
    if (isos.length > 0) d.isotopes = isos
  }
  return Object.keys(d).length > 0 ? d : null
}

async function fetchJson(path: string, base: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(new URL(path, base).toString(), {
    signal,
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    mode: 'cors',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ct = res.headers.get('content-type')?.toLowerCase() ?? ''
  if (ct && !ct.includes('application/json')) throw new Error('Bad content type')
  return res.json() as Promise<unknown>
}

function withTimeout(signal: AbortSignal): AbortSignal {
  return typeof AbortSignal.any === 'function' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.any([signal, AbortSignal.timeout(API_TIMEOUT_MS)])
    : signal
}

const detailsCache = new Map<number, ElementApiDetails | null>()
const imageCache = new Map<string, string | null>()

export async function fetchElementDetails(z: number, signal: AbortSignal): Promise<ElementApiDetails | null> {
  if (detailsCache.has(z)) return detailsCache.get(z) ?? null
  const details = parseElementDetails(await fetchJson(`/elements/${z}/`, ELEMENTS_API_ORIGIN, withTimeout(signal)))
  detailsCache.set(z, details)
  return details
}

export async function fetchWikiImage(name: string, signal: AbortSignal): Promise<string | null> {
  if (imageCache.has(name)) return imageCache.get(name) ?? null
  const data = await fetchJson(`/api/rest_v1/page/summary/${encodeURIComponent(name)}`, WIKI_API_ORIGIN, withTimeout(signal))
  const src = isRecord(data) && isRecord(data.thumbnail) ? readStr(data.thumbnail.source, 600) : undefined
  const safe = src && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(src) ? src : null
  imageCache.set(name, safe)
  return safe
}
