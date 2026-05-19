import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.list();
    const models = response.map(m => m.name);
    console.log(models.filter(m => m.includes('gemini')));
  } catch(e) {
    console.error(e.message);
  }
}
run();
