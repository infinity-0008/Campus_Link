import { Router } from "express";
import { USER_ROLES } from "../../config/constants.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { analyticsRequestSchema, driveReportRequestSchema, driveReportExportRequestSchema } from "./analytics.validation.js";
import { overview, skillsDemand, placements, driveReport, exportDriveReport, exportOverviewReport } from "./analytics.controller.js";

const router = Router();
router.use(authenticate, authorize(USER_ROLES.ADMIN, USER_ROLES.RECRUITER));

router.get("/overview", validate(analyticsRequestSchema), asyncHandler(overview));
router.get("/skills-demand", asyncHandler(skillsDemand));
router.get("/placements", validate(analyticsRequestSchema), asyncHandler(placements));
router.get("/reports/overview/export.csv", authorize(USER_ROLES.ADMIN), asyncHandler(exportOverviewReport));
router.get("/reports/drive/:jobId/export.csv", validate(driveReportExportRequestSchema), asyncHandler(exportDriveReport));
router.get("/reports/drive/:jobId", validate(driveReportRequestSchema), asyncHandler(driveReport));

export default router;
