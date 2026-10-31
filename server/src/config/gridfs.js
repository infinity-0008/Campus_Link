import mongoose from "mongoose";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ApiError } from "../utils/ApiError.js";

const BUCKET_NAME = "resumes";
let cachedDb;
let cachedBucket;

function getBucket() {
  const db = mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== 1) {
    throw new ApiError(503, "DATABASE_UNAVAILABLE", "Resume storage is unavailable because the database is not connected.");
  }

  if (cachedDb !== db || !cachedBucket) {
    cachedDb = db;
    cachedBucket = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
  }
  return cachedBucket;
}

export async function storeResumeBuffer(buffer, fileName, metadata = {}) {
  const bucket = getBucket();
  const uploadStream = bucket.openUploadStream(fileName, {
    contentType: "application/pdf",
    metadata: {
      ...metadata,
      contentType: "application/pdf",
      uploadedAt: new Date(),
    },
  });

  await pipeline(Readable.from([buffer]), uploadStream);
  return uploadStream.id;
}

export function openResumeDownloadStream(fileId) {
  return getBucket().openDownloadStream(fileId);
}

export async function readResumeBuffer(fileId) {
  const stream = openResumeDownloadStream(fileId);
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function deleteResumeFile(fileId) {
  if (!fileId) return;
  try {
    await getBucket().delete(fileId);
  } catch (error) {
    // GridFS reports code 26 when the file has already been removed.
    if (error?.code !== 26) throw error;
  }
}
