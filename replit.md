# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## StudyCircle App

Production-style social study and exam-prep platform (GATE/JEE/NEET/CAT/UPSC/placements). Single-user demo (Aarav Sharma, GATE CSE).

- **Artifact**: `artifacts/studycircle` — React + Vite + Tailwind v4 + shadcn UI + wouter + react-query + framer-motion + recharts
- **API**: `artifacts/api-server` — Express, in-memory store with rich seed data (`src/lib/store.ts`), routes in `src/routes/studycircle.ts`
- **Contract**: `lib/api-spec/openapi.yaml` (~30 endpoints). Run `pnpm --filter @workspace/api-spec run codegen` after edits.
- **Modules**: marketing landing, dashboard, study timer (pomodoro), circles + channels (Discord-style), focus rooms, mock exams + attempt + result, analytics, leaderboard, doubts feed, pods, resources, revision planner, calendar, achievements, settings.
- **Note on nullable schemas**: in OpenAPI, put `{ type: "null" }` BEFORE the value branch in `oneOf` so generated Zod doesn't coerce `null` into a Date/number.
