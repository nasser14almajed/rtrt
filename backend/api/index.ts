import { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/app.js';

export default (req: VercelRequest, res: VercelResponse) => {
  // Bridge to Express app
  // @ts-ignore
  app(req, res);
};