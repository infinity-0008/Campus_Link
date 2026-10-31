import { Router } from "express";
import { USER_ROLES } from "../../config/constants.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createInterviewRequestSchema,
  myInterviewsRequestSchema,
  interviewCalendarRequestSchema,
  updateInterviewRequestSchema,
} from "./interviews.validation.js";
import { create, listMine, calendar, update } from "./interviews.controller.js";

const router = Router();
router.use(authenticate);

router.post(
  "/",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(createInterviewRequestSchema),
  asyncHandler(create),
);
router.get(
  "/me",
  authorize(USER_ROLES.STUDENT, USER_ROLES.RECRUITER),
  validate(myInterviewsRequestSchema),
  asyncHandler(listMine),
);
router.get(
  "/",
  authorize(USER_ROLES.STUDENT, USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(interviewCalendarRequestSchema),
  asyncHandler(calendar),
);
router.patch(
  "/:id",
  authorize(USER_ROLES.RECRUITER, USER_ROLES.ADMIN),
  validate(updateInterviewRequestSchema),
  asyncHandler(update),
);

export default router;
