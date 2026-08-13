import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repoName = (() => {
  try {
    return JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).name ?? basename(repoRoot)
  } catch {
    return basename(repoRoot)
  }
})()
const manifestPath = join(repoRoot, "shared-manifest.json")
const update = process.argv.includes("--update")

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function expand(entryPath) {
  const abs = join(repoRoot, entryPath)
  if (!entryPath.endsWith("/")) return [entryPath]
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else out.push(p.slice(repoRoot.length + 1))
    }
  }
  walk(abs)
  return out
}

if (update) {
  if (repoName !== manifest.source) {
    console.error(`--update faqat manba repoda (${manifest.source}) ishlaydi; bu ${repoName}.`)
    process.exit(1)
  }
  for (const entry of manifest.files) {
    entry.hashes = Object.fromEntries(expand(entry.path).map((f) => [f, sha256(join(repoRoot, f))]))
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n")
  console.log(`shared-manifest.json yangilandi (${manifest.files.length} yozuv).`)
  process.exit(0)
}

const problems = []
for (const entry of manifest.files) {
  if (!entry.repos.includes(repoName)) continue
  for (const [file, expected] of Object.entries(entry.hashes ?? {})) {
    let actual
    try {
      actual = sha256(join(repoRoot, file))
    } catch {
      problems.push(`${file} — fayl topilmadi`)
      continue
    }
    if (actual !== expected) problems.push(`${file} — manba (${manifest.source}) dan farq qiladi`)
  }
}

if (problems.length > 0) {
  const header = `Umumiy fayllar driftda (${problems.length}):`
  const body = problems.map((p) => `  · ${p}`).join("\n")
  const hint =
    manifest.source === repoName
      ? "Manba repodasiz: ataylab o'zgartirgan bo'lsangiz `node scripts/check-shared.mjs --update`, so'ng sync-shared.mjs bilan tarqating."
      : `Tuzatish manbada (${manifest.source}) qilinib, sync-shared.mjs bilan tarqatiladi — bu repoda qo'lda tahrirlanmaydi.`
  if (manifest.mode === "fail") {
    console.error(`${header}\n${body}\n${hint}`)
    process.exit(1)
  }
  console.warn(`[warn] ${header}\n${body}\n${hint}\n(mode: "warn" — Wave 4 dan keyin "fail")`)
}
