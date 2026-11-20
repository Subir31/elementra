// Page titles, descriptions, structured data and the written content of the
// element pages. Used by the app (document titles), the server renderer and
// the prerender script, so it must stay free of browser-only APIs.

import { CATEGORY_META, ELEMENTS, formatNumber, type Element } from './data/elements'
import { SYMBOL_STORIES } from './data/learning'
import { PAGE_PATHS, SITE_NAME, absoluteUrl, elementPath } from './config/site'
import { parseRoute, type Route } from './hooks/useRouter'
import { formatDensity, kelvinToCelsius, prettyConfig } from './utils/format'

export interface PageMeta {
  title: string
  description: string
  path: string
  noindex?: boolean
  jsonLd: object[]
}

export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630, alt: 'Elementra — the interactive periodic table for students' }

const an = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const mass = (el: Element) => formatNumber(el.atomicMass, 3)
const celsius = (k: number) => formatNumber(kelvinToCelsius(k), 0)
const categoryOf = (el: Element) => lower(CATEGORY_META[el.categoryKey].label)
const withArticle = (el: Element) => `${an(categoryOf(el))} ${categoryOf(el)}`
const place = (p: string) => p.replace(/\bThe\b/g, 'the')
const plural = (s: string) => (s.endsWith('gas') ? `${s}es` : `${s}s`)

export function elementPosition(el: Element): string {
  if (el.group) return `group ${el.group}, period ${el.period}`
  return `period ${el.period}, in the ${el.categoryKey === 'lanthanide' ? 'lanthanide' : 'actinide'} series`
}

export function elementTitle(el: Element): string {
  return `${el.name} (${el.symbol}) – Element ${el.atomicNumber}: Properties & Facts | ${SITE_NAME}`
}

export function elementDescription(el: Element): string {
  return `${el.name} (${el.symbol}) is ${withArticle(el)} with atomic number ${el.atomicNumber} and atomic mass ${mass(el)} u. `
    + 'See its electron configuration, properties, Bohr model and memory tricks.'
}

function discoverySentence(el: Element): string | null {
  const { discoveryYear: year, discoveredBy: by, discoveryPlace: where } = el
  if (year != null && year < 0) {
    return `${el.name} has been known since ancient times (around ${formatNumber(-year, 0)} BC${where ? `, ${place(where)}` : ''}).`
  }
  if (year == null && !by) return null
  const parts = [`${el.name} was discovered`]
  if (by) parts.push(`by ${by}`)
  if (year != null) parts.push(`in ${year}`)
  if (where) parts.push(`in ${place(where)}`)
  return `${parts.join(' ')}.`
}

/** A short, original overview of the element, written from the data. */
export function elementIntro(el: Element): string[] {
  const name = el.name
  const lname = name.toLowerCase()
  const first = [
    `${name} (${el.symbol}) is ${withArticle(el)} with atomic number ${el.atomicNumber}.`,
    `It sits in ${elementPosition(el)} of the periodic table, in the ${el.block}-block.`,
    `A neutral ${lname} atom has ${el.atomicNumber} protons and ${el.atomicNumber} electrons`
      + (el.shells.length ? `, arranged in ${el.shells.length} shell${el.shells.length === 1 ? '' : 's'} (${el.shells.join(', ')}).` : '.'),
  ]
  if (el.radioactive) first.push(`${name} is radioactive.`)

  const mp = el.meltingPointK
  const bp = el.boilingPointK
  const second = [
    mp == null && bp == null
      ? `${name} is expected to be ${an(el.state)} ${el.state.toLowerCase()} at room temperature, but its melting and boiling points have not been measured.`
      : `At room temperature ${lname} is ${an(el.state)} ${el.state.toLowerCase()}.`,
  ]
  if (mp != null && bp != null) second.push(`It melts at ${celsius(mp)} °C (${formatNumber(mp, 0)} K) and boils at ${celsius(bp)} °C (${formatNumber(bp, 0)} K).`)
  else if (mp != null) second.push(`It melts at ${celsius(mp)} °C (${formatNumber(mp, 0)} K).`)
  else if (bp != null) second.push(`It boils at ${celsius(bp)} °C (${formatNumber(bp, 0)} K).`)
  if (el.density != null) second.push(`Its density is ${formatDensity(el.density)}.`)

  const third = [`Its atomic mass is ${mass(el)} u, so one mole of ${lname} has a mass of about ${mass(el)} grams.`]
  if (el.electronegativity != null) third.push(`Its electronegativity is ${formatNumber(el.electronegativity, 2)} on the Pauling scale.`)
  const discovery = discoverySentence(el)
  if (discovery) third.push(discovery)
  const story = SYMBOL_STORIES[el.symbol]
  if (story) third.push(`Its symbol ${el.symbol} comes from ${story.origin}, its ${story.language} name.`)

  return [first.join(' '), second.join(' '), third.join(' ')]
}

export interface Faq { q: string; a: string }

/** Answers to the questions students most often search for. */
export function elementFaq(el: Element): Faq[] {
  const name = el.name
  const lname = name.toLowerCase()
  const faq: Faq[] = [
    { q: `What is the atomic number of ${lname}?`, a: `The atomic number of ${lname} is ${el.atomicNumber}, so every ${lname} atom has ${el.atomicNumber} protons in its nucleus.` },
    { q: `What is the atomic mass of ${lname}?`, a: `The atomic mass of ${lname} is ${mass(el)} u, which means its molar mass is about ${mass(el)} g/mol.` },
  ]

  const short = prettyConfig(el.electronConfigurationSemantic)
  const full = prettyConfig(el.electronConfiguration)
  faq.push({
    q: `What is the electron configuration of ${lname}?`,
    a: short === full ? `The electron configuration of ${lname} is ${full}.` : `The electron configuration of ${lname} is ${short}. Written out in full it is ${full}.`,
  })

  if (el.valenceElectrons != null) {
    const v = el.valenceElectrons
    const why = el.atomicNumber === 2 ? 'which fill its only shell'
      : el.group != null && el.group <= 2 ? 'the same as its group number'
        : `its group number (${el.group}) minus 10`
    faq.push({ q: `How many valence electrons does ${lname} have?`, a: `${name} has ${v} valence electron${v === 1 ? '' : 's'}, ${why}.` })
  }

  faq.push({
    q: `Is ${lname} a metal?`,
    a: el.metalType === 'Metal' ? `Yes. ${name} is a metal — specifically ${withArticle(el)}.`
      : el.metalType === 'Metalloid' ? `${name} is a metalloid: its properties sit between those of metals and nonmetals.`
        : `No. ${name} is a nonmetal (${withArticle(el)}).`,
  })

  faq.push({
    q: `Where is ${lname} on the periodic table?`,
    a: `${name} is in ${elementPosition(el)} of the periodic table, in the ${el.block}-block, among the ${plural(categoryOf(el))}.`,
  })

  const mp = el.meltingPointK
  faq.push({
    q: `Is ${lname} a solid, liquid or gas?`,
    a: mp == null && el.boilingPointK == null
      ? `${name} is expected to be ${an(el.state)} ${el.state.toLowerCase()} at room temperature, though too little has been made to measure it.`
      : `${name} is ${an(el.state)} ${el.state.toLowerCase()} at room temperature (25 °C)${mp != null ? ` and melts at ${celsius(mp)} °C` : ''}.`,
  })

  const discovery = discoverySentence(el)
  if (discovery) faq.push({ q: `Who discovered ${lname}?`, a: discovery })
  return faq
}

/* ── Page metadata ── */
const HOME_DESCRIPTION = 'Free interactive periodic table of all 118 elements with trends, electron configurations, mnemonics, flashcards and quizzes. Built for students.'

function breadcrumbs(items: [string, string][]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absoluteUrl(path) })),
  }
}

export function routeMeta(route: Route): PageMeta {
  switch (route.view) {
    case 'explore':
      return {
        title: `Interactive Periodic Table for Students | ${SITE_NAME}`,
        description: HOME_DESCRIPTION,
        path: PAGE_PATHS.explore,
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: absoluteUrl('/'), inLanguage: 'en' },
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: SITE_NAME,
            url: absoluteUrl('/'),
            description: HOME_DESCRIPTION,
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Any',
            isAccessibleForFree: true,
            educationalLevel: 'Secondary school',
            about: { '@type': 'Thing', name: 'Periodic table of the chemical elements' },
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          },
        ],
      }
    case 'practice': {
      const description = 'Memorise the periodic table with mnemonics for the first 20 elements, element groups and Latin symbols, then test yourself with flashcards and quizzes.'
      return {
        title: `Periodic Table Mnemonics, Flashcards & Quizzes | ${SITE_NAME}`,
        description,
        path: PAGE_PATHS.practice,
        jsonLd: [
          breadcrumbs([['Periodic table', '/'], ['Practice', PAGE_PATHS.practice]]),
          {
            '@context': 'https://schema.org',
            '@type': 'LearningResource',
            name: 'Learn the periodic table',
            description,
            url: absoluteUrl(PAGE_PATHS.practice),
            learningResourceType: ['Flashcards', 'Quiz', 'Mnemonic'],
            educationalLevel: 'Secondary school',
            isAccessibleForFree: true,
            inLanguage: 'en',
          },
        ],
      }
    }
    case 'tools': {
      const description = 'Calculate the molar mass of any chemical formula, including brackets and hydrates like CuSO4·5H2O, with a breakdown by element. Plus a K, °C and °F converter.'
      return {
        title: `Molar Mass Calculator & Temperature Converter | ${SITE_NAME}`,
        description,
        path: PAGE_PATHS.tools,
        jsonLd: [
          breadcrumbs([['Periodic table', '/'], ['Molar mass calculator', PAGE_PATHS.tools]]),
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Molar mass calculator',
            url: absoluteUrl(PAGE_PATHS.tools),
            description,
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Any',
            isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          },
        ],
      }
    }
    case 'element': {
      const el = route.element
      const path = elementPath(el)
      return {
        title: elementTitle(el),
        description: elementDescription(el),
        path,
        jsonLd: [
          breadcrumbs([['Periodic table', '/'], [el.name, path]]),
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: elementFaq(el).map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          },
        ],
      }
    }
    default:
      return { title: `Page not found | ${SITE_NAME}`, description: HOME_DESCRIPTION, path: '/404', noindex: true, jsonLd: [] }
  }
}

/* ── Head tags for pre-rendered pages ── */
const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeJson = (o: object) => JSON.stringify(o).replace(/</g, '\\u003c')

export function renderHead(meta: PageMeta): string {
  const url = absoluteUrl(meta.path)
  const image = absoluteUrl(OG_IMAGE.path)
  const tags = [
    `<title>${escapeAttr(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttr(meta.description)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeAttr(meta.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}" />`,
    meta.noindex ? '' : `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escapeAttr(OG_IMAGE.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    ...meta.jsonLd.map(o => `<script type="application/ld+json">${escapeJson(o)}</script>`),
  ]
  return tags.filter(Boolean).join('\n    ')
}

export function headForPath(path: string): string {
  return renderHead(routeMeta(parseRoute(path)))
}

/* ── Sitemap and robots ── */
export const PRERENDER_PATHS: string[] = [
  PAGE_PATHS.explore,
  PAGE_PATHS.practice,
  PAGE_PATHS.tools,
  ...ELEMENTS.map(elementPath),
]

export function sitemapXml(lastmod: string): string {
  const urls = PRERENDER_PATHS.map(p => `  <url><loc>${absoluteUrl(p)}</loc><lastmod>${lastmod}</lastmod></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\nDisallow: /ad-frame.html\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`
}
