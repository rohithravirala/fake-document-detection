# Demo Script

**Owner:** M6 · **Status:** implemented

Six minutes. The order below builds one argument: *the machine is fast, and here
is why you can trust what it says.*

---

## Before you start

```bash
./scripts/setup_dev.sh
./.venv/bin/python scripts/seed_db.py --demo
./.venv/bin/python -m uvicorn backend.app.main:app &
cd frontend && npm run dev
```

Checklist:

- [x] Local stack running. **Do not depend on venue wifi or a deployment URL.**
- [x] `/api/health` shows the modules you intend to demonstrate
- [x] Case history has the seeded cases in it, so the screen is not empty
- [x] A second machine or phone ready as a backup
- [x] Network cable or wifi toggle within reach — you will need it at 4:30

---

## 0:00 — The problem (40 seconds)

> An officer at a checkpoint has about thirty seconds per person. Photo, expiry,
> visa, watchlist. Deciding whether the document itself is forged is the one task
> that does not fit — a trained examiner needs ten minutes.
>
> So that check gets skipped. And a forged document is not the goal for a
> criminal, it is the key: a bank account, a SIM card, a border crossing, a fresh
> identity for someone already blacklisted.

Then the question the rest of the demonstration answers:

> A machine can answer in two seconds. The hard part is whether the officer can
> trust the answer. "87% likely fake" gives them nothing to act on, and nothing
> to defend afterwards.

---

## 0:40 — A genuine Aadhaar (50 seconds)

Upload screen → **Aadhaar · genuine**.

Let the live stream run. Point at it while it does:

> Each check appears as it completes. The first one is the signature.

Verdict: **CLEAR**. Read the reason aloud — it is one sentence.

> The QR on an Aadhaar card is digitally signed by UIDAI. We verified that
> signature offline. No API call, no lookup, no network.

---

## 1:30 — The same card with the name edited (70 seconds)

Run **Aadhaar · name edited**.

Verdict: **REJECT**. Expand the failing check.

> The signature still verifies — the QR was not touched. What fails is the
> comparison: the card says PRIYA VERMA, the data UIDAI signed says ANITA SHARMA.
>
> The forger changed one of the two places the name is stored. Changing both
> would need UIDAI's private key.

**This is the whole idea.** Do not rush it. Point at `Expected` and `On the
document` in the evidence panel.

> That is not a probability. It is a contradiction, and the officer can point at
> it.

---

## 2:40 — PAN, with no model at all (40 seconds)

Run **PAN · name edited**.

> No image, no OCR, no machine learning. The PAN number encodes the first letter
> of the surname. This one encodes S. The card says RAHUL KUMAR.
>
> Pure arithmetic, and it runs in under a millisecond.

---

## 3:20 — Passport MRZ (40 seconds)

Run **Passport · MRZ check digits**.

> Five check digits, all verifying, against the ICAO published specimen.

Then **Passport · printed page altered**.

> The machine-readable zone and the printed data page disagree.

Be ready for the obvious follow-up, and answer it before it is asked:

> Check digits are modulo 10 — a forger who recomputes them produces an MRZ that
> verifies. They catch careless edits and OCR misreads, not a competent forger.
> That is why the MRZ is also compared against the printed page, and why a
> passport here can be rejected with certainty but only provisionally cleared.
> The decisive check for a passport is the signed chip, which needs NFC hardware.

Saying this first is worth more than being caught by it.

---

## 4:00 — Where there is no source of truth (30 seconds)

Run **No source of truth**.

Verdict: **REFER**.

> Nothing on this document can be checked against an issuing authority. The
> system will not clear it.
>
> It runs tampering analysis on documents like this — compression history, sensor
> noise, copied regions — but that only ever produces a risk score and a referral
> to a human. **The system is never allowed to call a document genuine on
> appearance alone.** That is enforced in the type system, not by convention.

---

## 4:30 — Pull the network (30 seconds)

Disconnect wifi. Run the genuine Aadhaar again.

> Same result. Aadhaar signature verification, PAN structure and MRZ check digits
> need no network at all.
>
> Border posts in remote areas genuinely lack connectivity. A system that stops
> working there is not a system for border posts.

Reconnect.

---

## 5:00 — The audit log (40 seconds)

Audit log screen. **Chain intact**.

> Every screening is hash-chained to the one before it. Altering a past record
> breaks every link after it.

If you have a terminal ready, edit a row and refresh — the page names the exact
record where history stops adding up.

> This is not blockchain, and that is deliberate. A hash chain gives the same
> tamper-evidence with none of the consensus cost and no network dependency. When
> a system reaches for blockchain to prove a log has not been edited, it is
> usually reaching for the word rather than the property.

---

## 5:40 — Scale (20 seconds)

Profiles screen.

> Adding a document type is this — thresholds, required fields, which checks
> apply. A row, not a code change and not a deployment.

---

## Questions you will get

**"What is your accuracy?"**
> 17 of 17 on our synthetic set, and I would not quote that as an accuracy figure.
> It demonstrates that each claimed check works; it says nothing about a forgery
> technique we did not think of. There is no lawful corpus of real forged Indian
> identity documents to test against, so any number we published would be
> measuring ourselves against ourselves.
>
> What I will claim precisely: if the UIDAI signature verifies and the printed
> text disagrees with it, the document was altered. That is not statistical.

**"Why no deep learning for forgery detection?"**
> Three reasons. No lawful training data. No explainability — an officer cannot
> act on an activation. And accuracy measured on fakes we generated ourselves
> would be meaningless.

**"Is the biometric data safe?"**
> We store 512-dimensional embeddings, never photographs. The model runs on this
> machine. No cloud face API is called and nothing biometric leaves the
> deployment boundary.

**"What if your OCR misreads something?"**
> A quality gate runs before anything else — a blurred capture is returned for a
> retake rather than analysed. Below the confidence threshold a mismatch is
> reported as a possible misread, not as tampering. And a missing model reports
> "could not run", which sends the case to a human. It never becomes a rejection.

**"What happens when a module crashes?"**
> It becomes an `unavailable` check and the case goes to REFER. A crash is never
> a verdict.

---

## If something fails live

- Backend down → the demonstration buttons still need it. Restart uvicorn; it is
  a two-second start.
- OCR unavailable → use the field-value buttons. They run the same checks and
  need no models. Say so; it is a design property, not a save.
- Frontend down → `http://localhost:8000/docs` and drive `POST /api/cases/manual`
  directly. Less pretty, same system.
- Everything down → `./.venv/bin/python evaluation/run.py` prints all 17 samples
  with their verdicts in a terminal.
