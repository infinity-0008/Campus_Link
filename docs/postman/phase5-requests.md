# CampusLink Phase 5 — Matching API and Postman guide

Base URL: `http://localhost:5000/api`

All endpoints require `Authorization: Bearer <token>`.

Phase 5 uses vectors already stored during Phase 3 resume/profile processing and Phase 4 job create/update/publish. **No endpoint in this phase calls the embedding model or Groq while ranking or comparing candidates.** If the local embedding model was disabled or unavailable at startup, matching reports `method: "tfidf-fallback"` and records `fallbackUsed: true`.

## 1. Student job-fit panel

`GET /jobs/:jobId/fit`

Access: authenticated student, for an open job and their own profile.

Example:

```http
GET /api/jobs/507f1f77bcf86cd799439011/fit
Authorization: Bearer <student-token>
```

Returns eligibility and matching in one response:

```json
{
  "success": true,
  "data": {
    "jobId": "507f1f77bcf86cd799439011",
    "eligibility": {
      "eligible": false,
      "failures": [
        {
          "rule": "minCgpa",
          "required": 7.5,
          "actual": 7.2,
          "message": "CGPA 7.2 is below the required 7.5."
        }
      ]
    },
    "matching": {
      "score": 78,
      "method": "embeddings",
      "fallbackUsed": false,
      "breakdown": {
        "skillCoverage": 0.8,
        "docSimilarity": 0.71,
        "projectRelevance": 0.6,
        "weights": { "skill": 0.5, "doc": 0.3, "project": 0.2 }
      },
      "matchedSkills": [],
      "missingSkills": [],
      "skillGaps": [],
      "comparison": { "keyword": 42, "tfidf": 61, "embeddings": 78 },
      "summary": "Strong match: 4 of 5 required skills found. Missing: Docker."
    }
  }
}
```

The numbers above are illustrative. Actual results are calculated from the stored student/job data and vectors.

A student may still view match fit when ineligible. Eligibility is a separate deterministic decision; the frontend must disable Apply when `eligibility.eligible` is false. Phase 6 will repeat this check on the backend during apply.

## 2. Recommended jobs

`GET /jobs/recommended`

Access: student only.

Supported query parameters: `q`, `company`, `location`, `type`, `page`, `limit`.

Example:

```http
GET /api/jobs/recommended?q=developer&location=Remote&page=1&limit=10
Authorization: Bearer <student-token>
```

Returns open, non-expired jobs ranked by stored matching score. Each item contains the job, `matchScore`, `matchMethod`, `matchedSkills`, `missingSkills` and `eligibilityResult`. Results include the standard pagination metadata. No embedding-model inference or LLM request occurs during this endpoint.

## 3. Matching score for a job/student pair

`GET /matching/:jobId/:studentId`

Access rules:

- Student: may request only their own `studentId`, and only for an open job.
- Recruiter: may request only their own job and only a student who has applied to that job.
- Admin: may request any job/student pair.

Example:

```http
GET /api/matching/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012
Authorization: Bearer <recruiter-token>
```

Returns the selected score, method, score breakdown, per-skill evidence, skill gaps, three-way comparison, embedding-only discoveries and a deterministic summary.

## 4. Three-way method comparison

`GET /matching/:jobId/:studentId/compare`

Uses the same access rules as the previous endpoint.

Example:

```http
GET /api/matching/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012/compare
Authorization: Bearer <recruiter-token>
```

Returns:

- `methods.keyword`: exact phrase/token coverage only; no synonym normalization.
- `methods.tfidf`: synonym-aware skill coverage (0.50), TF-IDF document similarity (0.35), and project/experience relevance (0.15).
- `methods.embeddings`: semantic skill coverage (0.50), document similarity (0.30), and project/experience relevance (0.20), or `null` if stored vectors/model readiness are unavailable.
- `embeddingsOnlySkills`: required skills found by embeddings but not by the TF-IDF synonym path.

## 5. Scoring rules

### Embeddings method

For every required job skill, compare its stored job vector against the stored student resume/profile item vectors. The best cosine similarity is used. A skill is matched when its similarity is greater than or equal to `SKILL_MATCH_THRESHOLD` (default `0.55`). Exact canonical/synonym skill matches count as `1.0`.

- Skill coverage: matched required skills / total required skills; weight `0.50`.
- Document similarity: cosine between stored resume and job document vectors; weight `0.30`.
- Project/experience relevance: mean of the top three stored project/experience item similarities against the job document vector; weight `0.20`.
- Final score: weighted sum × 100, rounded to an integer.

The PDF requires document similarity to be rescaled/clamped to `0..1`, but does not specify numerical calibration bounds. This implementation uses a documented linear calibration: cosine `0.20` maps to `0`, cosine `0.80` maps to `1`, and values outside the range are clamped. Recalibrate this range against the Phase 9 seeded resumes before the final demo if needed.

### TF-IDF fallback

- Synonym-aware skill overlap: weight `0.50`.
- TF-IDF document cosine: weight `0.35`.
- Mean of the top three TF-IDF project/experience similarities: weight `0.15`.
- Final score: weighted sum × 100, rounded to an integer.

### Keyword baseline

Keyword score is exact required-skill phrase coverage (`matched required skills / total required skills × 100`). It does not canonicalize aliases, so `ML` does not count as the exact phrase `machine learning`.

If no required skills are configured, skill coverage is `0`; document/project evidence may still contribute to the computed weighted score. Jobs should normally define their required skills for meaningful placement matching.

## 6. Error and authorization checks

- `400`: malformed MongoDB identifiers or invalid query values.
- `401`: missing/invalid Bearer token.
- `403`: student requests another student's match, recruiter requests another recruiter's job, or recruiter requests a non-applicant student.
- `404`: job or student profile not found; student fit request for a closed job.

## 7. Suggested test sequence

1. Upload a text-readable PDF as a student and verify `parseStatus: "ok"`.
2. Verify the student profile has stored embeddings when model preload reports `ready`.
3. Create/publish a job as an approved recruiter and verify the job has stored vectors when embeddings are ready.
4. Call the student fit endpoint and inspect matched/missing skills and score breakdown.
5. Call recommended jobs and verify match-score ordering and eligibility flags.
6. Use a recruiter token for a job the recruiter owns and an applicant student id after Phase 6 has created applications; verify the matching endpoint is accessible.
7. Try a student token with another student's id and a recruiter token with another recruiter's job; both must return `403`.
8. Set `EMBEDDINGS_ENABLED=false`, restart, and repeat fit/comparison. The response must use `tfidf-fallback`, with `comparison.embeddings: null`.
9. Compare two equivalent resumes using different wording to demonstrate the difference between exact keyword, synonym-aware TF-IDF and semantic matching.
