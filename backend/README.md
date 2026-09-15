# backend/ — API, database, queue, verdict engine

**Owner:** M1 · Rohith · **Difficulty:** Medium

Everything that is not a detection algorithm. The backend never decides whether a
document is fake — it asks `modules/`, collects their checks, and combines them.

| Folder | Holds |
|---|---|
| `app/api/` | FastAPI routes: submit, fetch case, SSE stream, case list |
| `app/models/` | SQLAlchemy models: cases, documents, checks, face_encounters, audit_log, verification_profiles |
| `app/schemas/` | Pydantic request/response schemas — must match `docs/API_CONTRACT.md` exactly |
| `app/services/` | Orchestration: dispatch to modules, persist results, write the audit chain |
| `app/verdict/` | The rules that turn a list of checks into CLEAR / REJECT / REFER |
| `app/workers/` | RQ jobs — the long work happens here, never in a request |
| `alembic/` | Migrations |
| `tests/` | pytest — the verdict engine especially |

## Done when

- [ ] `docker compose up` gives a running API, worker, Postgres and Redis
      *(compose file written; **never actually run** — Docker is not installed on
      the machine this was built on. Verify before relying on it.)*
- [x] `POST /api/cases` returns a `case_id` immediately
- [x] Checks stream over SSE as each one finishes
- [x] The verdict engine is covered by table-driven tests
- [x] A forensic signal can never produce CLEAR on its own
- [x] The audit chain detects a tampered past row

## Blocks everyone

`modules/common/` and `docs/API_CONTRACT.md` land **first**. Until those are merged,
M2–M6 are guessing at shapes. This is the critical path.
