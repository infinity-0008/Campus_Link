# Phase 9 — Seed, hardening and verification

## 1. Prepare the demo database

1. Configure `server/.env` with `MONGODB_URI` pointing to a dedicated database named `CampusLink` or `CampusLink_demo` (not production/shared data).
2. Set a strong `JWT_SECRET` (at least 32 characters).
3. Keep `EMBEDDINGS_ENABLED=true`.
4. Install dependencies and download the local embedding model:

```powershell
npm install
npm run download:model
```

## 2. Seed the demo

From the repository root:

```powershell
npm run seed
```

The script is idempotent but destructive to the CampusLink application collections and the `resumes.files` / `resumes.chunks` GridFS collections in the configured database. It refuses `NODE_ENV=production`, and it only accepts a database name containing `campuslink` or `demo`. It prints all demo email addresses, account roles/statuses and the shared demo password after verifying the seeded counts and 384-dimensional vectors.

The seed does not call Groq. It stores deterministic template summaries with `fallbackUsed: true`. A local embeddings model is required; the seed fails early if it cannot warm the model or compute stored profile/job vectors.

## 3. Import Postman assets

Import these files into Postman:

- `CampusLink.postman_collection.json`
- `CampusLink.postman_environment.json`

Select **CampusLink Demo**. Login requests save `studentToken`, `recruiterToken` or `adminToken` automatically. The collection includes Auth, Student, Recruiter, Admin, Negative tests, AI and Reports folders.

Use the seeded credentials printed by the seed script. The default shared demo password is `CampusLink@Demo2026` unless `CAMPUSLINK_DEMO_PASSWORD` was set in `server/.env`.

## 4. Automated tests

Run all tests:

```powershell
npm test
```

The ordinary unit/route-validation tests do not require MongoDB. The Supertest integration suite is skipped unless `CAMPUSLINK_TEST_MONGODB_URI` is set. To enable it, use a dedicated MongoDB database with `test` in its name:

```powershell
$env:CAMPUSLINK_TEST_MONGODB_URI = "mongodb+srv://<user>:<password>@<cluster>/CampusLink_test?retryWrites=true&w=majority"
npm test
Remove-Item Env:CAMPUSLINK_TEST_MONGODB_URI
```

The integration suite deletes records from its configured test database before each scenario. It tests student/recruiter registration, token identity, student/recruiter role boundaries, ineligible apply (`422`), successful apply, duplicate apply (`409`), recruiter ownership (`403`), valid shortlist transition and invalid status transition (`409`). The suite refuses a URI whose database name does not include `test`.

## 5. Negative API scenarios to demonstrate

- Attempt public admin registration: `400 VALIDATION_ERROR`.
- Use recruiter token on `/api/students/me`: `403 FORBIDDEN`.
- Apply to an ineligible job: `422 APPLICATION_INELIGIBLE` with failure details.
- Apply twice to the same job: `409 DUPLICATE_APPLICATION`.
- Read applicants for another recruiter's job: `403 FORBIDDEN`.
- Perform an invalid application transition: `409 INVALID_APPLICATION_STATUS_TRANSITION`.
- Upload a malformed or unsupported PDF: `415 UNSUPPORTED_RESUME_FORMAT`.

## 6. Pre-demo warm-up

Start the service before the demo and check `/api/health`. Then log in as one student and open recommendations/job fit, log in as a recruiter and open the applicant table/report, and open the admin analytics overview. The local embedding model is preloaded during server startup. Seeded AI summaries are already stored, so the main demo path does not depend on Groq.


## Semantic-matching demonstration pair

The seed deliberately creates two applications to the same **AI / Machine Learning Intern** job:

- `student01@campuslink.example.com` (Aanya): resume wording uses `ML, DL`.
- `student05@campuslink.example.com` (Meera): resume project wording says `built neural networks`.

Both are seeded as eligible applicants to that open job. Use the recruiter/admin applicant-list request to retrieve their student IDs and the matching comparison route:

```http
GET {{baseUrl}}/api/matching/{{jobId}}/{{studentId}}/compare
Authorization: Bearer {{adminToken}}
```

Set `jobId` to the AI / Machine Learning Intern job ID and `studentId` to each applicant's ID in turn. The expected purpose is to compare exact keyword matching, synonym-aware TF-IDF and the local semantic embedding method on differently worded evidence. Exact scores depend on the downloaded model and the configured threshold; the seed stores the calculated results at seed time.
