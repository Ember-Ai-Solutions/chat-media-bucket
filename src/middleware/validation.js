const logger = require('../config/logger');

const validateFilename = (req, res, next) => {
  const { filename } = req.query;
  
  if (!filename) {
    logger.warn('Missing filename in request', {
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    return res.status(400).json({
      error: 'Missing required parameter',
      message: 'filename is required'
    });
  }

  if (typeof filename !== 'string' || filename.trim().length === 0) {
    logger.warn('Invalid filename format', {
      filename,
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'filename must be a non-empty string'
    });
  }

  req.filename = filename.trim();
  next();
};

const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    logger.warn('No file uploaded', {
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    return res.status(400).json({
      error: 'No file uploaded',
      message: 'Please select a file to upload'
    });
  }

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

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    logger.warn('Unsupported file type uploaded', {
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      url: req.url,
      method: req.method,
      ip: req.ip
    });
    return res.status(400).json({
      error: 'Unsupported file type',
      message: 'The uploaded file type is not supported'
    });
  }

  next();
};

module.exports = {
  validateFilename,
  validateFileUpload
}; 