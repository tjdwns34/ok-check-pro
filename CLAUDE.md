# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on http://localhost:8080
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # Run ESLint
npm run preview      # Preview production build
npm run test         # Run Vitest (single run)
npm run test:watch   # Run Vitest in watch mode
```

E2E tests use Playwright (`playwright.config.ts`). Unit tests use Vitest with jsdom (`vitest.config.ts`).

## Architecture

**Stack:** React 18 + TypeScript + Vite, Supabase (PostgreSQL), TanStack React Query, shadcn/ui + TailwindCSS, Lovable cloud auth (Google OAuth).

**Entry point:** `src/main.tsx` → `src/App.tsx` (sets up QueryClientProvider, AuthProvider, TooltipProvider, toast providers, BrowserRouter).

**Pages:**
- `src/pages/Index.tsx` — The entire app (~387 lines). Contains both `LoginScreen` and `ChecklistApp` components, all data fetching/mutation logic via React Query against Supabase.
- `src/pages/NotFound.tsx` — 404 fallback.

**Auth:** `src/hooks/useAuth.tsx` — context + hook wrapping Lovable OAuth (`src/integrations/lovable/`) with Supabase session. Google OAuth only.

**Database:** Single table `checklist_items` (id, user_id, category, title, checked, memo, updated_at). Supabase client at `src/integrations/supabase/client.ts`. Generated types at `src/integrations/supabase/types.ts` (do not edit manually).

**Key patterns:**
- Optimistic updates on all mutations (`setQueryData` before server response)
- Memo field uses 800ms debounce to reduce DB writes
- Categories are hardcoded strings: `"월간 점검"` and `"분기 점검"`
- Path alias `@/*` → `src/*`
- TypeScript is configured with loose checking (`noImplicitAny: false`, `strictNullChecks: false`)

**UI components:** `src/components/ui/` is the shadcn/ui library — do not customize these directly; add wrappers or use Tailwind classes at call sites.

## Environment

Requires a `.env` file with Supabase credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). The project uses both `bun.lock` and `package-lock.json`; prefer `npm` for consistency.
