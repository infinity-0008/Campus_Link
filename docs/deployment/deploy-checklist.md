# CampusLink Production Deployment Checklist

## Before deploy

- [ ] Code is pushed to the intended Git branch.
- [ ] `render.yaml` is at the repository root.
- [ ] No `.env`, credentials, `node_modules/`, or `server/models/` are committed.
- [ ] Atlas production database user is scoped to the CampusLink database.
- [ ] Atlas Network Access includes Render connectivity (`0.0.0.0/0` per the PS03 deployment specification).
- [ ] Render environment variables have been reviewed; JWT secret is generated and API secrets are not in client variables.
- [ ] `CORS_ORIGIN` is the exact frontend production origin.

## Render build

- [ ] Blueprint root points to repository root.
- [ ] Build command installs workspaces and downloads the model at build time.
- [ ] Model download/verification completes with 384 dimensions when embeddings are enabled.
- [ ] Start command runs `node src/server.js` through the server workspace script.
- [ ] Exactly one web service instance is configured; no PM2/cluster mode.

## After deploy

- [ ] Render deploy is live and health-check path is `/api/health`.
- [ ] `/api/health` returns HTTP 200 and reports `db: connected`.
- [ ] Embeddings report `ready` or intentionally `fallback`.
- [ ] LLM reports `enabled` only when intentionally configured.
- [ ] `memoryMb` after model preload stays safely below 512 MB.
- [ ] If memory is not safe, set `EMBEDDINGS_ENABLED=false` (and allow build to skip model download) or upgrade the instance.
- [ ] Register/login works; no password hash is returned.
- [ ] Recruiter can publish an owned job.
- [ ] Eligible student can apply; ineligible application is rejected with 422.
- [ ] Recruiter can shortlist an applicant; student receives status notification.
- [ ] Interview can be scheduled and appears in calendar retrieval.
- [ ] GridFS resume upload/download still works after a redeploy.
- [ ] Admin analytics, audit logs and CSV exports return expected data.
- [ ] Deployed frontend `VITE_API_URL` points to the API URL ending in `/api`.
- [ ] CORS allows the frontend origin and rejects unapproved origins.

## Demo warm-up

- [ ] Complete setup and model download before the demo window.
- [ ] Start the service and inspect `/api/health` a few minutes before judging.
- [ ] Warm one student job-fit/recommendation call and one recruiter applicants/report call.
- [ ] Confirm seeded demo summaries exist; do not rely on a live Groq call.
- [ ] Keep a fallback plan with `EMBEDDINGS_ENABLED=false` if the measured 512 MB footprint is unsafe.
