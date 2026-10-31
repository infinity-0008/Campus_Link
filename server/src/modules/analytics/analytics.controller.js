import {
  getAnalyticsOverview,
  getSkillsDemand,
  getPlacementOutcomes,
  getDriveReport,
  getDriveReportCsvRows,
  getOverviewReportCsvRows,
} from "./analytics.service.js";
import { sendCsv, toCsv } from "../../utils/csv.js";

export async function overview(request, response) {
  const result = await getAnalyticsOverview(request.user, request.validated.query);
  return response.status(200).json({ success: true, data: result });
}

export async function skillsDemand(request, response) {
  const result = await getSkillsDemand(request.user);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export async function placements(request, response) {
  const result = await getPlacementOutcomes(request.user, request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export async function driveReport(request, response) {
  const result = await getDriveReport(request.validated.params.jobId, request.user);
  return response.status(200).json({ success: true, data: result });
}

const DRIVE_CSV_HEADERS = [
  { label: "Job ID", value: "jobId" },
  { label: "Company", value: "company" },
  { label: "Job Title", value: "title" },
  { label: "Status", value: "status" },
  { label: "Drive Date", value: "driveDate" },
  { label: "Application Deadline", value: "deadline" },
  { label: "Job Type", value: "type" },
  { label: "Location", value: "location" },
  { label: "Applicants", value: "applicantCount" },
  { label: "Applied", value: "applied" },
  { label: "Shortlisted", value: "shortlisted" },
  { label: "Interview Scheduled", value: "interviewScheduled" },
  { label: "Selected", value: "selected" },
  { label: "Rejected", value: "rejected" },
  { label: "Average Match Score", value: "averageMatchScore" },
  { label: "Median Match Score", value: "medianMatchScore" },
  { label: "Scheduled Interviews", value: "scheduledInterviews" },
  { label: "Rescheduled Interviews", value: "rescheduledInterviews" },
  { label: "Completed Interviews", value: "completedInterviews" },
  { label: "Cancelled Interviews", value: "cancelledInterviews" },
  { label: "Selection Rate (%)", value: "selectionRate" },
  { label: "Top Applicant Skills (JSON)", value: "topApplicantSkills" },
  { label: "Most Common Missing Skills (JSON)", value: "mostCommonMissingSkills" },
  { label: "Match Score Distribution (JSON)", value: "scoreDistribution" },
  { label: "Applications Per Day (JSON)", value: "applicationsPerDay" },
];

export async function exportDriveReport(request, response) {
  const rows = await getDriveReportCsvRows(request.validated.params.jobId, request.user);
  return sendCsv(response, `campuslink-drive-${request.validated.params.jobId}.csv`, toCsv(DRIVE_CSV_HEADERS, rows));
}

export async function exportOverviewReport(request, response) {
  const rows = await getOverviewReportCsvRows(request.user);
  return sendCsv(response, "campuslink-overview-reports.csv", toCsv(DRIVE_CSV_HEADERS, rows));
}
