const { EntitySchema } = require('typeorm');

const ClientEntity = new EntitySchema({
  name: 'Client',
  tableName: 'clients',
  columns: {
    id: { type: Number, primary: true, generated: true },
    name: { type: String, nullable: false },
    email: { type: String, unique: true, nullable: false },
    phone: { type: String, nullable: true },
    address: { type: String, nullable: true },
    created_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    updated_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    is_deleted: { type: Boolean, default: false, nullable: false },
  },
  relations: {
    pets: {
      target: 'Pet',
      type: 'one-to-many',
      inverseSide: 'client',
    },
  },
});

module.exports = { ClientEntity };