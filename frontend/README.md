# Stow Frontend

The web client for [Stow](../README.md), a decentralized savings protocol on Stellar. Built with Next.js (App Router), React 19, TypeScript, and Tailwind CSS v4.

This guide covers everything a new contributor needs to install, run, test, and build the app locally.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Same version used in CI |
| pnpm | 9 | The repo's package manager (`corepack enable` works too) |

> **Note:** A `pnpm-lock.yaml` is committed — always use pnpm so installs match CI.

## Getting Started

From this directory (`frontend/`):

```bash
# 1. Install dependencies
pnpm install

# 2. Start the dev server
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The page auto-updates as you edit files.

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start the development server on `http://localhost:3000` |
| `pnpm run build` | Create an optimized production build |
| `pnpm run start` | Serve the production build (run `build` first) |
| `pnpm run lint` | Run ESLint (`eslint-config-next` + TypeScript rules) |
| `pnpm run test` | Run unit tests once via Jest |
| `pnpm run test:watch` | Run tests in watch mode |
| `pnpm run test:coverage` | Run tests with a coverage report (thresholds enforced at 70%) |

## Environment Variables

No environment variables are required to run the app today — a clean clone works out of the box.

When configuration is needed (e.g. backend API URL, contract addresses), use these conventions:

- Create a `.env.local` file in `frontend/` for local overrides. It is git-ignored (all `.env*` files are).
- Prefix any variable read in client components with `NEXT_PUBLIC_`, e.g.:

  ```bash
  # frontend/.env.local
  NEXT_PUBLIC_API_URL=http://localhost:8080
  ```

- Restart the dev server after adding or changing variables.

## Folder Structure

```
frontend/
├── public/                  # Static assets served at /
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx       # Root layout: fonts, metadata, global chrome
│   │   ├── page.tsx         # Landing page (features, products, roadmap)
│   │   ├── globals.css      # Tailwind v4 entry + design tokens
│   │   └── favicon.ico
│   └── components/
│       ├── Navbar.tsx       # Top navigation
│       ├── MobileNav.tsx    # Mobile navigation
│       ├── WaitlistForm.tsx # Client component with form state
│       ├── GithubIcon.tsx   # Icon wrapper
│       └── savings/         # Savings-domain UI primitives
│           ├── BalanceSparkline.tsx  # SVG balance trend chart (accessible)
│           ├── ProgressRing.tsx      # SVG goal-progress ring
│           ├── index.ts              # Barrel export for the folder
│           └── README.md             # Per-component docs & usage
├── jest.config.js           # Jest config via next/jest
├── jest.setup.js            # Test setup (jest-dom, browser API mocks)
├── eslint.config.mjs        # ESLint flat config
├── next.config.ts           # Next.js config
└── postcss.config.mjs       # PostCSS/Tailwind pipeline
```

## Architecture Overview

- **App Router (`src/app/`)** — Pages are React Server Components by default. `layout.tsx` loads the Geist font family via `next/font`, sets metadata, and renders the global background layers.
- **Components (`src/components/`)** — Shared UI. Interactive pieces (e.g. `WaitlistForm`) opt into client-side rendering with `"use client"`.
- **Savings primitives (`src/components/savings/`)** — Reusable, dependency-free SVG widgets for savings dashboards (balance sparkline, progress ring). Import them from the barrel:

  ```tsx
  import { BalanceSparkline } from "@/components/savings";
  ```

- **Styling** — Tailwind CSS v4 with design tokens defined in `globals.css` (`bg-brand`, `text-muted`, etc.). Icons come from `lucide-react`.
- **Path aliases** — `@/*` maps to `src/*` (configured for both TypeScript and Jest).
- **Testing** — Jest with `next/jest` and React Testing Library in a jsdom environment. Tests live beside their components as `*.test.tsx`. Browser APIs not present in jsdom (`matchMedia`, `IntersectionObserver`, `ResizeObserver`) are mocked in `jest.setup.js`.

CI runs lint, tests, and build on every PR touching `frontend/` — see [`.github/workflows/frontend-ci.yml`](../.github/workflows/frontend-ci.yml).

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) — features and API reference.
- [Learn Next.js](https://nextjs.org/learn) — interactive tutorial.
- [Stellar Docs](https://developers.stellar.org/docs/build/smart-contracts) — Soroban smart contracts.

See the root [CONTRIBUTING.md](../CONTRIBUTING.md) for branch/PR conventions before opening a pull request.
