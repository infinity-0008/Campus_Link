import { Router } from "express";
import { USER_ROLES } from "../../config/constants.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  myApplicationsRequestSchema,
  changeApplicationStatusRequestSchema,
  applicationIdRequestSchema,
} from "./application.validation.js";
import { listMine, changeStatus, aiSummary } from "./applications.controller.js";

const router = Router();
router.use(authenticate);

router.get("/me", authorize(USER_ROLES.STUDENT), validate(myApplicationsRequestSchema), asyncHandler(listMine));
router.patch(
  "/:id/status",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(changeApplicationStatusRequestSchema),
  asyncHandler(changeStatus),
);
router.get(
  "/:id/ai-summary",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(applicationIdRequestSchema),
  asyncHandler(aiSummary),
);

export default router;
