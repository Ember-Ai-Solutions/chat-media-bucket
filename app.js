const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL;

// Middleware de autenticação
function authenticate(req, res, next) {
  const token = req.headers['authorization'];
  if (token === `Bearer ${process.env.AUTH_TOKEN}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Multer configurado com clientId vindo do header ou query param
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const clientId = req.headers['x-client-id'] || req.query.clientId;

    if (!clientId) {
      return cb(new Error('clientId is required (use x-client-id header or query param)'));
    }

    const dir = path.join(__dirname, 'uploads', clientId);
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

// Swagger com segurança
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
 *     summary: Upload de arquivo
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
 *         description: Arquivo salvo com sucesso
 */
app.post('/upload', authenticate, upload.single('file'), (req, res) => {
  const file = req.file;
  const clientId = req.clientId;
  res.json({ filePath: `${BASE_URL}/files/${clientId}/${file.filename}` });
});

/**
 * @swagger
 * /delete:
 *   delete:
 *     summary: Deletar arquivo
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
 *         description: Arquivo deletado
 */
app.delete('/delete', authenticate, (req, res) => {
  const { clientId, filename } = req.query;
  const filePath = path.join(__dirname, 'uploads', clientId, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ message: 'Arquivo deletado com sucesso' });
  } else {
    res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

/**
 * @swagger
 * /files/{clientId}/{filename}:
 *   get:
 *     summary: Obter arquivo
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
 *         description: Arquivo retornado
 */
app.use('/files', express.static(path.join(__dirname, 'uploads')));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger at ${BASE_URL}/api-docs`);
});
