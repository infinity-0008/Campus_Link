import { ApiError } from "../utils/ApiError.js";

/** Restrict a route to one or more authenticated account roles. */
export function authorize(...allowedRoles) {
  if (allowedRoles.length === 0) {
    throw new TypeError("authorize() requires at least one allowed role.");
  }

  return function authorizeRequest(request, response, next) {
    if (!request.user) {
      return next(new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required."));
    }

    if (!allowedRoles.includes(request.user.role)) {
      return next(new ApiError(403, "FORBIDDEN", "You do not have permission to access this resource."));
    }

    return next();
  };
}
