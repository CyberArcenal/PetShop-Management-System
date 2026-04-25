const { EntitySchema } = require('typeorm');

const AppointmentEntity = new EntitySchema({
  name: 'Appointment',
  tableName: 'appointments',
  columns: {
    id: { type: Number, primary: true, generated: true },
    client_id: { type: Number, nullable: false },
    pet_id: { type: Number, nullable: true },
    product_id: { type: Number, nullable: true },
    service_type: {
      type: String,
      nullable: false,
      check: "service_type IN ('Grooming', 'VetCheck', 'Training', 'Boarding', 'Other')",
    },
    appointment_date: { type: Date, nullable: false },
    status: {
      type: String,
      default: 'Scheduled',
      check: "status IN ('Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'NoShow')",
    },
    notes: { type: 'text', nullable: true },
    created_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    updated_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    is_deleted: { type: Boolean, default: false, nullable: false },
  },
  relations: {
    client: {
      target: 'Client',
      type: 'many-to-one',
      joinColumn: { name: 'client_id' },
      onDelete: 'CASCADE',
    },
    pet: {
      target: 'Pet',
      type: 'many-to-one',
      joinColumn: { name: 'pet_id' },
      onDelete: 'SET NULL',
    },
    product: {
      target: 'Product',
      type: 'many-to-one',
      joinColumn: { name: 'product_id' },
      onDelete: 'SET NULL',
    },
    sale: {
      target: 'Sale',
      type: 'one-to-one',
      inverseSide: 'appointment',
    },
  },
});

module.exports = { AppointmentEntity };