import { Router } from "express";
import { USER_ROLES } from "../../config/constants.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  auditLogListRequestSchema,
  driveListRequestSchema,
  idParamsSchema,
  recruiterListRequestSchema,
  studentListRequestSchema,
  studentUpdateRequestSchema,
} from "./admin.validation.js";
import {
  approveRecruiterRecord,
  auditLogs,
  drives,
  exportStudents,
  recruiters,
  students,
  updateStudentRecord,
} from "./admin.controller.js";

const router = Router();
router.use(authenticate, authorize(USER_ROLES.ADMIN));

// Static export route is registered before any parameterized routes.
router.get("/export/students.csv", asyncHandler(exportStudents));
router.get("/students", validate(studentListRequestSchema), asyncHandler(students));
router.patch("/students/:id", validate(studentUpdateRequestSchema), asyncHandler(updateStudentRecord));
router.get("/recruiters", validate(recruiterListRequestSchema), asyncHandler(recruiters));
router.patch("/recruiters/:id/approve", validate(idParamsSchema), asyncHandler(approveRecruiterRecord));
router.get("/drives", validate(driveListRequestSchema), asyncHandler(drives));
router.get("/audit-logs", validate(auditLogListRequestSchema), asyncHandler(auditLogs));

export default router;
