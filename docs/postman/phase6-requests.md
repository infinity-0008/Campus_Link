# Phase 6 — Applications and recruitment workflow (Postman)

Base URL: `http://localhost:5000/api`

Required environment variables:

- `baseUrl`
- `studentToken`
- `recruiterToken`
- `adminToken`
- `jobId`
- `applicationId`

Set `Authorization: Bearer {{studentToken}}` on student requests and the corresponding recruiter/admin token on management requests.

## Recommended end-to-end sequence

1. Log in as a student with a completed profile and a readable resume.
2. Log in as an approved recruiter and create/publish an open job with eligibility rules.
3. As the student, request `GET {{baseUrl}}/jobs/{{jobId}}/fit` and confirm eligibility.
4. Apply using `POST {{baseUrl}}/jobs/{{jobId}}/apply` with the student token.
5. Save `data.application._id` as `applicationId`.
6. Confirm the recruiter receives a notification record and an `APPLICATION_SUBMITTED` audit record in MongoDB.
7. As recruiter, list applicants with `GET {{baseUrl}}/jobs/{{jobId}}/applications?sort=score&page=1&limit=20`.
8. Change the application to shortlisted with `PATCH {{baseUrl}}/applications/{{applicationId}}/status`.
9. Check the student notification and status history.
10. Read `GET {{baseUrl}}/applications/{{applicationId}}/ai-summary` until `data.status` is `ready`.

## Requests

### Apply to a job (student)

`POST {{baseUrl}}/jobs/{{jobId}}/apply`

Headers: `Authorization: Bearer {{studentToken}}`

Body may be empty: `{}`

Expected: `201`, with the application, calculated match score, stored matching breakdown, eligibility snapshot, resume version and `aiSummaryStatus: "queued"`.

Important errors:

- `401 AUTHENTICATION_REQUIRED` — no/invalid token.
- `403 FORBIDDEN` — wrong role.
- `404 JOB_NOT_FOUND` / `404 STUDENT_PROFILE_NOT_FOUND` — missing resource/profile.
- `409 DUPLICATE_APPLICATION` — student already applied.
- `422 APPLICATION_INELIGIBLE` — response includes `error.details.failures`.

### My applications (student)

`GET {{baseUrl}}/applications/me?page=1&limit=20&sort=recent`

Headers: `Authorization: Bearer {{studentToken}}`

Optional status filter: `applied`, `shortlisted`, `interview_scheduled`, `selected`, `rejected`.

### List applicants (recruiter/admin)

`GET {{baseUrl}}/jobs/{{jobId}}/applications?page=1&limit=20&sort=score`

Headers: `Authorization: Bearer {{recruiterToken}}`

Optional filters: `status`, `minScore` (0–100), `q` (candidate name, email, roll number, branch or skill), `sort=score|date`.

Returns server-side pagination metadata, stored match evidence, candidate profile details and any completed AI summary. Listing does not invoke Groq or the embedding model.

### Change application status (recruiter/admin)

`PATCH {{baseUrl}}/applications/{{applicationId}}/status`

Headers: `Authorization: Bearer {{recruiterToken}}`

Body:

```json
{
  "status": "shortlisted",
  "note": "Reviewed against the job requirements."
}
```

Allowed transitions:

- `applied` → `shortlisted` or `rejected`
- `shortlisted` → `interview_scheduled` or `rejected`
- `interview_scheduled` → `selected`, `rejected` or `shortlisted`
- `selected` and `rejected` are terminal

Invalid transitions return `409 INVALID_APPLICATION_STATUS_TRANSITION`.

### Bulk shortlist (recruiter/admin)

`PATCH {{baseUrl}}/jobs/{{jobId}}/applications/bulk-shortlist`

Headers: `Authorization: Bearer {{recruiterToken}}`

Body:

```json
{
  "applicationIds": ["{{applicationId}}"],
  "note": "Shortlisted after initial review."
}
```

All selected applications must belong to the job and currently be `applied`. The endpoint creates a status-history entry, notification and audit record for each selected application.

### AI summary (recruiter/admin)

`GET {{baseUrl}}/applications/{{applicationId}}/ai-summary`

Headers: `Authorization: Bearer {{recruiterToken}}`

Before generation finishes: `{ "available": false, "status": "pending" }`.

When ready: returns the summary, skill-gap advice, model, prompt version, `fallbackUsed` and generation timestamp.

The explanation task receives only the computed match score, breakdown and matched/missing skills. It does not receive raw resume text or decide eligibility/matching.

### Export applicants (recruiter/admin)

`GET {{baseUrl}}/jobs/{{jobId}}/applications/export.csv?sort=score`

Headers: `Authorization: Bearer {{recruiterToken}}`

Returns a CSV attachment. Candidate-supplied spreadsheet formula prefixes are escaped.

## Authorization negative tests

- Student calls recruiter applicant list → `403`.
- Recruiter calls applicant list for another recruiter's job → `403`.
- Recruiter changes status for an application on another recruiter's job → `403`.
- Recruiter reads AI summary for an application on another recruiter's job → `403`.
- Recruiter requests `/students/:id` for a student who did not apply to their job → `403`.
- Recruiter requests `/students/:id/resume` for a student who did not apply to their job → `403`.
- Student tries to change application status → `403`.
- Duplicate apply → `409`.
- Ineligible apply → `422` with failures.
- Invalid status transition → `409`.

## Candidate profile and resume viewer

A recruiter can inspect a student only if that student has applied to one of the recruiter's jobs:

- `GET {{baseUrl}}/students/{{studentId}}`
- `GET {{baseUrl}}/students/{{studentId}}/resume`

Admins may inspect any student. The resume route streams the stored PDF from GridFS.
