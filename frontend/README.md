# frontend/ — officer interface

**Owners:** M4 (upload side) and M5 (verdict side) · **Difficulty:** Easy

React 18 + TypeScript + Vite + Tailwind + shadcn/ui. TanStack Query for the job
lifecycle, Zustand for local UI state.

## M4 — upload and processing

| Path | Holds |
|---|---|
| `src/pages/UploadPage.tsx` | Drop zone, camera capture, document type hint |
| `src/pages/ProcessingPage.tsx` | Live check stream over SSE, one row per check |
| `src/pages/LoginPage.tsx` | Official Officer Portal login with email, password, and custom name attribution |
| `src/components/upload/` | Drop zone, file card, camera |
| `src/components/layout/`, `src/components/common/` | Shell, nav, shared primitives, dynamic officer TopBar |
| `src/api/` | Typed client — generated from `docs/API_CONTRACT.md` |
| `src/mocks/` | **Build against these first.** Do not wait for the backend. |
| `src/lib/auth.tsx` | Officer authentication context, session persistence, and role management |
| `src/lib/`, `src/styles/` | Utilities, Tailwind config, tokens |

## M5 — verdict and history

| Path | Holds |
|---|---|
| `src/pages/VerdictPage.tsx` | CLEAR / REJECT / REFER, the one-line reason, evidence crops |
| `src/pages/CaseListPage.tsx` | Case history, TanStack Table |
| `src/components/verdict/` | Verdict badge, check list, evidence crop, face comparison |

## The one rule

The screen never shows a raw percentage as a verdict. One verdict, one reason, and
the cropped pixels that produced it. An officer has to be able to point at the
evidence, not at a number.
