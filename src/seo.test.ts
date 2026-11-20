import { describe, expect, it } from 'vitest'
import { ELEMENTS } from './data/elements'
import { parseRoute } from './hooks/useRouter'
import { PRERENDER_PATHS, elementFaq, elementIntro, headForPath, robotsTxt, routeMeta, sitemapXml } from './seo'

describe('page metadata', () => {
  it('has a unique title and a description of search-friendly length on every page', () => {
    const metas = PRERENDER_PATHS.map(p => routeMeta(parseRoute(p)))
    expect(new Set(metas.map(m => m.title)).size).toBe(metas.length)
    expect(new Set(metas.map(m => m.description)).size).toBe(metas.length)
    for (const m of metas) {
      expect(m.title.length, m.title).toBeLessThanOrEqual(70)
      expect(m.description.length, m.description).toBeGreaterThanOrEqual(70)
      expect(m.description.length, m.description).toBeLessThanOrEqual(165)
      expect(m.noindex).toBeFalsy()
    }
  })

  it('writes canonical, social and structured-data tags', () => {
    const head = headForPath('/element/iron')
    expect(head).toContain('<link rel="canonical" href="https://elementra.subirhazra.com/element/iron" />')
    expect(head).toContain('<title>Iron (Fe) – Element 26: Properties &amp; Facts | Elementra</title>')
    expect(head).toContain('og:image')
    const ld = [...head.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]))
    expect(ld.map(o => o['@type'])).toEqual(['BreadcrumbList', 'FAQPage'])
  })

  it('keeps the 404 page out of search results', () => {
    const head = headForPath('/404')
    expect(head).toContain('noindex')
    expect(head).not.toContain('rel="canonical"')
  })

  it('lists every page in the sitemap and points robots.txt at it', () => {
    const xml = sitemapXml('2026-01-01')
    expect(xml.match(/<url>/g)).toHaveLength(121)
    expect(xml).toContain('<loc>https://elementra.subirhazra.com/element/oganesson</loc>')
    expect(robotsTxt()).toContain('Sitemap: https://elementra.subirhazra.com/sitemap.xml')
  })
})

describe('element page content', () => {
  it('writes an overview and answers for every element without gaps', () => {
    for (const el of ELEMENTS) {
      const text = [...elementIntro(el), ...elementFaq(el).flatMap(f => [f.q, f.a])].join(' ')
      expect(text, el.name).not.toMatch(/undefined|null|NaN|\s{2}/)
    }
  })

  it('gets the facts right for familiar elements', () => {
    const oxygen = ELEMENTS[7]
    const faq = elementFaq(oxygen)
    expect(faq.find(f => f.q.includes('valence'))?.a).toBe('Oxygen has 6 valence electrons, its group number (16) minus 10.')
    expect(faq.find(f => f.q.includes('a metal'))?.a).toMatch(/^No\./)
    expect(elementIntro(oxygen)[1]).toContain('At room temperature oxygen is a gas.')
    const neon = elementFaq(ELEMENTS[9]).find(f => f.q.startsWith('Where'))?.a
    expect(neon).toContain('among the noble gases')
  })
})
