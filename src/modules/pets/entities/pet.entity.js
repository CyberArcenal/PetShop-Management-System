const { EntitySchema } = require('typeorm');

const PetEntity = new EntitySchema({
  name: 'Pet',
  tableName: 'pets',
  columns: {
    id: { type: Number, primary: true, generated: true },
    client_id: { type: Number, nullable: false },
    name: { type: String, nullable: false },
    species: { type: String, nullable: false },
    breed: { type: String, nullable: true },
    birth_date: { type: Date, nullable: true },
    weight: { type: 'decimal', precision: 5, scale: 2, nullable: true },
    medical_notes: { type: 'text', nullable: true },
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
    appointments: {
      target: 'Appointment',
      type: 'one-to-many',
      inverseSide: 'pet',
    },
  },
});

module.exports = { PetEntity };