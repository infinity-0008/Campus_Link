import mongoose from "mongoose";
import { USER_ROLES, USER_STATUSES } from "../config/constants.js";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    required: true,
    immutable: true,
  },
  status: {
    type: String,
    enum: Object.values(USER_STATUSES),
    required: true,
    default: USER_STATUSES.ACTIVE,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
  toJSON: {
    transform(_document, returned) {
      delete returned.passwordHash;
      delete returned.__v;
      return returned;
    },
  },
});


const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
