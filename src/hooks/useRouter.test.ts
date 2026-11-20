import { describe, expect, it } from 'vitest'
import { ELEMENTS } from '../data/elements'
import { elementPath, elementSlug } from '../config/site'
import { legacyHashPath, normalizePath, parseRoute } from './useRouter'

describe('routing', () => {
  it('gives every element a unique, URL-safe slug', () => {
    const slugs = ELEMENTS.map(elementSlug)
    expect(new Set(slugs).size).toBe(118)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+$/)
  })

  it('parses page and element routes', () => {
    expect(parseRoute('/')).toEqual({ view: 'explore' })
    expect(parseRoute('/practice')).toEqual({ view: 'practice' })
    expect(parseRoute('/tools')).toEqual({ view: 'tools' })
    const iron = ELEMENTS[25]
    expect(parseRoute(elementPath(iron))).toEqual({ view: 'element', element: iron })
  })

  it('tolerates trailing slashes, .html, case and query strings', () => {
    expect(normalizePath('/Element/Iron/')).toBe('/element/iron')
    expect(normalizePath('/element/iron.html?x=1#top')).toBe('/element/iron')
    expect(normalizePath('/index.html')).toBe('/')
    expect(parseRoute('/practice.html').view).toBe('practice')
  })

  it('reports unknown pages as not found', () => {
    expect(parseRoute('/element/unobtainium')).toEqual({ view: 'notfound', path: '/element/unobtainium' })
    expect(parseRoute('/learn').view).toBe('notfound')
  })

  it('maps the old hash routes to real paths', () => {
    expect(legacyHashPath('#/learn')).toBe('/practice')
    expect(legacyHashPath('#/quiz')).toBe('/practice')
    expect(legacyHashPath('#/tools')).toBe('/tools')
    expect(legacyHashPath('#/')).toBe('/')
    expect(legacyHashPath('#main')).toBeNull()
    expect(legacyHashPath('')).toBeNull()
  })
})
