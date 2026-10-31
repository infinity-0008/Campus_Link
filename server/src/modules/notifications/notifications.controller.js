import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./notifications.service.js";

export async function list(request, response) {
  const result = await listMyNotifications(request.user, request.validated.query);
  return response.status(200).json({
    success: true,
    data: { notifications: result.data, unreadCount: result.unreadCount },
    meta: result.meta,
  });
}

export async function markRead(request, response) {
  const notification = await markNotificationRead(request.validated.params.id, request.user);
  return response.status(200).json({ success: true, data: { notification } });
}

export async function markAllRead(request, response) {
  const result = await markAllNotificationsRead(request.user);
  return response.status(200).json({ success: true, data: result });
}
