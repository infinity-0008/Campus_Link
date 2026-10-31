# CampusLink backend architecture (Phases 1–6)

## Repository boundary

The root npm workspace contains `client/` and `server/` as sibling folders. The client workspace is a placeholder only; frontend work is developed separately. All backend routes use the `/api` prefix.

## Server structure

```text
server/src/
├── app.js
├── server.js
├── config/
│   ├── constants.js
│   ├── db.js
│   └── env.js
├── middleware/
│   ├── authenticate.js
│   ├── authorize.js
│   ├── errorHandler.js
│   ├── rateLimiter.js
│   └── validate.js
├── models/
│   ├── User.js
│   ├── StudentProfile.js
│   ├── RecruiterProfile.js
│   ├── Job.js
│   ├── Application.js
│   ├── Interview.js
│   ├── Notification.js
│   ├── AuditLog.js
│   └── index.js
├── modules/
│   ├── eligibility/
│   │   └── eligibility.service.js
│   ├── jobs/
│   │   ├── jobs.controller.js
│   │   ├── jobs.routes.js
│   │   ├── jobs.service.js
│   │   └── jobs.validation.js
│   ├── applications/
│   │   ├── application.routes.js
│   │   ├── application.validation.js
│   │   ├── applications.controller.js
│   │   ├── applications.service.js
│   │   └── aiSummaryQueue.js
│   ├── notifications/
│   │   └── notifications.service.js
│   └── audit/
│       └── audit.service.js
│   ├── auth/
│   │   ├── auth.controller.js
│   │   ├── auth.routes.js
│   │   ├── auth.service.js
│   │   └── auth.validation.js
│   ├── health/
│   └── students/
│       ├── students.controller.js
│       ├── students.routes.js
│       └── students.service.js
└── utils/
```

## API contract

Success:

```json
{ "success": true, "data": {} }
```

Failure:

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Readable message" } }
```

List endpoints will use server-side pagination and return `data` plus `meta: { page, limit, total, totalPages }`.

## Authentication and authorization

- Passwords are hashed with `bcrypt` cost 10.
- JWT access tokens use `JWT_EXPIRES_IN` and are passed as Bearer tokens.
- Registration accepts only `student` and `recruiter`; admin is seed-only.
- Student status defaults to `active`; recruiter status is explicitly `pending`.
- Pending recruiters may authenticate, but later job mutation routes must enforce approval before publishing.
- Suspended accounts are rejected at login and on authenticated requests, so an already-issued token cannot bypass suspension.
- `authenticate` verifies the JWT and reloads the account from MongoDB.
- `authorize(...roles)` applies role restrictions based on the database-loaded account.
- The optional login role selector is compared to the stored role and never used as an authorization source.
- Student and recruiter profile shell records are created during registration. If profile creation fails, the newly created user is removed as a compensating rollback.

## Model indexes and privacy

- `User`: unique email.
- `StudentProfile`: unique user; branch, CGPA and graduation-year indexes.
- `Job`: status, company, location and text indexes.
- `Application`: unique `{ job, student }`; `{ job, status }` index.
- `Interview`: scheduled date index.
- `Notification`: `{ user, read, createdAt }` index.
- `AuditLog`: `{ actor, createdAt }` and `{ action, createdAt }` indexes.
- `User.passwordHash` is `select: false` and is removed by the JSON transform.
- Student and job embedding payloads are `select: false` so normal queries do not load vectors.

## Phase 2 endpoints

| Method | Path | Guard |
|---|---|---|
| POST | `/api/auth/register` | Public; student/recruiter roles only |
| POST | `/api/auth/login` | Public; auth rate limiter |
| GET | `/api/auth/me` | Authenticated |
| GET | `/api/students/me` | Authenticated student |

`GET /api/students/me` is intentionally a profile-shell read for verifying the role guard. Profile editing and resume processing are Phase 3.

## Phase 1 security and reliability

- Helmet security headers.
- CORS allowlist configured by `CORS_ORIGIN`.
- Global rate limit: 100 requests per 15 minutes.
- Authentication rate limit: 10 requests per 15 minutes.
- JSON/form body size limits.
- Mongo operator sanitization.
- Zod request-validation middleware.
- Pino request logging with request IDs and sensitive-header redaction.
- Central error handler; production responses do not expose stack traces.
- Graceful shutdown on SIGINT/SIGTERM.

## Current implementation boundary

The foundation, authentication, student resume processing, job management, eligibility engine, matching engine and Phase 6 application workflow are implemented. Interview scheduling, notification read/list APIs, admin management, analytics, recruitment reports, complete seed data and production deployment verification remain assigned to Phases 7–10.


## Phase 3 student/profile routes and guards

| Route | Guard | Validation / processing |
|---|---|---|
| `GET /api/students/me` | `authenticate` + `authorize(student)` | Returns the caller's profile; parsed resume text and vectors are omitted |
| `PUT /api/students/me` | `authenticate` + `authorize(student)` | Zod allowlist; profile vectors refreshed or cleared if embedding fallback is active |
| `POST /api/students/me/resume` | `authenticate` + `authorize(student)` | Multer memory upload, size/MIME/extension/magic-byte validation, GridFS, Piscina PDF parser |
| `GET /api/students/me/resume` | `authenticate` + `authorize(student)` | Streams only the caller's GridFS file |
| `POST /api/students/me/resume/reparse` | `authenticate` + `authorize(student)` | Re-reads the caller's GridFS file and re-runs parse/extraction/embedding |

The upload middleware accepts one `resume` form-data file and does not trust the supplied MIME type by itself. The PDF is also checked for its `%PDF-` signature. Resume data is stored in the `resumes` GridFS bucket. Email and phone patterns are stripped before any LLM prompt is assembled. The LLM is treated as an extraction helper only; schema failure or provider failure uses the synonym-based classical extractor.

Two Piscina pools are lazy-created: a parse pool (`PARSE_THREADS`) and a single-worker embedding pool (`EMBEDDINGS_THREADS`). The embedding worker is warmed at server startup. The model is built into `server/models/` by the download script and loaded in local-only mode at runtime. The vectors stay excluded from ordinary Mongoose selections.

## Phase 4 job and eligibility routes

| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/api/jobs` | `authenticate` + `authorize(recruiter, admin)` + approved-recruiter service check | Creates draft only; recruiter owns the job |
| GET | `/api/jobs` | `authenticate` + Zod query validation | Server-side pagination, sort and filters; role-aware visibility |
| GET | `/api/jobs/:id` | `authenticate` + ID validation | Students/recruiters can see open jobs; recruiters can also see their own jobs; admin can see all |
| GET | `/api/jobs/:id/eligibility` | `authenticate` + `authorize(student)` + ID validation | Uses the shared pure eligibility engine |
| PUT | `/api/jobs/:id` | `authenticate` + `authorize(recruiter, admin)` + Zod body/ID validation + ownership/approval check | Recruiter can update own non-closed job only |
| PATCH | `/api/jobs/:id/publish` | `authenticate` + `authorize(recruiter, admin)` + ID validation + ownership/approval check | Draft → open; refreshes stored job vectors if model available |
| PATCH | `/api/jobs/:id/close` | `authenticate` + `authorize(recruiter, admin)` + ID validation + ownership/approval check | Open → closed |
| DELETE | `/api/jobs/:id` | `authenticate` + `authorize(recruiter, admin)` + ID validation + ownership/approval check | Draft only |
| POST | `/api/jobs/ai/suggest-skills` | `authenticate` + `authorize(recruiter, admin)` + Zod validation + approval check | Groq JSON schema + synonym fallback; suggestions are not auto-saved |

The eligibility query for `eligible=true` is applied in MongoDB before pagination. Its branch, CGPA, graduation-year and backlog filters mirror the pure evaluator; the returned student list also includes an `eligibilityResult` for each job. The Phase 6 apply endpoint re-evaluates the same pure function at submission time.

## Phase 5 matching routes and object-level guards

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/api/jobs/recommended` | `authenticate` + `authorize(student)` + Zod query validation | Scores open jobs from stored vectors, includes eligibility flags and uses pagination after score ranking |
| GET | `/api/jobs/:id/fit` | `authenticate` + `authorize(student)` + Zod ID validation | Current student's eligibility and matching explanation for an open job |
| GET | `/api/matching/:jobId/:studentId` | `authenticate` + allowed-role middleware + Zod ID validation + object-level service guard | Student can request self only; recruiter must own the job and the student must have applied; admin can inspect any pair |
| GET | `/api/matching/:jobId/:studentId/compare` | Same as matching endpoint | Returns keyword, TF-IDF and embeddings results plus skills uniquely found by embeddings |

### Matching computation and stored-vector policy

- Phase 3 creates student vectors when the profile/resume content is updated or parsed.
- Phase 4 creates job vectors when the job is created, updated or published.
- Matching selects `+embeddings` only in fit, recommendation and matching queries. Ordinary job/profile list reads still exclude vectors.
- The matching scorer runs in the existing Piscina parse pool. It does not call the embedding model or Groq.
- If the embedding model was disabled/unavailable, the matching response uses the TF-IDF fallback and sets `fallbackUsed: true`.
- Embedding skill coverage uses the best cosine match for each required skill, with `SKILL_MATCH_THRESHOLD` (default `0.55`) inclusive. Exact canonical/synonym matches count as `1.0`.
- Embedding weights: skills `0.50`, document similarity `0.30`, top-three project/experience relevance `0.20`.
- TF-IDF fallback weights: synonym-aware skill coverage `0.50`, document similarity `0.35`, project/experience relevance `0.15`.
- Keyword baseline is exact required-skill phrase coverage and does not canonicalize synonyms.
- Document cosine calibration is currently linear from `0.20 → 0` to `0.80 → 1`, clamped outside that range. The source PS03 pack requests a rescaled/clamped score but does not define these calibration endpoints; calibrate against the eventual seeded demo dataset.

Full request examples and response shapes are in [`docs/postman/phase5-requests.md`](postman/phase5-requests.md).


## Phase 6 application and recruitment workflow

| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/api/jobs/:id/apply` | `authenticate` + `authorize(student)` + Zod ID/body validation | Re-evaluates eligibility on the server; returns `422` with failure details if ineligible; unique `{ job, student }` index prevents duplicate submissions |
| GET | `/api/applications/me` | `authenticate` + `authorize(student)` + Zod query validation | Own applications, populated with a small job summary, server-side pagination and status filtering |
| GET | `/api/jobs/:id/applications` | `authenticate` + `authorize(recruiter, admin)` + job ownership check | Server-side page/limit/status/minScore/search and score/date sorting; candidate profile data is returned only for applicants to this job |
| PATCH | `/api/applications/:id/status` | `authenticate` + `authorize(recruiter, admin)` + job ownership check + Zod status validation | Enforces the application state machine; atomically compares the previous status; records status history, a student notification and an audit log |
| PATCH | `/api/jobs/:id/applications/bulk-shortlist` | `authenticate` + `authorize(recruiter, admin)` + job ownership check | Accepts up to 100 application IDs; every selected application must belong to the job and be in `applied` state |
| GET | `/api/jobs/:id/applications/export.csv` | `authenticate` + `authorize(recruiter, admin)` + job ownership check | Exports candidate and match evidence columns; spreadsheet formula prefixes are escaped |
| GET | `/api/applications/:id/ai-summary` | `authenticate` + `authorize(recruiter, admin)` + job ownership check | Returns pending/ready status, summary, skill-gap advice, model, prompt version and fallback flag |
| GET | `/api/students/:id` | `authenticate` + `authorize(recruiter, admin)` + applicant relationship check | Recruiter sees only students who applied to one of their jobs; admin can inspect any student |
| GET | `/api/students/:id/resume` | `authenticate` + `authorize(recruiter, admin)` + applicant relationship check | Streams the candidate's stored GridFS PDF under the same object-level access rule |

### Application state machine

- `applied` → `shortlisted` or `rejected`
- `shortlisted` → `interview_scheduled` or `rejected`
- `interview_scheduled` → `selected`, `rejected` or `shortlisted` (the return to `shortlisted` requires a cancelled interview record)
- `selected` and `rejected` are terminal states

Every successful transition appends `{ from, to, by, note, at }` to `statusHistory`, notifies the student and creates `APPLICATION_STATUS_CHANGED` in the audit log. The initial application also records `null → applied`, notifies the job recruiter and creates `APPLICATION_SUBMITTED`.

### Apply-time snapshots and AI summary

The apply endpoint reads the current student profile and stored resume/job vectors, re-runs the deterministic eligibility evaluator, computes the stored-data match score through the Piscina parse worker (with the existing TF-IDF fallback), and stores the match breakdown, eligibility snapshot and resume file ID at application time. Duplicate-index errors are translated to HTTP `409`.

After the application is persisted, its ID is put on a single-process in-memory summary queue. The request does not wait for Groq. The explanation task receives only the computed score, breakdown and matched/missing skills, validates the JSON result with Zod, and stores `text`, `gapAdvice`, `model`, `promptVersion`, `fallbackUsed` and `generatedAt`. If the LLM is disabled, unavailable or returns invalid output, deterministic template text is stored with `fallbackUsed: true`. Because this Phase 6 queue is in-process, work queued but not yet processed can be lost on a process restart; a durable queue is outside the current PS03 phase scope.

### Privacy and performance

- Applicant list queries read stored match scores and summaries only; they never invoke the LLM or embedding model.
- Applicant lists are filtered/sorted/paginated in MongoDB, and only the current page's student profile records are loaded.
- Candidate resume access is restricted by an application relationship and job ownership check.
- CSV values beginning with spreadsheet formula characters are escaped to reduce formula-injection risk.
- Notifications and audit writes are best-effort after the application/status write; failures are logged and do not erase an already-persisted application.

See [`docs/postman/phase6-requests.md`](postman/phase6-requests.md) for the end-to-end workflow and negative authorization cases.


## Phase 7 route authorization

| Route | Guard | Object-level authorization |
|---|---|---|
| `POST /api/interviews` | Bearer + recruiter/admin | Recruiter must be active and own the job attached to the application; admin may schedule globally |
| `GET /api/interviews/me` | Bearer + student/recruiter | Query is scoped to the authenticated student's or recruiter's participant id |
| `GET /api/interviews?from=&to=` | Bearer + student/recruiter/admin | Students see their own interviews; recruiters see their own jobs; admins see all |
| `PATCH /api/interviews/:id` | Bearer + recruiter/admin | Recruiter must own the interview; admin may manage globally |
| `GET /api/notifications` | Bearer | Query is scoped to `user = request.user._id` |
| `PATCH /api/notifications/:id/read` | Bearer | Update predicate includes both notification id and authenticated user id |
| `PATCH /api/notifications/read-all` | Bearer | Update predicate includes authenticated user id |

## Phase 8 — Administration and analytics modules

### Admin route authorization

All `/api/admin/*` routes run `authenticate` and `authorize(admin)` at router level:

- `GET /admin/students`: paginated aggregation over student accounts and profile shells; returns a safe projection.
- `PATCH /admin/students/:id`: updates an account and its student profile in a transaction; writes an audit record.
- `GET /admin/recruiters`: paginated recruiter/profile listing.
- `PATCH /admin/recruiters/:id/approve`: pending-to-active approval, audit record and recruiter notification in one transaction.
- `GET /admin/drives`: paginated drive listing with application and interview counts.
- `GET /admin/audit-logs`: filtered, paginated audit history.
- `GET /admin/export/students.csv`: streamed CSV export.

### Analytics authorization and ownership

Analytics routes allow admins and recruiters. A recruiter must be active/approved, and the service scopes every metric/report to jobs whose `recruiter` is that user's ID. Drive-specific report access checks job ownership before aggregation. The all-drives overview CSV is admin-only.

### Aggregations

MongoDB aggregation pipelines compute application status funnels, student/branch placement outcomes, per-drive skill evidence and time-series application counts. Median match scores are calculated from the aggregate's score list in Node after the database returns numeric values. Skills-demand combines job required skills with skills from students who applied to the scoped jobs.

### Audit coverage

The admin audit viewer filters `AuditLog` by actor, action, target type and created-at range, with optional text search across actions, target type and actor identity. Sensitive actions include job lifecycle changes, application status changes/submission, interview lifecycle changes, recruiter approval and admin student changes.

## Phase 9 route authorization review

All routes below are mounted under `/api`. `authenticate` verifies the Bearer token and reloads the account from MongoDB; role checks use that database-loaded role, not a client-supplied role value. Zod validation is applied to routes accepting parameters, query values, or request bodies. Endpoints with no user-controlled payload (health and notification read-all) do not need a body/parameter schema.

| Method | Route | Authentication / role guard | Object-level / data-scope guard |
|---|---|---|---|
| GET | `/api/health` | Public | Returns operational status only; no account data |
| POST | `/api/auth/register` | Public + auth rate limiter | Only `student` and `recruiter` roles accepted; admin cannot self-register |
| POST | `/api/auth/login` | Public + auth rate limiter | Selected login role, when provided, must match stored account role; suspended accounts rejected |
| GET | `/api/auth/me` | Bearer | Returns the authenticated account only |
| GET, PUT | `/api/students/me` | Bearer + student | Profile lookup/update is scoped to `request.user._id`; update schema is allowlisted |
| POST, GET | `/api/students/me/resume`, `/api/students/me/resume/reparse` | Bearer + student | GridFS file ID is taken from the authenticated student's own profile |
| GET | `/api/students/:id` | Bearer + recruiter/admin | Recruiter must have an application relationship to this student for one of their own jobs; admin is global |
| GET | `/api/students/:id/resume` | Bearer + recruiter/admin | Same applicant relationship check before streaming the GridFS object |
| POST | `/api/jobs` | Bearer + recruiter/admin | Recruiter must be active/approved; new job is owned by the authenticated recruiter |
| GET | `/api/jobs` | Bearer | Open jobs are visible to authenticated roles; recruiter-specific visibility is enforced by the job query |
| GET | `/api/jobs/:id` | Bearer + validated ID | Service limits students/recruiters to open jobs, with recruiter access to their own records and admin access globally |
| PUT, PATCH, DELETE | `/api/jobs/:id`, `/publish`, `/close`, draft delete | Bearer + recruiter/admin | Recruiter must be approved and own the job; state rules enforce draft/open/closed transitions |
| POST | `/api/jobs/ai/suggest-skills` | Bearer + recruiter/admin | Recruiter approval check; suggestions are returned for human review and are not automatically published |
| GET | `/api/jobs/:id/eligibility`, `/api/jobs/:id/fit`, `/api/jobs/recommended` | Bearer + student | Current student's profile is used; fit/recommendations are restricted to open jobs and stored vectors |
| POST | `/api/jobs/:id/apply` | Bearer + student | Student identity is `request.user`; backend rechecks eligibility and the unique `{ job, student }` index blocks duplicates |
| GET | `/api/jobs/:id/applications` and `/export.csv` | Bearer + recruiter/admin | Recruiter must be approved and own the job; only applicants to that job are returned/exported |
| PATCH | `/api/jobs/:id/applications/bulk-shortlist` | Bearer + recruiter/admin | Every application ID must belong to the requested owned job and be in `applied` status |
| GET | `/api/matching/:jobId/:studentId` and `/compare` | Bearer + student/recruiter/admin | Student can inspect self only; recruiter must own the job and the student must have applied; admin is global |
| GET | `/api/applications/me` | Bearer + student | Query is scoped to the authenticated student's ID |
| PATCH | `/api/applications/:id/status` | Bearer + recruiter/admin | Recruiter must own the job; state machine and interview cancellation requirements enforced in service |
| GET | `/api/applications/:id/ai-summary` | Bearer + recruiter/admin | Recruiter must own the job associated with the application |
| POST | `/api/interviews` | Bearer + recruiter/admin | Recruiter must own the job for the shortlisted application; active interview and recruiter time conflicts checked |
| GET | `/api/interviews/me` | Bearer + student/recruiter | Query scoped to authenticated participant; approved recruiter required |
| GET | `/api/interviews?from=&to=` | Bearer + student/recruiter/admin | Student sees own interviews; recruiter sees own interview records; admin is global |
| PATCH | `/api/interviews/:id` | Bearer + recruiter/admin | Recruiter must own the interview; state and time-conflict checks enforced |
| GET | `/api/notifications` | Bearer | Query always includes `user = request.user._id` |
| PATCH | `/api/notifications/:id/read` | Bearer | Update filter includes notification ID and authenticated user ID |
| PATCH | `/api/notifications/read-all` | Bearer | Update filter includes authenticated user ID |
| All | `/api/admin/*` | Bearer + admin at router level | Admin-only router; each list uses restricted field projection; mutations write audit logs |
| GET | `/api/analytics/overview`, `/skills-demand`, `/placements` | Bearer + admin/recruiter | Recruiter must be approved; all recruiter analytics are scoped to jobs owned by that recruiter |
| GET | `/api/analytics/reports/drive/:jobId` and `/export.csv` | Bearer + admin/recruiter | Drive ownership is checked before aggregation; recruiter can report only their own job |
| GET | `/api/analytics/reports/overview/export.csv` | Bearer + admin | Platform-wide export is explicitly admin-only |

### Middleware and security controls reviewed for Phase 9

1. `helmet()` is applied before routes and `x-powered-by` is disabled.
2. CORS accepts only origins listed in `CORS_ORIGIN`; requests without an Origin (for Postman/server tools) are permitted.
3. In production, Express trusts one reverse-proxy hop for Render client-IP and rate-limit handling.
4. Global rate limit is 100 requests per 15 minutes; auth routes have an additional 10 requests per 15 minutes.
5. JSON and URL-encoded bodies are capped at 1 MB; resume multipart uploads have file/count/field/part limits and PDF magic-byte validation.
6. `express-mongo-sanitize` runs before API routes to strip Mongo operator injection keys.
7. Zod is applied to every route that accepts params, query filters or bodies. Static no-input routes are documented above.
8. `passwordHash` and embedding vectors are excluded from ordinary Mongoose selection; user JSON serialization also strips password hashes.
9. Production error responses do not expose stack traces or error internals; full errors are logged through Pino with request IDs and authorization/cookie headers redacted.
10. Resume text is untrusted. PII patterns are redacted before Groq; model output is schema-validated; eligibility and final scores remain deterministic backend calculations.
11. Sensitive operations write audit records. The Phase 9 route review was performed against the mounted route files and corresponding service-level ownership checks.

## Phase 9 seed and verification assets

- Idempotent demo seed: `server/scripts/seed.js`; run at the repository root with `npm run seed`.
- Synthetic PDF assets: `server/seed/resumes/` (six text PDFs stored in GridFS by the seed).
- Postman collection: `docs/postman/CampusLink.postman_collection.json`.
- Postman environment: `docs/postman/CampusLink.postman_environment.json`.
- Supertest integration suite: `server/test/integration.workflows.test.js`; it runs only when `CAMPUSLINK_TEST_MONGODB_URI` points to a dedicated database whose name includes `test`.
- Seeded AI summaries use a deterministic template with `fallbackUsed: true`; the seed does not make Groq calls.
- The seed requires the local embedding model and `EMBEDDINGS_ENABLED=true` to compute and store profile/job vectors for the demo.
