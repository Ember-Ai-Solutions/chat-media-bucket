const path = require('path');

const environment = {
  port: process.env.PORT || 3000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  volumePath: process.env.VOLUME_PATH || path.join(__dirname, '../../../uploads'),
  authToken: process.env.AUTH_TOKEN,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info'
};

module.exports = environment; 