/**
 * Notification System - 通知系统
 *
 * 存储和获取定时任务到期的通知
 */

export interface Notification {
  id: string;
  type: 'cron' | 'system' | 'message';
  title: string;
  content: string;
  createdAt: number;
  read: boolean;
}

// 内存存储通知
const notifications: Map<string, Notification> = new Map();

// 最大存储通知数
const MAX_NOTIFICATIONS = 100;

export const notificationSystem = {
  /**
   * 添加通知
   */
  add(type: Notification['type'], title: string, content: string): Notification {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notification: Notification = {
      id,
      type,
      title,
      content,
      createdAt: Date.now(),
      read: false,
    };

    notifications.set(id, notification);

    // 清理旧通知
    if (notifications.size > MAX_NOTIFICATIONS) {
      const sorted = Array.from(notifications.values())
        .sort((a, b) => a.createdAt - b.createdAt);
      const toRemove = sorted.slice(0, notifications.size - MAX_NOTIFICATIONS);
      for (const n of toRemove) {
        notifications.delete(n.id);
      }
    }

    console.log(`[Notification] Added: ${title}`);
    return notification;
  },

  /**
   * 获取所有未读通知
   */
  getUnread(): Notification[] {
    return Array.from(notifications.values())
      .filter(n => !n.read)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * 获取所有通知
   */
  getAll(limit: number = 50): Notification[] {
    return Array.from(notifications.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },

  /**
   * 标记为已读
   */
  markAsRead(id: string): boolean {
    const notification = notifications.get(id);
    if (!notification) return false;
    notification.read = true;
    return true;
  },

  /**
   * 全部标记为已读
   */
  markAllAsRead(): number {
    let count = 0;
    for (const notification of notifications.values()) {
      if (!notification.read) {
        notification.read = true;
        count++;
      }
    }
    return count;
  },

  /**
   * 获取未读数量
   */
  getUnreadCount(): number {
    return Array.from(notifications.values()).filter(n => !n.read).length;
  },
};
