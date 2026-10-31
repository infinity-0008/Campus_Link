import { Router } from "express";
import { USER_ROLES } from "../../config/constants.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createJobRequestSchema,
  updateJobRequestSchema,
  jobIdRequestSchema,
  listJobsRequestSchema,
  suggestSkillsRequestSchema,
} from "./jobs.validation.js";
import { matchingJobFitRequestSchema, recommendedJobsRequestSchema } from "../matching/matching.validation.js";
import {
  applyToJobRequestSchema,
  applicantListRequestSchema,
  bulkShortlistRequestSchema,
} from "../applications/application.validation.js";
import {
  apply,
  listForJob,
  bulkShortlist,
  exportForJob,
} from "../applications/applications.controller.js";
import {
  create,
  list,
  getById,
  eligibility,
  update,
  publish,
  close,
  removeDraft,
  suggestSkills,
  fit,
  recommended,
} from "./jobs.controller.js";

const router = Router();
router.use(authenticate);

// Static routes must be registered before /:id.
router.post(
  "/ai/suggest-skills",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(suggestSkillsRequestSchema),
  asyncHandler(suggestSkills),
);

router.get(
  "/recommended",
  authorize(USER_ROLES.STUDENT),
  validate(recommendedJobsRequestSchema),
  asyncHandler(recommended),
);
router.get("/", validate(listJobsRequestSchema), asyncHandler(list));

router.post(
  "/:id/apply",
  authorize(USER_ROLES.STUDENT),
  validate(applyToJobRequestSchema),
  asyncHandler(apply),
);
router.get(
  "/:id/applications/export.csv",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(applicantListRequestSchema),
  asyncHandler(exportForJob),
);
router.patch(
  "/:id/applications/bulk-shortlist",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(bulkShortlistRequestSchema),
  asyncHandler(bulkShortlist),
);
router.get(
  "/:id/applications",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(applicantListRequestSchema),
  asyncHandler(listForJob),
);
router.post(
  "/",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(createJobRequestSchema),
  asyncHandler(create),
);
router.get(
  "/:id/fit",
  authorize(USER_ROLES.STUDENT),
  validate(matchingJobFitRequestSchema),
  asyncHandler(fit),
);
router.get(
  "/:id/eligibility",
  authorize(USER_ROLES.STUDENT),
  validate(jobIdRequestSchema),
  asyncHandler(eligibility),
);
router.get("/:id", validate(jobIdRequestSchema), asyncHandler(getById));
router.put(
  "/:id",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(updateJobRequestSchema),
  asyncHandler(update),
);
router.patch(
  "/:id/publish",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(jobIdRequestSchema),
  asyncHandler(publish),
);
router.patch(
  "/:id/close",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(jobIdRequestSchema),
  asyncHandler(close),
);
router.delete(
  "/:id",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(jobIdRequestSchema),
  asyncHandler(removeDraft),
);

export default router;
