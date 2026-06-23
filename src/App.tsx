import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ELEMENTS, CATEGORY_META, CATEGORY_ORDER, formatNumber,
  PROPERTY_META, getPropertyValue, getPropertyRange, heatColor, stateAtTemperature,
  getRadarData, type RadarPoint,
  type Element, type CategoryKey, type PropertyKey,
} from './data/elements'
import { calculateMolarMass, type FormulaResult } from './utils/chemistry'

function cx(...a: (string | false | null | undefined)[]) { return a.filter(Boolean).join(' ') }

type ViewMode   = 'standard' | 'heatmap' | 'temperature'
type UnitSystem = 'scientific' | 'metric'

const STATE_COLORS: Record<string, string> = {
  Solid: '#60a5fa', Liquid: '#34d399', Gas: '#f472b6', Unknown: '#94a3b8',
}

type QuizKind = 'symbol_to_name' | 'name_to_symbol' | 'number' | 'category' | 'description'
interface QuizQ  { id: number; kind: QuizKind; prompt: string; answer: string; options: string[]; element: Element }
interface ElementOfDay { atomic_number: number; symbol: string; name: string }
interface ApiIsotope   { stable: boolean; abundance: number | null; mass_number: number }
interface ElementApiDetails {
  description?: string; fun_fact?: string; uses?: string; oxidation_states?: string
  atomic_radius?: number; electron_affinity?: number; discovered_by?: string
  discovery_location?: string; is_radioactive?: boolean; isotopes?: ApiIsotope[]; named_after?: string
}

const ELEMENTS_API_ORIGIN = 'https://api.periodictableofelements.org'
const WIKI_API_ORIGIN     = 'https://en.wikipedia.org'
const API_TIMEOUT_MS      = 8_000
const API_TEXT_LIMIT      = 4_000
const API_LABEL_LIMIT     = 160
const API_OXIDATION_LIMIT = 120
const API_MAX_ISOTOPES    = 64

/* ── Helpers ── */
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null }
function readStr(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.replace(/\s+/g, ' ').trim()
  if (!s) return undefined
  return s.length <= max ? s : `${s.slice(0, max).trimEnd()}…`
}
function readNum(v: unknown): number | undefined { return typeof v === 'number' && Number.isFinite(v) ? v : undefined }
function readInt(v: unknown, min: number, max: number): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined
}
function parseElementOfDay(v: unknown): ElementOfDay | null {
  if (!isRecord(v)) return null
  const n = readInt(v.atomic_number, 1, ELEMENTS.length)
  const sym = readStr(v.symbol, 3)
  const name = readStr(v.name, 64)
  if (!n || !sym || !name) return null
  if (!/^[A-Z][a-z]{0,2}$/.test(sym)) return null
  return { atomic_number: n, symbol: sym, name }
}
function parseElementDetails(v: unknown): ElementApiDetails | null {
  if (!isRecord(v)) return null
  const d: ElementApiDetails = {}
  const desc = readStr(v.description, API_TEXT_LIMIT); if (desc) d.description = desc
  const ff = readStr(v.fun_fact, API_TEXT_LIMIT);    if (ff) d.fun_fact = ff
  const uses = readStr(v.uses, API_TEXT_LIMIT);      if (uses) d.uses = uses
  const ox = readStr(v.oxidation_states, API_OXIDATION_LIMIT); if (ox) d.oxidation_states = ox
  const disc = readStr(v.discovered_by, API_LABEL_LIMIT);      if (disc) d.discovered_by = disc
  const loc = readStr(v.discovery_location, API_LABEL_LIMIT);  if (loc) d.discovery_location = loc
  const na = readStr(v.named_after, API_TEXT_LIMIT);           if (na) d.named_after = na
  const ar = readNum(v.atomic_radius); if (ar !== undefined) d.atomic_radius = ar
  const ea = readNum(v.electron_affinity); if (ea !== undefined) d.electron_affinity = ea
  if (typeof v.is_radioactive === 'boolean') d.is_radioactive = v.is_radioactive
  if (Array.isArray(v.isotopes)) {
    const seen = new Set<number>()
    const isos = v.isotopes.slice(0, API_MAX_ISOTOPES).flatMap(item => {
      if (!isRecord(item) || typeof item.stable !== 'boolean') return []
      const mn = readInt(item.mass_number, 1, 400)
      if (!mn || seen.has(mn)) return []
      seen.add(mn)
      const ra = readNum(item.abundance)
      const ab = ra !== undefined && ra >= 0 && ra <= 1 ? ra : null
      return [{ stable: item.stable, abundance: ab, mass_number: mn }]
    })
    if (isos.length > 0) d.isotopes = isos
  }
  return Object.keys(d).length > 0 ? d : null
}

async function fetchJson(path: string, base: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(new URL(path, base).toString(), {
    signal, cache: 'no-store', credentials: 'omit',
    headers: { Accept: 'application/json' },
    mode: 'cors', redirect: 'error', referrerPolicy: 'no-referrer',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ct = res.headers.get('content-type')?.toLowerCase() ?? ''
  if (ct && !ct.includes('application/json')) throw new Error('Bad content type')
  return res.json() as Promise<unknown>
}

async function fetchWikiImage(name: string, signal: AbortSignal): Promise<string | null> {
  try {
    const data = await fetchJson(
      `/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      WIKI_API_ORIGIN, signal,
    ) as { thumbnail?: { source?: string }; originalimage?: { source?: string } }
    return data?.thumbnail?.source ?? null
  } catch { return null }
}

function readStoredNumber(pk: string, lk: string): number {
  try {
    const v = Number(localStorage.getItem(pk) || localStorage.getItem(lk) || 0)
    return Number.isFinite(v) && v >= 0 ? v : 0
  } catch { return 0 }
}
function formatTemperature(k: number | null, u: UnitSystem): string {
  if (k == null) return '—'
  return u === 'scientific' ? `${formatNumber(k, 2)} K` : `${formatNumber(k - 273.15, 2)} °C`
}

/* ──────────── Dialog hook ──────────── */
function useDialog(onClose: () => void) {
  const ref  = useRef<HTMLDivElement>(null)
  const cbRef = useRef(onClose)
  useEffect(() => { cbRef.current = onClose }, [onClose])
  useEffect(() => {
    const el   = ref.current
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const prevO = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const f = requestAnimationFrame(() => el?.focus())
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cbRef.current(); return }
      if (e.key !== 'Tab' || !el) return
      const foc = Array.from(el.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),[href],[tabindex]:not([tabindex="-1"])',
      ))
      if (!foc.length) { e.preventDefault(); el.focus(); return }
      const [first, last] = [foc[0], foc[foc.length - 1]]
      if (e.shiftKey && document.activeElement === first)  { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', kd)
    return () => { cancelAnimationFrame(f); document.removeEventListener('keydown', kd); document.body.style.overflow = prevO; prev?.focus() }
  }, [])
  return ref
}

/* ──────────── Quiz helpers ──────────── */
function shuffle<T>(a: T[]): T[] { const r=[...a]; for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r }
function makeQuiz(id: number): QuizQ {
  const el = ELEMENTS[Math.floor(Math.random()*ELEMENTS.length)]
  const kinds: QuizKind[] = ['symbol_to_name','name_to_symbol','number','category','description']
  const kind = kinds[Math.floor(Math.random()*kinds.length)]
  const w3 = (f:(e:Element)=>string) => shuffle(ELEMENTS.filter(x=>x.atomicNumber!==el.atomicNumber)).slice(0,3).map(f)
  if (kind==='symbol_to_name') return {id,kind,prompt:`What element has the symbol ${el.symbol}?`,answer:el.name,options:shuffle([el.name,...w3(e=>e.name)]),element:el}
  if (kind==='name_to_symbol') return {id,kind,prompt:`What is the chemical symbol for ${el.name}?`,answer:el.symbol,options:shuffle([el.symbol,...w3(e=>e.symbol)]),element:el}
  if (kind==='number') {
    const opts = new Set([String(el.atomicNumber)])
    for (const d of shuffle([-5,-3,-2,2,3,5])) { opts.add(String(Math.min(118,Math.max(1,el.atomicNumber+d)))); if(opts.size===4)break }
    while(opts.size<4) opts.add(String(Math.floor(Math.random()*118)+1))
    return {id,kind,prompt:`What is the atomic number of ${el.name}?`,answer:String(el.atomicNumber),options:shuffle([...opts]),element:el}
  }
  if (kind==='category') {
    const cats=Array.from(new Set(ELEMENTS.map(e=>e.category)))
    const w=shuffle(cats.filter(c=>c!==el.category)).slice(0,3)
    return {id,kind,prompt:`${el.name} (${el.symbol}) belongs to which category?`,answer:el.category,options:shuffle([el.category,...w]),element:el}
  }
  return {id,kind,prompt:`Which element is described? "${el.description.slice(0,120)}…"`,answer:el.name,options:shuffle([el.name,...w3(e=>e.name)]),element:el}
}

/* ──────────── Background ──────────── */
function Bg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <div className="absolute inset-0" style={{backgroundImage:[
        'radial-gradient(115% 85% at 72% -8%, rgba(124,58,237,0.22), transparent 50%)',
        'radial-gradient(105% 72% at -9% 14%, rgba(8,145,178,0.16), transparent 50%)',
        'radial-gradient(95% 65% at 106% 95%, rgba(219,39,119,0.12), transparent 50%)',
      ].join(',')}} />
      {/* Animated orbs */}
      <div className="absolute w-[720px] h-[720px] rounded-full blur-[160px] bg-violet-600/[0.08] animate-[orb_28s_ease-in-out_infinite] -top-[14%] right-[6%]" />
      <div className="absolute w-[560px] h-[560px] rounded-full blur-[130px] bg-cyan-500/[0.07]  animate-[orb2_34s_ease-in-out_infinite] bottom-[1%] -left-[10%]" />
      <div className="absolute w-[440px] h-[440px] rounded-full blur-[115px] bg-fuchsia-500/[0.07] animate-[orb3_22s_ease-in-out_infinite] top-[36%] -right-[8%]" />
      <div className="absolute w-[380px] h-[380px] rounded-full blur-[100px] bg-indigo-400/[0.06] animate-[orb2_38s_ease-in-out_infinite_reverse] top-[62%] left-[26%]" />
      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage:'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
        backgroundSize:'32px 32px',
      }} />
    </div>
  )
}

/* ──────────── Tile ──────────── */
function Tile({ el, isSel, vis, onClick, onCtx, inCmp, delay, vm, hp, tk, dark }: {
  el: Element; isSel: boolean; vis: boolean; onClick: ()=>void; onCtx: ()=>void
  inCmp: boolean; delay: number; vm: ViewMode; hp: PropertyKey; tk: number; dark: boolean
}) {
  const m = CATEGORY_META[el.categoryKey]
  let fill = m.color, label = formatNumber(el.atomicMass, 2), hasData = true
  if (vm === 'heatmap') {
    const v = getPropertyValue(el, hp)
    if (v == null) { hasData = false; fill = '#94a3b8' }
    else { const {min,max} = getPropertyRange(hp); fill = heatColor((v-min)/(max-min||1)); label = formatNumber(v,v<10?2:0) }
  } else if (vm === 'temperature') {
    const st = stateAtTemperature(el, tk); fill = STATE_COLORS[st]; label = st==='Unknown'?'?':st; if (st==='Unknown') hasData=false
  }
  const isHeatmap = vm === 'heatmap'
  const isTemp    = vm === 'temperature'
  const isDataMode = isHeatmap || isTemp
  const tileBg = isHeatmap
    ? (hasData ? fill : 'var(--bg-input)')
    : isTemp ? fill
    : dark
      ? `linear-gradient(155deg, ${m.color}24, ${m.color}0c 55%, transparent)`
      : `linear-gradient(155deg, ${m.color}32, ${m.color}0e 60%, #fff)`

  return (
    <button
      onClick={onClick} onContextMenu={e=>{e.preventDefault();onCtx()}}
      aria-label={`${el.name}, ${el.symbol}, atomic number ${el.atomicNumber}`}
      style={{
        gridColumn: el.xpos, gridRow: el.ypos,
        animationDelay: `${delay}ms`,
        background: tileBg,
        '--cat-color':  `${m.color}55`,
        '--cat-border': `${m.color}65`,
      } as React.CSSProperties}
      className={cx(
        'tile-glow relative text-left rounded-xl border px-[7px] py-1.5 sm:px-[9px] sm:py-2',
        'min-h-[56px] sm:min-h-[66px] group overflow-hidden',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
        'transition-all duration-200 opacity-0 animate-[tileIn_.38s_cubic-bezier(.34,1.56,.64,1)_forwards]',
        isSel
          ? 'border-[var(--accent)]/55 ring-2 ring-[var(--accent)]/20 z-20 scale-[1.07] shadow-[var(--shadow-glow)]'
          : inCmp
          ? 'border-amber-400/65 ring-1 ring-amber-400/30 z-10 shadow-md'
          : isDataMode
          ? 'border-transparent hover:scale-[1.05] hover:z-10'
          : 'border-[var(--border)] hover:-translate-y-[3px] hover:z-10',
        !vis && '!opacity-[0.12] !animate-none grayscale saturate-0 pointer-events-none',
      )}>
      {/* Category colour stripe at top */}
      {!isDataMode && (
        <div className="absolute top-0 left-[6px] right-[6px] h-[2.5px] rounded-b-none rounded-t-none rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-200"
          style={{background: m.color}} />
      )}
      {/* Compare badge */}
      {inCmp && (
        <span className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-amber-400 text-[8px] font-black flex items-center justify-center text-zinc-900 shadow-md">✓</span>
      )}

      <div className="relative mt-1">
        <div className="font-mono text-[8px] sm:text-[9.5px] tabular-nums font-semibold mb-0.5"
          style={{color: isDataMode ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)'}}>
          {el.atomicNumber}
        </div>
        <div className="font-display text-[14px] sm:text-[20px] leading-none font-black tracking-[-0.03em] mb-[3px]"
          style={{color: isDataMode ? '#fff' : 'var(--text-primary)'}}>
          {el.symbol}
        </div>
        <div className="text-[7.5px] sm:text-[9.5px] truncate font-medium leading-tight"
          style={{color: isDataMode ? 'rgba(255,255,255,0.88)' : 'var(--text-secondary)'}}>
          {el.name}
        </div>
        <div className="font-mono text-[7px] sm:text-[8.5px] tabular-nums truncate font-semibold mt-[1px]"
          style={{color: isDataMode ? 'rgba(255,255,255,0.92)' : 'var(--text-muted)'}}>
          {label}
        </div>
      </div>
    </button>
  )
}

/* ──────────── Molar Mass Calculator ──────────── */
function MolarCalc() {
  const [f, setF] = useState('')
  const [r, setR] = useState<FormulaResult | null>(null)
  const [err, setErr] = useState('')
  const calc = (e: React.FormEvent) => {
    e.preventDefault()
    try { setR(calculateMolarMass(f)); setErr('') }
    catch (er) { setR(null); setErr(er instanceof Error ? er.message : 'Invalid formula.') }
  }
  return (
    <div>
      <p className="text-[12px] mb-4 leading-relaxed" style={{color:'var(--text-muted)'}}>
        Runs fully offline. Supports parentheses, brackets, and subscripts.
      </p>
      <form onSubmit={calc} className="flex flex-col sm:flex-row gap-2.5">
        <label htmlFor="molar-formula" className="sr-only">Chemical formula</label>
        <input
          id="molar-formula" value={f} onChange={e=>setF(e.target.value)}
          placeholder="H₂SO₄  or  Ca(OH)₂" maxLength={80}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          className="min-w-0 flex-1 font-mono rounded-2xl px-4 py-3 text-[14px] outline-none transition-all duration-200 focus:shadow-[0_0_0_2px_var(--focus-ring)]"
          style={{background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--text-primary)'}}
        />
        <button type="submit"
          className="w-full sm:w-auto text-white px-6 py-3 rounded-2xl text-[13px] font-bold accent-gradient shadow-[0_6px_20px_-4px_color-mix(in_srgb,var(--accent)_55%,transparent)] active:scale-[0.97] hover:-translate-y-px hover:shadow-[0_8px_28px_-4px_color-mix(in_srgb,var(--accent)_65%,transparent)] transition-all">
          Calculate
        </button>
      </form>
      {err && <p className="mt-3 text-[12px] font-medium" style={{color:'var(--danger-text)'}} role="alert">{err}</p>}
      {r && (
        <div className="mt-5 animate-[fadeUp_.3s_ease]" aria-live="polite">
          <div className="section-label mb-3">Result</div>
          <div className="p-4 rounded-2xl mb-3 flex items-baseline gap-3" style={{background:'var(--accent-soft)',border:'1px solid var(--border-accent)'}}>
            <span className="font-display text-[32px] font-extrabold tracking-[-0.04em] tabular-nums text-gradient">{r.molarMass.toFixed(4)}</span>
            <span className="font-mono text-[13px]" style={{color:'var(--text-muted)'}}>g / mol</span>
          </div>
          <div className="space-y-1.5">
            {r.breakdown.map(b=>(
              <div key={b.symbol} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl" style={{background:'var(--bg-input)',border:'1px solid var(--border)'}}>
                <div className="flex items-center gap-2.5">
                  <span className="font-display font-black text-[15px]" style={{color:'var(--text-primary)'}}>{b.symbol}</span>
                  <span className="text-[11px] font-medium" style={{color:'var(--text-muted)'}}>× {b.count}</span>
                </div>
                <span className="font-mono text-[11.5px] font-semibold" style={{color:'var(--text-muted)'}}>{b.subtotal.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════ */
export default function App() {
  const dark = true

  const [selected, setSelected] = useState<Element|null>(null)
  const [search,   setSearch]   = useState('')
  const [catFilter, setCatFilter] = useState<Set<CategoryKey>>(new Set(CATEGORY_ORDER))
  const [vm, setVm] = useState<ViewMode>('standard')
  const [hp, setHp] = useState<PropertyKey>('electronegativity')
  const [tk, setTk] = useState(298)
  const [cmpList,  setCmpList]  = useState<Element[]>([])
  const [showCmp,  setShowCmp]  = useState(false)
  const [tab,      setTab]      = useState<'guide'|'quiz'|'calc'>('guide')
  const [units,    setUnits]    = useState<UnitSystem>('scientific')
  const [dayEl,    setDayEl]    = useState<ElementOfDay|null>(null)

  const searchRef  = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const sbTimerRef = useRef<number|null>(null)
  const qTimerRef  = useRef<number|null>(null)

  const [qq,      setQq]      = useState<QuizQ>(()=>makeQuiz(1))
  const [qs,      setQs]      = useState({c:0,t:0,streak:0,best:0})
  const [qf,      setQf]      = useState<null|{ch:string;ok:boolean}>(null)
  const [qDone,   setQDone]   = useState(false)
  const [hiScore, setHiScore] = useState(()=>readStoredNumber('elementra-hi','labrium-hi'))
  const [isNewBest,setIsNewBest]=useState(false)
  const QL = 12

  const goTo = (t: 'guide'|'quiz'|'calc') => {
    setTab(t)
    if (sbTimerRef.current) window.clearTimeout(sbTimerRef.current)
    sbTimerRef.current = window.setTimeout(() => sidebarRef.current?.scrollIntoView({behavior:'smooth',block:'start'}), 120)
  }

  useEffect(()=>()=>{ if(sbTimerRef.current) window.clearTimeout(sbTimerRef.current); if(qTimerRef.current) window.clearTimeout(qTimerRef.current) },[])

  /* Element of the day */
  useEffect(()=>{
    const ctrl = new AbortController()
    const t = window.setTimeout(()=>ctrl.abort(), API_TIMEOUT_MS)
    fetchJson('/elements/element-of-the-day/', ELEMENTS_API_ORIGIN, ctrl.signal)
      .then(parseElementOfDay).then(setDayEl).catch(()=>{ if(!ctrl.signal.aborted) setDayEl(null) })
      .finally(()=>window.clearTimeout(t))
    return ()=>{ window.clearTimeout(t); ctrl.abort() }
  },[])

  const filtered = useMemo(()=>{
    const q = search.trim().toLowerCase()
    return ELEMENTS.filter(el=>{
      if (q && !el.name.toLowerCase().includes(q) && !el.symbol.toLowerCase().includes(q) && String(el.atomicNumber)!==q) return false
      return catFilter.has(el.categoryKey)
    })
  },[search,catFilter])
  const visSet = useMemo(()=>new Set(filtered.map(e=>e.atomicNumber)),[filtered])
  const stats  = useMemo(()=>({
    s: ELEMENTS.filter(e=>e.state==='Solid').length,
    l: ELEMENTS.filter(e=>e.state==='Liquid').length,
    g: ELEMENTS.filter(e=>e.state==='Gas').length,
  }),[])

  /* Keyboard shortcuts */
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key==='Escape') setSelected(null)
      if (selected&&(e.key==='ArrowLeft'||e.key==='ArrowRight')) {
        e.preventDefault()
        const i=ELEMENTS.findIndex(x=>x.atomicNumber===selected.atomicNumber)
        setSelected(e.key==='ArrowRight' ? ELEMENTS[Math.min(117,i+1)] : ELEMENTS[Math.max(0,i-1)])
      }
    }
    window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h)
  },[selected])

  const answerQuiz=(ch:string)=>{
    if (qf||qDone) return
    const ok = ch===qq.answer
    setQf({ch,ok})
    const ns = {c:qs.c+(ok?1:0),t:qs.t+1,streak:ok?qs.streak+1:0,best:Math.max(qs.best,ok?qs.streak+1:0)}
    setQs(ns)
    if (qTimerRef.current) window.clearTimeout(qTimerRef.current)
    qTimerRef.current = window.setTimeout(()=>{
      setQf(null)
      if (ns.t >= QL) {
        setQDone(true)
        if (ns.c > hiScore) { setIsNewBest(true); setHiScore(ns.c); try{localStorage.setItem('elementra-hi',String(ns.c))}catch{} }
        return
      }
      setQq(makeQuiz(qq.id+1))
    }, 820)
  }
  const resetQuiz = () => {
    if(qTimerRef.current) window.clearTimeout(qTimerRef.current)
    setQs({c:0,t:0,streak:0,best:0}); setQq(makeQuiz(1)); setQf(null); setQDone(false); setIsNewBest(false)
  }
  const toggleCat = (k:CategoryKey) => setCatFilter(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n})
  const toggleCmp = (el:Element) => setCmpList(p=>{
    if(p.find(e=>e.atomicNumber===el.atomicNumber)) return p.filter(e=>e.atomicNumber!==el.atomicNumber)
    if(p.length>=3) return [...p.slice(1),el]
    return [...p,el]
  })
  const clearFilters = () => { setSearch(''); setCatFilter(new Set(CATEGORY_ORDER)) }

  /* ── RENDER ── */
  return (
    <div className="min-h-screen min-h-dvh antialiased relative" style={{color:'var(--text-primary)'}}>
      <Bg />

      <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 xl:px-14 py-5 sm:py-8 lg:py-12">

        {/* ═══════════ HEADER ═══════════ */}
        <header className="mb-7 sm:mb-10 animate-[fadeUp_.5s_ease]">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="section-label">Periodic Table · 118 Elements</span>
                <span className="badge badge-accent">Dark Edition</span>
              </div>
              <h1 className="font-display font-black tracking-[-0.05em] leading-none" style={{fontSize:'clamp(22px,4.5vw,44px)'}}>
                <span className="text-gradient-animate">Elementra</span>
              </h1>
              <p className="mt-2 max-w-[40rem] text-[12.5px] sm:text-[13px]" style={{color:'var(--text-muted)'}}>
                Interactive periodic table, quiz, and molar-mass calculator in a single dark workspace.
              </p>
            </div>

            {/* Action bar */}
            <nav className="flex items-center gap-2 flex-wrap" aria-label="Main actions">
              <button onClick={()=>setSelected(ELEMENTS[Math.floor(Math.random()*ELEMENTS.length)])}
                aria-label="Open a random element"
                style={{background:'var(--bg-input)',border:'1px solid var(--border)'}}
                className="h-9 sm:h-10 px-4 sm:px-5 rounded-full text-[12.5px] sm:text-[13px] font-semibold transition-all hover:bg-[var(--bg-input-hover)] hover:-translate-y-px active:scale-[0.97]">
                Random
              </button>
              <button onClick={()=>goTo('quiz')}
                className="h-9 sm:h-10 px-4 sm:px-5 rounded-full text-[12.5px] sm:text-[13px] font-bold text-white active:scale-[0.97] transition-all accent-gradient shadow-[0_6px_20px_-4px_color-mix(in_srgb,var(--accent)_55%,transparent)] hover:shadow-[0_8px_28px_-4px_color-mix(in_srgb,var(--accent)_65%,transparent)] hover:-translate-y-px">
                Quiz
              </button>
              <button onClick={()=>goTo('calc')}
                className="h-9 sm:h-10 px-4 sm:px-5 rounded-full text-[12.5px] sm:text-[13px] font-semibold active:scale-[0.97] transition-all hover:bg-[var(--bg-input-hover)] hover:-translate-y-px"
                style={{background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--text-secondary)'}}>
                Calc
              </button>
              <button onClick={clearFilters}
                className="h-9 sm:h-10 px-3 sm:px-4 rounded-full text-[12px] font-medium transition-all hover:bg-[var(--bg-input)] hover:scale-[1.02]"
                style={{color:'var(--text-muted)'}}>
                Reset
              </button>
            </nav>
          </div>

          {/* ── Stats bar ── */}
          <div className="grid grid-cols-2 min-[480px]:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-5">
            {[
              {l:'Elements', v:'118',             c:'rgba(124,58,237,0.15)'},
              {l:'Solids',   v:String(stats.s),   c:'rgba(52,211,153,0.12)'},
              {l:'Liquids',  v:String(stats.l),   c:'rgba(56,189,248,0.12)'},
              {l:'Gases',    v:String(stats.g),   c:'rgba(192,132,252,0.12)'},
            ].map(s=>(
              <div key={s.l}
                className="group relative rounded-2xl overflow-hidden px-4 py-3.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] cursor-default"
                style={{background:'var(--bg-card)',border:'1px solid var(--border)',boxShadow:'var(--shadow-sm)'}}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{background:`radial-gradient(180px at 50% 130%, ${s.c}, transparent 70%)`}} />
                <div className="relative">
                  <div>
                    <div className="section-label truncate">{s.l}</div>
                    <div className="font-display text-[24px] sm:text-[30px] font-extrabold tabular-nums tracking-[-0.035em] leading-none mt-2" style={{color:'var(--text-primary)'}}>{s.v}</div>
                  </div>
                </div>
              </div>
            ))}

            {/* Element of the Day */}
            {dayEl ? (
              <button
                onClick={()=>{ const f=ELEMENTS.find(e=>e.atomicNumber===dayEl.atomic_number); if(f) setSelected(f) }}
                className="col-span-2 rounded-2xl px-4 py-3.5 flex items-center gap-3.5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] group"
                style={{background:'var(--accent-soft)',border:'1px solid var(--border-accent)',boxShadow:`0 4px 24px -4px var(--accent-glow)`}}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-black text-[17px] text-white shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                  style={{background:'var(--accent)',boxShadow:`0 4px 16px -2px var(--accent-glow)`}}>
                  {dayEl.symbol}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="section-label" style={{color:'var(--accent)'}}>Element of the Day</div>
                  <div className="font-display font-bold text-[15px] truncate mt-0.5" style={{color:'var(--text-primary)'}}>{dayEl.name}</div>
                </div>
                <span className="text-[15px] opacity-35 group-hover:opacity-90 group-hover:translate-x-2 transition-all duration-300" style={{color:'var(--accent)'}}>→</span>
              </button>
            ) : (
              <div className="col-span-2 rounded-2xl px-4 py-3.5 flex items-center gap-3.5"
                style={{background:'var(--bg-card)',border:'1px solid var(--border)',boxShadow:'var(--shadow-sm)'}}>
                <div className="w-11 h-11 rounded-xl shrink-0 shimmer" style={{background:'var(--img-placeholder)'}} />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 rounded-full w-20 shimmer" style={{background:'var(--img-placeholder)'}} />
                  <div className="h-4 rounded-full w-28 shimmer" style={{background:'var(--img-placeholder)'}} />
                </div>
              </div>
            )}

            {/* Units toggle */}
            <div className="col-span-2 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3"
              style={{background:'var(--bg-card)',border:'1px solid var(--border)',boxShadow:'var(--shadow-sm)'}}>
              <div>
                <div className="section-label">Temperature Units</div>
                <div className="font-display font-bold text-[14px] sm:text-[15px] mt-0.5" style={{color:'var(--text-primary)'}}>
                  {units==='scientific' ? 'SI · Kelvin' : 'Metric · °C'}
                </div>
              </div>
              <button onClick={()=>setUnits(u=>u==='scientific'?'metric':'scientific')}
                aria-label={`Switch to ${units==='scientific'?'Celsius':'Kelvin'}`}
                className="px-3.5 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                style={{background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--text-muted)'}}>
                Toggle
              </button>
            </div>
          </div>
        </header>

        {/* ═══════════ SEARCH + FILTER ═══════════ */}
        <section className="rounded-2xl px-4 sm:px-5 py-4 mb-6" aria-label="Search and filter"
          style={{background:'var(--bg-card)',border:'1px solid var(--border)',boxShadow:'var(--shadow-sm)'}}>
          <div className="flex flex-col lg:flex-row gap-3.5">
            {/* Search input */}
            <div className="relative flex-1 group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] transition-transform duration-200 group-focus-within:scale-110"
                style={{color:'var(--text-muted)'}}>⌕</span>
              <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search name, symbol, or atomic number…"
                aria-label="Search elements" maxLength={64}
                className="w-full rounded-2xl pl-10 pr-[88px] py-3 text-[14px] font-medium outline-none transition-all duration-200 focus:shadow-[0_0_0_2.5px_var(--focus-ring)]"
                style={{background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--text-primary)'}} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] font-bold px-2.5 py-1 rounded-xl tabular-nums transition-all duration-200"
                style={{
                  background: filtered.length<118?'var(--accent-soft)':'var(--bg-elevated)',
                  color:       filtered.length<118?'var(--accent)':'var(--text-faint)',
                  border:      filtered.length<118?'1px solid var(--border-accent)':'1px solid var(--border)',
                }}>
                {filtered.length}<span style={{fontWeight:400,color:'var(--text-faint)'}}>/118</span>
              </span>
            </div>
            {/* Category pills */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_ORDER.map(k=>(
                <button key={k} onClick={()=>toggleCat(k)} aria-pressed={catFilter.has(k)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-[1.03]"
                  style={{
                    background:  catFilter.has(k) ? CATEGORY_META[k].color+'30' : 'var(--bg-input)',
                    border:      `1px solid ${catFilter.has(k) ? CATEGORY_META[k].color+'58' : 'var(--border)'}`,
                    color:       catFilter.has(k) ? '#fff' : 'var(--text-muted)',
                    boxShadow:   catFilter.has(k) ? `0 2px 12px -3px ${CATEGORY_META[k].color}40` : 'none',
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5 align-middle" style={{background:CATEGORY_META[k].color}} />
                  {CATEGORY_META[k].label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ GRID: TABLE + SIDEBAR ═══════════ */}
        <div className="grid grid-cols-12 gap-5 xl:gap-7">

          {/* ─── Periodic Table ─── */}
          <div className="col-span-12 xl:col-span-9">

            {/* View mode toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="flex p-1.5 rounded-2xl gap-1 self-start" style={{background:'var(--bg-input)',border:'1px solid var(--border)'}}>
                {([
                  {k:'standard',    l:'Categories', i:'🎨'},
                  {k:'heatmap',     l:'Heatmap',    i:'🌡️'},
                  {k:'temperature', l:'Phase Sim',  i:'🧊'},
                ] as const).map(v=>(
                  <button key={v.k} onClick={()=>setVm(v.k)} aria-pressed={vm===v.k}
                    className={cx(
                      'px-3 sm:px-4 py-2 rounded-xl text-[12px] font-bold transition-all duration-200 whitespace-nowrap',
                      vm===v.k
                        ? 'text-white accent-gradient shadow-[0_4px_14px_-4px_color-mix(in_srgb,var(--accent)_60%,transparent)] scale-[1.02]'
                        : 'hover:bg-[var(--bg-input-hover)]',
                    )}
                    style={vm!==v.k?{color:'var(--text-muted)'}:undefined}>
                    <span className="mr-1.5">{v.i}</span>{v.l}
                  </button>
                ))}
              </div>

              {vm==='heatmap'&&(
                <>
                  <label htmlFor="heatmap-property" className="sr-only">Heatmap property</label>
                  <select id="heatmap-property" value={hp} onChange={e=>setHp(e.target.value as PropertyKey)}
                    className="rounded-xl px-3.5 py-2.5 text-[12.5px] outline-none animate-[slideDown_.3s_ease] font-semibold"
                    style={{background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--text-primary)'}}>
                    {Object.entries(PROPERTY_META).map(([k,m])=><option key={k} value={k}>{m.icon} {m.label}</option>)}
                  </select>
                </>
              )}

              {vm==='temperature'&&(
                <div className="flex flex-col gap-2.5 flex-1 animate-[slideDown_.3s_ease]">
                  <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
                    <input type="range" min={1} max={6000} value={tk} onChange={e=>setTk(Number(e.target.value))}
                      aria-label="Simulation temperature in Kelvin" aria-valuetext={`${tk} Kelvin`}
                      className="w-full min-[420px]:flex-1 accent-[var(--accent)]" />
                    <div className="font-mono text-[13px] font-bold min-[420px]:w-[140px] min-[420px]:text-right" style={{color:'var(--text-primary)'}}>
                      {tk} K <span className="font-normal" style={{color:'var(--text-muted)'}}>({(tk-273.15).toFixed(0)} °C)</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[{l:'❄️ 0 K',v:1},{l:'Room',v:298},{l:'100 °C',v:373},{l:'🔥 1000 K',v:1000},{l:'☀️ 6000 K',v:6000}].map(p=>(
                      <button key={p.v} onClick={()=>setTk(p.v)}
                        className={cx('px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all',tk===p.v?'scale-[1.04]':'')}
                        style={tk===p.v
                          ?{background:'var(--accent)',color:'#fff',boxShadow:`0 4px 14px -4px var(--accent-glow)`}
                          :{background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--text-muted)'}}>
                        {p.l}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-medium" style={{color:'var(--text-faint)'}}>Simplified phase estimate · approximately 1 atm</p>
                </div>
              )}

              {cmpList.length>0&&(
                <button onClick={()=>setShowCmp(true)}
                  className="sm:ml-auto px-5 py-2.5 rounded-xl text-[12.5px] font-bold transition-all animate-[popIn_.3s_ease] hover:scale-105 active:scale-95 text-white"
                  style={{background:'linear-gradient(135deg,#f59e0b,#f97316)',boxShadow:'0 4px 16px -4px rgba(245,158,11,0.55)'}}>
                  ⚖️ Compare ({cmpList.length})
                </button>
              )}
            </div>

            {/* Table card */}
            <div className="rounded-[22px] sm:rounded-[26px] p-3 sm:p-5 xl:p-6 w-full"
              style={{background:'var(--bg-card)',border:'1px solid var(--border)',boxShadow:'var(--shadow-lg)'}}>
              <div className="w-full overflow-x-auto pb-3 overscroll-x-contain -mx-1.5 px-1.5">
                <div className="min-w-[880px] sm:min-w-[960px]"
                  style={{display:'grid',gridTemplateColumns:'repeat(18, minmax(48px,1fr))',gap:'5px'}}>
                  {ELEMENTS.map((el,i)=>(
                    <Tile key={el.atomicNumber}
                      el={el} isSel={selected?.atomicNumber===el.atomicNumber} vis={visSet.has(el.atomicNumber)}
                      onClick={()=>setSelected(el)} onCtx={()=>toggleCmp(el)}
                      inCmp={!!cmpList.find(e=>e.atomicNumber===el.atomicNumber)}
                      delay={Math.min(i*4,460)} vm={vm} hp={hp} tk={tk} dark={dark} />
                  ))}
                  <div style={{gridColumn:3,gridRow:6,color:'var(--text-faint)'}} className="text-[9.5px] font-bold flex items-end pb-1 pl-1.5">57–71</div>
                  <div style={{gridColumn:3,gridRow:7,color:'var(--text-faint)'}} className="text-[9.5px] font-bold flex items-end pb-1 pl-1.5">89–103</div>
                </div>
              </div>

              {/* Legends */}
              <div className="flex flex-wrap gap-x-3.5 gap-y-2 mt-4 pt-4" style={{borderTop:'1px solid var(--border)'}}>
                {vm==='standard'&&CATEGORY_ORDER.map(k=>(
                  <span key={k} className="flex items-center gap-1.5 text-[10.5px]" style={{color:'var(--text-muted)'}}>
                    <span className="w-2.5 h-2.5 rounded-sm" style={{background:CATEGORY_META[k].color}} />
                    {CATEGORY_META[k].label}
                  </span>
                ))}
                {vm==='heatmap'&&(()=>{const{min,max}=getPropertyRange(hp);const pm=PROPERTY_META[hp];return(
                  <div className="w-full">
                    <div className="flex justify-between text-[11px] mb-2 font-medium" style={{color:'var(--text-muted)'}}>
                      <span>{pm.icon} {pm.label}{pm.unit&&` (${pm.unit})`}</span>
                      <span className="text-[10px]" style={{color:'var(--text-faint)'}}>Right-click a tile to compare</span>
                    </div>
                    <div className="h-3.5 rounded-full overflow-hidden"
                      style={{background:`linear-gradient(90deg,${heatColor(0)},${heatColor(.25)},${heatColor(.5)},${heatColor(.75)},${heatColor(1)})`}} />
                    <div className="flex justify-between font-mono text-[10px] mt-1.5 tabular-nums" style={{color:'var(--text-muted)'}}>
                      <span>{formatNumber(min,1)}</span><span>{formatNumber(max,1)}</span>
                    </div>
                  </div>
                )})()}
                {vm==='temperature'&&Object.entries(STATE_COLORS).map(([st,c])=>(
                  <span key={st} className="flex items-center gap-1.5 text-[11px]" style={{color:'var(--text-muted)'}}>
                    <span className="w-2.5 h-2.5 rounded-sm" style={{background:c,boxShadow:`0 0 6px ${c}60`}} />{st}
                  </span>
                ))}
              </div>

              {/* Empty state */}
              {filtered.length===0&&(
                <div className="mt-6 rounded-2xl px-6 py-14 text-center animate-[fadeUp_.3s_ease]" style={{border:'1px dashed var(--border)'}}>
                  <div className="text-[38px] mb-3">🔍</div>
                  <p className="font-semibold mb-1" style={{color:'var(--text-secondary)'}}>No elements match</p>
                  <p className="text-[12px] mb-4" style={{color:'var(--text-muted)'}}>Try adjusting search or category filters</p>
                  <button onClick={clearFilters}
                    className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:scale-105 active:scale-95"
                    style={{background:'var(--accent-soft)',border:'1px solid var(--border-accent)',color:'var(--accent)'}}>
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ─── Sidebar ─── */}
          <aside ref={sidebarRef} className="col-span-12 xl:col-span-3 scroll-mt-20">
            <div className="rounded-[20px] sm:rounded-[22px] overflow-hidden xl:sticky xl:top-6"
              style={{background:'var(--bg-card)',border:'1px solid var(--border)',boxShadow:'var(--shadow)'}}>

              {/* Tabs */}
              <div className="flex p-2 gap-1" style={{borderBottom:'1px solid var(--border)'}}>
                {([{k:'guide',l:'Guide'},{k:'quiz',l:'Quiz'},{k:'calc',l:'Calc'}] as const).map(t=>(
                  <button key={t.k} onClick={()=>setTab(t.k)} role="tab" aria-selected={tab===t.k}
                    className={cx('flex-1 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-center transition-all duration-200 rounded-xl',
                    tab===t.k?'shadow-sm':'hover:bg-[var(--bg-input-hover)]')}
                    style={{
                      color:      tab===t.k?'var(--accent)':'var(--text-muted)',
                      background: tab===t.k?'var(--accent-soft)':'transparent',
                      border:     tab===t.k?'1px solid var(--border-accent)':'1px solid transparent',
                    }}>
                    <span>{t.l}</span>
                  </button>
                ))}
              </div>

              {/* Tab panels */}
              <div className="p-5 sm:p-6 min-h-[340px]" role="tabpanel">

                {tab==='guide'&&(
                  <div className="space-y-4 animate-[fadeUp_.35s_ease]">
                    <h3 className="font-display font-bold text-[17px] tracking-[-0.025em]" style={{color:'var(--text-primary)'}}>Lab Guide</h3>
                    {vm==='heatmap'&&(
                      <div className="p-3.5 rounded-2xl" style={{background:'var(--bg-input)',border:'1px solid var(--border)'}}>
                        <div className="section-label mb-2.5">Property Trend</div>
                        <TrendGraph propKey={hp} />
                      </div>
                    )}
                    <ul className="space-y-3">
                      {[
                        {i:'⌨️',t:'Arrow keys navigate between elements'},
                        {i:'🔍',t:'Ctrl / ⌘ K to focus search'},
                        {i:'⚖️',t:'Right-click a tile or use Compare in its profile'},
                        {i:'🌡️',t:'Heatmap reveals periodic property trends'},
                        {i:'🧊',t:'Phase model simulates state at ~1 atm'},
                        {i:'⚗️',t:'Offline molar mass calculator'},
                        {i:'📷',t:'Element photos loaded from Wikipedia'},
                      ].map(x=>(
                        <li key={x.t} className="flex gap-3 text-[12.5px] items-start leading-snug group" style={{color:'var(--text-muted)'}}>
                          <span className="shrink-0 text-[14px] mt-0.5 group-hover:scale-110 transition-transform">{x.i}</span>
                          <span>{x.t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {tab==='quiz'&&(
                  <div className="animate-[fadeUp_.35s_ease]">
                    {qDone ? (
                      <div className="text-center py-4">
                        <div className="text-[52px] mb-3 animate-[popIn_.4s_ease]">{qs.c>=10?'🏆':qs.c>=7?'🎉':'📚'}</div>
                        <div className="font-display font-black text-[22px] tracking-[-0.035em]" style={{color:'var(--text-primary)'}}>Quiz Complete!</div>
                        <div className="font-mono text-[14px] mt-1.5 font-semibold" style={{color:'var(--text-muted)'}}>{qs.c} / {QL} correct — {Math.round(qs.c/QL*100)}%</div>
                        {isNewBest&&(
                          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold animate-[popIn_.4s_ease_.15s_both]"
                            style={{background:'rgba(245,158,11,0.12)',color:'#b45309',border:'1px solid rgba(245,158,11,0.3)'}}>
                            🥇 New personal best!
                          </div>
                        )}
                        <div className="font-mono text-[11px] mt-2" style={{color:'var(--text-faint)'}}>All-time best: {Math.max(hiScore,qs.c)} / {QL}</div>
                        <button onClick={resetQuiz}
                          className="w-full mt-5 text-white font-bold py-3.5 rounded-2xl accent-gradient shadow-[0_6px_20px_-4px_color-mix(in_srgb,var(--accent)_55%,transparent)] active:scale-[0.98] hover:-translate-y-px hover:shadow-[0_8px_28px_-4px_color-mix(in_srgb,var(--accent)_65%,transparent)] transition-all">
                          Play Again
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-3">
                          <span className="section-label">Q {qs.t+1} of {QL}</span>
                          <div className="flex gap-3 font-mono text-[11.5px] font-bold">
                            <span style={{color:'#10b981'}}>✓ {qs.c}</span>
                            <span style={{color:'#f59e0b'}}>🔥 {qs.streak}</span>
                          </div>
                        </div>
                        <div className="h-[3px] rounded-full overflow-hidden mb-4"
                          role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={QL} aria-valuenow={qs.t}
                          style={{background:'var(--bg-input)'}}>
                          <div className="h-full rounded-full accent-gradient transition-all duration-500" style={{width:`${(qs.t/QL)*100}%`}} />
                        </div>
                        <p className="font-display font-semibold text-[15px] mb-4 leading-[1.45] tracking-[-0.015em]"
                          style={{color:'var(--text-primary)'}}>{qq.prompt}</p>
                        <div className="space-y-2">
                          {qq.options.map(o=>{
                            const chosen=qf?.ch===o, isAns=o===qq.answer, green=!!qf&&isAns, red=!!qf&&chosen&&!qf.ok
                            return (
                              <button key={o} onClick={()=>answerQuiz(o)} disabled={!!qf}
                                className={cx('w-full text-left px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-200',
                                  green?'scale-[1.01]':red?'scale-[0.99]':'hover:scale-[1.01] active:scale-[0.98]')}
                                style={green
                                  ?{background:'var(--success-bg)',color:'var(--success-text)',border:'1px solid var(--success-border)',boxShadow:'0 2px 12px -2px rgba(16,185,129,0.2)'}
                                  :red
                                  ?{background:'var(--danger-bg)',color:'var(--danger-text)',border:'1px solid var(--danger-border)'}
                                  :{background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--text-secondary)'}}>
                                {green?'✓ ':red?'✗ ':''}{o}
                              </button>
                            )
                          })}
                        </div>
                        <div className="sr-only" aria-live="polite">
                          {qf?(qf.ok?'Correct.':`Incorrect. The answer is ${qq.answer}.`):''}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {tab==='calc'&&<div className="animate-[fadeUp_.35s_ease]"><MolarCalc /></div>}
              </div>
            </div>
          </aside>
        </div>

        {/* ═══════════ FOOTER ═══════════ */}
        <footer className="mt-12 sm:mt-16 pt-5 sm:pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]"
          style={{borderTop:'1px solid var(--border)',color:'var(--text-faint)'}}>
          <div className="flex items-center flex-wrap justify-center sm:justify-start gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{background:'var(--accent)'}} />
            <span>Data: open periodic-table datasets</span>
            <span>·</span>
            <span>
              Details:{' '}
              <a href="https://periodictableofelements.org/" target="_blank" rel="noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-[var(--text-muted)]"
                style={{color:'var(--text-muted)'}}>PeriodicTableOfElements.org</a>
            </span>
            <span>·</span>
            <span>
              Photos:{' '}
              <a href="https://en.wikipedia.org/" target="_blank" rel="noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-[var(--text-muted)]"
                style={{color:'var(--text-muted)'}}>Wikipedia Commons (CC)</a>
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span>118 elements</span>
            <span style={{color:'var(--border-strong)'}}>·</span>
            <span>Ctrl/⌘ K search</span>
            <span style={{color:'var(--border-strong)'}}>·</span>
            <span>Keyboard nav</span>
          </div>
        </footer>
      </div>

      {/* Modals */}
      {selected&&(
        <Modal el={selected} dark={dark} units={units}
          inCompare={cmpList.some(i=>i.atomicNumber===selected.atomicNumber)}
          onToggleCompare={()=>toggleCmp(selected)}
          onClose={()=>setSelected(null)}
          onPrev={()=>{const i=ELEMENTS.findIndex(e=>e.atomicNumber===selected.atomicNumber);if(i>0)setSelected(ELEMENTS[i-1])}}
          onNext={()=>{const i=ELEMENTS.findIndex(e=>e.atomicNumber===selected.atomicNumber);if(i<117)setSelected(ELEMENTS[i+1])}} />
      )}
      {showCmp&&cmpList.length>0&&(
        <CmpModal els={cmpList} onClose={()=>setShowCmp(false)}
          onRm={el=>setCmpList(p=>p.filter(e=>e.atomicNumber!==el.atomicNumber))}
          onClear={()=>{setCmpList([]);setShowCmp(false)}} />
      )}
    </div>
  )
}

/* ══════════════════════════════════════
   ELEMENT MODAL
   ══════════════════════════════════════ */
function Modal({el,dark,units,inCompare,onToggleCompare,onClose,onPrev,onNext}: {
  el: Element; dark: boolean; units: UnitSystem; inCompare: boolean
  onToggleCompare:()=>void; onClose:()=>void; onPrev:()=>void; onNext:()=>void
}) {
  const m = CATEGORY_META[el.categoryKey]
  const [api,       setApi]       = useState<ElementApiDetails|null>(null)
  const [loading,   setLoading]   = useState(true)
  const [wikiImg,   setWikiImg]   = useState<string|null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError,  setImgError]  = useState(false)
  const dialogRef = useDialog(onClose)

  /* Fetch element API details */
  useEffect(()=>{
    const ctrl = new AbortController()
    const t = window.setTimeout(()=>ctrl.abort(), API_TIMEOUT_MS)
    setApi(null); setLoading(true)
    fetchJson(`/elements/${el.atomicNumber}/`, ELEMENTS_API_ORIGIN, ctrl.signal)
      .then(parseElementDetails).then(setApi).catch(()=>setApi(null))
      .finally(()=>{ window.clearTimeout(t); if(!ctrl.signal.aborted) setLoading(false) })
    return ()=>{ window.clearTimeout(t); ctrl.abort() }
  },[el.atomicNumber])

  /* Fetch Wikipedia image */
  useEffect(()=>{
    const ctrl = new AbortController()
    setWikiImg(null); setImgLoaded(false); setImgError(false)
    fetchWikiImage(el.name, ctrl.signal).then(setWikiImg).catch(()=>setWikiImg(null))
    return ()=>ctrl.abort()
  },[el.name])

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop-blur-md" role="presentation"
        style={{background:'var(--bg-overlay)'}} onClick={onClose} />

      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="el-dialog-title" tabIndex={-1}
        className="relative w-full sm:max-w-[980px] sm:rounded-[28px] overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[90vh] outline-none animate-[modalIn_.3s_cubic-bezier(.34,1.1,.64,1)]"
        style={{background:'var(--bg-modal)',border:'1px solid var(--border)',boxShadow:'var(--shadow-modal)'}}>

        {/* ── Hero banner ── */}
        <div className="relative overflow-hidden shrink-0 flex items-end px-5 sm:px-8 pb-5 pt-12 sm:pt-14"
          style={{
            background:`linear-gradient(140deg, ${m.color}dd 0%, ${m.color}88 45%, ${m.color}40 70%, transparent)`,
            borderBottom:`1px solid ${m.color}28`,
            minHeight: '108px',
          }}>
          {/* Hatching pattern */}
          <div className="absolute inset-0 opacity-[0.18]" style={{
            backgroundImage:`repeating-linear-gradient(45deg, transparent 0, transparent 18px, rgba(255,255,255,0.12) 18px, rgba(255,255,255,0.12) 19px)`,
          }} />
          {/* Right glow */}
          <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none"
            style={{background:`radial-gradient(ellipse at 85% 40%, ${m.color}66, transparent 65%)`}} />
          {/* Close button */}
          <button onClick={onClose} aria-label="Close"
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold z-10 transition-all hover:scale-110 active:scale-90"
            style={{background:'rgba(0,0,0,0.22)',color:'rgba(255,255,255,0.9)',border:'1px solid rgba(255,255,255,0.18)'}}>
            ✕
          </button>
          {/* Element identity */}
          <div className="relative flex items-end gap-4 sm:gap-6">
            <div className="font-display font-black leading-none tracking-[-0.05em] text-white drop-shadow-lg select-none"
              style={{fontSize:'clamp(60px,10vw,88px)', textShadow:`0 0 48px ${m.color}99`}}>
              {el.symbol}
            </div>
            <div className="pb-1">
              <div className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-1">Z = {el.atomicNumber}</div>
              <h2 id="el-dialog-title" className="font-display font-black leading-none text-white"
                style={{fontSize:'clamp(18px,3.5vw,28px)'}}>
                {el.name}
              </h2>
              <div className="text-white/65 text-[12px] font-medium mt-1.5 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{background:'rgba(255,255,255,0.18)'}}>
                  {el.category}
                </span>
                <span>{el.block.toUpperCase()}-block</span>
                {api?.is_radioactive && <span className="text-amber-300 font-bold">☢ Radioactive</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row gap-5 sm:gap-7 p-5 sm:p-7">

            {/* ── Left column ── */}
            <div className="md:w-[256px] lg:w-[272px] shrink-0 space-y-4">

              {/* Wikipedia element photo */}
              <div className="relative rounded-2xl overflow-hidden"
                style={{border:'1px solid var(--border)',background:'var(--bg-input)',minHeight:'160px'}}>
                {/* Shimmer while loading */}
                {!imgLoaded && !imgError && wikiImg && (
                  <div className="absolute inset-0 shimmer" style={{background:'var(--img-placeholder)'}} />
                )}
                {/* Photo */}
                {wikiImg && !imgError && (
                  <img
                    src={wikiImg} alt={`${el.name} element`}
                    className="w-full object-cover transition-all duration-700"
                    style={{
                      height: '168px',
                      opacity: imgLoaded ? 1 : 0,
                      transform: imgLoaded ? 'scale(1)' : 'scale(1.05)',
                    }}
                    loading="lazy" decoding="async"
                    onLoad={()=>setImgLoaded(true)}
                    onError={()=>setImgError(true)}
                  />
                )}
                {/* Fallback: styled symbol card */}
                {(!wikiImg || imgError) && (
                  <div className="h-[168px] flex flex-col items-center justify-center relative">
                    {dark && <div className="absolute inset-0 opacity-20 pointer-events-none" style={{background:`radial-gradient(circle at 50% 40%, ${m.color}, transparent 70%)`}} />}
                    <span className="font-mono text-[11px] font-semibold mb-2" style={{color:'var(--text-muted)'}}>Z = {el.atomicNumber}</span>
                    <span className="font-display font-black leading-none tracking-[-0.04em] select-none"
                      style={{fontSize:'72px',color:m.color,textShadow:dark?`0 0 40px ${m.color}55`:undefined}}>
                      {el.symbol}
                    </span>
                    <span className="font-display font-semibold text-[13px] mt-1.5" style={{color:'var(--text-muted)'}}>{formatNumber(el.atomicMass,5)} u</span>
                  </div>
                )}
                {/* Caption */}
                {wikiImg && imgLoaded && (
                  <div className="absolute bottom-0 left-0 right-0 py-1.5 px-3 text-[9px] text-right"
                    style={{background:'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',color:'rgba(255,255,255,0.72)'}}>
                    📷 Wikipedia Commons · CC License
                  </div>
                )}
                {/* Loading indicator for wiki image */}
                {wikiImg === null && (
                  <div className="absolute inset-0 shimmer rounded-2xl" style={{background:'var(--img-placeholder)'}} />
                )}
              </div>

              {/* Group / Period / Block */}
              <div className="grid grid-cols-3 gap-2">
                {[{l:'Group',v:el.group??'—'},{l:'Period',v:el.period},{l:'Block',v:el.block.toUpperCase()}].map(x=>(
                  <div key={x.l} className="px-2.5 py-2.5 rounded-xl text-center hover:scale-[1.02] transition-transform"
                    style={{background:'var(--bg-input)',border:'1px solid var(--border)'}}>
                    <div className="section-label mb-1">{x.l}</div>
                    <div className="font-display font-black text-[16px]" style={{color:'var(--text-primary)'}}>{x.v}</div>
                  </div>
                ))}
              </div>

              {/* Bohr model */}
              <Bohr shells={el.shells} color={m.color} />

              {/* Compare toggle */}
              <button onClick={onToggleCompare}
                className="w-full py-3 rounded-2xl text-[12.5px] font-bold transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                style={{
                  background: inCompare?'rgba(245,158,11,0.13)':'var(--bg-input)',
                  border:     inCompare?'1px solid rgba(245,158,11,0.45)':'1px solid var(--border)',
                  color:      inCompare?'#b45309':'var(--text-secondary)',
                  boxShadow:  inCompare?'0 4px 16px -4px rgba(245,158,11,0.28)':'none',
                }}>
                {inCompare?'✓ In comparison':'+ Add to comparison'}
              </button>

              {/* Prev / Next */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={onPrev} disabled={el.atomicNumber===1} aria-label="Previous element"
                  className="py-2.5 rounded-xl text-[18px] transition-all hover:scale-[1.03] active:scale-90 disabled:opacity-25 font-semibold"
                  style={{background:'var(--bg-input)',border:'1px solid var(--border)'}}>←</button>
                <button onClick={onNext} disabled={el.atomicNumber===118} aria-label="Next element"
                  className="py-2.5 rounded-xl text-[18px] transition-all hover:scale-[1.03] active:scale-90 disabled:opacity-25 font-semibold"
                  style={{background:'var(--bg-input)',border:'1px solid var(--border)'}}>→</button>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="flex-1 min-w-0 space-y-5">

              {/* Description */}
              <div>
                <p className="text-[13.5px] sm:text-[14.5px] leading-[1.78] break-words" style={{color:'var(--text-secondary)'}}>
                  {api?.description || el.summary}
                </p>
              </div>

              {/* Key properties */}
              <div>
                <div className="section-label mb-3">Properties</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    {l:'Density',       v: el.density!=null?`${formatNumber(el.density,6)} g/cm³`:'—'},
                    {l:'Melting Point', v: formatTemperature(el.meltingPointK, units)},
                    {l:'Boiling Point', v: formatTemperature(el.boilingPointK, units)},
                    {l:'Phase (STP)',   v: el.state},
                    {l:'Electronegativity', v: el.electronegativity!=null?formatNumber(el.electronegativity,2):'—'},
                    {l:'1st Ionization',v: el.ionizationEnergy?`${el.ionizationEnergy} kJ/mol`:'—'},
                  ].map(p=>(
                    <div key={p.l} className="px-3.5 py-3 rounded-xl hover:scale-[1.01] transition-transform"
                      style={{background:'var(--bg-input)',border:'1px solid var(--border)'}}>
                      <div className="section-label mb-1.5">{p.l}</div>
                      <div className="font-mono text-[12.5px] font-semibold break-words leading-snug" style={{color:'var(--text-primary)'}}>{p.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Property Fingerprint */}
              <div className="p-4 sm:p-5 rounded-2xl" style={{background:'var(--bg-input)',border:'1px solid var(--border)'}}>
                <div className="flex items-center justify-between mb-2">
                  <div className="section-label">Property Fingerprint</div>
                  <div className="flex items-center gap-3 text-[10px]" style={{color:'var(--text-muted)'}}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{background:m.color}} />{el.symbol}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{background:'var(--text-faint)'}} />Global avg
                    </span>
                  </div>
                </div>
                <RadarChart el={el} color={m.color} />
              </div>

              {/* Fun fact */}
              <div className="p-4 rounded-2xl" style={{background:'var(--fun-fact-bg)',border:'1px solid var(--fun-fact-border)'}}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[15px]">💡</span>
                  <div className="section-label" style={{color:'var(--fun-fact-label)'}}>Fun Fact</div>
                </div>
                <p className="text-[13px] font-medium leading-relaxed break-words" style={{color:'var(--fun-fact-text)'}}>
                  {api?.fun_fact || el.funFact}
                </p>
              </div>

              {/* API extended data */}
              {api&&(
                <div className="space-y-4 animate-[fadeUp_.4s_ease]">
                  {api.uses&&(
                    <div>
                      <div className="section-label mb-2">Common Uses</div>
                      <p className="text-[13px] leading-relaxed break-words" style={{color:'var(--text-secondary)'}}>{api.uses}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {api.oxidation_states&&<PropCard l="Oxidation States" v={api.oxidation_states} />}
                    {api.atomic_radius!=null&&<PropCard l="Atomic Radius" v={`${api.atomic_radius} pm`} />}
                    {api.electron_affinity!=null&&<PropCard l="Electron Affinity" v={`${api.electron_affinity} kJ/mol`} />}
                    {api.discovered_by&&<PropCard l="Discoverer" v={api.discovered_by} />}
                    {api.discovery_location&&<PropCard l="Found in" v={api.discovery_location} />}
                    {api.is_radioactive!=null&&(
                      <div className="px-3.5 py-3 rounded-xl" style={{background:'var(--bg-input)',border:'1px solid var(--border)'}}>
                        <div className="section-label mb-1.5">Radioactive</div>
                        <div className={cx('font-mono text-[12.5px] font-semibold',api.is_radioactive?'text-amber-500':'')}
                          style={!api.is_radioactive?{color:'var(--text-primary)'}:undefined}>
                          {api.is_radioactive?'Yes ☢':'No'}
                        </div>
                      </div>
                    )}
                  </div>
                  {api.isotopes&&api.isotopes.length>0&&(
                    <div>
                      <div className="section-label mb-2.5">Isotopes</div>
                      <div className="flex flex-wrap gap-2">
                        {api.isotopes.slice(0,10).map(iso=>(
                          <span key={iso.mass_number}
                            className="font-mono text-[11px] px-3 py-1.5 rounded-xl hover:scale-[1.04] transition-transform cursor-default"
                            style={{background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--text-secondary)'}}>
                            <b style={{color:'var(--text-primary)'}}>{el.symbol}-{iso.mass_number}</b>
                            {iso.abundance!=null&&<span className="ml-1.5" style={{color:'var(--text-muted)'}}>{(iso.abundance*100).toFixed(1)}%</span>}
                            {!iso.stable&&<span className="ml-1 text-amber-500">☢</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {api.named_after&&(
                    <div>
                      <div className="section-label mb-2">Name Origin</div>
                      <p className="text-[13px] italic leading-relaxed break-words" style={{color:'var(--text-secondary)'}}>{api.named_after}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Loading state */}
              {loading&&(
                <div className="flex items-center gap-2.5 text-[12px] font-medium py-1.5" role="status" style={{color:'var(--text-faint)'}}>
                  <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin shrink-0"
                    style={{borderColor:'var(--border)',borderTopColor:'var(--accent)'}} />
                  Loading supplemental details…
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── PropCard ── */
function PropCard({l,v}:{l:string;v:string}) {
  return (
    <div className="px-3.5 py-3 rounded-xl hover:scale-[1.01] transition-transform"
      style={{background:'var(--bg-input)',border:'1px solid var(--border)'}}>
      <div className="section-label mb-1.5">{l}</div>
      <div className="font-mono text-[12px] font-semibold break-words leading-snug" style={{color:'var(--text-primary)'}} title={v}>{v}</div>
    </div>
  )
}

/* ══════════════════════════════════════
   RADAR CHART
   ══════════════════════════════════════ */
function RadarChart({ el, color }: { el: Element; color: string }) {
  const data: RadarPoint[] = getRadarData(el)
  const [hover, setHover] = useState<number|null>(null)
  const sz = 260, cx = sz/2, cy = sz/2+6, R = 88, n = data.length
  const ang = (i:number) => (i/n)*Math.PI*2 - Math.PI/2
  const pt  = (i:number, r:number) => ({x: cx+Math.cos(ang(i))*R*r, y: cy+Math.sin(ang(i))*R*r})
  const toggle = (i:number) => setHover(c=>c===i?null:i)
  const clear  = (i:number) => setHover(c=>c===i?null:c)
  const onKD   = (i:number, e:React.KeyboardEvent<SVGCircleElement>) => { if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(i)} }
  const poly   = (vals:number[]) => vals.map((v,i)=>{const p=pt(i,Math.max(0.04,v));return`${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(' ')
  const rings  = [0.25,0.5,0.75,1]
  const uid    = `rc-${el.atomicNumber}`

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${sz} ${sz}`} className="w-full max-w-[280px]" role="img" aria-label={`Property fingerprint for ${el.name}`}>
        <defs>
          <radialGradient id={uid}>
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.07" />
          </radialGradient>
        </defs>
        {rings.map((r,ri)=>(
          <polygon key={ri} points={data.map((_,i)=>{const p=pt(i,r);return`${p.x},${p.y}`}).join(' ')}
            fill="none" stroke="var(--border)" strokeWidth={ri===rings.length-1?1.3:0.7} />
        ))}
        {data.map((_,i)=>{const p=pt(i,1);return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth="0.7" />})}
        <polygon points={poly(data.map(d=>d.avg))} fill="var(--text-faint)" fillOpacity="0.1" stroke="var(--text-faint)" strokeWidth="1.2" strokeDasharray="3 3" />
        <polygon points={poly(data.map(d=>d.value))} fill={`url(#${uid})`} stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
        {data.map((d,i)=>{const p=pt(i,Math.max(0.04,d.value));return(
          <circle key={i} cx={p.x} cy={p.y} r={hover===i?5.5:3.5} fill={color}
            stroke="var(--bg-modal)" strokeWidth="2"
            tabIndex={0} role="button"
            aria-label={`${d.label}: ${d.raw!=null?formatNumber(d.raw):'No data'}`}
            onMouseEnter={()=>setHover(i)} onMouseLeave={()=>clear(i)}
            onFocus={()=>setHover(i)} onBlur={()=>clear(i)}
            onClick={()=>toggle(i)} onKeyDown={e=>onKD(i,e)}
            style={{cursor:'pointer',transition:'r .18s ease',filter:hover===i?`drop-shadow(0 0 5px ${color}cc)`:'none'}} />
        )})}
        {data.map((d,i)=>{const p=pt(i,1.26);const a=ang(i);const anchor=Math.abs(Math.cos(a))<0.3?'middle':Math.cos(a)>0?'start':'end';return(
          <text key={i} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle"
            style={{fontSize:'9px',fontWeight:700,fill:hover===i?color:'var(--text-muted)',transition:'fill .18s',fontFamily:'var(--font-mono)'}}>
            {d.short}
          </text>
        )})}
      </svg>
      <div className="mt-1 h-5 text-center">
        {hover!=null?(
          <span className="font-mono text-[11px]" style={{color:'var(--text-secondary)'}}>
            <b style={{color}}>{data[hover].label}:</b>{' '}
            {data[hover].raw!=null?formatNumber(data[hover].raw):'—'}
            <span style={{color:'var(--text-faint)'}}> · {Math.round(data[hover].value*100)}% of range</span>
          </span>
        ):(
          <span className="text-[10.5px]" style={{color:'var(--text-faint)'}}>Hover a vertex · solid=element  dashed=avg</span>
        )}
      </div>
      <div className="mt-3 grid w-full max-w-[320px] grid-cols-3 gap-2">
        {data.map((d,i)=>{const active=hover===i;return(
          <button key={d.key} type="button" onClick={()=>toggle(i)} onFocus={()=>setHover(i)} onBlur={()=>clear(i)}
            className="rounded-xl px-2.5 py-2 text-left transition-all duration-150 hover:scale-[1.02]"
            style={{
              background: active?`${color}18`:'var(--bg-input)',
              border:     active?`1px solid ${color}60`:'1px solid var(--border)',
              boxShadow:  active?`0 2px 12px -2px ${color}30`:'none',
            }}>
            <div className="section-label">{d.short}</div>
            <div className="font-mono text-[11px] mt-1 font-semibold" style={{color:active?color:'var(--text-primary)'}}>
              {d.raw!=null?formatNumber(d.raw):'—'}
            </div>
          </button>
        )})}
      </div>
    </div>
  )
}

/* ── Trend graph ── */
function TrendGraph({ propKey }: { propKey: PropertyKey }) {
  const {min,max} = getPropertyRange(propKey)
  const W=240,H=100,P=5
  const toP=(z:number,v:number)=>{
    const x=P+((z-1)/117)*(W-P*2)
    const y=H-P-((v-min)/(max-min||1))*(H-P*2)
    return`${x.toFixed(2)},${y.toFixed(2)}`
  }
  const segs:string[][]=[];let cur:string[]=[]
  for (const e of ELEMENTS) {
    const v=getPropertyValue(e,propKey)
    if(v==null){if(cur.length>1)segs.push(cur);cur=[];continue}
    cur.push(toP(e.atomicNumber,v))
  }
  if(cur.length>1)segs.push(cur)
  return(
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[90px]" role="img" aria-label={`${PROPERTY_META[propKey].label} trend`}>
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="var(--accent)"   stopOpacity="0.8" />
            <stop offset="50%"  stopColor="var(--accent-2)" stopOpacity="1"   />
            <stop offset="100%" stopColor="var(--accent-3)" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        {segs.map((seg,i)=>(
          <path key={i} d={`M ${seg.join(' L ')}`} fill="none" stroke="url(#tg)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>
      <div className="flex justify-between mt-1 font-mono text-[9px]" style={{color:'var(--text-faint)'}}>
        <span>Z=1</span><span>Z=118</span>
      </div>
    </div>
  )
}

/* ── Bohr model ── */
function Bohr({shells,color}:{shells:number[];color:string}) {
  const maxR=80, rings=shells.length
  return(
    <div className="flex justify-center py-1">
      <svg viewBox="0 0 200 200" className="w-full max-w-[156px]" aria-hidden="true">
        <defs>
          <radialGradient id={`ng-${color.replace('#','')}`}>
            <stop offset="0%"   stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="0.04" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="15" fill={`url(#ng-${color.replace('#','')})`} />
        <circle cx="100" cy="100" r="5" fill={color} style={{filter:`drop-shadow(0 0 5px ${color}cc)`}} />
        {shells.map((n,i)=>{
          const r=19+(maxR-19)*(i+1)/Math.max(1,rings)
          return(
            <g key={i}>
              <circle cx="100" cy="100" r={r} fill="none" stroke="var(--border)" strokeWidth="0.9" />
              {Array.from({length:n}).map((_,j)=>{
                const a=(j/n)*Math.PI*2-Math.PI/2
                return <circle key={j} cx={100+r*Math.cos(a)} cy={100+r*Math.sin(a)} r="2.6" fill={color}
                  style={{filter:`drop-shadow(0 0 2px ${color}88)`}} />
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ══════════════════════════════════════
   COMPARISON MODAL
   ══════════════════════════════════════ */
function CmpModal({els,onClose,onRm,onClear}:{els:Element[];onClose:()=>void;onRm:(e:Element)=>void;onClear:()=>void}) {
  const dialogRef = useDialog(onClose)
  const rows=[
    {l:'Symbol',          g:(e:Element)=>e.symbol},
    {l:'Atomic Number',   g:(e:Element)=>String(e.atomicNumber)},
    {l:'Atomic Mass (u)', g:(e:Element)=>formatNumber(e.atomicMass,3)},
    {l:'Category',        g:(e:Element)=>e.category},
    {l:'Group',           g:(e:Element)=>e.group==null?'—':String(e.group)},
    {l:'Period',          g:(e:Element)=>String(e.period)},
    {l:'Block',           g:(e:Element)=>e.block.toUpperCase()},
    {l:'Phase (STP)',     g:(e:Element)=>e.state},
    {l:'Melting (K)',     g:(e:Element)=>formatNumber(e.meltingPointK)},
    {l:'Boiling (K)',     g:(e:Element)=>formatNumber(e.boilingPointK)},
    {l:'Density',         g:(e:Element)=>formatNumber(e.density)},
    {l:'Electronegativity',g:(e:Element)=>formatNumber(e.electronegativity)},
    {l:'Config',          g:(e:Element)=>e.electronConfigurationSemantic},
  ]
  return(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5">
      <div className="absolute inset-0 backdrop-blur-md" role="presentation"
        style={{background:'var(--bg-overlay)'}} onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cmp-dialog-title" tabIndex={-1}
        className="relative w-full max-w-[860px] rounded-[22px] sm:rounded-[26px] overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] outline-none animate-[modalIn_.28s_ease]"
        style={{background:'var(--bg-modal)',border:'1px solid var(--border)',boxShadow:'var(--shadow-modal)'}}>
        <div className="flex items-center justify-between px-5 sm:px-7 py-4" style={{borderBottom:'1px solid var(--border)'}}>
          <h2 id="cmp-dialog-title" className="font-display font-bold text-[17px] sm:text-[19px] tracking-[-0.025em]"
            style={{color:'var(--text-primary)'}}>
            ⚖️ Element Comparison
          </h2>
          <div className="flex gap-2">
            <button onClick={onClear}
              className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all hover:scale-105 active:scale-95"
              style={{background:'var(--bg-input)',border:'1px solid var(--border)',color:'var(--text-muted)'}}>
              Clear all
            </button>
            <button onClick={onClose} aria-label="Close comparison"
              className="w-8 h-8 rounded-xl text-[13px] font-bold transition-all hover:scale-110 active:scale-90 flex items-center justify-center"
              style={{background:'var(--danger-bg)',border:'1px solid var(--danger-border)',color:'var(--danger-text)'}}>
              ✕
            </button>
          </div>
        </div>
        <div className="overflow-auto p-4 sm:p-6">
          <table className="w-full border-collapse">
            <caption className="sr-only">Comparison of selected element properties</caption>
            <thead>
              <tr>
                <th className="text-left section-label pb-4 pr-3 w-28 sticky left-0" style={{background:'var(--bg-modal)'}}>Property</th>
                {els.map(e=>{const c=CATEGORY_META[e.categoryKey];return(
                  <th key={e.atomicNumber} className="pb-4 px-3 min-w-[120px]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-[14px] flex items-center justify-center font-display font-black text-[20px] transition-all hover:scale-110"
                        style={{background:`${c.color}20`,color:c.color,border:`1.5px solid ${c.color}45`}}>
                        {e.symbol}
                      </div>
                      <span className="font-display font-bold text-[13px]" style={{color:'var(--text-primary)'}}>{e.name}</span>
                      <button onClick={()=>onRm(e)} className="text-[10px] font-medium transition-colors hover:text-[var(--danger-text)]"
                        style={{color:'var(--text-faint)'}}>remove</button>
                    </div>
                  </th>
                )})}
              </tr>
            </thead>
            <tbody>
              {rows.map((row,ri)=>(
                <tr key={row.l} className="transition-colors" style={ri%2?{background:'var(--bg-input)'}:undefined}>
                  <td className="section-label py-3 pr-3 whitespace-nowrap pl-2 rounded-l-lg sticky left-0"
                    style={{background:ri%2?'var(--bg-input)':'var(--bg-modal)'}}>{row.l}</td>
                  {els.map(e=>(
                    <td key={e.atomicNumber} className="text-center py-3 px-3 font-mono text-[12px] font-medium rounded-r-lg"
                      style={{color:'var(--text-secondary)'}}>{row.g(e)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
