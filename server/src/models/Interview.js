import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  scheduledAt: { type: Date, required: true },
  durationMins: { type: Number, required: true, min: 1, max: 1440 },
  mode: { type: String, enum: ["online", "onsite"], required: true },
  location: { type: String, trim: true, default: null },
  link: { type: String, trim: true, default: null },
  status: {
    type: String,
    enum: ["scheduled", "completed", "cancelled", "rescheduled"],
    default: "scheduled",
  },
  notes: { type: String, trim: true, default: "", maxlength: 5000 },
}, { timestamps: true });

interviewSchema.index({ scheduledAt: 1 });
interviewSchema.index({ recruiter: 1, scheduledAt: 1, status: 1 });
interviewSchema.index({ student: 1, scheduledAt: 1, status: 1 });
interviewSchema.index({ application: 1, status: 1 });

const Interview = mongoose.models.Interview || mongoose.model("Interview", interviewSchema);
export default Interview;
