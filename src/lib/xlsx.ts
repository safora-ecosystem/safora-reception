// Minimal XLSX yozuvchi — BOG'LIQLIKSIZ (paketga bitta ham yangi kutubxona qo'shilmaydi).
//
// Nega CSV emas: CSV da format yo'q — rahbar faylni ochganda ustunlar yopishgan, summalar
// matn, sarlavha oddiy qator bo'lib chiqadi va "bu nima?" degan savol qoladi. Mehmonxonaga
// yuboriladigan hisobot TAYYOR ko'rinishda bo'lishi kerak: sarlavha, ustun kengliklari,
// muzlatilgan shapka, minglik ajratgichi, "Jami" qatori.
//
// Nega SpreadsheetML (Excel 2003 XML) emas: zamonaviy Excel uni ochishda "fayl formati
// kengaytmaga mos emas" ogohlantirishini chiqaradi — mehmonxona egasiga birinchi taassurot
// shu bo'ladi. Haqiqiy .xlsx esa jimgina ochiladi.
//
// Nega jsPDF/SheetJS emas: SheetJS ~800KB, bizga uning 5% i kerak. XLSX — ZIP ichidagi
// bir nechta XML. Siqishsiz (store) ZIP yozish ~60 qator, qolgani XML shablon.
//
// QO'LLAB-QUVVATLANADIGAN QISM (ataylab tor): bitta yoki bir nechta varaq, sarlavha +
// izoh qatori, ustun kengliklari, muzlatilgan shapka, matn/son/pul/foiz kataklari,
// "Jami" qatori. Formula, grafik, birlashtirilgan katak — YO'Q (kerak bo'lsa qo'shiladi).

// ── ZIP (store, siqishsiz) ───────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

type ZipEntry = { name: string; data: Uint8Array }

/** Siqishsiz ZIP. Hisobot fayllari kichik (o'nlab KB) — siqish foydasi nolga yaqin,
    lekin DEFLATE yozish yuzlab qator qo'shardi. */
function zip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true) // local file header
    lv.setUint16(4, 20, true) // version needed
    lv.setUint16(6, 0x0800, true) // UTF-8 nomlar
    lv.setUint16(8, 0, true) // method: store
    lv.setUint16(10, 0, true) // vaqt
    lv.setUint16(12, 0x0021, true) // sana: 1980-01-01 (deterministik)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, size, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    local.set(nameBytes, 30)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true) // central directory header
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x0021, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true) // local header o'rni
    central.set(nameBytes, 46)

    locals.push(local, entry.data)
    centrals.push(central)
    offset += local.length + size
  }

  const cdSize = centrals.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true) // end of central directory
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)

  // Bo'laklarni BITTA buferga yig'amiz: `Blob` konstruktoriga `Uint8Array` ro'yxatini
  // uzatish TS 6 da `ArrayBufferLike` sababli tip xatosi beradi, `ArrayBuffer` esa toza.
  const parts = [...locals, ...centrals, end]
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const part of parts) {
    out.set(part, pos)
    pos += part.length
  }

  return new Blob([out.buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

// ── XLSX ─────────────────────────────────────────────────────────────────────

const xml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] ?? c,
  )

/** Katak turi — format, tekislash va "Jami" qatoridagi ko'rinish shundan. */
export type XlsxKind = "text" | "center" | "number" | "money" | "percent"

export type XlsxCol = {
  header: string
  /** Belgilar hisobidagi kenglik (Excel birligi). */
  width: number
  kind?: XlsxKind
}

export type XlsxCell = string | number | null

export type XlsxSheet = {
  /** Varaq yorlig'i (31 belgidan oshmasin — Excel cheklovi). */
  name: string
  /** A1 dagi katta sarlavha. */
  title: string
  /** Sarlavha ostidagi kulrang izoh (davr, mehmonxona nomi). */
  subtitle?: string
  cols: XlsxCol[]
  rows: XlsxCell[][]
  /** "Jami" qatori — to'ldirilgan fon bilan pastda turadi. */
  totals?: XlsxCell[]
}

// Uslub indekslari — `styles.xml` dagi `cellXfs` tartibiga MOS bo'lishi shart.
const S_TITLE = 1
const S_SUBTITLE = 2
const S_HEAD = 3
const S_TEXT = 4
const S_NUM = 5
const S_CENTER = 6
const S_TOTAL_TEXT = 7
const S_TOTAL_NUM = 8
const S_PCT = 9

function bodyStyle(kind: XlsxKind | undefined, value: XlsxCell): number {
  if (typeof value !== "number") return kind === "center" ? S_CENTER : S_TEXT
  if (kind === "percent") return S_PCT
  return S_NUM
}

/** 0 → "A", 25 → "Z", 26 → "AA". */
function colLetter(index: number): string {
  let n = index + 1
  let out = ""
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function cellXml(ref: string, value: XlsxCell, style: number): string {
  if (value == null || value === "") return `<c r="${ref}" s="${style}"/>`
  if (typeof value === "number")
    return `<c r="${ref}" s="${style}"><v>${Number.isFinite(value) ? value : 0}</v></c>`
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = sheet.cols
  const lastCol = colLetter(Math.max(0, cols.length - 1))

  // Qatorlar: 1 — sarlavha, 2 — izoh (bo'lsa), keyin shapka, keyin ma'lumot.
  const headRow = sheet.subtitle ? 3 : 2
  const rowsXml: string[] = []

  rowsXml.push(
    `<row r="1" ht="21" customHeight="1">${cellXml("A1", sheet.title, S_TITLE)}</row>`,
  )
  if (sheet.subtitle) {
    rowsXml.push(`<row r="2" ht="15">${cellXml("A2", sheet.subtitle, S_SUBTITLE)}</row>`)
  }

  rowsXml.push(
    `<row r="${headRow}" ht="28" customHeight="1">` +
      cols
        .map((c, i) => cellXml(`${colLetter(i)}${headRow}`, c.header, S_HEAD))
        .join("") +
      `</row>`,
  )

  sheet.rows.forEach((row, r) => {
    const n = headRow + 1 + r
    rowsXml.push(
      `<row r="${n}">` +
        cols
          .map((c, i) => cellXml(`${colLetter(i)}${n}`, row[i] ?? null, bodyStyle(c.kind, row[i] ?? null)))
          .join("") +
        `</row>`,
    )
  })

  if (sheet.totals) {
    const n = headRow + 1 + sheet.rows.length
    rowsXml.push(
      `<row r="${n}" ht="20" customHeight="1">` +
        cols
          .map((_, i) => {
            const v = sheet.totals![i] ?? null
            return cellXml(
              `${colLetter(i)}${n}`,
              v,
              typeof v === "number" ? S_TOTAL_NUM : S_TOTAL_TEXT,
            )
          })
          .join("") +
        `</row>`,
    )
  }

  const lastRow = headRow + sheet.rows.length + (sheet.totals ? 1 : 0)

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastCol}${lastRow}"/>
<sheetViews><sheetView showGridLines="0" workbookViewId="0">
<pane ySplit="${headRow}" topLeftCell="A${headRow + 1}" activePane="bottomLeft" state="frozen"/>
</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`)
    .join("")}</cols>
<sheetData>${rowsXml.join("")}</sheetData>
</worksheet>`
}

// numFmtId 164 — "1 234 567" (bo'sh joy ajratgich, o'zbek/rus odati);
// 166 — "59%" (qiymat 0..100 sifatida saqlanadi, foizga bo'linmaydi).
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2">
<numFmt numFmtId="164" formatCode="#,##0"/>
<numFmt numFmtId="166" formatCode="0&quot;%&quot;"/>
</numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="15"/><color rgb="FF1C1917"/><name val="Calibri"/></font>
<font><sz val="10"/><color rgb="FF78716C"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF1C1917"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDF3C4"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border>
<left style="thin"><color rgb="FFC9C4BD"/></left>
<right style="thin"><color rgb="FFC9C4BD"/></right>
<top style="thin"><color rgb="FFC9C4BD"/></top>
<bottom style="thin"><color rgb="FFC9C4BD"/></bottom>
<diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="3" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
</cellXfs>
</styleSheet>`

/** Varaqlarni .xlsx qilib yig'adi va brauzerdan yuklab beradi. */
export function downloadXlsx(fileName: string, sheets: XlsxSheet[]): void {
  const enc = new TextEncoder()
  const list = sheets.length > 0 ? sheets : [{ name: "Hisobot", title: "Hisobot", cols: [], rows: [] }]

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${list
    .map((s, i) => `<sheet name="${xml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("")}</sheets>
</workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
    { name: "_rels/.rels", data: enc.encode(rootRels) },
    { name: "xl/workbook.xml", data: enc.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(workbookRels) },
    { name: "xl/styles.xml", data: enc.encode(STYLES_XML) },
    ...list.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: enc.encode(sheetXml(s)),
    })),
  ]

  const url = URL.createObjectURL(zip(entries))
  const a = document.createElement("a")
  a.href = url
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
