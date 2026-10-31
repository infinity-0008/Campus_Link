import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_RESUME_MB * 1024 * 1024,
    files: 1,
    fields: 10,
    parts: 12,
  },
});

/** Multer's errors are translated into CampusLink's standard API envelope. */
export function uploadResume(request, response, next) {
  upload.single("resume")(request, response, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(
        413,
        "RESUME_TOO_LARGE",
        `Resume exceeds the maximum allowed size of ${env.MAX_RESUME_MB} MB.`,
      ));
    }

    if (error instanceof multer.MulterError) {
      return next(new ApiError(400, "INVALID_UPLOAD", error.message));
    }

    return next(error);
  });
}

export function validateResumeFile(file) {
  if (!file) {
    throw new ApiError(400, "RESUME_REQUIRED", "Attach a PDF resume using the 'resume' form field.");
  }

  const hasPdfExtension = typeof file.originalname === "string" && file.originalname.toLowerCase().endsWith(".pdf");
  const hasPdfMimeType = file.mimetype === "application/pdf";
  const hasPdfMagicBytes = Buffer.isBuffer(file.buffer)
    && file.buffer.length >= 5
    && file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";

  if (!hasPdfExtension || !hasPdfMimeType || !hasPdfMagicBytes) {
    throw new ApiError(415, "UNSUPPORTED_RESUME_FORMAT", "Only valid PDF files are accepted.");
  }
}
