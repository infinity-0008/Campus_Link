import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { loadAccountFromToken } from "../modules/auth/auth.service.js";

export const authenticate = asyncHandler(async (request, response, next) => {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED", "A Bearer access token is required.");
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED", "A Bearer access token is required.");
  }

  request.user = await loadAccountFromToken(token);
  return next();
});
