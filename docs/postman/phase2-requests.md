# Phase 2 Postman requests

Set `baseUrl` to `http://localhost:5000`.

## 1. Register a student

`POST {{baseUrl}}/api/auth/register`

```json
{
  "name": "Aarav Student",
  "email": "aarav@example.com",
  "password": "secure-pass-123",
  "role": "student"
}
```

Expected: `201`, `data.user.role = student`, `data.user.status = active`, plus `data.token`.

## 2. Register a recruiter

`POST {{baseUrl}}/api/auth/register`

```json
{
  "name": "Riya Recruiter",
  "email": "riya@company.example",
  "password": "secure-pass-123",
  "role": "recruiter",
  "company": "Example Labs",
  "designation": "Talent Partner",
  "website": "https://example.com"
}
```

Expected: `201`, `data.user.role = recruiter`, `data.user.status = pending`, plus `data.token`.

## 3. Login

`POST {{baseUrl}}/api/auth/login`

```json
{
  "email": "aarav@example.com",
  "password": "secure-pass-123",
  "role": "student"
}
```

Expected: `200`, current user and `data.token`. Store the token in a Postman environment variable such as `studentToken`.

## 4. Read current account

`GET {{baseUrl}}/api/auth/me`

Header: `Authorization: Bearer {{studentToken}}`

Expected: `200`, `data.user`.

## 5. Read the student profile shell

`GET {{baseUrl}}/api/students/me`

Header: `Authorization: Bearer {{studentToken}}`

Expected: `200`, `data.profile` containing the newly-created empty profile shell.

## 6. Verify the role guard

Use the recruiter token instead:

`GET {{baseUrl}}/api/students/me`

Header: `Authorization: Bearer {{recruiterToken}}`

Expected: `403`, error code `FORBIDDEN`.

## 7. Negative tests

- Register with `role: admin`: `400 VALIDATION_ERROR`.
- Register with invalid email or password shorter than 8 characters: `400 VALIDATION_ERROR`.
- Register the same email twice: `409 EMAIL_ALREADY_REGISTERED`.
- Login with an incorrect password: `401 INVALID_CREDENTIALS`.
- Login with a role selector that does not match the account: `403 ROLE_MISMATCH`.
- Call `/api/auth/me` without a token: `401 AUTHENTICATION_REQUIRED`.

Admin accounts are intentionally not self-registerable. They are created by the later seed script as specified in the build pack.
