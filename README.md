# 🧪 RecordAI — AI-Powered Laboratory Notebook Digitization Platform

[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_52-000000?logo=expo&logoColor=white)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Database_%26_Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**RecordAI** is an end-to-end laboratory record digitization platform that sits between raw camera/scanned notebook pages and formal academic/industrial report generation. Powered by vision extractions, human verification auditing, live formula evaluation, interactive graphing, and multi-format export (PDF & Word DOCX).

---

## 🌟 Key Features

### 💻 Web Application (`recordai-web`)
- **Multi-Page Upload Pipeline**: Upload or drag-and-drop handwritten lab notebook pages (`PNG`, `JPG`, `PDF`).
- **Split-Screen Human Verification**: Zoomable original document viewer on the left side-by-side with editable extracted canonical sections on the right.
- **Confidence Signaling & Flagged Items Review**:
  - Highlights extracted sections and table data with AI confidence scores $<70\%$.
  - "Flagged Items" review panel listing low-confidence extractions with click-to-focus jump navigation and explicit review gate checkboxes.
- **Interactive Observation Table Editor**:
  - Web & mobile grid editor with keyboard cell navigation (`ArrowKeys`, `Tab`, `Enter`).
  - Automatic detection of numeric column anomalies (flagging non-numeric text in numeric data columns).
- **Safe Formula Calculation Engine**:
  - Define custom mathematical expressions (`+`, `-`, `*`, `/`, `^`, `avg()`, `sqrt()`) bound to observation table columns.
  - Safe evaluation using `mathjs` without unsafe `eval()` or `Function` constructors.
  - Tracks verification status (`pending` vs `confirmed`).
- **Data Visualization & Graph Picker**:
  - Automatically suggests charts when observation tables contain two or more numeric columns.
  - Support for **Line**, **Bar**, and **Scatter** charts with custom X/Y axis mapping and saved JSON configuration.
- **Multi-Format Export Pipeline**:
  - Serverless PDF generation (`generate-record-pdf` Edge Function) with formatted title blocks, tables, calculation results, and chart rendering.
  - Microsoft Word `.docx` generation (`generate-record-docx` Edge Function) for editable manuscript preparation.
- **Templating System**:
  - Pre-seeded subject templates (*Physics/Chemistry Standard* and *Electronics/CS Standard*) defining section order, styling accent colors, and chart inclusion.
- **Record History & Orphan-Free Deletion**:
  - Filterable history table by subject and status.
  - Complete deletion workflow removing both PostgreSQL database records and associated storage files in `lab-uploads` and `generated-records` buckets.

### 📱 Mobile Companion App (`recordai-mobile`)
- **Native Camera & Gallery Capture**: Capture handwritten pages directly using device camera (`expo-camera`) or photo library (`expo-image-picker`).
- **Native Touch Verification**: Stacked mobile layout optimized for phones, featuring custom touch grid controls (`MobileTableEditor`).
- **Native Document Sharing**: Instant PDF generation and OS share sheet integration (`expo-sharing` & `expo-file-system`).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Web** | React 19, TypeScript, Vite, TailwindCSS v4, Lucide React, Recharts, Mathjs |
| **Mobile Companion** | Expo SDK 52, React Native, TypeScript, React Navigation v7 |
| **Backend & Storage** | Supabase (Authentication, PostgreSQL Database, RLS, Storage Buckets) |
| **Edge Functions** | Deno TypeScript Edge Functions (`extract-lab-record`, `generate-record-pdf`, `generate-record-docx`) |

---

## 📁 Repository Structure

```
RecordAI/
├── src/                        # Web Application Frontend (React 19 + Vite)
│   ├── components/             # Reusable UI components (TableEditor, CalculationTab, ObservationChart, Navbar, etc.)
│   ├── context/                # AuthContext & Session management
│   ├── pages/                  # Page screens (Dashboard, VerifyPage, NewRecord, History, Generate, etc.)
│   ├── lib/                    # Supabase Client setup
│   └── types/                  # Shared TypeScript database interfaces
├── recordai-mobile/            # Mobile Companion App (Expo SDK 52 + React Native)
│   ├── src/
│   │   ├── components/         # Mobile components (MobileTableEditor)
│   │   ├── context/            # Native AuthContext with AsyncStorage
│   │   ├── navigation/         # React Navigation Stack
│   │   └── screens/            # Mobile Screens (Login, Dashboard, NewRecord, Verify, Generate)
│   ├── App.tsx                 # Mobile Entry Point
│   ├── app.json                # Expo config with permissions
│   └── eas.json                # EAS Build & Store submission profiles
├── supabase/                   # Supabase Infrastructure & Backend
│   ├── functions/              # Edge Functions
│   │   ├── extract-lab-record/ # AI Vision extraction handler
│   │   ├── generate-record-pdf/# PDF document generation handler
│   │   └── generate-record-docx/# Word DOCX document generation handler
│   └── migrations/             # SQL Migrations & RLS Policies
│       ├── 20260822000000_initial_schema.sql
│       ├── 20260822000001_seed_templates.sql
│       ├── 20260822000001_storage_bucket_lab_uploads.sql
│       └── 20260822000002_generated_records_bucket.sql
├── vercel.json                 # Web Vercel deployment & routing config
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **Supabase Account**: Free or Pro tier project at [supabase.com](https://supabase.com)

---

### 1. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Web Environment Variables (.env)
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Create a `.env` file in the `recordai-mobile/` directory:

```bash
# Mobile Environment Variables (recordai-mobile/.env)
EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

### 2. Database & Storage Setup (Supabase)

Run the SQL migration scripts in your **[Supabase SQL Editor](https://supabase.com/dashboard)** in the following sequential order:

1. **Initial Schema & RLS Policies**:
   Run `supabase/migrations/20260822000000_initial_schema.sql`
2. **Seed Default Templates**:
   Run `supabase/migrations/20260822000001_seed_templates.sql`
3. **Lab Uploads Storage Bucket**:
   Run `supabase/migrations/20260822000001_storage_bucket_lab_uploads.sql`
4. **Generated Records Storage Bucket**:
   Run `supabase/migrations/20260822000002_generated_records_bucket.sql`

---

### 3. Deploy Supabase Edge Functions

Deploy the Deno Edge Functions using the Supabase CLI:

```bash
# Deploy AI extraction function
supabase functions deploy extract-lab-record --no-verify-jwt

# Deploy PDF generation function
supabase functions deploy generate-record-pdf --no-verify-jwt

# Deploy Word DOCX generation function
supabase functions deploy generate-record-docx --no-verify-jwt
```

---

### 4. Running the Web Application (`recordai-web`)

```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev
```

Open your browser and navigate to `http://localhost:5173`.

---

### 5. Running the Mobile Application (`recordai-mobile`)

```bash
# Navigate to mobile directory
cd recordai-mobile

# Install mobile dependencies
npm install

# Start Expo development server (for iOS / Android / Web)
npx expo start
```

Press `w` to run in web mode (`http://localhost:8081`), `a` for Android emulator, or `i` for iOS simulator.

---

## 📦 Production Deployment

### Web Deployment (Vercel)
The project includes a ready-to-use **`vercel.json`** file configured with SPA client-side rewrites and HTTP security headers.

1. Connect your GitHub repository to Vercel.
2. Set Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Build Command: `npm run build`
4. Output Directory: `dist`

### Mobile Deployment (EAS Build)
The mobile app includes **`eas.json`** configured for Expo Application Services (EAS):

```bash
cd recordai-mobile

# Build Android APK / Bundle
eas build --platform android --profile production

# Build iOS App Store Package
eas build --platform ios --profile production
```

---

## 🛡️ Security & Privacy
- **Row-Level Security (RLS)**: Enforced across all Supabase database tables (`experiments`, `documents`, `sections`, `observation_tables`, `calculations`, `generated_documents`).
- **Owner-Restricted Storage**: Uploaded scan files and generated PDF/DOCX reports are restricted to authenticated owners via path storage policies.
- **Safe Expressions**: Formula evaluation uses isolated scope parsers rather than JavaScript execution.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
