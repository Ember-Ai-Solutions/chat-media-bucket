const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const logger = require('./config/logger');
const environment = require('./config/environment');

const app = express();
const PORT = environment.port;
const BASE_URL = environment.baseUrl;
const VOLUME_PATH = environment.volumePath;

logger.info('Starting application', { volumePath: VOLUME_PATH });

fs.readdir(path.join(__dirname, '..'), { withFileTypes: true }, (err, entries) => {
  if (err) {
    logger.error('Error reading project root directory', { error: err.message });
    return;
  }

  const directories = entries
    .filter(entry => entry.isDirectory())
    .map(dir => dir.name);

  logger.info('Project root directory structure', {
    basePath: path.join(__dirname, '..'),
    directories: directories
  });
});


function authenticate(req, res, next) {
  const token = req.headers['authorization'];
  if (token === `Bearer ${environment.authToken}`) {
    next();
  } else {
    logger.warn('Unauthorized access attempt', { ip: req.ip });
    res.status(401).json({ error: 'Unauthorized' });
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const clientId = req.headers['x-client-id'] || req.query.clientId;

    if (!clientId) {
      logger.error('Missing clientId in request');
      return cb(new Error('clientId is required (use x-client-id header or query param)'));
    }

    const dir = path.join(__dirname, VOLUME_PATH, clientId);
    fs.mkdirSync(dir, { recursive: true });
    req.clientId = clientId;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage });

// Swagger setup
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Upload API',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./app.js'],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload file
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-client-id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded successfully
 */
app.post('/upload', authenticate, upload.single('file'), (req, res) => {
  const file = req.file;
  const clientId = req.clientId;
  logger.info('File uploaded successfully', { clientId, filename: file.filename });
  res.json({ filePath: `${BASE_URL}/files/${clientId}/${file.filename}` });
});

/**
 * @swagger
 * /delete:
 *   delete:
 *     summary: Delete file
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File deleted
 */
app.delete('/delete', authenticate, (req, res) => {
  const { clientId, filename } = req.query;
  const filePath = path.join(__dirname, VOLUME_PATH, clientId, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    logger.info('File deleted successfully', { clientId, filename });
    res.json({ message: 'File successfully deleted' });
  } else {
    logger.warn('File not found for deletion', { clientId, filename });
    res.status(404).json({ error: 'File not found' });
  }
});

/**
 * @swagger
 * /files/{clientId}/{filename}:
 *   get:
 *     summary: Get file
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File returned
 */
app.use('/files', express.static(path.join(__dirname, VOLUME_PATH)));

app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, swaggerUrl: `${BASE_URL}/api-docs` });
});