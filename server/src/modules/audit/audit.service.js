import AuditLog from "../../models/AuditLog.js";

export async function writeAuditLog({ actor, actorRole, action, targetType, targetId, meta = {}, ip = null }) {
  return AuditLog.create({ actor, actorRole, action, targetType, targetId, meta, ip });
}

export async function writeAuditLogs(items = []) {
  if (!items.length) return [];
  return AuditLog.insertMany(items, { ordered: true });
}
