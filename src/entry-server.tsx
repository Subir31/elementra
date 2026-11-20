// Build-time renderer: `npm run build` uses this to write a complete HTML page
// for every route, so search engines and slow phones get content immediately.

import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'
import { SsrContext } from './hooks/useRouter'

export { PRERENDER_PATHS, headForPath, robotsTxt, sitemapXml } from './seo'
export { todayKey } from './utils/format'

export function render(path: string, day: string): string {
  return renderToString(
    <StrictMode>
      <SsrContext.Provider value={{ path, day }}>
        <App />
      </SsrContext.Provider>
    </StrictMode>,
  )
}
