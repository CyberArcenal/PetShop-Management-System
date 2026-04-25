const { EntitySchema } = require('typeorm');

const ProductEntity = new EntitySchema({
  name: 'Product',
  tableName: 'products',
  columns: {
    id: { type: Number, primary: true, generated: true },
    name: { type: String, nullable: false },
    category: { type: String, nullable: true },
    price: { type: 'decimal', precision: 10, scale: 2, nullable: false },
    stock: { type: Number, default: 0, nullable: false },
    reorder_level: { type: Number, default: 5, nullable: false },
    description: { type: 'text', nullable: true },
    is_active: { type: Boolean, default: true, nullable: false },
    created_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    updated_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    is_deleted: { type: Boolean, default: false, nullable: false },
  },
  relations: {
    saleItems: {
      target: 'SaleItem',
      type: 'one-to-many',
      inverseSide: 'product',
    },
    appointments: {
      target: 'Appointment',
      type: 'one-to-many',
      inverseSide: 'product',
    },
  },
});

module.exports = { ProductEntity };