# modules/passport/ — MRZ check digits and the printed page

**Owner:** M3 (shares Aadhaar's crypto context) · **Difficulty:** Medium
**Status:** working against published ICAO specimens

Not in the original folder plan. Stage 3 needs it, and folding passport logic
into `aadhaar/` would have made both worse.

A passport restates its data page in the machine-readable zone, and the MRZ
carries check digits over its own fields. Two independent sources of evidence
follow from that, and the module uses both.

## What is implemented

- [x] ICAO 9303 check digit — weights 7,3,1, `A`=10…`Z`=35, `<`=0
- [x] TD1 (3×30), TD2 (2×36) and TD3 (2×44) parsing
- [x] Five check digits on TD3: document number, birth, expiry, optional, composite
- [x] MRZ compared against every field read off the printed data page
- [x] Expiry as a POLICY check — an expired passport is genuine and expired
- [x] Tested against the published ICAO Doc 9303 specimen values

## The limitation, stated plainly

**Check digits do not stop a competent forger.** They are modulo 10 and anyone
can recompute them. `backend/tests/test_mrz.py` contains a worked example:
editing the date of birth and writing the correct digit produces an MRZ where
every digit verifies, composite included.

What they reliably catch is a field edited without recomputing its digit — the
careless forgery — and OCR misreads, which is what they were designed for.

Against a forger who does the arithmetic, the defences are:

- the MRZ must also agree with the **printed data page**, which is two surfaces
  to edit consistently rather than one, and
- the ePassport **chip is signed** by the issuing state. That is the passport
  equivalent of the Aadhaar Secure QR and the only decisive check available.
  It needs NFC hardware and is out of scope here.

So a passport can be **rejected** with certainty by this module and only
**provisionally cleared**. Say that before an evaluator asks.

## What is still open

- [ ] ePassport chip reading (needs NFC hardware)
- [ ] Visa-specific rules — validity window, stay duration, entry count
- [ ] MRZ extraction from a real photograph, end to end. The OCR-B constrained
      path is written but has only been exercised on text, not on an image
