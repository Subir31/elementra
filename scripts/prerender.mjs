// Writes a complete HTML file for every page (home, practice, tools, 118
// element pages and a 404 page) plus sitemap.xml and robots.txt.
// Runs after `vite build` (client) and `vite build --ssr` (renderer).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const ssrDir = resolve(root, '.ssr')

const { render, headForPath, PRERENDER_PATHS, sitemapXml, robotsTxt, todayKey } =
  await import(pathToFileURL(resolve(ssrDir, 'entry-server.js')).href)

const template = readFileSync(resolve(dist, 'index.html'), 'utf8')
const SEO_BLOCK = /<!--seo-->[\s\S]*?<!--\/seo-->/
const ROOT_DIV = '<div id="root"></div>'
if (!SEO_BLOCK.test(template) || !template.includes(ROOT_DIV)) {
  throw new Error('dist/index.html is missing the <!--seo--> block or the empty #root element')
}

const day = todayKey()
const fileFor = path => (path === '/' ? 'index.html' : path === '/404' ? '404.html' : `${path.slice(1)}.html`)

let bytes = 0
for (const path of [...PRERENDER_PATHS, '/404']) {
  const html = render(path, day)
  if (!html || html.length < 500) throw new Error(`Rendering ${path} produced almost no HTML`)
  const page = template
    .replace(SEO_BLOCK, headForPath(path))
    .replace(ROOT_DIV, `<div id="root" data-path="${path}" data-day="${day}">${html}</div>`)
  const file = resolve(dist, fileFor(path))
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, page)
  bytes += page.length
}

const lastmod = new Date().toISOString().slice(0, 10)
writeFileSync(resolve(dist, 'sitemap.xml'), sitemapXml(lastmod))
writeFileSync(resolve(dist, 'robots.txt'), robotsTxt())
rmSync(ssrDir, { recursive: true, force: true })

const count = PRERENDER_PATHS.length + 1
console.log(`Pre-rendered ${count} pages (${(bytes / count / 1024).toFixed(0)} KB each on average), sitemap.xml and robots.txt`)
