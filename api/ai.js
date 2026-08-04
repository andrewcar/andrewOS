import { Configuration, OpenAIApi } from 'openai';
import { handleAiRequest } from './completion.js';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export { buildCompletionRequest, extractCompletionText, handleAiRequest } from './completion.js';

export default async function (req, res) {
  return handleAiRequest(req, res, {
    createCompletion: (params) => openai.createCompletion(params),
  });
}
