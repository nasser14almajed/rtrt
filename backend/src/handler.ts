import serverless from 'serverless-http';
import dotenv from 'dotenv';
dotenv.config();
import app from './app.js';

export const handler = serverless(app);