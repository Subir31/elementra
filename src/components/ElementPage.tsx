import type { CSSProperties } from 'react'
import { CATEGORY_META, ELEMENTS, type Element } from '../data/elements'
import { STUDY_SET_BY_ID, setsContaining, type StudySet } from '../data/learning'
import { elementFaq, elementIntro } from '../seo'
import { AdSlot } from './AdSlot'
import { ElementDetails, ElementHeroContent } from './ElementDetails'
import { Icon } from './Icon'
import { ElementLink, Link } from './Link'

/** The full, indexable page for one element (/element/iron). */
export function ElementPage({ el, learned, inCompare, onToggleLearned, onToggleCompare, onStudy, onQuiz }: {
  el: Element
  learned: boolean
  inCompare: boolean
  onToggleLearned: () => void
  onToggleCompare: () => void
  onStudy: (set: StudySet) => void
  onQuiz: (set: StudySet) => void
}) {
  const m = CATEGORY_META[el.categoryKey]
  const prev = ELEMENTS[el.atomicNumber - 2]
  const next = ELEMENTS[el.atomicNumber]
  const faq = elementFaq(el)

  const family = el.group
    ? { id: 'rel-group', title: `More in group ${el.group}`, items: ELEMENTS.filter(e => e.group === el.group && e !== el) }
    : { id: 'rel-group', title: `More ${m.label.toLowerCase()}s`, items: ELEMENTS.filter(e => e.categoryKey === el.categoryKey && e !== el) }
  const row = { id: 'rel-period', title: `More in period ${el.period}`, items: ELEMENTS.filter(e => e.period === el.period && e.group != null && e !== el) }
  const all = STUDY_SET_BY_ID.get('all')
  const sets = [...setsContaining(el.symbol), ...(all ? [all] : [])]

  return (
    <article className="mx-auto max-w-[1040px] space-y-5 pt-1 sm:space-y-6 sm:pt-3" style={{ '--c': m.color } as CSSProperties}>
      <nav aria-label="Breadcrumb" className="text-[13px] text-[var(--text-3)]">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="transition-colors hover:text-[var(--text)]">Periodic table</Link></li>
          <li aria-hidden="true"><Icon name="chevronRight" size={13} /></li>
          <li aria-current="page" className="font-semibold text-[var(--text-2)]">{el.name}</li>
        </ol>
      </nav>

      <header className="hero relative rounded-[28px] px-5 pb-6 pt-16 shadow-[var(--shadow-lg)] sm:px-8 sm:pb-8 sm:pt-10">
        <div className="absolute right-3 top-3 z-[2] flex gap-2 sm:right-5 sm:top-5">
          {prev && <ElementLink el={prev} mode="page" className="hero-btn" aria-label={`Previous: ${prev.name}`}><Icon name="chevronLeft" /></ElementLink>}
          {next && <ElementLink el={next} mode="page" className="hero-btn" aria-label={`Next: ${next.name}`}><Icon name="chevronRight" /></ElementLink>}
        </div>
        <ElementHeroContent el={el} heading="h1" />
      </header>

      <section className="card p-5 sm:p-7" aria-label={`${el.name} at a glance`}>
        <ElementDetails el={el} learned={learned} inCompare={inCompare} onToggleLearned={onToggleLearned} onToggleCompare={onToggleCompare} headingLevel="h2" />
      </section>

      <AdSlot placement="element" />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-start sm:gap-6">
        <div className="space-y-5 sm:space-y-6">
          <section className="card p-5 sm:p-7" aria-labelledby="about-title">
            <h2 id="about-title" className="text-[21px] font-bold">About {el.name.toLowerCase()}</h2>
            {elementIntro(el).map(p => <p key={p.slice(0, 32)} className="mt-3 text-[15px] leading-[1.75] text-[var(--text-2)]">{p}</p>)}
          </section>

          <section className="card p-5 sm:p-7" aria-labelledby="faq-title">
            <h2 id="faq-title" className="text-[21px] font-bold">{el.name}: quick answers</h2>
            <div className="mt-2 divide-y divide-[var(--border)]">
              {faq.map(f => (
                <div key={f.q} className="py-3.5">
                  <h3 className="text-[15.5px] font-semibold">{f.q}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--text-2)]">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5 sm:space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="practise-title">
            <h2 id="practise-title" className="flex items-center gap-2 text-[19px] font-bold"><Icon name="target" size={18} className="text-[var(--accent-text)]" />Practise {el.name.toLowerCase()}</h2>
            <p className="mt-1 text-[13.5px] text-[var(--text-3)]">Lock it in with flip cards, then check yourself with a quick quiz.</p>
            <ul className="mt-4 space-y-2.5">
              {sets.map(set => (
                <li key={set.id} className="panel flex flex-wrap items-center gap-2 p-3">
                  <span className="min-w-0 flex-1 text-[14px] font-semibold">{set.title}</span>
                  <button type="button" className="btn btn-sm btn-soft" onClick={() => onStudy(set)}><Icon name="layers" size={14} />Cards</button>
                  <button type="button" className="btn btn-sm" onClick={() => onQuiz(set)}><Icon name="target" size={14} />Quiz</button>
                </li>
              ))}
            </ul>
          </section>

          {[family, row].map(group => group.items.length > 0 && (
            <section key={group.id} className="card p-5 sm:p-6" aria-labelledby={group.id}>
              <h2 id={group.id} className="text-[17px] font-bold">{group.title}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {group.items.map(e => (
                  <li key={e.atomicNumber}>
                    <ElementLink el={e} mode="page" className="el-card !gap-2.5 !rounded-xl !py-1.5 !pl-1.5 !pr-3"
                      style={{ '--c': CATEGORY_META[e.categoryKey].color, animation: 'none' } as CSSProperties}>
                      <span className="el-sym !h-8 !w-8 !rounded-lg !text-[13px]">{e.symbol}</span>
                      <span className="text-[13.5px] font-semibold">{e.name}</span>
                    </ElementLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <nav aria-label="Previous and next element" className="grid grid-cols-2 gap-3">
        {prev ? (
          <ElementLink el={prev} mode="page" className="card flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5">
            <Icon name="arrowLeft" size={18} className="shrink-0 text-[var(--text-3)]" />
            <span className="min-w-0"><span className="eyebrow block">Previous · {prev.atomicNumber}</span><span className="block truncate font-display text-[16px] font-bold">{prev.name}</span></span>
          </ElementLink>
        ) : <span />}
        {next ? (
          <ElementLink el={next} mode="page" className="card flex items-center justify-end gap-3 p-4 text-right transition-transform hover:-translate-y-0.5">
            <span className="min-w-0"><span className="eyebrow block">Next · {next.atomicNumber}</span><span className="block truncate font-display text-[16px] font-bold">{next.name}</span></span>
            <Icon name="arrowRight" size={18} className="shrink-0 text-[var(--text-3)]" />
          </ElementLink>
        ) : <span />}
      </nav>

      <div className="flex justify-center pb-2">
        <Link href="/" className="btn"><Icon name="table" size={16} />Back to the periodic table</Link>
      </div>
    </article>
  )
}
