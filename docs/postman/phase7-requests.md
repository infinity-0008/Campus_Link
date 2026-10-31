# Phase 7 — Interviews, notifications and calendar (Postman)

Base URL: `http://localhost:5000/api`

## Environment variables

Use the existing Phase 6 variables and add:

- `interviewId`
- `studentToken`
- `recruiterToken`
- `adminToken`
- `applicationId`

## Suggested end-to-end sequence

1. Log in as an approved recruiter and a student.
2. Ensure the student has applied to one of the recruiter's jobs and the application is `shortlisted`.
3. Schedule an interview with `POST /interviews` using the recruiter token.
4. Save `data.interview._id` as `interviewId`.
5. Confirm the application moved from `shortlisted` to `interview_scheduled` and its `statusHistory` contains the transition.
6. Confirm both the student and recruiter received an interview notification.
7. Retrieve the interview using `GET /interviews/me` for either participant.
8. Retrieve the calendar range using `GET /interviews?from=...&to=...`.
9. Reschedule the interview and confirm the status becomes `rescheduled`.
10. Schedule a second interview for the same recruiter that overlaps the first; expect `409 RECRUITER_INTERVIEW_CONFLICT`.
11. Cancel the first interview. If the application is still `interview_scheduled`, it returns to `shortlisted` and a history entry is appended.
12. Schedule again if desired, then mark that interview `completed`. The application remains `interview_scheduled` until the recruiter separately records `selected` or `rejected`.
13. List notifications, mark one read, then mark all remaining notifications read.

## Schedule an interview

`POST {{baseUrl}}/interviews`

Header: `Authorization: Bearer {{recruiterToken}}`

Online request:

```json
{
  "applicationId": "{{applicationId}}",
  "scheduledAt": "2027-01-15T10:00:00.000Z",
  "durationMins": 45,
  "mode": "online",
  "link": "https://meet.example.com/campuslink-interview",
  "notes": "Technical round"
}
```

Onsite interviews require `mode: "onsite"` and a non-empty `location`. Date-times must be ISO 8601 strings with an explicit timezone. The schedule must be in the future. Only shortlisted applications can be scheduled.

Expected: `201` with the created interview. The application changes to `interview_scheduled` and both participants receive notifications.

Important errors:

- `401 AUTHENTICATION_REQUIRED` — no/invalid token.
- `403 FORBIDDEN` — wrong role or recruiter does not own the job.
- `403 RECRUITER_NOT_APPROVED` — recruiter account is not active.
- `404 APPLICATION_NOT_FOUND` — application does not exist.
- `409 APPLICATION_NOT_SHORTLISTED` — application is not shortlisted.
- `409 ACTIVE_INTERVIEW_EXISTS` — this application already has an active interview.
- `409 RECRUITER_INTERVIEW_CONFLICT` — the recruiter has an overlapping scheduled/rescheduled interview.
- `400` — invalid date, mode, meeting link or location.

## List my interviews

`GET {{baseUrl}}/interviews/me?page=1&limit=20`

Header: `Authorization: Bearer {{studentToken}}` or `{{recruiterToken}}`.

Optional filters: `from`, `to` (both required together), `status` (`scheduled`, `rescheduled`, `completed`, `cancelled`). Results are scoped to the authenticated participant.

## Calendar range

`GET {{baseUrl}}/interviews?from=2027-01-01T00:00:00.000Z&to=2027-02-01T00:00:00.000Z&page=1&limit=100`

Header: `Authorization: Bearer {{studentToken}}`, `{{recruiterToken}}` or `{{adminToken}}`.

The `to` value is exclusive. Maximum range is 366 days. Students see only their interviews, recruiters see only interviews for their jobs, and admins can see all interviews. Results include populated job, student and recruiter summary fields.

## Reschedule, cancel or complete

All use:

`PATCH {{baseUrl}}/interviews/{{interviewId}}`

Header: `Authorization: Bearer {{recruiterToken}}`

### Reschedule

```json
{
  "action": "reschedule",
  "scheduledAt": "2027-01-16T11:00:00.000Z",
  "durationMins": 45,
  "mode": "online",
  "link": "https://meet.example.com/new-room",
  "notes": "Moved at candidate request"
}
```

The interview status becomes `rescheduled`. Conflict checks exclude the current interview and include all other `scheduled` and `rescheduled` interviews for the recruiter.

### Cancel

```json
{
  "action": "cancel",
  "notes": "Candidate requested cancellation"
}
```

The interview status becomes `cancelled`. If the linked application is still `interview_scheduled`, it returns to `shortlisted` with a status-history entry. This enables the Phase 6 state-machine transition that is permitted only after an interview is cancelled.

### Complete

```json
{
  "action": "complete",
  "notes": "Interview completed"
}
```

The interview status becomes `completed`. The application remains `interview_scheduled`; the recruiter must separately transition it to `selected` or `rejected` after reviewing the result.

A completed or cancelled interview cannot be modified again. All successful actions notify both participants and write an audit log.

## Notifications

### List notifications

`GET {{baseUrl}}/notifications?page=1&limit=20`

Optional: `unreadOnly=true`.

Response `data` contains `notifications` and `unreadCount`; pagination metadata is returned in `meta`.

### Mark one notification as read

`PATCH {{baseUrl}}/notifications/{{notificationId}}/read`

No body required. A user can update only their own notification. A notification belonging to someone else returns `404 NOTIFICATION_NOT_FOUND`.

### Mark all notifications as read

`PATCH {{baseUrl}}/notifications/read-all`

No body required. Only unread notifications belonging to the authenticated user are changed.

## Authorization / negative tests

- Student attempts to schedule an interview → `403`.
- Student attempts to update an interview → `403`.
- Recruiter attempts to schedule for another recruiter's application → `403`.
- Recruiter attempts to reschedule/cancel/complete another recruiter's interview → `403`.
- Pending recruiter accesses interview management → `403 RECRUITER_NOT_APPROVED`.
- Student lists `/interviews/me` → only that student's interviews.
- Recruiter lists `/interviews/me` → only their job interviews.
- Student tries to mark another user's notification read → `404`.
- Overlapping recruiter interview → `409 RECRUITER_INTERVIEW_CONFLICT`.
- Cancelled/completed interview update → `409 INTERVIEW_NOT_ACTIVE`.
- Attempt to schedule an application not shortlisted → `409 APPLICATION_NOT_SHORTLISTED`.

## Operational note

Interview scheduling and linked application-status changes are performed in a MongoDB transaction so the two records do not diverge if one write fails. Use MongoDB Atlas or another MongoDB replica-set deployment that supports transactions. The frontend should refresh/poll `GET /notifications` about every 30 seconds for the notification bell; polling is a frontend responsibility, not a server-side timer.
