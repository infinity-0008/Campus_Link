# Phase 8 — Admin, Analytics, Reports and Audit: Postman Guide

Base URL: `http://localhost:5000/api`

All `/admin/*` endpoints are administrator-only. The original build specification says admin accounts are created by the seed script; the Phase 9 seed script has not been built yet. Until then, test these routes only with a locally bootstrapped admin account (never add a public admin-registration route). Analytics endpoints accept admins and approved recruiters; recruiter analytics are limited to jobs owned by that recruiter. Students are denied.

## 1. Admin student management

### List and search students

`GET {{baseUrl}}/admin/students?page=1&limit=20&q=&status=active&branch=CSE&gradYear=2027&minCgpa=7&maxCgpa=10&sort=cgpa&order=desc`

Optional query fields: `q`, `status` (`active` or `suspended`), `branch`, `gradYear`, `minCgpa`, `maxCgpa`, `sort` (`name`, `cgpa`, `gradYear`, `createdAt`), `order` (`asc`, `desc`), `page`, and `limit` (maximum 100).

The response includes account details and a deliberately restricted student-profile projection. It does not return password hashes, resume parsed text, GridFS file IDs or embedding vectors.

### Update a student or suspend/reactivate the account

`PATCH {{baseUrl}}/admin/students/{{studentUserId}}`

```json
{
  "name": "Aarav Sharma",
  "status": "active",
  "branch": "CSE",
  "cgpa": 8.4,
  "gradYear": 2027,
  "backlogs": 0,
  "skills": ["javascript", "react", "node.js"]
}
```

The route accepts only explicitly supplied fields. `status` may be `active` or `suspended`. Account/profile changes and the audit record are committed in one MongoDB transaction.

## 2. Recruiter approval

### List recruiters

`GET {{baseUrl}}/admin/recruiters?page=1&limit=20&status=pending&q=Acme&sort=createdAt&order=desc`

### Approve a pending recruiter

`PATCH {{baseUrl}}/admin/recruiters/{{recruiterUserId}}/approve`

No request body is required. Approval changes the account from `pending` to `active`, writes a `RECRUITER_APPROVED` audit record and creates an approval notification. Attempting to approve an already active/suspended recruiter returns `409 RECRUITER_NOT_PENDING`.

## 3. Placement drives

`GET {{baseUrl}}/admin/drives?page=1&limit=20&status=open&q=Software&sort=driveDate&order=asc`

Returns paginated drives/jobs with recruiter identity, applicant count, selected count and interview count. Admins can manage individual jobs through the existing `/jobs` CRUD/publish/close routes; job create/update/publish/close/delete operations are now audit logged.

## 4. Audit logs

`GET {{baseUrl}}/admin/audit-logs?page=1&limit=20&actor={{userId}}&action=JOB_PUBLISHED&targetType=Job&from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z&q=publish`

Optional filters: `actor` (user ObjectId), `action`, `targetType`, `from`, `to`, and `q`. The `to` value is exclusive. Results are newest first and include actor name/email, role, action, target, metadata, IP and timestamp.

## 5. Analytics

### Overview

`GET {{baseUrl}}/analytics/overview?from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z`

Returns job counts, application totals/funnel, unique applicants, average and median match scores, interview count; admins additionally receive total/active/pending account counts. A recruiter receives metrics only for their own jobs.

### Skills demand

`GET {{baseUrl}}/analytics/skills-demand`

Returns each required skill's job-demand count alongside the number of applicants to the scoped jobs who list that skill on their profile.

### Placement outcomes

`GET {{baseUrl}}/analytics/placements?from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z`

Returns application and selected-student outcomes grouped by student branch. Missing branch data is grouped as `Unspecified`.

## 6. Recruitment reports and exports

### One drive report

`GET {{baseUrl}}/analytics/reports/drive/{{jobId}}`

Includes applicant count, funnel counts, average/median match score, top applicant skills, most common missing skills, interview counts, selection rate and applications per UTC day.

Admins can inspect any drive. Recruiters can inspect only their own drives; attempting another recruiter's job returns `403 FORBIDDEN`.

### One drive CSV

`GET {{baseUrl}}/analytics/reports/drive/{{jobId}}/export.csv`

### All-drives overview CSV (admin only)

`GET {{baseUrl}}/analytics/reports/overview/export.csv`

### Student CSV (admin only)

`GET {{baseUrl}}/admin/export/students.csv`

CSV responses include the drive fields, funnel, average/median scores, interview status counts, selection rate, top applicant skills, common missing skills and per-day application series (the three array-valued fields are JSON cells). Student exports are streamed. All CSVs include a UTF-8 BOM and escape spreadsheet formula prefixes.

## 7. Negative authorization tests

1. Call every `/admin/*` route without a token: expect `401 AUTHENTICATION_REQUIRED`.
2. Call `/admin/students` with a student or recruiter token: expect `403 FORBIDDEN`.
3. Call `/analytics/overview` with a student token: expect `403 FORBIDDEN`.
4. Call `/analytics/reports/drive/{{anotherRecruitersJobId}}` with a recruiter token: expect `403 FORBIDDEN`.
5. Call `/analytics/reports/overview/export.csv` with a recruiter token: expect `403 FORBIDDEN`.
6. Approve a recruiter twice: first call succeeds for pending account; second call returns `409 RECRUITER_NOT_PENDING`.
7. Attempt to update a recruiter through `/admin/students/:id`: expect `404 STUDENT_NOT_FOUND`.

## 8. Transaction requirement

Recruiter approval and student account/profile updates use MongoDB transactions to keep the account change and its audit/notification records consistent. Test them against MongoDB Atlas or a local replica set; standalone MongoDB does not support multi-document transactions.
