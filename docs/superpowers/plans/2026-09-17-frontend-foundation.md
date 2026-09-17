# Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first runnable Next.js frontend foundation for Network Agent, including login, JWT session handling, an API client, a protected console shell, and route placeholders for later product phases.

**Architecture:** Keep the NestJS backend at the repository root and add the frontend under `apps/web` without converting the root package into a workspace yet. The browser talks directly to the NestJS REST API through a small typed API client that unwraps the backend `{ code, message, data }` envelope and attaches the persisted Bearer token. Protected console routes share a client-side authentication gate and application shell.

**Tech Stack:** Next.js 16.3.5, React 19.3, TypeScript, Tailwind CSS 4, shadcn-style local UI primitives, TanStack Query 5, Zustand 5, React Hook Form 7, Zod 4, Vitest.

**Spec:** `docs/frontend-product-plan.md`

## Global Constraints

- Frontend lives in `apps/web`.
- Use Next.js App Router.
- Login matches the existing backend contract: `email + password`.
- API responses are unwrapped from `{ code, message, data }`.
- API requests attach `Authorization: Bearer <accessToken>` when a session exists.
- HTTP 401 clears the local session and redirects to `/login` in the browser.
- Phase 1 does not invent device metrics or task statistics that the backend does not expose.
- Backend CORS allows the separately served web application origin.

---

### Task 1: Frontend scaffold and test runner

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/components.json`
- Create: `apps/web/.env.example`

**Interfaces:**
- Produces the standalone `apps/web` development, build, lint, typecheck, and test commands.

- [ ] Add the Next.js/React runtime and frontend dependencies.
- [ ] Add Tailwind PostCSS configuration and TypeScript aliases.
- [ ] Add Vitest with the `@/*` path alias.
- [ ] Add `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000` as the local API example.

### Task 2: API client behavior

**Files:**
- Create: `apps/web/src/lib/api-client.test.ts`
- Create: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/lib/auth-store.ts`

**Interfaces:**
- Produces: `apiRequest<T>(path, init?) => Promise<T>`.
- Consumes: persisted `accessToken` from `useAuthStore.getState()`.

- [ ] Specify tests for successful response-envelope unwrapping and backend error propagation.
- [ ] Implement URL building from `NEXT_PUBLIC_API_BASE_URL`.
- [ ] Attach JSON content type and Bearer token when available.
- [ ] On 401, clear the session and redirect to `/login` in browser environments.

### Task 3: Login schema and authentication flow

**Files:**
- Create: `apps/web/src/features/auth/schema.test.ts`
- Create: `apps/web/src/features/auth/schema.ts`
- Create: `apps/web/src/features/auth/api.ts`
- Create: `apps/web/src/features/auth/login-form.tsx`
- Create: `apps/web/src/app/login/page.tsx`

**Interfaces:**
- Consumes: `apiRequest<LoginResult>('/auth/login', ...)`.
- Produces persisted `{ accessToken, user }` session state.

- [ ] Specify tests that reject invalid email and empty password.
- [ ] Define the Zod login schema matching the backend DTO.
- [ ] Submit email/password through React Hook Form.
- [ ] Persist the returned session and navigate to `/dashboard`.
- [ ] Display backend/form errors without exposing implementation details.

### Task 4: Protected console shell

**Files:**
- Create: `apps/web/src/components/providers.tsx`
- Create: `apps/web/src/components/auth-gate.tsx`
- Create: `apps/web/src/components/app-shell.tsx`
- Create: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/components/ui/input.tsx`
- Create: `apps/web/src/components/ui/card.tsx`
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/(console)/layout.tsx`

**Interfaces:**
- `Providers` owns the `QueryClient`.
- `AuthGate` redirects unauthenticated users after Zustand persistence hydration.
- `AppShell` owns navigation and logout UI.

- [ ] Add shared application styles and metadata.
- [ ] Add TanStack Query provider.
- [ ] Add the authenticated layout and sidebar/topbar shell.
- [ ] Redirect `/` to `/dashboard`.

### Task 5: Phase 1 routes

**Files:**
- Create: `apps/web/src/app/(console)/dashboard/page.tsx`
- Create: `apps/web/src/app/(console)/devices/page.tsx`
- Create: `apps/web/src/app/(console)/agent/page.tsx`
- Create: `apps/web/src/app/(console)/tasks/page.tsx`
- Create: `apps/web/src/app/(console)/audit/page.tsx`
- Create: `apps/web/src/app/(console)/settings/page.tsx`

**Interfaces:**
- Produces stable navigation destinations for later phases.

- [ ] Build the Dashboard as a truthful foundation view with system capability cards rather than fake metrics.
- [ ] Add explicit phase placeholders for Devices, Agent, Tasks, Audit, and Settings.

### Task 6: Backend browser access

**Files:**
- Modify: `src/main.ts`
- Modify: `.env.remote.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes `WEB_ORIGIN`, defaulting to `http://localhost:3001`.

- [ ] Enable NestJS CORS for configured web origins.
- [ ] Document `WEB_ORIGIN` in the environment example.
- [ ] Ignore nested frontend `node_modules`, `.next`, and coverage outputs.

### Verification

- [ ] `cd apps/web && npm install`
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] From the repository root, run the existing backend test suite.
- [ ] Start NestJS on port 3000 and Next.js on port 3001; verify login, protected-route redirect, logout, and navigation.

> The chat execution environment cannot reach npm/GitHub directly, so runtime verification must be performed by CI or a connected development runtime after this commit. Static repository diff review is still required before promotion to `master`.
