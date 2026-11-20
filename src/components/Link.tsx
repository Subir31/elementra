import { createContext, useContext, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { elementPath } from '../config/site'
import type { Element } from '../data/elements'
import { isPlainClick, navigateTo } from '../hooks/useRouter'

/** App-level actions that links and buttons deep in the tree can trigger. */
export interface Actions {
  navigate: (path: string) => void
  openElement: (el: Element) => void
}

export const ActionsContext = createContext<Actions>({
  navigate: path => navigateTo(path),
  openElement: () => {},
})

export const useActions = () => useContext(ActionsContext)

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>

/** A real link (crawlable, opens in a new tab with Ctrl/⌘) that navigates in-app on a plain click. */
export function Link({ href, onClick, ...rest }: AnchorProps & { href: string }) {
  const { navigate } = useActions()
  return (
    <a href={href} {...rest} onClick={e => {
      onClick?.(e)
      if (!isPlainClick(e)) return
      e.preventDefault()
      navigate(href)
    }} />
  )
}

/**
 * Links to an element's page. A plain click opens the quick-view sheet
 * (mode "sheet") or moves to the full page (mode "page").
 */
export function ElementLink({ el, mode = 'sheet', onClick, ...rest }: AnchorProps & { el: Element; mode?: 'sheet' | 'page' }) {
  const { navigate, openElement } = useActions()
  const href = elementPath(el)
  return (
    <a href={href} {...rest} onClick={(e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e)
      if (!isPlainClick(e)) return
      e.preventDefault()
      if (mode === 'page') navigate(href)
      else openElement(el)
    }} />
  )
}
