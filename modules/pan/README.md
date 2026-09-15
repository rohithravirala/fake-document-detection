# modules/pan/ — PAN structural validator

**Owner:** M5 · **Difficulty:** Easy — pure Python, no models, no images

The PAN number encodes its own holder category and the first letter of the surname.
A forger who edits the printed name and leaves the number alone is caught by
arithmetic, not by a model.

## Scope

- [x] Format: `^[A-Z]{5}[0-9]{4}[A-Z]$`
- [x] 4th character → holder category (P, C, H, F, A, T, B, G, J, L)
- [x] 5th character must equal the first letter of the printed surname
- [x] Each failure returns a `Check` with a citation, never a score

## Done when

Table-driven pytest covers valid PANs, each malformed shape, an unknown category
letter, and a surname mismatch. This is the first check that works end to end and
the easiest one to defend to an evaluator — make the tests good.

**After this ships,** M5 moves to the verdict side of `frontend/`.
