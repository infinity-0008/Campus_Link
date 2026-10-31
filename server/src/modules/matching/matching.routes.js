import { Router } from "express";
import { USER_ROLES } from "../../config/constants.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { matchingPairRequestSchema } from "./matching.validation.js";
import { comparePair, matchPair } from "./matching.controller.js";

const router = Router();
router.use(authenticate);
router.use(authorize(USER_ROLES.STUDENT, USER_ROLES.RECRUITER, USER_ROLES.ADMIN));

router.get("/:jobId/:studentId/compare", validate(matchingPairRequestSchema), asyncHandler(comparePair));
router.get("/:jobId/:studentId", validate(matchingPairRequestSchema), asyncHandler(matchPair));

export default router;
