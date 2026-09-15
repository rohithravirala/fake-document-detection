# API Contract

> **Owner:** M1 · Rohith · **Status:** not started

Single source of truth for every request and response shape between `frontend/`, `backend/` and `modules/`.
Nothing in this repo may define its own shapes — if it crosses a folder boundary, it is specified here first.

## To fill in

- [ ] `POST /api/cases` — submit documents, returns `case_id`
- [ ] `GET  /api/cases/{id}` — case with documents, checks, verdict
- [ ] `GET  /api/cases/{id}/stream` — SSE, one event per completed check
- [ ] `GET  /api/cases` — paginated case list
- [ ] Shared types: `Check`, `Verdict`, `ExtractedField`, `BBox`, `Evidence`
- [ ] Module interface: what `modules/*` receive and must return
- [ ] Error envelope and status codes
