const { EntitySchema } = require('typeorm');

const NotificationEntity = new EntitySchema({
  name: 'Notification',
  tableName: 'notifications',
  columns: {
    id: { type: Number, primary: true, generated: true },
    userId: { name: 'user_id', type: Number, nullable: true, comment: 'ID of the user who receives this notification' },
    title: { type: String, length: 255, nullable: false },
    message: { type: 'text', nullable: false },
    type: {
      type: 'varchar',
      length: 50,
      nullable: false,
      default: 'info',
      check: "type IN ('info', 'success', 'warning', 'error', 'purchase', 'sale')",
    },
    isRead: { name: 'is_read', type: Boolean, default: false },
    metadata: { type: 'simple-json', nullable: true, comment: 'Additional JSON data' },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true, default: () => 'CURRENT_TIMESTAMP' },
    updatedAt: { name: 'updated_at', type: 'datetime', updateDate: true, nullable: true },
  },
  indices: [
    { name: 'idx_notifications_user_read', columns: ['userId', 'isRead'] },
    { name: 'idx_notifications_created', columns: ['createdAt'] },
  ],
  relations: {
    user: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'user_id' },
      onDelete: 'SET NULL',
    },
  },
});

module.exports = { NotificationEntity };