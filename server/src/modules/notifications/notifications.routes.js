import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { listNotificationsRequestSchema, notificationIdRequestSchema } from "./notifications.validation.js";
import { list, markRead, markAllRead } from "./notifications.controller.js";

const router = Router();
router.use(authenticate);

router.get("/", validate(listNotificationsRequestSchema), asyncHandler(list));
// Keep this static route before /:id/read so it is never interpreted as an id.
router.patch("/read-all", asyncHandler(markAllRead));
router.patch("/:id/read", validate(notificationIdRequestSchema), asyncHandler(markRead));

export default router;
