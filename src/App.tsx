import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ELEMENTS, ELEMENT_BY_SYMBOL, ELEMENT_BY_Z, elementOfTheDay, type Element, type PropertyKey } from './data/elements'
import { STUDY_SETS, elementsOfSet, type StudySet } from './data/learning'
import { PAGE_PATHS, elementPath, type PageView } from './config/site'
import { useProgress } from './hooks/useProgress'
import { navigateTo, normalizePath, overlayState, useRoute, useToday } from './hooks/useRouter'
import { useTheme } from './hooks/useUi'
import { elementTitle, routeMeta } from './seo'
import { AdSlot } from './components/AdSlot'
import { CompareModal, CompareTray } from './components/Compare'
import { ElementPage } from './components/ElementPage'
import { ElementSheet } from './components/ElementSheet'
import { ExploreView, useExploreState } from './components/ExploreView'
import { FlashcardSession } from './components/Flashcards'
import { Icon, type IconName } from './components/Icon'
import { ActionsContext, ElementLink, Link } from './components/Link'
import { NotFound } from './components/NotFound'
import { PracticeView } from './components/PracticeView'
import { QuizSession } from './components/QuizSession'
import { ToolsView } from './components/ToolsView'

const NAV: { view: PageView; label: string; icon: IconName; title: string }[] = [
  { view: 'explore', label: 'Table', icon: 'table', title: 'Interactive periodic table' },
  { view: 'practice', label: 'Practice', icon: 'book', title: 'Mnemonics, flashcards & quizzes' },
  { view: 'tools', label: 'Tools', icon: 'calculator', title: 'Molar mass calculator' },
]

const POPULAR = ['H', 'He', 'C', 'N', 'O', 'Na', 'Mg', 'Al', 'Si', 'Cl', 'K', 'Ca', 'Fe', 'Cu', 'Zn', 'Ag', 'Au', 'Hg', 'Pb', 'U']
  .map(s => ELEMENT_BY_SYMBOL.get(s))
  .filter((e): e is Element => Boolean(e))

const FIRST_SET = STUDY_SETS[0]

interface Study { set: StudySet; elements: Element[] }

export default function App() {
  const route = useRoute()
  const [theme, toggleTheme] = useTheme()
  const progress = useProgress()
  const explore = useExploreState()
  const searchRef = useRef<HTMLInputElement>(null)
  const today = useToday()
  const dayElement = useMemo(() => elementOfTheDay(new Date(`${today}T12:00:00`)), [today])

  const [selected, setSelected] = useState<Element | null>(null)
  const [compare, setCompare] = useState<Element[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [study, setStudy] = useState<Study | null>(null)
  const [quiz, setQuiz] = useState<{ set: StudySet; nonce: number } | null>(null)

  const pageView: PageView | null = route.view === 'explore' || route.view === 'practice' || route.view === 'tools' ? route.view : null
  const [visited, setVisited] = useState<Set<PageView>>(() => new Set(pageView ? [pageView] : []))
  useEffect(() => {
    if (pageView) setVisited(v => (v.has(pageView) ? v : new Set(v).add(pageView)))
  }, [pageView])
  // Views stay mounted after the first visit so their state survives switching.
  const mounted = (v: PageView) => pageView === v || visited.has(v)

  /* ── Overlays get one history entry, so the phone's Back button closes them ── */
  const overlayOpen = useRef(false)
  const afterBack = useRef<(() => void) | null>(null)

  const clearOverlays = () => {
    setSelected(null)
    setShowCompare(false)
    setStudy(null)
    setQuiz(null)
  }

  /** Opens (or updates) the overlay history entry. An element sheet shows its own URL. */
  const setOverlayEntry = useCallback((url?: string, z?: number) => {
    const s = overlayState()
    if (overlayOpen.current && s) {
      window.history.replaceState({ ...s, z }, '', url ?? s.base)
      return
    }
    const base = window.location.pathname
    window.history.pushState({ elementraOverlay: true, base, z }, '', url ?? base)
    overlayOpen.current = true
  }, [])

  const closeAll = useCallback((then?: () => void) => {
    clearOverlays()
    if (overlayOpen.current) {
      overlayOpen.current = false
      afterBack.current = then ?? null
      window.history.back()
    } else then?.()
  }, [])

  useEffect(() => {
    const onPop = () => {
      const s = overlayState()
      if (overlayOpen.current && !s) {
        overlayOpen.current = false
        clearOverlays()
      } else if (!overlayOpen.current && s) {
        // Forward into an old overlay entry: reopen the element if we know which one.
        const el = s.z ? ELEMENT_BY_Z.get(s.z) : undefined
        if (el) { overlayOpen.current = true; setSelected(el) }
        else window.history.replaceState(null, '', s.base)
      }
      const fn = afterBack.current
      afterBack.current = null
      fn?.()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const openElement = useCallback((el: Element) => {
    setOverlayEntry(elementPath(el), el.atomicNumber)
    setSelected(el)
  }, [setOverlayEntry])

  const closeElement = useCallback(() => {
    if (showCompare || study || quiz) { setSelected(null); setOverlayEntry() }
    else closeAll()
  }, [showCompare, study, quiz, closeAll, setOverlayEntry])

  const openStudy = useCallback((s: Study) => { setOverlayEntry(); setQuiz(null); setStudy(s) }, [setOverlayEntry])
  const openStudySet = useCallback((set: StudySet) => openStudy({ set, elements: elementsOfSet(set) }), [openStudy])
  const openQuiz = useCallback((set: StudySet) => { setOverlayEntry(); setStudy(null); setQuiz({ set, nonce: Date.now() }) }, [setOverlayEntry])

  const navigate = useCallback((path: string, after?: () => void) => {
    const run = () => {
      if (normalizePath(path) !== normalizePath(window.location.pathname)) navigateTo(path)
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      after?.()
    }
    if (overlayOpen.current) closeAll(run); else run()
  }, [closeAll])

  const actions = useMemo(() => ({ navigate: (path: string) => navigate(path), openElement }), [navigate, openElement])

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
    document.title = selected ? elementTitle(selected) : routeMeta(route).title
  }, [route, selected])

  /* ── Global shortcuts: "/" or Ctrl/⌘+K to search ── */
  const focusSearch = useCallback(() => {
    navigate(PAGE_PATHS.explore, () => requestAnimationFrame(() => {
      searchRef.current?.focus()
      searchRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }))
  }, [navigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      const isSearch = (e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')
      if (!isSearch || selected || showCompare || study || quiz) return
      e.preventDefault()
      focusSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusSearch, selected, showCompare, study, quiz])

  const randomElement = () => openElement(ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)])

  const showTrend = (property: PropertyKey | null) => {
    explore.setTableView(property ? 'heatmap' : 'standard')
    if (property) explore.setProperty(property)
    explore.setLayout('table')
    navigate(PAGE_PATHS.explore, () => requestAnimationFrame(() => document.getElementById('explore-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
  }

  const activeNav: PageView | null = route.view === 'element' ? 'explore' : pageView

  return (
    <ActionsContext.Provider value={actions}>
      <div className="relative min-h-dvh" style={{ paddingBottom: 'calc(var(--bottom-nav-h) + var(--safe-bottom))' }}>
        <Background />

        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-xl focus:bg-[var(--surface-raised)] focus:px-4 focus:py-2">
          Skip to content
        </a>

        {/* ── Top bar ── */}
        <header className="topbar">
          <div className="shell flex h-16 items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Elementra home">
              <span className="brand-mark"><Icon name="atom" size={20} /></span>
              <span className="font-display text-[19px] font-extrabold tracking-[-0.03em]">Elementra</span>
            </Link>

            <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
              {NAV.map(n => (
                <Link key={n.view} href={PAGE_PATHS[n.view]} className="nav-tab" aria-current={activeNav === n.view ? 'page' : undefined}>
                  <Icon name={n.icon} size={16} />{n.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <button type="button" className="btn btn-sm hidden sm:inline-flex" onClick={focusSearch}>
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

        {/* ── Pages ── */}
        <main id="main" className="shell relative pb-10 pt-4 sm:pt-6">
          {mounted('explore') && (
            <div hidden={pageView !== 'explore'} className={pageView === 'explore' ? 'view-enter' : undefined}>
              <ExploreView state={explore} searchRef={searchRef} learned={progress.learned} compare={compareSet}
                dayElement={dayElement} learnedCount={progress.learned.size} streak={progress.streak}
                onOpen={openElement} onQuickQuiz={() => openQuiz(FIRST_SET)} />
            </div>
          )}
          {mounted('practice') && (
            <div hidden={pageView !== 'practice'} className={pageView === 'practice' ? 'view-enter' : undefined}>
              <PracticeView progress={progress} onStudy={openStudySet} onQuiz={openQuiz} onShowTrend={showTrend} />
            </div>
          )}
          {mounted('tools') && (
            <div hidden={pageView !== 'tools'} className={pageView === 'tools' ? 'view-enter' : undefined}>
              <ToolsView onOpen={openElement} />
            </div>
          )}
          {route.view === 'element' && (
            <div className="view-enter" key={route.element.atomicNumber}>
              <ElementPage el={route.element} learned={progress.learned.has(route.element.atomicNumber)} inCompare={compareSet.has(route.element.atomicNumber)}
                onToggleLearned={() => progress.setLearned(route.element.atomicNumber, !progress.learned.has(route.element.atomicNumber))}
                onToggleCompare={() => toggleCompare(route.element)} onStudy={openStudySet} onQuiz={openQuiz} />
            </div>
          )}
          {route.view === 'notfound' && <NotFound path={route.path} />}
        </main>

        {/* The home page already ends with its own ad, and the 404 page shows none. */}
        {(route.view === 'practice' || route.view === 'tools' || route.view === 'element') && (
          <div className="shell relative">
            <AdSlot placement="footer" className="pb-6" />
          </div>
        )}
        <Footer />

        {/* ── Mobile bottom navigation ── */}
        <nav className="bottom-nav md:hidden" aria-label="Main">
          {NAV.map(n => (
            <Link key={n.view} href={PAGE_PATHS[n.view]} className="bottom-tab" aria-current={activeNav === n.view ? 'page' : undefined}>
              <span className="tab-icon"><Icon name={n.icon} size={20} /></span>
              {n.label}
            </Link>
          ))}
        </nav>

        {!selected && !showCompare && !study && !quiz && (
          <CompareTray items={compare} onOpen={() => { setOverlayEntry(); setShowCompare(true) }} onRemove={removeCompare} onClear={() => setCompare([])} />
        )}

        {/* ── Overlays ── */}
        {showCompare && compare.length > 0 && (
          <CompareModal items={compare} onClose={() => closeAll()} onRemove={removeCompare} onOpen={openElement} />
        )}
        {study && (
          <FlashcardSession key={study.set.id + study.elements.length} set={study.set} elements={study.elements} learned={progress.learned}
            onLearned={z => progress.setLearned(z, true)} onQuiz={() => openQuiz(study.set)} onClose={() => closeAll()} />
        )}
        {quiz && (
          <QuizSession key={quiz.nonce} set={quiz.set} progress={progress} active={!selected} onOpen={openElement}
            onStudyMissed={elements => openStudy({
              set: { id: 'missed', title: 'Your missed questions', subtitle: 'Review', symbols: elements.map(e => e.symbol) },
              elements,
            })}
            onClose={() => closeAll()} />
        )}
        {selected && (
          <ElementSheet el={selected} learned={progress.learned.has(selected.atomicNumber)} inCompare={compareSet.has(selected.atomicNumber)}
            onToggleLearned={() => progress.setLearned(selected.atomicNumber, !progress.learned.has(selected.atomicNumber))}
            onToggleCompare={() => toggleCompare(selected)} onNavigate={openElement} onClose={closeElement} />
        )}
      </div>
    </ActionsContext.Provider>
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

const footerLink = 'text-[var(--text-2)] transition-colors hover:text-[var(--text)]'

function Footer() {
  return (
    <footer className="relative z-[1] border-t border-[var(--border)]">
      <div className="shell grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_1.3fr_1fr]">
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
            {NAV.map(n => <li key={n.view}><Link href={PAGE_PATHS[n.view]} className={footerLink}>{n.title}</Link></li>)}
            <li><Link href={PAGE_PATHS.practice} className={footerLink}>Mnemonic for the first 20 elements</Link></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">Popular elements</div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13.5px]">
            {POPULAR.map(e => <li key={e.atomicNumber}><ElementLink el={e} mode="page" className={footerLink}>{e.name}</ElementLink></li>)}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">Credits</div>
          <ul className="space-y-2 text-[13.5px] text-[var(--text-3)]">
            <li>Element data from open MIT-licensed datasets</li>
            <li>Extra details from <a className="underline decoration-[var(--border-2)] underline-offset-2 hover:text-[var(--text)]" href="https://periodictableofelements.org/" target="_blank" rel="noreferrer noopener">PeriodicTableOfElements.org</a></li>
            <li>Summaries and photos from <a className="underline decoration-[var(--border-2)] underline-offset-2 hover:text-[var(--text)]" href="https://en.wikipedia.org/" target="_blank" rel="noreferrer noopener">Wikipedia</a> (CC BY-SA)</li>
            <li><a className="inline-flex items-center gap-1.5 hover:text-[var(--text)]" href="https://github.com/Subir31/elementra" target="_blank" rel="noreferrer noopener"><Icon name="github" size={14} />Open source on GitHub</a></li>
          </ul>
        </div>
      </div>
      <div className="shell flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] py-4 text-[12px] text-[var(--text-4)]">
        <span suppressHydrationWarning>© {new Date().getFullYear()} Elementra · Progress is saved only on this device.</span>
        <span className="hidden items-center gap-1.5 sm:flex"><span className="kbd">/</span> search · <span className="kbd">←</span><span className="kbd">→</span> browse elements</span>
      </div>
    </footer>
  )
}
