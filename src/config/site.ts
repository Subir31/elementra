// Site-wide constants shared by the app, the server renderer and the build scripts.

export const SITE_URL = 'https://elementra.subirhazra.com'
export const SITE_NAME = 'Elementra'

export const PAGE_PATHS = { explore: '/', practice: '/practice', tools: '/tools' } as const
export type PageView = keyof typeof PAGE_PATHS

export function elementSlug(el: { name: string }): string {
  return el.name.toLowerCase()
}

export function elementPath(el: { name: string }): string {
  return `/element/${elementSlug(el)}`
}

export function absoluteUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}
