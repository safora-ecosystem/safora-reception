import { useEffect, useState } from "react"
import { StickyNote01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { useT } from "@/lib/i18n"
import { useNotesBadge } from "@/lib/notes"
import { NotesBoard } from "./notes-board"


export function NotesButton() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const { overdue, unseen } = useNotesBadge()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <Button
        variant="outline"
        size="xl"
        className="relative bg-white"
        onClick={() => setOpen(true)}
        aria-label={t("notes.title")}
      >
        <Icon icon={StickyNote01Icon} />
        <span className="hidden @5xl:inline">{t("notes.title")}</span>
        {}
        {overdue > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-warning px-1 text-[0.625rem] font-semibold text-on-fill ring-2 ring-white tabular-nums">
            {overdue > 9 ? "9+" : overdue}
          </span>
        ) : unseen ? (
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary ring-2 ring-white" />
        ) : null}
      </Button>
      <NotesBoard open={open} onOpenChange={setOpen} />
    </>
  )
}
