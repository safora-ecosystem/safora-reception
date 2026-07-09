# safora-reception

Safora front-desk (reception) panel — `reception.safora.uz`. Operations only: booking
calendar, check-in / check-out, guest chat, requests. No financial screens (those live in
`safora-owner`).

## Stack

- **Vite + React + TypeScript** SPA (plain npm, no monorepo, no Next.js)
- **TanStack Router** (code-based) + **TanStack Query**
- **Tailwind v4** (CSS-first config) + **shadcn/ui** (`radix-nova`), lucide icons
- Talks to **core-api** (`safora-backend`) via `VITE_API_URL`

## Getting started

```bash
npm install
cp .env.example .env      # set VITE_API_URL (default http://localhost:3000)
npm run dev               # http://localhost:5174
```

Scripts: `npm run dev` · `npm run build` · `npm run lint` · `npm run preview`.

For the backend (docker, seed, running core-api) see `safora-backend/SESSION.md`.
See repo-specific conventions in the engineering guide; product/design context in `safora-backend`
(`goal.md`, `architecture.md`, `design.md`).
