const { EntitySchema } = require('typeorm');

const ReportLogEntity = new EntitySchema({
  name: 'ReportLog',
  tableName: 'report_logs',
  columns: {
    id: { type: Number, primary: true, generated: true },
    report_name: { type: String, nullable: false },
    parameters: { type: 'json', nullable: true },
    generated_by: { type: Number, nullable: true },
    generated_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    file_path: { type: String, nullable: true },
    data_summary: { type: 'text', nullable: true },
    created_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    updated_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    is_deleted: { type: Boolean, default: false, nullable: false },
  },
  relations: {
    user: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'generated_by' },
      onDelete: 'SET NULL',
    },
  },
});

module.exports = { ReportLogEntity };