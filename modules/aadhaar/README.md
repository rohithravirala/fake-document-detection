# modules/aadhaar/ — QR decode + UIDAI signature verification

**Owner:** M3 · **Difficulty:** HARD — the strongest claim in the project

The Aadhaar secure QR is digitally signed by UIDAI. If the signature verifies, the
data inside it is authoritative — offline, with no network and no API key. Comparing
that against the text printed on the card catches any alteration with certainty.

## Scope

- [~] Detect and decode the QR (`pyzbar` / `zxing-cpp`)
      *(OpenCV path written with six fallback renderings; `pyzbar` supported but
      not installed. **Never run against a real Aadhaar QR image.**)*
- [x] Parse the secure QR payload — byte layout, delimiters, compression
- [x] Split data from signature
- [~] Load the UIDAI public certificate (`pyOpenSSL`)
      *(loader handles PEM and DER and is tested; the real UIDAI certificate is
      not provisioned here)*
- [x] Verify the signature (`cryptography` — **never hand-rolled crypto**)
- [x] Extract demographic fields and the embedded photo
- [x] Cross-compare signed data against OCR-extracted printed text

## State

All of the above is implemented and tested. The cryptographic path is verified
end to end in `backend/tests/test_aadhaar.py`: a synthetic payload assembled in
the real byte layout, signed with a throwaway RSA key, verified through the same
`signature.py` that runs in production — and a one-byte edit after signing fails
verification, which is the test that makes the rest mean anything.

## What is still open

**No real Aadhaar Secure QR has been through this.** That is the gap that
matters. The parser follows the documented layout and the crypto is standard, but
the byte offsets have only been exercised against payloads we generated. Get real
sample QRs and confirm a decode before trusting any of it.

**The UIDAI certificate is not provisioned.** Without it, `aadhaar.qr_signature`
reports `unavailable` — never `fail`. Drop the real certificate into `certs/` and
the module switches to production behaviour with no code change.

`scripts/seed_db.py --demo` writes a synthetic `demo-signer.pem` here for
demonstrations. It is gitignored deliberately: a demo signer sitting beside the
real UIDAI certificate is how a deployment ends up verifying cards against the
wrong key.

## Risks

Payload format varies by generation of the QR. Legacy unsigned XML is handled and
explicitly reported as proving nothing — regenerating it is trivial, so it can
never support a CLEAR.

---

`[x]` done and tested · `[~]` written but not verified against the real thing · `[ ]` not done
