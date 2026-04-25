const { EntitySchema } = require('typeorm');

const UserEntity = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    id: { type: Number, primary: true, generated: true },
    username: { type: String, unique: true, nullable: false },
    email: { type: String, unique: true, nullable: false },
    password_hash: { type: String, nullable: false },
    first_name: { type: String, nullable: true },
    last_name: { type: String, nullable: true },
    role: {
      type: String,
      default: 'staff',
      check: "role IN ('admin', 'staff', 'manager')",
    },
    is_active: { type: Boolean, default: true, nullable: false },
    last_login_at: { type: Date, nullable: true },
    created_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    updated_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    is_deleted: { type: Boolean, default: false, nullable: false },
  },
  relations: {
    reportLogs: {
      target: 'ReportLog',
      type: 'one-to-many',
      inverseSide: 'user',
    },
  },
});

module.exports = { UserEntity };