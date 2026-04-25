//@ts-check
// src/app.js
require('reflect-metadata');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const { specs } = require('./config/swagger');
const { AppDataSource } = require('./db/datasource');
const { logger } = require('./common/utils/logger');
const { authenticateToken } = require('./middlewares/auth.middleware');
const { errorHandler } = require('./middlewares/error.middleware');

// Import module routes
const clientRoutes = require('./modules/clients/routes/base.routes');
const petRoutes = require('./modules/pets/routes/base.routes');
const productRoutes = require('./modules/products/routes/base.routes');
const appointmentRoutes = require('./modules/appointments/routes/base.routes');
const saleRoutes = require('./modules/sales/routes/base.routes');
const saleItemRoutes = require('./modules/sales/routes/saleItem.routes');
const authRoutes = require('./modules/auth/routes/base.routes');
const reportRoutes = require('./modules/reports/routes/base.routes');
const notificationRoutes = require('./modules/notifications/routes/notification.routes');
const notificationLogRoutes = require('./modules/notifications/routes/notifylog.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// Middleware
// ------------------------------------------------------------------
// @ts-ignore
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------------------------
// API Routes
// ------------------------------------------------------------------
// Public routes (walang authentication)
app.use('/api/v1/auth', authRoutes);

// Protected routes (kailangan ng valid JWT)
app.use('/api/v1/clients', authenticateToken, clientRoutes);
app.use('/api/v1/pets', authenticateToken, petRoutes);                // idinagdag
app.use('/api/v1/products', authenticateToken, productRoutes);
app.use('/api/v1/appointments', authenticateToken, appointmentRoutes); // idinagdag
app.use('/api/v1/sales', authenticateToken, saleRoutes);
app.use('/api/v1/sale-items', authenticateToken, saleItemRoutes);
app.use('/api/v1/reports', authenticateToken, reportRoutes);
app.use('/api/v1/notifications', authenticateToken, notificationRoutes);
app.use('/api/v1/notification-logs', authenticateToken, notificationLogRoutes);

// ------------------------------------------------------------------
// Health Check & Swagger
// ------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ------------------------------------------------------------------
// 404 Handler
// ------------------------------------------------------------------
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ------------------------------------------------------------------
// Global Error Handler
// ------------------------------------------------------------------
app.use(errorHandler);

// ------------------------------------------------------------------
// Start Server
// ------------------------------------------------------------------
AppDataSource.initialize()
  .then(() => {
    logger.info('Database connected');
    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Swagger UI available at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    logger.error('Database connection error:', err);
    process.exit(1);
  });

module.exports = app;