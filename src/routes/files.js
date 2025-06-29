const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const environment = require('../config/environment');
const { validateFilename, validateFileUpload } = require('../middleware/validation');

const router = express.Router();
const VOLUME_PATH = environment.volumePath;
const BASE_URL = environment.baseUrl;

function authenticate(req, res, next) {
  try {
    const token = req.headers['authorization'];
    if (!token) {
      logger.warn('Missing authorization header', { ip: req.ip, url: req.url });
      return res.status(401).json({ 
        error: 'Missing authorization',
        message: 'Authorization header is required'
      });
    }

    if (token !== `Bearer ${environment.authToken}`) {
      logger.warn('Invalid authorization token', { ip: req.ip, url: req.url });
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Invalid authorization token'
      });
    }

    next();
  } catch (error) {
    logger.error('Authentication error', { error: error.message, ip: req.ip });
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dir = path.join(__dirname, '..', VOLUME_PATH);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (error) {
      logger.error('Error creating directory', { 
        error: error.message, 
        path: path.join(__dirname, '..', VOLUME_PATH)
      });
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      const ext = path.extname(file.originalname);
      const filename = `${uuidv4()}${ext}`;
      logger.info('Generated filename', { originalname: file.originalname, filename });
      cb(null, filename);
    } catch (error) {
      logger.error('Error generating filename', { error: error.message, originalname: file.originalname });
      cb(error);
    }
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/json',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      logger.warn('File type rejected', { 
        mimetype: file.mimetype, 
        originalname: file.originalname,
        ip: req.ip
      });
      return cb(new Error('Unsupported file type'), false);
    }

    cb(null, true);
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     FileUploadResponse:
 *       type: object
 *       properties:
 *         filePath:
 *           type: string
 *           description: Complete URL to access the uploaded file
 *           example: "http://localhost:3000/files/123e4567-e89b-12d3-a456-426614174000.jpg"
 *         filename:
 *           type: string
 *           description: Generated unique filename
 *           example: "123e4567-e89b-12d3-a456-426614174000.jpg"
 *         originalname:
 *           type: string
 *           description: Original filename from the uploaded file
 *           example: "photo.jpg"
 *         size:
 *           type: integer
 *           description: File size in bytes
 *           example: 1024000
 *         mimetype:
 *           type: string
 *           description: MIME type of the file
 *           example: "image/jpeg"
 *     FileDeleteResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Success message
 *           example: "File successfully deleted"
 *         filename:
 *           type: string
 *           description: Name of the deleted file
 *           example: "123e4567-e89b-12d3-a456-426614174000.jpg"
 *         size:
 *           type: integer
 *           description: Size of the deleted file in bytes
 *           example: 1024000
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error type
 *           example: "File not found"
 *         message:
 *           type: string
 *           description: Detailed error message
 *           example: "The specified file does not exist"
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       description: Bearer token for API authentication
 */

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload a file to the server
 *     description: |
 *       Upload a single file to the server. The file will be stored with a unique UUID filename.
 *       
 *       **Supported file types:**
 *       - Images: JPEG, PNG, GIF, WebP
 *       - Documents: PDF, TXT, JSON, CSV
 *       - Spreadsheets: XLS, XLSX
 *       
 *       **File size limit:** 10MB
 *       
 *       **Authentication:** Bearer token required
 *     tags:
 *       - File Management
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (max 10MB)
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileUploadResponse'
 *             example:
 *               filePath: "http://localhost:3000/files/123e4567-e89b-12d3-a456-426614174000.jpg"
 *               filename: "123e4567-e89b-12d3-a456-426614174000.jpg"
 *               originalname: "vacation_photo.jpg"
 *               size: 2048576
 *               mimetype: "image/jpeg"
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               noFile:
 *                 summary: No file uploaded
 *                 value:
 *                   error: "No file uploaded"
 *                   message: "Please select a file to upload"
 *               unsupportedType:
 *                 summary: Unsupported file type
 *                 value:
 *                   error: "Unsupported file type"
 *                   message: "The uploaded file type is not supported"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingToken:
 *                 summary: Missing authorization header
 *                 value:
 *                   error: "Missing authorization"
 *                   message: "Authorization header is required"
 *               invalidToken:
 *                 summary: Invalid token
 *                 value:
 *                   error: "Invalid token"
 *                   message: "Invalid authorization token"
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "File too large"
 *               message: "The uploaded file exceeds the maximum allowed size"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Upload failed"
 *               message: "An error occurred while processing the upload"
 */
router.post('/upload', 
  authenticate, 
  upload.single('file'), 
  validateFileUpload,
  (req, res) => {
    try {
      const file = req.file;
      
      logger.info('File uploaded successfully', { 
        filename: file.filename,
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      });
      
      res.json({ 
        filePath: `${BASE_URL}/files/${file.filename}`,
        filename: file.filename,
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      });
    } catch (error) {
      logger.error('Error in upload handler', { error: error.message });
      res.status(500).json({ 
        error: 'Upload failed',
        message: 'An error occurred while processing the upload'
      });
    }
  }
);

/**
 * @swagger
 * /delete:
 *   delete:
 *     summary: Delete a file from the server
 *     description: |
 *       Delete a specific file from the server using its filename.
 *       
 *       **Note:** This operation is irreversible. The file will be permanently deleted.
 *       
 *       **Authentication:** Bearer token required
 *     tags:
 *       - File Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the file to delete
 *         example: "123e4567-e89b-12d3-a456-426614174000.jpg"
 *     responses:
 *       200:
 *         description: File deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileDeleteResponse'
 *             example:
 *               message: "File successfully deleted"
 *               filename: "123e4567-e89b-12d3-a456-426614174000.jpg"
 *               size: 2048576
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Missing required parameter"
 *               message: "filename is required"
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Invalid token"
 *               message: "Invalid authorization token"
 *       403:
 *         description: Forbidden - permission denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Permission denied"
 *               message: "Access to the file is denied"
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "File not found"
 *               message: "The specified file does not exist"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Delete failed"
 *               message: "An error occurred while deleting the file"
 */
router.delete('/delete', 
  authenticate, 
  validateFilename,
  (req, res) => {
    try {
      const filename = req.filename;
      const filePath = path.join(__dirname, '..', VOLUME_PATH, filename);

      if (!fs.existsSync(filePath)) {
        logger.warn('File not found for deletion', { filename, ip: req.ip });
        return res.status(404).json({ 
          error: 'File not found',
          message: 'The specified file does not exist'
        });
      }

      const stats = fs.statSync(filePath);
      fs.unlinkSync(filePath);
      
      logger.info('File deleted successfully', { 
        filename,
        size: stats.size,
        ip: req.ip
      });
      
      res.json({ 
        message: 'File successfully deleted',
        filename,
        size: stats.size
      });
    } catch (error) {
      logger.error('Error deleting file', { 
        error: error.message, 
        filename: req.filename 
      });
      
      if (error.code === 'EACCES') {
        return res.status(403).json({ 
          error: 'Permission denied',
          message: 'Access to the file is denied'
        });
      }
      
      res.status(500).json({ 
        error: 'Delete failed',
        message: 'An error occurred while deleting the file'
      });
    }
  }
);

/**
 * @swagger
 * /files/{filename}:
 *   get:
 *     summary: Download a file from the server
 *     description: |
 *       Download a specific file from the server using its filename.
 *       
 *       **Note:** This endpoint serves files directly and does not require authentication.
 *       Files are served with appropriate MIME types and headers.
 *     tags:
 *       - File Access
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the file to download
 *         example: "123e4567-e89b-12d3-a456-426614174000.jpg"
 *     responses:
 *       200:
 *         description: File content returned successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Type:
 *             description: MIME type of the file
 *             schema:
 *               type: string
 *               example: "image/jpeg"
 *           Content-Length:
 *             description: Size of the file in bytes
 *             schema:
 *               type: integer
 *               example: 2048576
 *           Content-Disposition:
 *             description: File attachment header
 *             schema:
 *               type: string
 *               example: "attachment; filename=123e4567-e89b-12d3-a456-426614174000.jpg"
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "File not found"
 *               message: "The requested file does not exist"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "File access error"
 *               message: "An error occurred while accessing the file"
 */
router.use('/files', (req, res, next) => {
  try {
    const staticPath = path.join(__dirname, '..', VOLUME_PATH);
    const filePath = path.join(staticPath, req.path);
    
    if (!fs.existsSync(filePath)) {
      logger.warn('File not found in static route', { 
        path: req.path, 
        ip: req.ip 
      });
      return res.status(404).json({ 
        error: 'File not found',
        message: 'The requested file does not exist'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error in static file route', { 
      error: error.message, 
      path: req.path 
    });
    res.status(500).json({ 
      error: 'File access error',
      message: 'An error occurred while accessing the file'
    });
  }
}, express.static(path.join(__dirname, '..', VOLUME_PATH)));

module.exports = router; 