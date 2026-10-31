# CampusLink Phase 4 — Postman requests

Base URL: `http://localhost:5000/api`

All listed requests require `Authorization: Bearer <token>`, except `/api/health`.
Use a recruiter token from an **approved/active** recruiter account to manage jobs. Newly registered recruiters are pending until Phase 8 admin approval is implemented; for Phase 4 testing, use a manually approved test recruiter or update the test recruiter's `User.status` to `active` in MongoDB.

## 1. Create a draft job

`POST /jobs`

```json
{
  "company": "Nexaura Technologies",
  "title": "Software Engineer Intern",
  "description": "Build and maintain web applications, collaborate with engineers, write tests, and work with REST APIs and databases.",
  "location": "Lucknow / Hybrid",
  "type": "internship",
  "salaryRange": { "min": 15000, "max": 25000, "currency": "INR" },
  "requiredSkills": ["JavaScript", "React", "Node.js", "MongoDB"],
  "eligibility": {
    "branches": ["CSE", "IT"],
    "minCgpa": 7.0,
    "gradYear": 2027,
    "maxBacklogs": 0
  },
  "deadline": "2026-12-15T18:29:59.000Z",
  "driveDate": "2027-01-10T04:30:00.000Z"
}
```

The server always creates the job as `draft`; clients cannot set its status.

## 2. Suggest required skills

`POST /jobs/ai/suggest-skills`

```json
{
  "description": "We need an engineer experienced in Python, FastAPI, MongoDB, Docker and REST APIs.",
  "existingSkills": []
}
```

The response includes `skills`, `model`, `promptVersion` and `fallbackUsed`. Suggestions are not saved or published automatically; the recruiter must review them and include approved skills in the job form.

## 3. List and filter jobs

`GET /jobs?page=1&limit=20&q=software&location=Lucknow&type=internship&sort=recent`

Supported filters: `q`, `role` (mapped to the `title` field because the PS03 Job model has no separate role field), `location`, `company`, `type`, `eligible=true`, `status`, `page`, `limit`, `sort`.

Supported sort values: `recent`, `deadline`, `company`, `title`.

Students only receive open jobs. Recruiters can browse open jobs and all of their own jobs. Admins can view all jobs.

## 4. Read one job

`GET /jobs/:id`

Students can read open jobs; recruiters can read open jobs and their own jobs; admins can read all jobs.

## 5. Check student eligibility

`GET /jobs/:id/eligibility`

Student token required. The result is:

```json
{
  "success": true,
  "data": {
    "eligible": false,
    "failures": [
      {
        "rule": "minCgpa",
        "required": 7.5,
        "actual": 7.1,
        "message": "CGPA 7.1 is below the required 7.5."
      }
    ]
  }
}
```

The example values are illustrative; actual failures are computed from MongoDB profile and job data.

## 6. Update a job

`PUT /jobs/:id`

Send one or more editable fields using the same property names as create. Recruiters can update only their own jobs; admins can update any job. Closed jobs cannot be edited.

## 7. Publish a draft

`PATCH /jobs/:id/publish`

Only a draft can be published. The server computes/stores job embeddings at publish time if the local embedding model is available. If not, it preserves functionality using the later matching fallback.

## 8. Close an open job

`PATCH /jobs/:id/close`

Only open jobs can be closed.

## 9. Delete a draft

`DELETE /jobs/:id`

Only draft jobs can be deleted. Open and closed jobs return `409`.

## Expected errors

- `400`: invalid fields, invalid query, or past deadline on publish.
- `401`: missing or invalid token.
- `403`: wrong role or recruiter account not yet approved.
- `404`: job/profile not found or job is not visible to this user.
- `409`: invalid job status transition or attempt to delete a non-draft job.

All collection responses use `{ success: true, data, meta: { page, limit, total, totalPages } }`.

## Negative ownership test

Create a draft as Recruiter A, then attempt `PUT /jobs/:id`, `PATCH /jobs/:id/publish`, `PATCH /jobs/:id/close` or `DELETE /jobs/:id` with Recruiter B's token. Each mutation must return `403 FORBIDDEN`. A student attempting a job-mutation route also receives `403`. A recruiter may still read another recruiter's job when that job is open.
