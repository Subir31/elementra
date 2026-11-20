import type { CSSProperties } from 'react'
import { CATEGORY_META } from '../data/elements'
import { searchElements } from './ExploreView'
import { Icon } from './Icon'
import { ElementLink, Link } from './Link'

/** Shown for unknown addresses, with a guess at the element that was meant. */
export function NotFound({ path }: { path: string }) {
  const guess = path.split('/').filter(Boolean).pop() ?? ''
  // Try shorter and shorter prefixes, so typos like "irn" still suggest Iron.
  let suggestions: ReturnType<typeof searchElements> = []
  for (let n = Math.min(guess.length, 5); n >= 2 && suggestions.length === 0; n--) {
    const found = searchElements(guess.slice(0, n))
    if (found.length < 118) suggestions = found.slice(0, 6)
  }

  return (
    <section className="mx-auto grid max-w-[640px] place-items-center gap-4 py-14 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon name="search" size={28} /></span>
      <h1 className="font-display text-[clamp(26px,4vw,38px)] font-extrabold tracking-[-0.03em]">This page isn’t on the table</h1>
      <p className="max-w-[48ch] text-[15px] text-[var(--text-2)]">The link may be old or mistyped. Try one of these, or head back to the periodic table.</p>
      {suggestions.length > 0 && (
        <ul className="mt-1 flex flex-wrap justify-center gap-2">
          {suggestions.map(e => (
            <li key={e.atomicNumber}>
              <ElementLink el={e} mode="page" className="el-card !gap-2.5 !rounded-xl !py-1.5 !pl-1.5 !pr-3" style={{ '--c': CATEGORY_META[e.categoryKey].color, animation: 'none' } as CSSProperties}>
                <span className="el-sym !h-8 !w-8 !rounded-lg !text-[13px]">{e.symbol}</span>
                <span className="text-[13.5px] font-semibold">{e.name}</span>
              </ElementLink>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-primary"><Icon name="table" size={16} />Periodic table</Link>
        <Link href="/practice" className="btn"><Icon name="book" size={16} />Practice</Link>
        <Link href="/tools" className="btn"><Icon name="calculator" size={16} />Molar mass calculator</Link>
      </div>
    </section>
  )
}
