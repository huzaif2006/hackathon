# HCM Lite - Project Rules

## Project
Saylani Hackathon: AI-assisted HR system (Admin, HR, Employee). Web app required.
Database starts EMPTY. No dummy/seed data. First-run setup creates company + Admin.

## Stack
- frontend/: React (Vite) + Tailwind
- backend/: Node.js + Express + MongoDB (Mongoose)
- AI: hosted LLM API with tool calling (Gemini or Groq). Key only in backend env AI_API_KEY.
- Monorepo: one Git repo, two folders. Frontend deploys to Vercel (root: frontend), backend to Render (root: backend).

## Backend structure
backend/src/{routes, controllers, services, models, middleware, utils}
Flow: route -> controller -> service (business rules live HERE) -> model.

## Always follow
- Every API checks JWT + role + data scope. Employee reads only rows with own employee_id. Hiding buttons is NOT security.
- Passwords hashed with bcrypt. JWT login.
- Validate every input (zod). Return proper status codes (409 duplicate check-in, 422 overlap/over-balance, 403 forbidden).
- Server stamps time. Never trust client time.
- Dashboard numbers computed on server with MongoDB aggregation, filterable by date range + department.
- AI never queries DB directly and never saves data. AI tools reuse the same services + permission checks as REST API.
- Secrets only in .env. Commit .env.example only.
- CORS origin from env FRONTEND_URL. Port from process.env.PORT. Frontend API url from import.meta.env.VITE_API_URL (never hardcode localhost).
- Any new or changed endpoint: update docs/api-contract.md. Before writing frontend, read docs/api-contract.md. Do not guess endpoints. Keep field names identical on frontend and backend.
- Read docs/brief.md for business rules and metric formulas.
- Frontend: responsive (375px+), loading/empty/error states for every screen, role-based menus.
- Work on ONE module at a time. Keep code simple and readable.
