import { describe, expect, it } from 'vitest'
import { buildAdFrame, readyUnits, unitScript, type AdsConfig } from './ads'

const KEY = '0123456789abcdef0123456789abcdef'

function config(overrides: Partial<AdsConfig> = {}): AdsConfig {
  return {
    enabled: true,
    strictIsolation: false,
    showPlaceholdersInDev: false,
    bannerHost: 'https://www.highperformanceformat.com',
    units: {
      leaderboard: { type: 'banner', key: KEY, width: 728, height: 90 },
      empty: { type: 'banner', key: '', width: 320, height: 50 },
      native: { type: 'native', script: '//pl1.example.com/abc/invoke.js', containerId: 'container-abc', height: 250 },
    },
    placements: {},
    ...overrides,
  }
}

describe('ad config', () => {
  it('builds banner script URLs from the key', () => {
    const cfg = config()

    expect(unitScript(cfg.units.leaderboard, cfg)).toBe(`https://www.highperformanceformat.com/${KEY}/invoke.js`)
    expect(unitScript(cfg.units.native, cfg)).toBe('https://pl1.example.com/abc/invoke.js')
  })

  it('ignores units that are not filled in or unsafe', () => {
    const cfg = config({
      units: {
        empty: { type: 'banner', key: '', width: 320, height: 50 },
        injected: { type: 'native', script: 'https://x.com/a.js"><script>', containerId: 'c', height: 10 },
        badId: { type: 'native', script: 'https://x.com/a.js', containerId: '"><img>', height: 10 },
      },
    })

    expect(Object.keys(readyUnits(cfg))).toEqual([])
  })

  it('serves nothing while ads are disabled', () => {
    expect(readyUnits(config({ enabled: false }))).toEqual({})
  })

  it('embeds only ready units in the frame page', () => {
    const html = buildAdFrame(config())

    expect(html).toContain(KEY)
    expect(html).toContain('container-abc')
    expect(html).not.toContain('"empty"')
  })
})
