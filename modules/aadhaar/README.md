# modules/aadhaar/ — QR decode + UIDAI signature verification

**Owner:** M3 · **Difficulty:** HARD — the strongest claim in the project

The Aadhaar secure QR is digitally signed by UIDAI. If the signature verifies, the
data inside it is authoritative — offline, with no network and no API key. Comparing
that against the text printed on the card catches any alteration with certainty.

## Scope

- [ ] Detect and decode the QR (`pyzbar` / `zxing-cpp`)
- [ ] Parse the secure QR payload — byte layout, delimiters, compression
- [ ] Split data from signature
- [ ] Load the UIDAI public certificate (`pyOpenSSL`)
- [ ] Verify the signature (`cryptography` — **never hand-rolled crypto**)
- [ ] Extract demographic fields and the embedded photo
- [ ] Cross-compare signed data against OCR-extracted printed text

## Risks — raise early, do not sit on them

Payload format varies by generation of the QR. Get real sample QRs in week 1 and
confirm you can decode one before building anything on top. If the signature path
stalls, the field-comparison path still has demo value — ship that first.
