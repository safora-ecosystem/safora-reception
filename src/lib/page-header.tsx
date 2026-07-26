import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"


type PageHeader = { title: ReactNode; actions?: ReactNode }

interface PageHeaderValue {
  header: PageHeader
  setHeader: (h: PageHeader) => void
}

const PageHeaderContext = createContext<PageHeaderValue | null>(null)

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeader>({ title: "" })
  const value = useMemo(() => ({ header, setHeader }), [header])
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
}

export function usePageHeader(): PageHeader {
  const ctx = useContext(PageHeaderContext)
  if (!ctx) throw new Error("usePageHeader PageHeaderProvider ichida ishlatilishi kerak")
  return ctx.header
}

export function useSetPageHeader(title: ReactNode, actions?: ReactNode): void {
  const ctx = useContext(PageHeaderContext)
  if (!ctx) throw new Error("useSetPageHeader PageHeaderProvider ichida ishlatilishi kerak")
  const { setHeader } = ctx
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  useEffect(() => {
    setHeader({ title, actions: actionsRef.current })
    if (typeof title === "string" && title) document.title = `${title} · Safora`
  }, [title, setHeader])
}
