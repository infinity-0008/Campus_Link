import mongoose from "mongoose";
import { USER_ROLES } from "../config/constants.js";

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  actorRole: { type: String, enum: Object.values(USER_ROLES), required: true },
  action: { type: String, required: true, trim: true, maxlength: 120 },
  targetType: { type: String, required: true, trim: true, maxlength: 100 },
  targetId: { type: mongoose.Schema.Types.Mixed, default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: null, maxlength: 100 },
}, { timestamps: true });

auditLogSchema.index({ actor: 1, createdAt: -1 });

auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, createdAt: -1 });
auditLogSchema.index({ actorRole: 1, createdAt: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
