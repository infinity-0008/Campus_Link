import { Router } from "express";
import { register, login, me } from "./auth.controller.js";
import { registerRequestSchema, loginRequestSchema } from "./auth.validation.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authRateLimiter } from "../../middleware/rateLimiter.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

router.post("/register", authRateLimiter, validate(registerRequestSchema), asyncHandler(register));
router.post("/login", authRateLimiter, validate(loginRequestSchema), asyncHandler(login));
router.get("/me", authenticate, asyncHandler(me));

export default router;
