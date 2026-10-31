import { ApiError } from "../utils/ApiError.js";

/**
 * Validate any combination of request body, query and route parameters.
 * Parsed values are made available at request.validated.{body, query, params}.
 */
export function validate(schemas) {
  // If a Zod object schema is passed directly (e.g. z.object({ body, query, params }))
  // unwrap its .shape so we can iterate over body/query/params keys.
  const schemaMap = (schemas && typeof schemas === "object" && typeof schemas.safeParse === "function")
    ? schemas.shape ?? {}
    : schemas;

  return function validateRequest(request, response, next) {
    const validated = {};

    for (const key of ["body", "query", "params"]) {
      const schema = schemaMap[key];
      if (!schema) continue;

      const result = schema.safeParse(request[key]);
      if (!result.success) {
        return next(new ApiError(
          400,
          "VALIDATION_ERROR",
          `Invalid request ${key}.`,
          result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        ));
      }
      validated[key] = result.data;
    }

    request.validated = validated;
    return next();
  };
}
