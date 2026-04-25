//@ts-check
// src/config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PetShop Management API',
      version: '1.0.0',
      description: 'REST API backend for PetShop Management System (Express + TypeORM)',
      contact: {
        name: 'CyberArcenal',
        email: 'dargab1999@gmail.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        // Common response wrapper
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
        // Client entity
        Client: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Juan Dela Cruz' },
            email: { type: 'string', example: 'juan@example.com' },
            phone: { type: 'string', example: '09171234567' },
            address: { type: 'string', example: 'Manila' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            is_deleted: { type: 'boolean', default: false },
          },
        },
        // Pet entity
        Pet: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            client_id: { type: 'integer' },
            name: { type: 'string' },
            species: { type: 'string' },
            breed: { type: 'string', nullable: true },
            birth_date: { type: 'string', format: 'date', nullable: true },
            weight: { type: 'number', format: 'float', nullable: true },
            medical_notes: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            is_deleted: { type: 'boolean', default: false },
          },
        },
        // Product entity
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            category: { type: 'string', nullable: true },
            price: { type: 'number', format: 'float' },
            stock: { type: 'integer' },
            reorder_level: { type: 'integer' },
            description: { type: 'string', nullable: true },
            is_active: { type: 'boolean', default: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            is_deleted: { type: 'boolean', default: false },
          },
        },
        // Appointment entity
        Appointment: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            client_id: { type: 'integer' },
            pet_id: { type: 'integer', nullable: true },
            product_id: { type: 'integer', nullable: true },
            service_type: { type: 'string', enum: ['Grooming', 'VetCheck', 'Training', 'Boarding', 'Other'] },
            appointment_date: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'NoShow'] },
            notes: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            is_deleted: { type: 'boolean', default: false },
          },
        },
        // Sale entity
        Sale: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            client_id: { type: 'integer' },
            appointment_id: { type: 'integer', nullable: true },
            invoice_number: { type: 'string' },
            total_amount: { type: 'number', format: 'float' },
            status: { type: 'string', enum: ['initiated', 'pending', 'paid', 'partially_paid', 'cancelled'] },
            payment_method: { type: 'string', nullable: true },
            payment_date: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            is_deleted: { type: 'boolean', default: false },
          },
        },
        // User entity (authentication)
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            email: { type: 'string' },
            first_name: { type: 'string', nullable: true },
            last_name: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['admin', 'staff', 'manager'] },
            is_active: { type: 'boolean', default: true },
            last_login_at: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            is_deleted: { type: 'boolean', default: false },
          },
        },
        // Authentication responses
        AuthResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/routes/*.js'], // Path to route files with JSDoc comments
};

const specs = swaggerJsdoc(options);
module.exports = { specs };