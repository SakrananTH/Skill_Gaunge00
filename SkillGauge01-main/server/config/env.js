import 'dotenv/config';

export const env = {
  PORT: process.env.PORT || 4000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3002',
  MYSQL_HOST: process.env.MYSQL_HOST || 'localhost',
  MYSQL_PORT: process.env.MYSQL_PORT || '3306',
  MYSQL_DATABASE: process.env.MYSQL_DATABASE || 'admin-worker-registration',
  MYSQL_USER: process.env.MYSQL_USER || 'root',
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || 'rootpassword',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_change_me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',
  THAI_ADDRESS_DATA_PATH: process.env.THAI_ADDRESS_DATA_PATH
};
