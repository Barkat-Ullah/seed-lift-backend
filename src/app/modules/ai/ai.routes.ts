import express, { RequestHandler } from 'express';
import { askHandler } from './ai.service';


const router = express.Router();
router.post('/ask', askHandler as RequestHandler);

export const geminiRouter = router;
