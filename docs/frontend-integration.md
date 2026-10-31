# Frontend integration notes

## Preserved landing page

`client/pages/Home.jsx` is copied byte-for-byte from the supplied Fusion starter. It continues to render `KageLandingPage` from `@designcodeio/threeui` with the starter's settings, including its `#e0231c` primary color. The rest of the product uses the same charcoal/crimson identity. The landing page is not replaced with a new template. The public layout adds CampusLink navigation, a skip-to-content link and footer around it; the Kage component itself remains unchanged.

## API client

`client/api/axios.js` adds the stored JWT as a Bearer token, unwraps the CampusLink `{ success, data }` response envelope, preserves `{ data, meta }` for paginated responses, clears invalid sessions on HTTP 401, and surfaces API error messages. Set `VITE_API_URL` to the backend URL ending in `/api` in production. In local development, leave it blank and use the Vite `/api` proxy.

## Role model

The UI exposes Student, Recruiter and Placement Admin. Admin maps to the backend `admin` role. Registration is available for students and recruiters; admin registration is not exposed. The login selector is informational and the server's returned role controls redirection and access.

## List handling

Jobs, applications, applicants, students, drives, audit events, and notifications use backend-side filters/pagination where those endpoints support them. The recruiter workspace calls `GET /api/jobs?mine=true` to scope the job table to the authenticated recruiter; the server validates this filter and applies the recruiter ID in MongoDB.

## Matching and eligibility

The frontend does not calculate eligibility, matching or recommendations. It renders backend results, including match method, score breakdown, skill evidence, missing skills, and eligibility failures. The UI does not claim that a match score guarantees placement.

## Known API boundaries

- Password-reset screens are omitted because the supplied backend contract does not include reset endpoints.
- Recruiter rejection is not exposed because the supplied admin API only defines recruiter approval.
- Student-side interview reschedule/cancel controls are not shown; the backend workflow assigns those controls to recruiters.
- Calendar views render interview data returned by the calendar endpoint; frontend does not invent events.
- Notification topbar summary polls every 30 seconds as required by the specification.


## Routes and hosting

The frontend implements the public routes and the Student, Recruiter, and Placement Admin route trees listed in the frontend guide. `vercel.json` and `netlify.toml` publish `dist/client` and provide an SPA fallback for direct navigation/refresh on nested routes. Build with `npm run build`; the backend remains a separate Node service.

## Accessibility and behavior

Shared form controls generate associated labels and expose validation state. Dialogs support Escape to close, keep keyboard focus within the dialog, and restore focus when dismissed. Dashboard forms and tables use responsive layouts; chart sections use API-supplied values rather than hardcoded demo series.
