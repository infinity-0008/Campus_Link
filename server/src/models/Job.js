import mongoose from "mongoose";
import { JOB_STATUSES } from "../config/constants.js";

const { Schema } = mongoose;

const salaryRangeSchema = new Schema({
  min: { type: Number, min: 0, default: null },
  max: { type: Number, min: 0, default: null },
  currency: { type: String, trim: true, default: "INR" },
}, { _id: false });

const eligibilitySchema = new Schema({
  courses: { type: [String], default: [] },
  branches: { type: [String], default: [] },
  minCgpa: { type: Number, min: 0, max: 10, default: null },
  gradYear: { type: Number, min: 1900, max: 2200, default: null },
  maxBacklogs: { type: Number, min: 0, default: 0 },
}, { _id: false });

const jobEmbeddingSkillSchema = new Schema({
  text: { type: String, required: true },
  vector: {
    type: [Number],
    validate: {
      validator: (vector) => vector.length === 384,
      message: "Skill embedding vectors must contain exactly 384 dimensions.",
    },
  },
}, { _id: false });

const jobEmbeddingsSchema = new Schema({
  model: String,
  version: String,
  skills: { type: [jobEmbeddingSkillSchema], default: [] },
  doc: {
    type: [Number],
    validate: {
      validator: (vector) => vector.length === 384,
      message: "Document embeddings must contain exactly 384 dimensions.",
    },
  },
  updatedAt: Date,
}, { _id: false });

const jobSchema = new Schema({
  recruiter: { type: Schema.Types.ObjectId, ref: "User", required: true },
  company: { type: String, required: true, trim: true, maxlength: 180 },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, required: true, trim: true, maxlength: 20000 },
  location: { type: String, required: true, trim: true, maxlength: 180 },
  type: { type: String, enum: ["full_time", "internship"], required: true },
  salaryRange: { type: salaryRangeSchema, default: () => ({}) },
  requiredSkills: { type: [String], default: [] },
  eligibility: { type: eligibilitySchema, default: () => ({}) },
  status: {
    type: String,
    enum: Object.values(JOB_STATUSES),
    default: JOB_STATUSES.DRAFT,
  },
  deadline: { type: Date, default: null },
  driveDate: { type: Date, default: null },
  embeddings: { type: jobEmbeddingsSchema, default: undefined, select: false },
}, { timestamps: true });

jobSchema.index({ status: 1 });
jobSchema.index({ company: 1 });
jobSchema.index({ location: 1 });
jobSchema.index({ title: "text", description: "text", requiredSkills: "text" });

const Job = mongoose.models.Job || mongoose.model("Job", jobSchema);
export default Job;
