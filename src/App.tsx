import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ELEMENTS, elementOfTheDay, type Element, type PropertyKey } from './data/elements'
import { elementsOfSet, type StudySet } from './data/learning'
import { useProgress } from './hooks/useProgress'
import { useTheme, useView, type View } from './hooks/useUi'
import { AdSlot } from './components/AdSlot'
import { CompareModal, CompareTray } from './components/Compare'
import { ElementSheet } from './components/ElementSheet'
import { ExploreView, useExploreState } from './components/ExploreView'
import { FlashcardSession } from './components/Flashcards'
import { Icon, type IconName } from './components/Icon'
import { LearnView } from './components/LearnView'
import { QuizView, type QuizRequest } from './components/QuizView'
import { ToolsView } from './components/ToolsView'

const NAV: { view: View; label: string; icon: IconName; title: string }[] = [
  { view: 'explore', label: 'Explore', icon: 'table', title: 'Interactive Periodic Table' },
  { view: 'learn', label: 'Learn', icon: 'book', title: 'Learn the Elements' },
  { view: 'quiz', label: 'Quiz', icon: 'target', title: 'Periodic Table Quiz' },
  { view: 'tools', label: 'Tools', icon: 'calculator', title: 'Molar Mass Calculator' },
]

interface Study { set: StudySet; elements: Element[]; canQuiz: boolean }

export default function App() {
  const [view, go] = useView()
  const [theme, toggleTheme] = useTheme()
  const progress = useProgress()
  const explore = useExploreState()
  const searchRef = useRef<HTMLInputElement>(null)
  const dayElement = useMemo(() => elementOfTheDay(), [])

  const [selected, setSelected] = useState<Element | null>(null)
  const [compare, setCompare] = useState<Element[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [study, setStudy] = useState<Study | null>(null)
  const [quizRequest, setQuizRequest] = useState<QuizRequest | null>(null)
  const [visited, setVisited] = useState<Set<View>>(() => new Set([view]))

  useEffect(() => {
    setVisited(v => (v.has(view) ? v : new Set(v).add(view)))
  }, [view])

  /* ── Overlays get one history entry, so the phone's Back button closes them ── */
  const overlayEntry = useRef(false)
  const afterBack = useRef<(() => void) | null>(null)

  const pushOverlay = () => {
    if (overlayEntry.current) return
    window.history.pushState({ elementraOverlay: true }, '')
    overlayEntry.current = true
  }

  const closeAll = useCallback((then?: () => void) => {
    setSelected(null)
    setShowCompare(false)
    setStudy(null)
    if (overlayEntry.current) {
      overlayEntry.current = false
      afterBack.current = then ?? null
      window.history.back()
    } else then?.()
  }, [])

  useEffect(() => {
    const onPop = () => {
      if (overlayEntry.current) {
        overlayEntry.current = false
        setSelected(null)
        setShowCompare(false)
        setStudy(null)
      }
      const fn = afterBack.current
      afterBack.current = null
      fn?.()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openElement = useCallback((el: Element) => { pushOverlay(); setSelected(el) }, [])
  const closeElement = useCallback(() => {
    if (showCompare || study) setSelected(null)
    else closeAll()
  }, [showCompare, study, closeAll])

  const openStudy = (s: Study) => { pushOverlay(); setStudy(s) }

  const navigate = useCallback((v: View, after?: () => void) => {
    const run = () => { go(v); after?.() }
    if (overlayEntry.current) closeAll(run); else run()
  }, [go, closeAll])

  /* ── Comparison ── */
  const compareSet = useMemo(() => new Set(compare.map(e => e.atomicNumber)), [compare])
  const toggleCompare = (el: Element) => setCompare(prev => {
    if (prev.some(e => e.atomicNumber === el.atomicNumber)) return prev.filter(e => e.atomicNumber !== el.atomicNumber)
    return prev.length >= 3 ? [...prev.slice(1), el] : [...prev, el]
  })
  const removeCompare = (el: Element) => {
    const next = compare.filter(e => e.atomicNumber !== el.atomicNumber)
    setCompare(next)
    if (next.length < 2 && showCompare) closeAll()
  }

  /* ── Page title ── */
  useEffect(() => {
    const page = NAV.find(n => n.view === view)?.title ?? 'Interactive Periodic Table'
    document.title = selected ? `${selected.name} (${selected.symbol}) · Elementra` : `Elementra · ${page}`
  }, [view, selected])

  /* ── Global shortcuts: "/" or Ctrl/⌘+K to search ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      const isSearch = (e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')
      if (!isSearch || selected || showCompare || study) return
      e.preventDefault()
      if (view !== 'explore') go('explore')
      requestAnimationFrame(() => {
        searchRef.current?.focus()
        searchRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, go, selected, showCompare, study])

  const randomElement = () => openElement(ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)])

  const startQuiz = (setId: string) => navigate('quiz', () => setQuizRequest({ setId, nonce: Date.now() }))

  const showTrend = (property: PropertyKey | null) => {
    explore.setTableView(property ? 'heatmap' : 'standard')
    if (property) explore.setProperty(property)
    explore.setLayout('table')
    navigate('explore', () => requestAnimationFrame(() => document.getElementById('explore-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
  }

  return (
    <div className="relative min-h-dvh" style={{ paddingBottom: 'calc(var(--bottom-nav-h) + var(--safe-bottom))' }}>
      <Background />

      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-xl focus:bg-[var(--surface-raised)] focus:px-4 focus:py-2">
        Skip to content
      </a>

      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="shell flex h-16 items-center gap-3">
          <a href="#/" className="flex items-center gap-2.5" aria-label="Elementra home" onClick={e => { e.preventDefault(); navigate('explore') }}>
            <span className="brand-mark"><Icon name="atom" size={20} /></span>
            <span className="font-display text-[19px] font-extrabold tracking-[-0.03em]">Elementra</span>
          </a>

          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map(n => (
              <a key={n.view} href={n.view === 'explore' ? '#/' : `#/${n.view}`} className="nav-tab" aria-current={view === n.view ? 'page' : undefined}
                onClick={e => { e.preventDefault(); navigate(n.view) }}>
                <Icon name={n.icon} size={16} />{n.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="btn btn-sm hidden sm:inline-flex" onClick={() => {
              navigate('explore', () => requestAnimationFrame(() => searchRef.current?.focus()))
            }}>
              <Icon name="search" size={15} />Search<span className="kbd ml-1 hidden lg:inline-flex">/</span>
            </button>
            <button type="button" className="icon-btn" onClick={randomElement} aria-label="Open a random element" title="Random element">
              <Icon name="dice" size={18} />
            </button>
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title="Toggle theme">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Views (kept mounted after the first visit so their state survives) ── */}
      <main id="main" className="shell relative pb-10 pt-4 sm:pt-6">
        {visited.has('explore') && (
          <div hidden={view !== 'explore'} className={view === 'explore' ? 'view-enter' : undefined}>
            <ExploreView state={explore} searchRef={searchRef} learned={progress.learned} compare={compareSet}
              dayElement={dayElement} learnedCount={progress.learned.size} streak={progress.streak} onOpen={openElement} go={v => navigate(v)} />
          </div>
        )}
        {visited.has('learn') && (
          <div hidden={view !== 'learn'} className={view === 'learn' ? 'view-enter' : undefined}>
            <LearnView progress={progress} onOpen={openElement}
              onStudy={set => openStudy({ set, elements: elementsOfSet(set), canQuiz: true })}
              onQuiz={set => startQuiz(set.id)} onShowTrend={showTrend} />
          </div>
        )}
        {visited.has('quiz') && (
          <div hidden={view !== 'quiz'} className={view === 'quiz' ? 'view-enter' : undefined}>
            <QuizView progress={progress} request={quizRequest} active={view === 'quiz' && !selected && !study} onOpen={openElement}
              onStudyMissed={elements => openStudy({
                set: { id: 'missed', title: 'Your missed questions', subtitle: 'Review', symbols: elements.map(e => e.symbol) },
                elements,
                canQuiz: false,
              })} />
          </div>
        )}
        {visited.has('tools') && (
          <div hidden={view !== 'tools'} className={view === 'tools' ? 'view-enter' : undefined}>
            <ToolsView onOpen={openElement} />
          </div>
        )}
      </main>

      <div className="shell relative">
        <AdSlot placement="footer" className="pb-6" />
      </div>
      <Footer navigate={navigate} />

      {/* ── Mobile bottom navigation ── */}
      <nav className="bottom-nav md:hidden" aria-label="Main">
        {NAV.map(n => (
          <a key={n.view} href={n.view === 'explore' ? '#/' : `#/${n.view}`} className="bottom-tab" aria-current={view === n.view ? 'page' : undefined}
            onClick={e => { e.preventDefault(); navigate(n.view) }}>
            <span className="tab-icon"><Icon name={n.icon} size={20} /></span>
            {n.label}
          </a>
        ))}
      </nav>

      {!selected && !showCompare && (
        <CompareTray items={compare} onOpen={() => { pushOverlay(); setShowCompare(true) }} onRemove={removeCompare} onClear={() => setCompare([])} />
      )}

      {/* ── Overlays ── */}
      {showCompare && compare.length > 0 && (
        <CompareModal items={compare} onClose={() => closeAll()} onRemove={removeCompare} onOpen={openElement} />
      )}
      {study && (
        <FlashcardSession key={study.set.id + study.elements.length} set={study.set} elements={study.elements} learned={progress.learned}
          onLearned={z => progress.setLearned(z, true)}
          onQuiz={() => (study.canQuiz ? startQuiz(study.set.id) : closeAll(() => navigate('quiz')))}
          onClose={() => closeAll()} />
      )}
      {selected && (
        <ElementSheet el={selected} learned={progress.learned.has(selected.atomicNumber)} inCompare={compareSet.has(selected.atomicNumber)}
          onToggleLearned={() => progress.setLearned(selected.atomicNumber, !progress.learned.has(selected.atomicNumber))}
          onToggleCompare={() => toggleCompare(selected)} onNavigate={setSelected} onClose={closeElement} />
      )}
    </div>
  )
}

function Background() {
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="orb hidden md:block" style={{ width: 520, height: 520, top: '-12%', right: '4%', background: 'var(--accent)', opacity: 0.16, animation: 'drift 26s ease-in-out infinite' }} />
      <div className="orb hidden md:block" style={{ width: 420, height: 420, top: '30%', left: '-8%', background: 'var(--accent-3)', opacity: 0.1, animation: 'drift2 32s ease-in-out infinite' }} />
    </div>
  )
}

function Footer({ navigate }: { navigate: (v: View) => void }) {
  return (
    <footer className="relative z-[1] border-t border-[var(--border)]">
      <div className="shell grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="brand-mark !h-8 !w-8"><Icon name="atom" size={18} /></span>
            <span className="font-display text-[18px] font-extrabold">Elementra</span>
          </div>
          <p className="mt-3 max-w-[40ch] text-[13.5px] leading-relaxed text-[var(--text-3)]">
            A free, interactive periodic table for students — explore the elements, spot the trends and remember what you learn.
          </p>
        </div>
        <div>
          <div className="eyebrow mb-3">Study</div>
          <ul className="space-y-2 text-[14px]">
            {NAV.map(n => (
              <li key={n.view}>
                <a href={n.view === 'explore' ? '#/' : `#/${n.view}`} onClick={e => { e.preventDefault(); navigate(n.view) }}
                  className="text-[var(--text-2)] transition-colors hover:text-[var(--text)]">{n.title}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">Credits</div>
          <ul className="space-y-2 text-[13.5px] text-[var(--text-3)]">
            <li>Element data from open MIT-licensed datasets</li>
            <li>Extra details from <a className="underline decoration-[var(--border-2)] underline-offset-2 hover:text-[var(--text)]" href="https://periodictableofelements.org/" target="_blank" rel="noreferrer noopener">PeriodicTableOfElements.org</a></li>
            <li>Photos from <a className="underline decoration-[var(--border-2)] underline-offset-2 hover:text-[var(--text)]" href="https://commons.wikimedia.org/" target="_blank" rel="noreferrer noopener">Wikimedia Commons</a></li>
            <li><a className="inline-flex items-center gap-1.5 hover:text-[var(--text)]" href="https://github.com/Subir31/elementra" target="_blank" rel="noreferrer noopener"><Icon name="github" size={14} />Open source on GitHub</a></li>
          </ul>
        </div>
      </div>
      <div className="shell flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] py-4 text-[12px] text-[var(--text-4)]">
        <span>© {new Date().getFullYear()} Elementra · Progress is saved only on this device.</span>
        <span className="hidden items-center gap-1.5 sm:flex"><span className="kbd">/</span> search · <span className="kbd">←</span><span className="kbd">→</span> browse elements</span>
      </div>
    </footer>
  )
}
