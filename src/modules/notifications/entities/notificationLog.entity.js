const { EntitySchema } = require('typeorm');

const NotificationLogEntity = new EntitySchema({
  name: 'NotificationLog',
  tableName: 'notification_logs',
  columns: {
    id: { primary: true, type: 'int', generated: true },
    recipient_email: { type: 'varchar', nullable: false },
    subject: { type: 'varchar', nullable: true },
    payload: { type: 'text', nullable: true },
    status: {
      type: 'varchar',
      length: 20,
      default: 'queued',
      check: "status IN ('queued', 'sent', 'failed', 'resend')",
    },
    error_message: { type: 'text', nullable: true },
    retry_count: { type: 'int', default: 0 },
    resend_count: { type: 'int', default: 0 },
    sent_at: { type: 'datetime', nullable: true },
    last_error_at: { type: 'datetime', nullable: true },
    created_at: { type: 'datetime', createDate: true, default: () => 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'datetime', updateDate: true },
  },
  indices: [
    { name: 'IDX_notification_status', columns: ['status'] },
    { name: 'IDX_notification_recipient', columns: ['recipient_email'] },
    { name: 'IDX_notification_status_created', columns: ['status', 'created_at'] },
  ],
});

module.exports = { NotificationLogEntity };