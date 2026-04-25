const { EntitySchema } = require('typeorm');

const SaleEntity = new EntitySchema({
  name: 'Sale',
  tableName: 'sales',
  columns: {
    id: { type: Number, primary: true, generated: true },
    client_id: { type: Number, nullable: false },
    appointment_id: { type: Number, nullable: true },
    invoice_number: { type: String, unique: true, nullable: false },
    total_amount: { type: 'decimal', precision: 10, scale: 2, nullable: false },
    status: {
      type: String,
      default: 'Pending',
      check: "status IN ('initiated', 'pending', 'paid', 'partially_paid', 'cancelled')",
    },
    payment_method: { type: String, nullable: true },
    payment_date: { type: Date, nullable: true },
    created_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    updated_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    is_deleted: { type: Boolean, default: false, nullable: false },
  },
  relations: {
    client: {
      target: 'Client',
      type: 'many-to-one',
      joinColumn: { name: 'client_id' },
      onDelete: 'RESTRICT',
    },
    appointment: {
      target: 'Appointment',
      type: 'one-to-one',
      joinColumn: { name: 'appointment_id' },
      onDelete: 'SET NULL',
    },
    items: {
      target: 'SaleItem',
      type: 'one-to-many',
      inverseSide: 'sale',
    },
  },
});

module.exports = { SaleEntity };