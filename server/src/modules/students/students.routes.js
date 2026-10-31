import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { uploadResume } from "../../middleware/upload.js";
import { USER_ROLES } from "../../config/constants.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  getMyProfile,
  updateMyProfile,
  uploadMyResume,
  reparseMyResume,
  downloadMyResume,
  getStudentById,
  downloadApplicantResume,
} from "./students.controller.js";
import { updateStudentProfileSchema } from "./students.validation.js";
import { applicationIdRequestSchema } from "../applications/application.validation.js";

const router = Router();
router.use(authenticate);

// Own-profile routes are intentionally registered before /:id routes.
router.get("/me", authorize(USER_ROLES.STUDENT), asyncHandler(getMyProfile));
router.put("/me", authorize(USER_ROLES.STUDENT), validate(updateStudentProfileSchema), asyncHandler(updateMyProfile));
router.post("/me/resume", authorize(USER_ROLES.STUDENT), uploadResume, asyncHandler(uploadMyResume));
router.get("/me/resume", authorize(USER_ROLES.STUDENT), asyncHandler(downloadMyResume));
router.post("/me/resume/reparse", authorize(USER_ROLES.STUDENT), asyncHandler(reparseMyResume));

// A recruiter must have an application to one of their own jobs before seeing
// this student's profile or resume. Admin access is global and backend-checked.
router.get(
  "/:id/resume",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(applicationIdRequestSchema),
  asyncHandler(downloadApplicantResume),
);
router.get(
  "/:id",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(applicationIdRequestSchema),
  asyncHandler(getStudentById),
);

export default router;
