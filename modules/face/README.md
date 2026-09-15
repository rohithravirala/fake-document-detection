# modules/face/ — local embeddings, three-band comparison

**Owner:** unassigned · **Difficulty:** Medium
**Status:** code complete, **never run against real faces**

Not in the original folder plan; stage 4 needs it.

Verifying a document is not enough. A genuine card in the wrong hands passes
every cryptographic check there is.

## Three comparisons, answering different questions

| Comparison | Question |
|---|---|
| live vs document photo | Is the person here the person on the card? |
| document photo vs QR photo | Was the photograph on the card replaced? **Decisive** — the QR photo is signed by UIDAI |
| live vs prior encounters | Has this face been screened before under another identity? |

The third runs in the database, not here — `backend/app/services/faces.py`, via
pgvector. This module publishes the embedding for it.

## Design decisions worth defending

**Three bands, not two.** `≥ 0.85` match, `≤ 0.60` no match, and an explicit
inconclusive band between them. Document photographs are small, often printed at
low resolution, and frequently years old. Forcing a binary answer out of that
produces confident errors, and a confident error about identity at a border is
the worst output this system could give.

**An 80-pixel resolution floor.** Below it, no similarity score is reported at
all — one computed from that would be noise wearing a number's clothes.

**Embeddings, never images.** The model runs on this machine. No cloud face API
is ever called. An embedding is not reversible into a usable photograph. Say this
first: biometric handling is exactly what a Ministry of Home Affairs evaluator
will probe.

**A face match cannot clear a document.** The check type is `biometric`, which is
not authoritative. It confirms who is holding the card, not whether the card is
real.

## What is still open

- [ ] **Run it against real faces.** InsightFace is not installed here, so the
      module reports `unavailable` and cases route to REFER. The logic, the
      bands and the resolution floor are complete and unexercised
- [ ] Liveness detection — nothing stops a photograph of a photograph
- [ ] Threshold calibration. 0.85/0.60 are InsightFace's usual figures, not ours
- [ ] Live camera capture wired through to this module end to end
