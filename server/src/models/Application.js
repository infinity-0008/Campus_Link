import mongoose from "mongoose";
import { APPLICATION_STATUSES } from "../config/constants.js";

const { Schema } = mongoose;

const eligibilityFailureSchema = new Schema({
  rule: { type: String, required: true },
  required: { type: Schema.Types.Mixed, default: null },
  actual: { type: Schema.Types.Mixed, default: null },
  message: { type: String, required: true },
}, { _id: false });

const statusHistorySchema = new Schema({
  from: { type: String, enum: Object.values(APPLICATION_STATUSES), default: null },
  to: { type: String, enum: Object.values(APPLICATION_STATUSES), required: true },
  by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  note: { type: String, trim: true, default: "" },
  at: { type: Date, default: Date.now },
}, { _id: false });

const aiSummarySchema = new Schema({
  text: { type: String, default: "" },
  model: { type: String, default: null },
  promptVersion: { type: String, default: null },
  gapAdvice: { type: String, default: "" },
  fallbackUsed: { type: Boolean, default: false },
  generatedAt: { type: Date, default: null },
}, { _id: false });

const applicationSchema = new Schema({
  job: { type: Schema.Types.ObjectId, ref: "Job", required: true },
  student: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: {
    type: String,
    enum: Object.values(APPLICATION_STATUSES),
    default: APPLICATION_STATUSES.APPLIED,
  },
  matchScore: { type: Number, min: 0, max: 100, default: null },
  matchBreakdown: { type: Schema.Types.Mixed, default: {} },
  eligibilitySnapshot: {
    eligible: { type: Boolean, required: true, default: true },
    failures: { type: [eligibilityFailureSchema], default: [] },
  },
  statusHistory: { type: [statusHistorySchema], default: [] },
  resumeVersion: { type: Schema.Types.ObjectId, default: null },
  aiSummary: { type: aiSummarySchema, default: undefined },
}, { timestamps: true });

applicationSchema.index({ job: 1, student: 1 }, { unique: true });
applicationSchema.index({ job: 1, status: 1 });
applicationSchema.index({ job: 1, matchScore: -1, createdAt: -1 });
applicationSchema.index({ student: 1, createdAt: -1 });
applicationSchema.index({ student: 1, status: 1, createdAt: -1 });

const Application = mongoose.models.Application || mongoose.model("Application", applicationSchema);
export default Application;
