# SVARAM — Officer Verification Console (Frontend)

**Smart India Hackathon (SIH 2026)** · Problem ID: **SIH26188**  
*AI-Based Fake Identity & Document Screening System — Ministry of Home Affairs (MHA) / Law Enforcement*

High-performance, mission-critical single page application built with **React 18**, **TypeScript**, **Vite**, and **Tailwind CSS**. Designed specifically for high-throughput border security checkposts, transport checkpoints, and sensitive law enforcement document screening.

---

## 🚀 Key UI & Architectural Features

### 1. Government-Grade Security Visual Design
- **Custom Design Tokens & Palettes:** Curated national tricolour subtle accents (`#0f2347` navy, `#f59e0b` saffron-gold, `#10b981` emerald), high-contrast readability, and official typography.
- **Glassmorphic Security Panels:** Layered depth with backdrop blur, glowing status borders (`glow-emerald`, `glow-red`, `glow-amber`), and authenticated watermarks.
- **Anti-Tamper Verdict Badges:** Holographic-style stamped badges with cryptographic hash seals and officer verification signatures.

### 2. High-Speed Screening & Verification Flow
- **Command Palette (`Ctrl+K` / `Cmd+K`):** Instant keyboard navigation across all modules, quick test profile injection, and case lookup.
- **Forensic Inspection Toolbar:** Interactive client-side document examination (Invert, Contrast Boost, Grayscale, Alignment Grid, Optical Zoom, Lightbox Magnifier).
- **Synthetic Test Presets:** 1-click test runs for Aadhaar, PAN, Voter ID (EPIC), and Driving Licence with preset fraud signals.
- **Real-Time SSE Stream:** Live progress indicator showing multi-stage verification (Cryptographic, Structural, OCR, Biometric, Forensic, Policy).

### 3. Cryptographic Audit & Chain of Custody
- **SHA-256 Block Chaining:** Immutable audit trail with previous block hash linkage and cryptographic integrity verification.
- **Chain of Custody Timeline:** Full provenance logging with officer badge ID, terminal station code, and ISO timestamping.
- **Export Capabilities:** Certified JSON dossiers and CSV exports for forensic archival and court submission.

### 4. Interactive Analytics & Identity Intelligence
- **SVG Trend & Distribution Visualizations:** Zero-dependency interactive SVG area charts, donut break-outs, and signal strength score rings.
- **Face Embedding Gallery:** 512-dimensional facial recognition similarity slider and duplicate identity risk alerts.

---

## 📁 Architecture & File Layout

| Path | Purpose & Highlights |
|---|---|
| `src/components/layout/` | `AppShell` (Command Palette, shortcut listener, navigation), `TopBar`, `Sidebar`, `Brand` |
| `src/components/upload/` | `DropZone` (laser animation, format chips), `DocumentPreview` (forensic filter suite), `FileCard`, `CameraCapture` |
| `src/components/verdict/` | `VerdictBanner` (seal watermark, copy & print), `CheckList` (search filter, decisive tabs), `EvidenceCrop` (laser zoom) |
| `src/components/charts/` | `Charts.tsx` (TrendChart with tooltips, DonutChart with legend, ScoreRing, BarList) |
| `src/pages/` | `DashboardPage`, `VerifyPage`, `CaseHistoryPage`, `CaseDetailPage`, `FaceSearchPage`, `AnalyticsPage`, `AuditLogsPage`, `OfficersPage`, `SettingsPage`, `LoginPage` |
| `src/api/` | `client.ts` (officer provenance headers), `hooks.ts` (TanStack Query, live SSE stream, metrics calculation), `types.ts` |
| `src/lib/` | `auth.tsx` (clearance levels, stations, officer switcher), `format.ts`, `utils.ts` (Indian ID validators) |

---

## 🛠️ Development & Quality Assurance

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run TypeScript type check (strict mode)
npx tsc --noEmit

# Run unit tests
npx vitest run

# Production build
npm run build
```

