const { EntitySchema } = require('typeorm');

const SaleItemEntity = new EntitySchema({
  name: 'SaleItem',
  tableName: 'sale_items',
  columns: {
    id: { type: Number, primary: true, generated: true },
    sale_id: { type: Number, nullable: false },
    product_id: { type: Number, nullable: false },
    quantity: { type: Number, nullable: false },
    unit_price: { type: 'decimal', precision: 10, scale: 2, nullable: false },
    total_price: { type: 'decimal', precision: 10, scale: 2, nullable: false },
    created_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    updated_at: { type: Date, default: () => 'CURRENT_TIMESTAMP', nullable: false },
    is_deleted: { type: Boolean, default: false, nullable: false },
  },
  relations: {
    sale: {
      target: 'Sale',
      type: 'many-to-one',
      joinColumn: { name: 'sale_id' },
      onDelete: 'CASCADE',
    },
    product: {
      target: 'Product',
      type: 'many-to-one',
      joinColumn: { name: 'product_id' },
      onDelete: 'RESTRICT',
    },
  },
});

module.exports = { SaleItemEntity };