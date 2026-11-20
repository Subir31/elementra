// Shared by the app (to size and place slots) and by vite.config.ts (to build
// the isolated ad frame). Keep this file free of browser-only APIs.

import config from './ads.json'

export interface BannerUnit { type: 'banner'; key: string; width: number; height: number; src?: string }
export interface NativeUnit { type: 'native'; script: string; containerId: string; height: number }
export type AdUnit = BannerUnit | NativeUnit

export interface AdsConfig {
  enabled: boolean
  strictIsolation: boolean
  showPlaceholdersInDev: boolean
  bannerHost: string
  units: Record<string, AdUnit>
  placements: Record<string, string[]>
}

export type Placement = 'explore' | 'element' | 'practice' | 'tools' | 'footer'

export const ADS = config as AdsConfig

const KEY = /^[a-z0-9]{32}$/i
const HTTPS_URL = /^https:\/\/[a-z0-9.-]+(?::\d+)?\/[\w\-./%]*$/i
const CONTAINER_ID = /^[\w-]{1,80}$/

function toHttps(url: string): string {
  return url.startsWith('//') ? `https:${url}` : url
}

/** The script URL a unit loads, or null when the unit is not filled in correctly. */
export function unitScript(unit: AdUnit, cfg: AdsConfig = ADS): string | null {
  if (unit.type === 'banner') {
    if (!KEY.test(unit.key)) return null
    const src = toHttps(unit.src || `${cfg.bannerHost.replace(/\/$/, '')}/${unit.key}/invoke.js`)
    return HTTPS_URL.test(src) ? src : null
  }
  const src = toHttps(unit.script)
  return HTTPS_URL.test(src) && CONTAINER_ID.test(unit.containerId) ? src : null
}

export function readyUnits(cfg: AdsConfig = ADS): Record<string, AdUnit> {
  if (!cfg.enabled) return {}
  return Object.fromEntries(Object.entries(cfg.units).filter(([, u]) => unitScript(u, cfg)))
}

export function unitWidth(unit: AdUnit): number {
  return unit.type === 'banner' ? unit.width : 0
}

/** Builds the stand-alone page that hosts ad scripts inside a sandboxed iframe. */
export function buildAdFrame(cfg: AdsConfig = ADS): string {
  const units = Object.fromEntries(
    Object.entries(readyUnits(cfg)).map(([name, u]) => [
      name,
      u.type === 'banner'
        ? { type: 'banner', key: u.key, width: u.width, height: u.height, src: unitScript(u, cfg) }
        : { type: 'native', containerId: u.containerId, src: unitScript(u, cfg) },
    ]),
  )
  // Escape "<" so config values can never close the script element.
  const data = JSON.stringify(units).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="light dark">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>Advertisement</title>
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}body{display:flex;align-items:center;justify-content:center;min-height:100vh}</style>
</head>
<body>
<script>
(function () {
  var units = ${data};
  var name = new URLSearchParams(location.search).get('u') || '';
  if (!Object.prototype.hasOwnProperty.call(units, name)) return;
  var u = units[name];
  if (u.type === 'banner') {
    window.atOptions = { key: u.key, format: 'iframe', height: u.height, width: u.width, params: {} };
    document.write('<script src="' + u.src + '"><\\/script>');
  } else {
    // Native widgets size themselves; the parent page resizes the frame to fit.
    document.body.style.cssText = 'display:block;min-height:0';
    document.write('<script async data-cfasync="false" src="' + u.src + '"><\\/script><div id="' + u.containerId + '"></div>');
  }
})();
</script>
</body>
</html>
`
}
