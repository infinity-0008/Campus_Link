import { createStudentExportCursor, listAuditLogs, listDrives, listRecruiters, listStudents, approveRecruiter, updateStudent } from "./admin.service.js";
import { csvCell } from "../../utils/csv.js";
import { logger } from "../../utils/logger.js";

export async function students(request, response) {
  const result = await listStudents(request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export async function updateStudentRecord(request, response) {
  const result = await updateStudent(request.validated.params.id, request.validated.body, request.user, request.ip);
  return response.status(200).json({ success: true, data: result });
}

export async function recruiters(request, response) {
  const result = await listRecruiters(request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export async function approveRecruiterRecord(request, response) {
  const recruiter = await approveRecruiter(request.validated.params.id, request.user, request.ip);
  return response.status(200).json({ success: true, data: { recruiter } });
}

export async function drives(request, response) {
  const result = await listDrives(request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export async function auditLogs(request, response) {
  const result = await listAuditLogs(request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

const STUDENT_EXPORT_HEADERS = [
  "Name", "Email", "Account Status", "Roll Number", "Branch", "CGPA", "Graduation Year", "Backlogs", "Phone", "Skills", "Resume Parse Status", "Registered At",
];

export async function exportStudents(request, response) {
  const cursor = await createStudentExportCursor();
  response.status(200);
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", 'attachment; filename="campuslink-students.csv"');
  response.setHeader("Cache-Control", "no-store");
  response.write(`\uFEFF${STUDENT_EXPORT_HEADERS.map(csvCell).join(",")}\r\n`);

  try {
    for await (const student of cursor) {
      const row = [
        student.name,
        student.email,
        student.status,
        student.rollNo,
        student.branch,
        student.cgpa,
        student.gradYear,
        student.backlogs,
        student.phone,
        Array.isArray(student.skills) ? student.skills.join("; ") : "",
        student.resumeParseStatus,
        student.createdAt,
      ];
      response.write(`${row.map(csvCell).join(",")}\r\n`);
    }
    response.end();
  } catch (error) {
    logger.error({ err: error }, "Student CSV export failed after streaming began.");
    response.destroy(error);
  } finally {
    await cursor.close().catch(() => undefined);
  }
}
