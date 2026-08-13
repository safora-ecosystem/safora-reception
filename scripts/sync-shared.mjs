import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repoName = basename(repoRoot)
const parent = dirname(repoRoot)
const dryRun = process.argv.includes("--dry-run")

const manifest = JSON.parse(readFileSync(join(repoRoot, "shared-manifest.json"), "utf8"))

if (repoName !== manifest.source) {
  console.error(`sync faqat manba repodan (${manifest.source}) ishlaydi; bu ${repoName}.`)
  process.exit(1)
}

const targets = new Set()
for (const entry of manifest.files) {
  for (const repo of entry.repos) {
    if (repo === manifest.source) continue
    const targetRoot = join(parent, repo)
    if (!existsSync(targetRoot)) {
      console.warn(`[skip] ${repo} — ${targetRoot} topilmadi`)
      continue
    }
    for (const file of Object.keys(entry.hashes ?? {})) {
      const from = join(repoRoot, file)
      const to = join(targetRoot, file)
      if (dryRun) console.log(`${file} → ${repo}`)
      else {
        mkdirSync(dirname(to), { recursive: true })
        cpSync(from, to)
      }
      targets.add(repo)
    }
  }
}

if (!dryRun) {
  // Manifest + skriptlarning o'zi ham umumiy — qo'riqchi hamma repoda bir xil ishlasin.
  for (const repo of targets) {
    const targetRoot = join(parent, repo)
    cpSync(join(repoRoot, "shared-manifest.json"), join(targetRoot, "shared-manifest.json"))
    mkdirSync(join(targetRoot, "scripts"), { recursive: true })
    cpSync(join(repoRoot, "scripts/check-shared.mjs"), join(targetRoot, "scripts/check-shared.mjs"))
    cpSync(join(repoRoot, "scripts/sync-shared.mjs"), join(targetRoot, "scripts/sync-shared.mjs"))
  }
  console.log(`Tarqatildi: ${[...targets].join(", ") || "(hech narsa)"}`)
}
