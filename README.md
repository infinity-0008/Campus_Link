# CampusLink — Full-stack placement and recruitment platform

This repository combines the CampusLink backend (Phases 1–10) with the supplied Fusion/Kage React landing-page starter and the role-based CampusLink frontend.

## Stack

- Frontend: React 18, Vite, JavaScript, React Router 6, TanStack Query, Axios, Tailwind CSS, react-hook-form, Recharts, react-hot-toast, Lucide.
- Landing page: the original Fusion `KageLandingPage` component from `@designcodeio/threeui` is retained unchanged as the public home-page base. Its original Kage black/crimson visual treatment remains intact; CampusLink navigation and the authenticated application pages are added around it. The React Three Fiber / Drei / Three.js runtime dependencies from the supplied starter are included explicitly.
- Backend: Node.js, Express, MongoDB Atlas/Mongoose, Zod, JWT, bcrypt, GridFS, Piscina, PDF parsing, local all-MiniLM-L6-v2 embeddings, Groq-compatible LLM support.

The original PS03 roles are **Student**, **Recruiter**, and **Placement Admin** (server enum `admin`). Public registration supports students and recruiters only. Admin accounts are seeded.

## Requirements

- Node.js 22.22.0 recommended (see `.node-version`).
- npm 10+.
- MongoDB Atlas or a MongoDB replica set. Interview scheduling, admin profile updates and seed data use transactions.

## Local setup (PowerShell)

1. Extract the repository and open the root folder in VS Code.
2. Install dependencies:

   ```powershell
   npm install
   ```

3. Create the backend environment file:

   ```powershell
   Copy-Item server/.env.example server/.env
   notepad server/.env
   ```

4. Set at least `MONGODB_URI` and a strong `JWT_SECRET` (32+ random characters). Keep `LLM_API_KEY` private. `CORS_ORIGIN` can be `http://localhost:5173` for local development.
5. Download the local embedding model once:

   ```powershell
   npm run download:model
   ```

6. Optional: seed a dedicated local/demo database. The seed clears the CampusLink collections in the configured database, so do not point it at production:

   ```powershell
   npm run seed
   ```

7. Start both applications:

   ```powershell
   npm run dev
   ```

   Frontend: `http://localhost:5173`

   Backend: `http://localhost:5000`

   Health: `http://localhost:5000/api/health`

The Vite development server proxies `/api` to `http://localhost:5000`. To use a different local API server, set `CAMPUSLINK_API_PROXY` before starting Vite.

## Frontend-only or backend-only development

```powershell
npm run dev:client
npm run dev:server
```

The frontend is in `client/`; the Express backend is in `server/`. All frontend API calls are centralized in `client/api/`. Authentication uses the backend-issued JWT and the backend role is authoritative. Route guards improve navigation only; server-side authorization remains the security boundary.

## Build and tests

```powershell
npm run build
npm test
npm run test:client
npm run test:integration
```

The frontend build writes to `dist/client/`. The backend runs as a separate Node process and is not bundled into a browser artifact. `npm run build` builds the frontend workspace; it does not publish to Render or Vercel. `vercel.json` and `netlify.toml` set the output directory and SPA fallback so nested React Router routes can be refreshed directly.

## Deploy

- Backend: Render Blueprint `render.yaml` (single process; `server/models/` is downloaded during the build step).
- Database: MongoDB Atlas. Use a dedicated database user and network allow-list appropriate to Render's outbound networking. The supplied deployment checklist documents the broader network rule from the PS03 pack and its security trade-offs.
- Frontend: deploy the Vite app from this repository using the root Vite config/build script. The output directory is `dist/client` (configured in `vercel.json` and `netlify.toml`). Set `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api` in the frontend deployment environment and set backend `CORS_ORIGIN` to the exact deployed frontend origin.
- Keep all credentials in Render/Vercel/Netlify environment settings. Never commit `.env` files.

Reference specifications are included in `docs/spec/`: the original Nexaura problem statements and the CampusLink frontend instruction guide. See `docs/deployment/` and `docs/frontend-integration.md` for implementation and deployment details.

## Main frontend routes

- Public: `/`, `/login`, `/register`
- Student: `/student/dashboard`, `/student/profile`, `/student/resume`, `/student/jobs`, `/student/jobs/:id`, `/student/applications`, `/student/interviews`, `/student/notifications`
- Recruiter: `/recruiter/dashboard`, `/recruiter/jobs`, `/recruiter/jobs/create`, `/recruiter/jobs/:id/edit`, `/recruiter/jobs/:id/applicants`, `/recruiter/interviews`, `/recruiter/reports`, `/recruiter/notifications`
- Placement Admin: `/admin/dashboard`, `/admin/recruiters`, `/admin/students`, `/admin/drives`, `/admin/audit-logs`, `/admin/analytics`, `/admin/notifications`

The landing page remains based on the supplied Kage component. The authenticated workspaces adopt its dark charcoal/crimson brand accents with restrained light data surfaces for readability.
