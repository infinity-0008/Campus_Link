import mongoose from "mongoose";
import Notification from "../../models/Notification.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, buildPaginationMeta } from "../../utils/pagination.js";

export async function createNotification({ user, type, title, message, link = null }) {
  return Notification.create({ user, type, title, message, link, read: false });
}

export async function createNotifications(items = []) {
  if (!items.length) return [];
  return Notification.insertMany(items.map((item) => ({ ...item, read: false })), { ordered: true });
}

function assertObjectId(value) {
  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, "INVALID_NOTIFICATION_ID", "A valid notification id is required.");
  }
}

/** Return only the authenticated user's notifications. */
export async function listMyNotifications(user, filters) {
  const { page, limit, skip } = getPagination(filters);
  const query = { user: user._id };
  if (filters.unreadOnly === "true") query.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .select("type title message link read createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ user: user._id, read: false }),
  ]);

  return {
    data: notifications,
    unreadCount,
    meta: buildPaginationMeta({ page, limit, total }),
  };
}

/** Ownership is part of the update predicate, so users cannot mark another user's notification. */
export async function markNotificationRead(notificationId, user) {
  assertObjectId(notificationId);
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: user._id },
    { $set: { read: true } },
    { new: true, runValidators: true },
  ).select("type title message link read createdAt updatedAt").lean();

  if (!notification) {
    throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "The requested notification could not be found.");
  }
  return notification;
}

export async function markAllNotificationsRead(user) {
  const result = await Notification.updateMany(
    { user: user._id, read: false },
    { $set: { read: true } },
  );
  return { modifiedCount: result.modifiedCount };
}
