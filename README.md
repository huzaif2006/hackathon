# HCM Lite

AI-assisted Human Capital Management for the Saylani Hackathon. The web application has Admin, HR, and Employee roles, with server-enforced permissions and an initially empty database.

## Stack

- `frontend/`: React, Vite, Tailwind CSS, React Router, Axios, Recharts
- `backend/`: Node.js, Express, MongoDB, Mongoose, Zod, JWT, bcryptjs
- AI: Gemini function calling from the backend only
- PDF: PDFKit
- Integration tests: Node's test runner, Supertest, and a MongoDB in-memory replica set

## Requirements

- Node.js 20 or later
- npm
- MongoDB replica set for transactions (MongoDB Atlas works; a standalone local MongoDB server is not sufficient for transaction-backed flows)

## Run locally

1. Install dependencies:

   ```powershell
   cd backend
   npm install
   cd ..\frontend
   npm install
   ```

2. Copy `backend/.env.example` to `backend/.env`. Set:
   - `MONGO_URI` to a MongoDB replica-set connection string
   - `JWT_SECRET` to a long, random private value
   - `FRONTEND_URL` to the frontend origin (`http://localhost:5173` locally; a comma-separated allowlist is supported)
   - `AI_API_KEY` to a Gemini API key if AI features are needed
   - `PORT` if the default `5000` is not suitable

3. Copy `frontend/.env.example` to `frontend/.env.local` and set `VITE_API_URL` to the backend origin.

4. Start the backend and frontend in separate terminals:

   ```powershell
   cd backend
   npm run dev
   ```

   ```powershell
   cd frontend
   npm run dev
   ```

5. Open the Vite URL. On an empty database the app routes to first-run setup. Create the company and the first Admin there; there is no seed data or default password.

## First Admin and HR onboarding

- The first Admin is created from `/setup` only while the database has no users.
- Admin creates departments, designations, leave types, holidays, and HR accounts in Settings.
- HR signs in using the one-time temporary password and must immediately set a private password.
- HR creates employees; each gets a linked account and a one-time temporary password. Employees also change that password on first sign-in.

## AI configuration

Set `AI_API_KEY` only in `backend/.env` or the backend hosting environment. Do not add it to frontend variables or source control. Without a key, the rest of the application remains available; AI endpoints return a friendly unavailable response.

## Tests and checks

```powershell
cd backend
npm run test:integration
```

```powershell
cd frontend
npm run lint
npm run build
```

## Deployment

### Backend (Render)

- Create a Node web service with repository root `backend`.
- Build command: `npm install`
- Start command: `npm start`
- Configure `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`, `AI_API_KEY` and optionally `PORT` in Render environment settings.
- Use a MongoDB replica set (MongoDB Atlas) for multi-document transactions.

### Frontend (Vercel)

- Import the repository with project root `frontend`.
- Set `VITE_API_URL` to the deployed backend URL.
- Add the deployed Vercel origin to backend `FRONTEND_URL`.
- `frontend/vercel.json` rewrites client-side routes to `index.html`.

### Backend (Vercel serverless Express)

- Create a separate Vercel project from this repository with project root `backend`.
- Vercel detects `backend/index.js` as the Express entry point and serves the exported app as one serverless function; it does not call `listen()`. `backend/vercel.json` sets the function duration to 60 seconds (subject to the selected Vercel plan's limit) and includes PDFKit data files.
- Add these environment variables to the Vercel project:
  - `MONGO_URI`: MongoDB Atlas replica-set URI (transactions require a replica set).
  - `JWT_SECRET`: long, random secret.
  - `FRONTEND_URL`: exact frontend production origin; comma-separated origins are supported.
  - `AI_API_KEY`: Gemini key, optional if AI is not enabled.
  - `PORT`: optional; Vercel provides its own function runtime and local development defaults to `5000`.
- Vercel automatically supplies `VERCEL_URL` for the deployment. The API allows HTTPS `*.vercel.app` origins for preview deployments; set `FRONTEND_URL` for the production frontend and any custom domains.
- PDFKit's AFM and color-profile data are explicitly bundled through `includeFiles` in `backend/vercel.json`; payslip generation uses those package files and does not write to local disk.
- `bcryptjs` replaces native `bcrypt`; it reads and verifies existing bcrypt-compatible hashes without requiring native binaries.
- Local development is unchanged: run `npm run dev` from `backend`, with `MONGO_URI`, `JWT_SECRET`, and `FRONTEND_URL` configured in `backend/.env`.

## Five-minute demo script

1. Start with an empty database and create the first Admin from setup.
2. Configure office hours, timezone, weekend, one department/designation, leave types, and a holiday.
3. Create an HR user; sign in as HR, change the temporary password, and register two employees.
4. Sign in as one employee, change the temporary password, check in/out, and submit a leave request.
5. As HR, approve the leave/correction and prepare a payroll draft. Show dashboard KPIs and CSV export.
6. As Admin, finalize the payroll, open the audit log, and post an announcement.
7. As an employee, show the announcement, notification, leave balance, and finalized payslip PDF. Try asking the AI a Roman Urdu leave question if `AI_API_KEY` is configured.

## Scope status

- Implemented: setup/authentication, organization, employee directory/import/export, attendance/corrections, leave, payroll/payslips, dashboards, Gemini assistant, audit log, announcements, notifications, and role-based web flows.
- Automated verification: the replica-set Supertest flow covers the principal cross-module path and key RBAC cases. Run it against the current checkout before demos and deployment.
- Known limits: login throttling is process-memory/IP-based and resets on restart; there is no distributed rate-limit store. The in-memory MongoDB test downloads its MongoDB binary on first run. The Vite production bundle may emit a large-chunk advisory.
- Windows note: the integration-test MongoDB binary requires the Microsoft Visual C++ 2015-2022 Redistributable.
- Not implemented: optional brief bonus features (camera/face attendance, attrition-risk scoring, absence anomaly flags, three-late penalty, dark mode, and PWA packaging). Initial Admin creation is through the first-run setup page, not environment-provisioned credentials.
