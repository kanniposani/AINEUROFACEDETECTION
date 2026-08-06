# NeuroScan Wellness

# NeuroFace AI — Complete Lovable Build Prompt

Copy everything below into Lovable as your project prompt (or paste it into an existing NeuroFace AI project to extend it).

---

title

Build a full-stack web app called **NeuroFace AI** — a facial stress & wellness signal screening tool that uses the device camera and real-time facial landmark detection to estimate stress level and general wellness indicators. Position it clearly as an **educational/wellness screening tool, not a medical diagnostic device** — include a visible disclaimer on the scan and results screens.

### Tech Stack
- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui components
- @mediapipe/face_mesh + @mediapipe/camera_utils for real-time facial landmark detection (468 points) via webcam
- Supabase for auth, database, and storage
- Framer Motion for animations
- Recharts for trend charts
- jsPDF for exportable PDF health reports
- PWA support (installable, works offline for the static shell)

### Visual Design System
Dark, futuristic "neuro-scan" aesthetic:
- Background: deep navy/near-black (#0a0f1a)
- Accent colors: neon cyan (#00F5FF) as primary, neon purple and neon pink as secondary accents
- Status colors: green (excellent) → lime (good) → yellow (moderate) → orange (warning) → red (critical)
- Typography: Inter for UI text, JetBrains Mono for data/metrics readouts
- Glassmorphism cards with subtle border glow, soft neon box-shadows on active elements
- Animated scan-line effect during face capture, pulsing glow on the face-mesh overlay
- Smooth fade/slide transitions between screens (Framer Motion)
- Fully responsive: mobile-first (camera scan is primarily a phone use case), but dashboard should also work well on desktop

### Core Pages & Flow

**1. Landing Page**
- Hero section explaining what NeuroFace AI does, with a "Start Scan" CTA
- Short "How it works" 3-step visual (Scan → Analyze → Results)
- Clear disclaimer: "This tool provides wellness insights for educational purposes and is not a substitute for professional medical advice."
- Sign up / Log in buttons

**2. Auth**
- Supabase email/password + Google OAuth
- Simple onboarding: name, age range, optional baseline health notes (all optional, stored securely)

**3. Scan Screen**
- Live camera feed with MediaPipe face mesh overlay drawn on top (landmark dots/mesh lines in neon cyan)
- Real-time face alignment guidance ("Center your face", "Hold still", "Ensure good lighting")
- Countdown before capture, animated scanning beam effect during the ~5-10 second analysis window
- Extract signals such as: blink rate, micro-expression variance around eyes/mouth/brow regions, facial symmetry, estimated tension in jaw/brow landmarks, subtle color/texture variance in skin regions (as an approximate proxy signal — clearly labeled as experimental)
- Combine signals into a computed **Stress Index (0–100)** and secondary indicators (Fatigue Level, Tension Level, Symmetry Score) using a transparent, documented scoring formula (not a black box — show a "How this score is calculated" info panel)

**4. Results Screen**
- Large circular animated meter for the overall Stress Index, color-coded by severity band
- Breakdown cards for each sub-metric (Fatigue, Tension, Symmetry, Blink Rate) with mini gauges
- Plain-language interpretation of the result and general wellness suggestions (hydration, breaks, breathing exercises) — not medical advice
- "Download PDF Report" button (jsPDF) with score, date/time, and breakdown formatted cleanly
- "Save to History" button (writes to Supabase)

**5. Dashboard**
- Summary cards at top: latest score, 7-day average, trend direction (up/down arrow)
- Line/area chart (Recharts) of Stress Index over time, filterable by 7 days / 30 days / all time
- Table/list of past scans (date, score, quick status badge) with tap-to-expand detail view
- Streak tracker ("X days of consistent check-ins")
- Empty state with a friendly prompt to take the first scan if no history exists

**6. Profile / Settings**
- Edit profile info
- Notification preferences (daily check-in reminder)
- Data export (download all history as PDF or CSV)
- Delete account / clear data (with confirmation modal)
- Light/dark mode toggle (default dark)

### Database Schema (Supabase / Postgres)

**profiles**
- id (uuid, references auth.users)
- full_name (text)
- age_range (text)
- created_at (timestamptz)

**scans**
- id (uuid, pk)
- user_id (uuid, fk → profiles.id)
- stress_index (int)
- fatigue_level (int)
- tension_level (int)
- symmetry_score (int)
- blink_rate (numeric)
- raw_metrics (jsonb) — store full computed signal breakdown for transparency/debugging
- created_at (timestamptz)

**settings**
- user_id (uuid, fk → profiles.id, pk)
- reminder_enabled (boolean)
- reminder_time (time)
- theme (text)

Enable Row Level Security on all tables so users can only read/write their own rows.

### Additional Requirements
- All scan processing (face mesh + score calculation) happens client-side in the browser — no raw video/image data should be uploaded or stored, only the derived numeric metrics, for privacy
- Add a clear one-time consent modal before first camera use, explaining what is and isn't stored
- Include loading skeletons for dashboard and results while data fetches
- Include empty, loading, and error states for every data-driven screen
- Toast notifications (sonner) for save success/failure
- Fully keyboard-accessible forms and buttons, proper ARIA labels on interactive elements

## PROMPT END

---

- **Domain fit:** Emerging Trends in Machine Learning (computer vision — MediaPipe face landmark model) or Emerging Technologies (PWA + real-time browser ML)
- **SDG angle:** SDG 3 (Good Health & Well-Being — stress awareness), SDG 9 (Industry, Innovation & Infrastructure — browser-based real-time ML), SDG 4 (Quality Education — if framed as an awareness/educational tool)
- Be upfront with your guide that the "health" signals are **approximate, camera-derived proxies**, not clinically validated measurements — this is important to state in your abstract's limitations section to avoid overclaiming.

This project was built with [Lovable](https://lovable.dev).




**Live app**: https://aineurofacedetection.lovable.app





## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
