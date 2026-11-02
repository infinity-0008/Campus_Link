import mongoose from "mongoose";

const { Schema } = mongoose;

const projectSchema = new Schema({
  title: { type: String, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 5000 },
  techStack: { type: [String], default: [] },
}, { _id: true });

const experienceSchema = new Schema({
  company: { type: String, trim: true, maxlength: 160 },
  role: { type: String, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 5000 },
  startDate: { type: Date },
  endDate: { type: Date },
}, { _id: true });

const extractionProjectSchema = new Schema({
  title: String,
  description: String,
  techStack: { type: [String], default: [] },
}, { _id: false });

const extractionExperienceSchema = new Schema({
  company: String,
  role: String,
  description: String,
  startDate: String,
  endDate: String,
}, { _id: false });

const aiExtractionSchema = new Schema({
  skills: { type: [String], default: [] },
  projects: { type: [extractionProjectSchema], default: [] },
  experience: { type: [extractionExperienceSchema], default: [] },
  education: { type: [Schema.Types.Mixed], default: [] },
  model: { type: String, default: null },
  promptVersion: { type: String, default: null },
  fallbackUsed: { type: Boolean, default: false },
}, { _id: false });

const resumeSchema = new Schema({
  fileId: { type: Schema.Types.ObjectId, default: null },
  fileName: { type: String, trim: true, default: null },
  uploadedAt: { type: Date, default: null },
  parsedText: { type: String, default: "" },
  parsedSkills: { type: [String], default: [] },
  parseStatus: {
    type: String,
    enum: ["none", "ok", "failed"],
    default: "none",
  },
  parseError: { type: String, default: null },
  aiExtraction: { type: aiExtractionSchema, default: undefined },
}, { _id: false });

const embeddingItemSchema = new Schema({
  kind: { type: String, enum: ["skill", "project", "experience"], required: true },
  text: { type: String, required: true },
  vector: {
    type: [Number],
    validate: {
      validator: (vector) => vector.length === 384,
      message: "Embedding vectors must contain exactly 384 dimensions.",
    },
  },
}, { _id: false });

const embeddingsSchema = new Schema({
  model: String,
  version: String,
  items: { type: [embeddingItemSchema], default: [] },
  doc: {
    type: [Number],
    validate: {
      validator: (vector) => vector.length === 384,
      message: "Document embeddings must contain exactly 384 dimensions.",
    },
  },
  updatedAt: Date,
}, { _id: false });

const studentProfileSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  rollNo: { type: String, trim: true, default: null },
  branch: { type: String, trim: true, default: null },
  cgpa: { type: Number, min: 0, max: 10, default: null },
  cgpaSemester: { type: Number, min: 1, max: 12, default: null },
  gradYear: { type: Number, min: 1900, max: 2200, default: null },
  backlogs: { type: Number, min: 0, default: 0, validate: Number.isInteger },
  phone: { type: String, trim: true, default: null },
  skills: { type: [String], default: [] },
  projects: { type: [projectSchema], default: [] },
  experience: { type: [experienceSchema], default: [] },
  resume: { type: resumeSchema, default: () => ({}) },
  // Vectors are excluded from ordinary reads; matching code must opt in explicitly.
  embeddings: { type: embeddingsSchema, default: undefined, select: false },
}, { timestamps: true });

studentProfileSchema.index({ branch: 1 });
studentProfileSchema.index({ cgpa: 1 });
studentProfileSchema.index({ gradYear: 1 });

const StudentProfile = mongoose.models.StudentProfile || mongoose.model("StudentProfile", studentProfileSchema);
export default StudentProfile;
