# CampusLink Phase 10 — Render + Atlas Deployment

This guide deploys the Express API to Render. The React/Vite frontend is developed separately and can be deployed to Vercel, Netlify, or another static hosting provider.

## 1. Deployment architecture

- API: one Render Node.js web service (`campuslink-api`).
- Database and PDF storage: MongoDB Atlas; resumes stay in the `resumes` GridFS bucket in the same Atlas database.
- Embeddings: `Xenova/all-MiniLM-L6-v2`, downloaded during the Render build into `server/models/`, then loaded locally at runtime.
- LLM: optional Groq OpenAI-compatible endpoint. The Blueprint keeps `AI_ENABLED=true` to match the project defaults, but Groq calls fall back automatically when `LLM_MODEL` or `LLM_API_KEY` is empty. Set `AI_ENABLED=false` to hard-disable external LLM calls.
- Frontend: separate Vercel/Netlify deployment. Set its `VITE_API_URL` to the API origin plus `/api`.

The Render Blueprint uses the Free 512 MB instance and `numInstances: 1`. Render Free services have limited CPU, spin down after 15 minutes without traffic and can take roughly a minute to wake; use this tier for the PS03 demo rather than a production SLA. Upgrade to a paid plan for steadier performance. No PM2 or Node cluster is used. Piscina's parse and embedding pools are worker threads inside the one Node process; the embedding pool remains limited to one worker.

## 2. Prepare the repository

1. Extract this project and commit the complete `CampusLink_Backend/` directory to a GitHub repository.
2. Ensure `server/models/` is not committed. `.gitignore` excludes it; the Render build creates it.
3. Push the branch you intend to deploy.
4. In Render, choose **New → Blueprint** and connect the repository containing `render.yaml`.

The repository root is the Blueprint root. Do not configure `server/` as the Render root directory: the build and start commands use npm workspaces from the repository root.

## 3. MongoDB Atlas configuration

1. Create a dedicated Atlas database user for CampusLink. Give it only the required read/write role on the CampusLink database; do not use the Atlas account owner credentials.
2. Copy the Atlas connection string and replace the username, password and database name.
3. In Atlas Network Access, add `0.0.0.0/0` as the allowed IP entry for Render connectivity. Render outbound IPs are not fixed for this deployment pattern. This allows connections from any IP, so use a strong unique database password, database-scoped permissions and never expose the URI in the client bundle or repository.
4. Set the database name in the URI to a dedicated production name, for example `CampusLink`.
5. Confirm Atlas allows database connections and URL-encode the database password if it contains reserved URI characters.

GridFS stores uploaded PDF resumes in Atlas. Do not write uploaded resumes to Render's local filesystem: the service filesystem is ephemeral.

## 4. Render Blueprint environment variables

The Blueprint defines all application settings. During Blueprint creation, provide the prompted values:

| Variable | Production value / action |
|---|---|
| `NODE_ENV` | `production` (Blueprint) |
| `NODE_VERSION` | `22.22.0` (Blueprint / `.node-version`) |
| `MONGODB_URI` | Atlas URI for the production database (secret) |
| `MONGODB_MAX_POOL_SIZE` | `5` on the 512 MB instance |
| `JWT_SECRET` | Render-generated random value; do not replace with a demo secret |
| `JWT_EXPIRES_IN` | `1d` |
| `CORS_ORIGIN` | Exact deployed frontend origin, e.g. `https://your-campuslink.vercel.app`; no trailing slash. For multiple origins use comma-separated exact origins. |
| `MAX_RESUME_MB` | `5` |
| `AI_ENABLED` | `true` by default per project configuration; set `false` to hard-disable external LLM calls |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | Current model ID selected in your Groq account (optional while AI is disabled) |
| `LLM_API_KEY` | Groq API key (secret; optional while AI is disabled) |
| `LLM_TIMEOUT_MS` | `15000` |
| `LLM_MAX_CONCURRENCY` | `2` |
| `EMBEDDINGS_ENABLED` | `true` for the full matching demonstration |
| `EMBEDDINGS_MODEL` | `Xenova/all-MiniLM-L6-v2` |
| `EMBEDDINGS_THREADS` | `1` |
| `PARSE_THREADS` | `2` |
| `SKILL_MATCH_THRESHOLD` | `0.55` |
| `LOG_LEVEL` | `info` |
| `PORT` | Do not hardcode in the Blueprint. Render supplies `PORT`; locally the app defaults to `5000`. |

Never use the demo password as `JWT_SECRET`. Never add `MONGODB_URI`, `JWT_SECRET` or `LLM_API_KEY` to `client/.env` or any `VITE_` variable.

## 5. Build and start commands

The `render.yaml` already configures:

- Build: `npm install && npm run download:model --workspace=server`
- Start: `npm run start --workspace=server`
- Health-check path: `/api/health`
- Instance count: one
- Shutdown grace: 30 seconds

The model downloader is deliberately independent of the application env validator. A model build does not need the production MongoDB URI or JWT secret. If `EMBEDDINGS_ENABLED=false`, the build skips downloading the model. When enabled, the build loads the model once and verifies a 384-dimensional output before the deploy artifact is produced.

At runtime, `server/src/workers/embedText.js` disables remote model loading and uses the local cache only. Missing/incompatible model files result in the documented TF-IDF/keyword fallback, not runtime model downloads.

## 6. Verify the deployed API

After Render reports the deploy as live:

1. Open `https://<your-service>.onrender.com/api/health`.
2. Confirm HTTP 200 and `data.db: "connected"`.
3. Confirm `data.embeddings: "ready"` when `EMBEDDINGS_ENABLED=true`; `fallback` is expected if deliberately disabled or the model did not load.
4. Confirm `data.llm` is `disabled` unless AI is enabled and both model/key are configured.
5. Record `data.memoryMb` after model preload. Keep it safely under the 512 MB plan limit. If it is near/over the limit or the service restarts/OOMs, set `EMBEDDINGS_ENABLED=false` and redeploy; Phase 5 uses the TF-IDF fallback. For a full embeddings demo, upgrade to a larger plan if the measured model footprint cannot fit.
6. Register/login with demo or test accounts as appropriate.
7. Upload a valid PDF and confirm it can be downloaded after a service redeploy; this proves it is stored in Atlas GridFS rather than on ephemeral local disk.
8. Exercise recruiter job publishing, eligible student application, recruiter shortlisting and status update.
9. Check recruiter interview scheduling and the calendar endpoints.
10. Check admin analytics and a CSV export.

Production health behavior: `/api/health` returns 503 if the production process is running but its MongoDB connection is unavailable. An embedding fallback alone does not fail health because the API remains usable using classical matching.

## 7. Connect the frontend

The frontend is not built in this backend repository. In the separate Vite frontend project, create a production `.env` file or set the same variable in Vercel/Netlify:

```env
VITE_API_URL=https://<your-service>.onrender.com/api
```

The Axios instance should use that value as its base URL, e.g. `axios.create({ baseURL: import.meta.env.VITE_API_URL })`. Do not append `/api` twice in individual API paths. Add the exact frontend origin to the backend Render `CORS_ORIGIN` variable and redeploy the API after changing it.

The sample `client/.env.example` in this repository is only a connection reference; the `client/` folder remains a placeholder workspace and is not deployed by the API Blueprint. In the Postman `CampusLink Demo` environment, change `baseUrl` to `https://<your-service>.onrender.com` (without `/api`, because the collection paths already include `/api`).

## 8. Render filesystem and scaling notes

Render's default filesystem is ephemeral. That is acceptable for the downloaded model because the model is part of each build artifact and gets downloaded again on deploy. Resume PDFs and app data must remain in Atlas GridFS/MongoDB. No persistent disk is required for the current design.

Keep one Render instance. Each extra instance would load another copy of the embedding model. The current application uses an in-process AI summary queue; queued summaries may be lost on process restart, as documented in the Phase 6 design. For the six-hour PS03 demonstration, use the seeded precomputed summaries and verify the key workflow before judging.

## 9. Deployment rollback

If a deploy fails:

1. Read the Render build/start logs and the missing/invalid environment variable name.
2. Confirm `MONGODB_URI`, `JWT_SECRET` and `CORS_ORIGIN` are set in the Render service.
3. If model download fails, verify build outbound network access and try a fresh deploy. If memory is the runtime problem, set `EMBEDDINGS_ENABLED=false` and redeploy.
4. Use Render's rollback to the last known-good deploy if the new release is not healthy.
5. After recovery, verify `/api/health` and the login/job/application workflow.
