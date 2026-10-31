import mongoose from "mongoose";

const recruiterProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  company: { type: String, trim: true, default: null, maxlength: 180 },
  designation: { type: String, trim: true, default: null, maxlength: 160 },
  website: { type: String, trim: true, default: null, maxlength: 500 },
}, { timestamps: true });


const RecruiterProfile = mongoose.models.RecruiterProfile || mongoose.model("RecruiterProfile", recruiterProfileSchema);
export default RecruiterProfile;
