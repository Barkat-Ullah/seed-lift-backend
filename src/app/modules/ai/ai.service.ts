import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Cache, DAILY_LIMIT, RequestLimiter } from './ai.constant';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface GeminiRequestBody {
  prompt: string;
  model?: string;
  data?: string;
}

interface GeminiResponse {
  response: string;
  usage?: { promptTokens: number; candidates: number };
  cached?: boolean;
  remainingRequests?: number;
}

export const askHandler = async (
  req: Request<{}, any, GeminiRequestBody>,
  res: Response<GeminiResponse>,
) => {
  try {
    let prompt: string = '';

    if (req.body.data) {
      try {
        const parsed = JSON.parse(req.body.data);
        prompt = parsed.prompt?.trim();
      } catch (e) {
        return res
          .status(400)
          .json({ response: 'Invalid JSON in "data" field.' });
      }
    } else if (req.body.prompt) {
      prompt = req.body.prompt.trim();
    }

    if (!prompt) {
      return res.status(400).json({ response: 'Prompt is required.' });
    }

    if (RequestLimiter.isExceeded()) {
      return res.status(429).json({
        response: 'Daily limit exceeded (1500 requests). Try again tomorrow.',
        remainingRequests: 0,
      });
    }

    const model = 'gemini-2.0-flash';

    let cacheKey = `gemini|${model}|${prompt}`;

    const cached = Cache.get(cacheKey) as GeminiResponse | undefined;
    if (cached) {
      // console.log('Cache Hit');
      return res.json({
        ...cached,
        cached: true,
        remainingRequests: DAILY_LIMIT - RequestLimiter.getCount(),
      });
    }

    const content: string[] = [prompt];

    const geminiModel = genAI.getGenerativeModel({ model });
    const result = await geminiModel.generateContent(content);
    const responseText = result.response.text();

    const usage = {
      promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
      candidates: result.response.candidates?.length || 0,
    };

    const responseData: GeminiResponse = {
      response: responseText,
      usage,
    };

    // Cache result
    Cache.set(cacheKey, responseData);
    const currentCount = RequestLimiter.increment();

    res.json({
      ...responseData,
      cached: false,
      remainingRequests: DAILY_LIMIT - currentCount,
    });
  } catch (error: any) {
    console.error('Gemini API Error:', error);

    if (error.status === 404) {
      return res.status(404).json({ response: 'Model not found.' });
    }
    if (error.message?.includes('location')) {
      return res
        .status(403)
        .json({ response: 'Service not available in your region.' });
    }

    res.status(500).json({ response: 'Failed to process request.' });
  }
};
