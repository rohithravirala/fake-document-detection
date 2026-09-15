# Deployment

**Owner:** M1 · Rohith · **Status:** implemented

---

## Environment variables

Everything is in [`.env.example`](../.env.example). Nothing here is required —
unset values give the SQLite, in-process path.

| Variable | Default | Effect |
|---|---|---|
| `DATABASE_URL` | SQLite under `var/` | Postgres URL switches on `JSONB` and pgvector |
| `REDIS_URL` | unset | Set it to run RQ workers instead of in-process tasks |
| `UPLOAD_DIR` | `var/uploads` | Where screened images are stored, by content hash |
| `MODEL_DIR` | `var/models` | Where model weights are cached |
| `AADHAAR_CERT_PATH` | `modules/aadhaar/certs/` | The UIDAI public certificate |
| `OFFICER_ID` | `demo-officer-01` | Hard-coded identity; no auth system is built |
| `ALLOWED_ORIGINS` | localhost dev ports | CORS |

---

## Docker Compose

```bash
docker compose up --build
docker compose exec api python scripts/seed_db.py --demo
```

Five services: `db` (pgvector/pgvector:pg16), `redis`, `api`, `worker`, `web`.

The API and worker share the uploads volume — the worker reads images the API
wrote. Splitting them without sharing that volume is the failure mode to watch
for when moving to separate hosts; use object storage at that point.

The `pgvector/pgvector:pg16` image is used rather than stock Postgres because it
ships the extension already built. Compiling it at container start is a build
step waiting to fail at a demonstration.

---

## Migrations

```bash
cd backend && alembic upgrade head
```

The database URL comes from the application settings, not from `alembic.ini`, so
a migration cannot run against a different database than the app is using.

After changing a model:

```bash
cd backend && alembic revision --autogenerate -m "describe the change"
```

CI fails if models and migrations have drifted apart.

---

## Railway / Render

Free tier, adequate for a demonstration.

1. Provision Postgres and enable the `vector` extension (`CREATE EXTENSION IF NOT
   EXISTS vector` — the first migration does this).
2. Provision Redis, or leave `REDIS_URL` unset to run in-process.
3. Deploy `backend/Dockerfile`; set `DATABASE_URL` and `REDIS_URL`.
4. Deploy `frontend/Dockerfile` with `VITE_API_TARGET` pointing at the API.
5. Run `alembic upgrade head`, then `python scripts/seed_db.py`.

A worker is only needed when `REDIS_URL` is set. With it unset the API screens
in-process, which is fine at demonstration volume.

---

## Demo day

**Have the local fallback ready and tested.** Deployment URLs fail at the worst
possible moment, and venue wifi is not something to build a demonstration on.

```bash
./scripts/setup_dev.sh
./.venv/bin/python -m uvicorn backend.app.main:app &
cd frontend && npm run dev
```

Then **disconnect the network and run the demonstration again.** Aadhaar
signature verification, PAN structure validation and MRZ check digits all work
offline — they need no UIDAI API, no lookup and no connectivity of any kind.

That is worth showing deliberately rather than mentioning: border posts in remote
areas genuinely lack connectivity, and a system that stops working there is not a
system for border posts. Pulling the cable mid-demonstration makes the point
better than a slide does.

Before demo day, with a connection you trust:

```bash
./.venv/bin/python scripts/download_models.py --all
docker compose build          # if demonstrating the containers
cd frontend && npm run build  # verify the production bundle
```

---

## Hardening — what is deliberately not built

| Not built | Why, and what it would take |
|---|---|
| Authentication | `OFFICER_ID` is hard-coded. Real deployment needs officer identity on every case and audit record; the columns already exist |
| TLS | Terminate at the load balancer. `getUserMedia` needs a secure context, so camera capture will not work over plain HTTP anyway |
| Rate limiting | Nothing here throttles uploads |
| Object storage | Images go to a local volume. Multi-host needs S3 or equivalent |
| External audit anchor | The hash chain detects edits but an administrator with full table access could recompute it. Publishing the head hash somewhere append-only closes that |
| Secret management | Environment variables. No vault integration |

These are stated rather than left to be discovered. The screening logic was the
project; the operational shell around it is a known, bounded piece of work.
