// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { render } from './entry-server'

// Rendering on the server proves no component touches browser-only APIs while
// rendering, and that each pre-rendered page contains its real content.
describe('server rendering', () => {
  it('renders the home page with the table as real links', () => {
    const html = render('/', '2026-01-15')
    expect(html).toContain('<h1')
    expect(html).toContain('made memorable')
    expect(html.match(/href="\/element\/[a-z]+"/g)?.length).toBeGreaterThanOrEqual(118)
  })

  it('renders an element page with its overview and answers', () => {
    const html = render('/element/iron', '2026-01-15')
    expect(html).toMatch(/<h1[^>]*>Iron/)
    expect(html).toContain('What is the atomic mass of iron?')
    expect(html).toContain('href="/element/cobalt"')
  })

  it('renders the practice and tools pages', () => {
    expect(render('/practice', '2026-01-15')).toContain('Learn the periodic table')
    expect(render('/tools', '2026-01-15')).toContain('Molar mass calculator')
  })

  it('renders a helpful not-found page', () => {
    expect(render('/404', '2026-01-15')).toContain('This page isn’t on the table')
  })
})
