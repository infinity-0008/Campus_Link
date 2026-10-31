# CampusLink Phase 3 — Postman requests

Base URL: `http://localhost:5000/api`

Set `studentToken` to the token returned by student login. All requests below require `Authorization: Bearer {{studentToken}}` except the health request.

## 1. Read student profile

`GET {{baseUrl}}/students/me`

Expected: `200`, `{ success: true, data: { profile } }`. Parsed resume text and embedding vectors are not returned.

## 2. Update student profile

`PUT {{baseUrl}}/students/me`

Headers: `Authorization: Bearer {{studentToken}}`, `Content-Type: application/json`

```json
{
  "rollNo": "CSE2024-001",
  "branch": "CSE",
  "cgpa": 8.4,
  "gradYear": 2027,
  "backlogs": 0,
  "phone": "+91 9876543210",
  "skills": ["JavaScript", "React", "Node.js", "Python"],
  "projects": [
    {
      "title": "FinanceFlow",
      "description": "A personal finance tracker with transaction management.",
      "techStack": ["HTML", "CSS", "JavaScript"]
    }
  ],
  "experience": []
}
```

Expected: `200`; updates only allowlisted profile fields. Skills/projects/experience are re-embedded when the local model is available.

## 3. Upload PDF resume

`POST {{baseUrl}}/students/me/resume`

Body: `form-data`, key `resume`, type **File**, select a PDF (maximum 5 MB by default). Do not manually set the multipart Content-Type; Postman adds the boundary.

Expected: `200`, parse status `ok`, parsed skills and AI extraction metadata. If Groq is unavailable or fails validation, the response still succeeds through the synonym fallback and `fallbackUsed` is true.

Invalid file type returns `415`. Oversized upload returns `413`. Corrupt or text-empty PDF returns `422` and stores a readable `parseError` in the profile.

## 4. Download / view current PDF

`GET {{baseUrl}}/students/me/resume`

Expected: `200`, `Content-Type: application/pdf`, file displayed/downloaded by Postman. Only the owning student can access this endpoint.

## 5. Re-parse stored PDF

`POST {{baseUrl}}/students/me/resume/reparse`

Expected: `200` after parsing, extraction and embedding refresh. Returns `404` if no resume is stored.

## 6. Role and authentication negatives

- No token on any `/students/me` route: `401`.
- Recruiter token on any `/students/me` route: `403`.
- Attempt to update `role`, `user`, `resume` or `embeddings`: `400` validation error.

## Response conventions

JSON successes use `{ "success": true, "data": ... }`. JSON errors use `{ "success": false, "error": { "code": "...", "message": "...", "details": ... } }`. PDF download is a binary response.
