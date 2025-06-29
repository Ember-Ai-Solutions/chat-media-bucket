const express = require('express');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const logger = require('./config/logger');
const environment = require('./config/environment');
const filesRouter = require('./routes/files');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = environment.port;
const BASE_URL = environment.baseUrl;

logger.info('Starting application', { volumePath: environment.volumePath });

try {
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
} catch (error) {
    logger.error('Error during startup directory scan', { error: error.message });
}

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'File Upload API',
            version: '1.0.0',
            description: `
## File Upload and Management API

This API provides endpoints for uploading, downloading, and managing files on the server.

### Features
- **File Upload**: Upload files with automatic UUID filename generation
- **File Download**: Direct access to uploaded files
- **File Deletion**: Remove files from the server
- **Authentication**: Bearer token-based security
- **File Validation**: Type and size restrictions

### Supported File Types
- **Images**: JPEG, PNG, GIF, WebP
- **Documents**: PDF, TXT, JSON, CSV
- **Spreadsheets**: XLS, XLSX

### File Size Limits
- Maximum file size: 10MB per file
- One file per request

### Authentication
All endpoints (except file download) require a Bearer token in the Authorization header.

### Base URL
\`${BASE_URL}\`

### Documentation
This interactive documentation allows you to test the API endpoints directly.
            `,
            contact: {
                name: 'API Support',
                email: 'support@example.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    description: 'Bearer token for API authentication. Include your token in the Authorization header.'
                },
            },
        },
        security: [{ bearerAuth: [] }],
        tags: [
            {
                name: 'File Management',
                description: 'Operations for uploading and deleting files'
            },
            {
                name: 'File Access',
                description: 'Operations for accessing and downloading files'
            }
        ]
    },
    apis: ['./src/routes/*.js'],
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'File Upload API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true
    }
}));

app.use('/', filesRouter);

app.use(errorHandler);

const server = app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, swaggerUrl: `${BASE_URL}/docs` });
});

server.on('error', (error) => {
    logger.error('Server error', { error: error.message });
    process.exit(1);
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

module.exports = app; 