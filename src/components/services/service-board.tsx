import { useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { RangeToggle } from "@/components/shared/charts"
import {
  ApiError,
  updateServiceRequest,
  type ServiceRequest,
  type ServiceRequestStatus,
} from "@/lib/api"
import { localIso } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { ServiceCard, type CardActions } from "./service-card"
import { ServiceColumn } from "./service-column"
import { AmountDialog, CancelDialog } from "./service-dialogs"
import {
  BOARD_COLUMNS,
  COLUMN_EMPTY,
  COLUMN_TITLE,
  REQUESTS_KEY,
  STATS_KEY,
  closedAt,
  queueOrder,
  type BoardColumn,
} from "./service-meta"


type DoneWindow = 1 | 7 | 30

type Patch = {
  id: string
  status?: ServiceRequestStatus
  amount?: number
  okMsg?: string
  failMsg?: string
}

function apiErr(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback
}

function applyPatch(row: ServiceRequest, patch: Patch): ServiceRequest {
  const now = new Date().toISOString()
  const next: ServiceRequest = { ...row }
  if (patch.amount !== undefined) next.amount = String(patch.amount)
  if (patch.status) {
    next.status = patch.status
    next.acceptedAt = patch.status === "new" ? row.acceptedAt : (row.acceptedAt ?? now)
    next.completedAt =
      patch.status === "done" || patch.status === "cancelled" ? (row.completedAt ?? now) : null
  }
  return next
}

function daysAgoMs(days: number): number {
  const start = new Date(`${localIso()}T00:00:00`)
  start.setDate(start.getDate() - (days - 1))
  return start.getTime()
}

/**
 * Klaviatura bilan ko'chirish. dnd-kit sukut bo'yicha strelkani 25 pikselga suradi — uch
 * ustunli doskada bir ustundan ikkinchisiga o'tish o'nlab bosish bo'lardi. Bu getter esa
 * KEYINGI USTUN markaziga sakraydi: chap/o'ng — ustun, boshqa tugmalar — o'z ishi.
 */
const columnCoordinates: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context: { collisionRect, droppableContainers } },
) => {
  const step = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0
  if (step === 0 || !collisionRect) return undefined
  event.preventDefault()

  const columns = droppableContainers
    .getEnabled()
    .filter((container) => container.rect.current)
    .sort((a, b) => a.rect.current!.left - b.rect.current!.left)
  if (columns.length < 2) return undefined

  const center = collisionRect.left + collisionRect.width / 2
  let index = 0
  let nearest = Infinity
  columns.forEach((container, i) => {
    const rect = container.rect.current!
    const distance = Math.abs(rect.left + rect.width / 2 - center)
    if (distance < nearest) {
      nearest = distance
      index = i
    }
  })

  const target = columns[Math.min(columns.length - 1, Math.max(0, index + step))]
  const rect = target.rect.current!
  const dx = rect.left + rect.width / 2 - center
  if (dx === 0) return undefined
  return { x: currentCoordinates.x + dx, y: currentCoordinates.y }
}

export function ServiceBoard({ requests }: { requests: ServiceRequest[] }) {
  const t = useT()
  const qc = useQueryClient()
  const [doneWindow, setDoneWindow] = useState<DoneWindow>(1)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [amountFor, setAmountFor] = useState<ServiceRequest | null>(null)
  const [amountMode, setAmountMode] = useState<"close" | "edit">("close")
  const [cancelFor, setCancelFor] = useState<ServiceRequest | null>(null)

  const sensors = useSensors(
    // 6px — bosish va sudrashni ajratadigan chegara: usiz kartadagi tugmani bosish ham
    // "sudrash boshlandi" bo'lib hisoblanardi.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  )

  const patch = useMutation({
    mutationFn: ({ id, status, amount }: Patch) =>
      updateServiceRequest(id, {
        ...(status ? { status } : {}),
        ...(amount !== undefined ? { amount } : {}),
      }),
    onMutate: async (vars: Patch) => {
      // Kartani DARHOL ko'chiramiz: sudrab qo'yib yuborgandan keyin u eski ustunda turib,
      // so'rov qaytgach sakrab o'tsa doska "ishonchsiz" bo'lib ko'rinadi.
      await qc.cancelQueries({ queryKey: REQUESTS_KEY })
      const previous = qc.getQueryData<ServiceRequest[]>(REQUESTS_KEY)
      qc.setQueryData<ServiceRequest[]>(REQUESTS_KEY, (rows) =>
        rows?.map((row) => (row.id === vars.id ? applyPatch(row, vars) : row)),
      )
      return { previous }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(REQUESTS_KEY, ctx.previous)
      toast.error(apiErr(err, vars.failMsg ?? t("services.statusFailed")))
    },
    onSuccess: (_data, vars) => {
      if (vars.okMsg) toast.success(vars.okMsg)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: REQUESTS_KEY })
      qc.invalidateQueries({ queryKey: STATS_KEY })
    },
  })

  const byId = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests])

  const columns = useMemo(() => {
    const since = daysAgoMs(doneWindow)
    const open = (status: BoardColumn) =>
      requests.filter((r) => r.status === status).sort(queueOrder)
    return {
      new: open("new"),
      in_progress: open("in_progress"),
      // Yopilganlar oynaga bog'liq: doska — bugungi ish stoli, 30 kunlik tarix emas.
      done: requests.filter((r) => r.status === "done" && closedAt(r) >= since).sort(queueOrder),
      cancelled: requests
        .filter((r) => r.status === "cancelled" && closedAt(r) >= since)
        .sort(queueOrder),
    }
  }, [requests, doneWindow])

  const actions: CardActions = {
    onAccept: (request) => patch.mutate({ id: request.id, status: "in_progress" }),
    onComplete: (request) => {
      setAmountMode("close")
      setAmountFor(request)
    },
    onCancel: (request) => setCancelFor(request),
    onReopen: (request) => patch.mutate({ id: request.id, status: "in_progress" }),
    onEditAmount: (request) => {
      setAmountMode("edit")
      setAmountFor(request)
    },
  }

  function moveTo(request: ServiceRequest, column: BoardColumn) {
    if (request.status === column) return
    // Yopishda summa MAJBURIY qadam: taksi/ovqat narxi shu payt ma'lum bo'ladi va uni
    // o'tkazib yuborish tushum hisobini jimgina buzardi.
    if (column === "done") {
      setAmountMode("close")
      setAmountFor(request)
      return
    }
    patch.mutate({ id: request.id, status: column })
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const request = byId.get(String(event.active.id))
    const column = event.over?.id as BoardColumn | undefined
    if (!request || !column) return
    moveTo(request, column)
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("services.dragStart", { title: byId.get(String(active.id))?.title ?? "" }),
    onDragOver: ({ over }) =>
      over ? t("services.dragOverCol", { column: t(COLUMN_TITLE[over.id as BoardColumn]) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("services.dragDropped", {
            title: byId.get(String(active.id))?.title ?? "",
            column: t(COLUMN_TITLE[over.id as BoardColumn]),
          })
        : t("services.dragCancelled"),
    onDragCancel: () => t("services.dragCancelled"),
  }

  const active = activeId ? (byId.get(activeId) ?? null) : null

  return (
    <DndContext
      sensors={sensors}
      // `closestCorners` — sichqoncha bilan ham, klaviatura bilan ham ishlaydi
      // (`pointerWithin` klaviatura bilan sudrashda hech qachon nishon topmasdi).
      collisionDetection={closestCorners}
      accessibility={{ announcements }}
      onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex grow flex-col gap-4">
        {/* Doska paneli: chapda nima uchun ekani, o'ngda yopilganlar oynasi. Oyna faqat
            uchinchi ustunga tegadi — shuning uchun yonida yorliq bor, aks holda tugmalar
            butun doskani filtrlaydigandek o'qilardi. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-500">
            {t("services.intro")} {t("services.boardHint")}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">{t("services.doneWindow")}</span>
            <RangeToggle
              options={[
                { value: 1 as DoneWindow, label: t("common.today") },
                { value: 7 as DoneWindow, label: t("services.win7") },
                { value: 30 as DoneWindow, label: t("services.win30") },
              ]}
              value={doneWindow}
              onChange={setDoneWindow}
              ariaLabel={t("services.doneWindow")}
            />
          </div>
        </div>

        <div
          role="group"
          aria-label={t("services.boardAria")}
          className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-3"
        >
        {BOARD_COLUMNS.map((column) => (
          <ServiceColumn
            key={column}
            id={column}
            title={t(COLUMN_TITLE[column])}
            count={columns[column].length}
          >
            {columns[column].length === 0 && (column !== "done" || columns.cancelled.length === 0) ? (
              // `my-auto` — bo'sh ustun to'liq balandlikda, izoh esa markazda tursin
              // (tepaga yopishgan matn "yuklanmay qoldi" degandek ko'rinardi).
              <p className="my-auto px-1 py-10 text-center text-sm text-neutral-400">
                {t(COLUMN_EMPTY[column])}
              </p>
            ) : (
              columns[column].map((request) => (
                <ServiceCard
                  key={request.id}
                  request={request}
                  actions={actions}
                  ghost={request.id === activeId}
                />
              ))
            )}

            {/* Bekor qilinganlar — uchinchi ustun tubida, ajratgich ostida. Ular ish emas,
                lekin jimgina yo'qolib ketmasligi kerak: "men buni bekor qilganmidim?" degan
                savol smena oxirida albatta chiqadi. */}
            {column === "done" && columns.cancelled.length > 0 && (
              <>
                <p className="hairline-t px-1 pt-3 text-xs text-neutral-400">
                  {t("services.cancelledGroup", { count: columns.cancelled.length })}
                </p>
                {columns.cancelled.map((request) => (
                  <ServiceCard key={request.id} request={request} actions={actions} />
                ))}
              </>
            )}
          </ServiceColumn>
        ))}
        </div>
      </div>

      {/* Sichqoncha ostidagi nusxa — ustun scroll'i va `overflow` ichida qolib ketmasin
          uchun portal orqali chiziladi (dnd-kit o'zi qiladi). */}
      <DragOverlay dropAnimation={null}>
        {active ? <ServiceCard request={active} overlay /> : null}
      </DragOverlay>

      <AmountDialog
        request={amountFor}
        mode={amountMode}
        pending={patch.isPending}
        onClose={() => setAmountFor(null)}
        onSubmit={(amount) => {
          if (!amountFor) return
          patch.mutate(
            amountMode === "edit"
              ? { id: amountFor.id, amount, okMsg: t("services.amountSaved") }
              : { id: amountFor.id, status: "done", amount, okMsg: t("services.closed"), failMsg: t("services.closeFailed") },
          )
          setAmountFor(null)
        }}
      />

      <CancelDialog
        request={cancelFor}
        pending={patch.isPending}
        onClose={() => setCancelFor(null)}
        onConfirm={() => {
          if (!cancelFor) return
          patch.mutate({
            id: cancelFor.id,
            status: "cancelled",
            okMsg: t("services.cancelDone"),
            failMsg: t("services.cancelFailed"),
          })
          setCancelFor(null)
        }}
      />
    </DndContext>
  )
}
