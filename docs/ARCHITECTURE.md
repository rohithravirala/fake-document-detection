# Architecture

> **Owner:** M1 · Rohith · **Status:** not started

## To fill in

- [ ] Request lifecycle: upload → job → worker → checks → verdict → SSE
- [ ] Why a worker queue and not a blocking request
- [ ] Database schema and why JSONB for `extracted_fields`, `bboxes`, `evidence`, `profile`
- [ ] `pgvector` and how multiple-identity detection works in SQL
- [ ] Verdict engine: how checks combine into CLEAR / REJECT / REFER
- [ ] Audit hash chain and why it replaces blockchain
- [ ] Verification profiles: adding a document type without code
