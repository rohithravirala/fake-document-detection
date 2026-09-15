/**
 * Field-only cases that drive the real checks.
 *
 * These are not mocked responses — they are real submissions that run the
 * genuine verdict engine on known inputs. Two reasons they exist:
 *
 * 1. they work on a machine with no OCR engine installed, which is the fallback
 *    the demonstration needs when a venue laptop is not the one it was built on;
 * 2. each one has a stated expectation, so a wrong verdict is visible
 *    immediately rather than being taken on trust.
 *
 * The Aadhaar demonstrations are not here: a Secure QR payload is tens of
 * kilobytes and has to be generated with a signing key. `scripts/seed_db.py`
 * creates those server-side.
 */

export interface DemoCase {
  label: string
  expectation: string
  documents: Array<{ doc_type: string; fields: Record<string, string> }>
}

/** ICAO Doc 9303 published specimen. Its expiry is in 2012, deliberately. */
const ICAO_SPECIMEN_MRZ =
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\n' +
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10'

export const DEMO_CASES: DemoCase[] = [
  {
    label: 'PAN · genuine',
    expectation: 'CLEAR — the number encodes K, and the surname is KUMAR',
    documents: [
      {
        doc_type: 'pan',
        fields: { pan_number: 'ABCPK1234X', name: 'RAHUL KUMAR' },
      },
    ],
  },
  {
    label: 'PAN · name edited',
    expectation: 'REJECT — the number encodes S, no name word starts with S',
    documents: [
      {
        doc_type: 'pan',
        fields: { pan_number: 'ABCPS1234X', name: 'RAHUL KUMAR' },
      },
    ],
  },
  {
    label: 'PAN · invented number',
    expectation: 'REJECT — Z is not an issued holder category',
    documents: [
      {
        doc_type: 'pan',
        fields: { pan_number: 'ABCZK1234X', name: 'RAHUL KUMAR' },
      },
    ],
  },
  {
    label: 'Passport · MRZ check digits',
    expectation: 'REJECT — all five digits verify, but the specimen expired in 2012',
    documents: [{ doc_type: 'passport', fields: { mrz: ICAO_SPECIMEN_MRZ } }],
  },
  {
    label: 'Passport · printed page altered',
    expectation: 'REJECT — the data page and the MRZ state different numbers',
    documents: [
      {
        doc_type: 'passport',
        fields: { mrz: ICAO_SPECIMEN_MRZ, passport_number: 'L898902C9' },
      },
    ],
  },
  {
    label: 'No source of truth',
    expectation: 'REFER — nothing here can be verified, so it cannot be cleared',
    documents: [{ doc_type: 'unknown', fields: { name: 'SOMEONE' } }],
  },
]
