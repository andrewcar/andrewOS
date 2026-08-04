/**
 * Pure OpenAI completion request shaping (no SDK import).
 */

export function buildCompletionRequest(question) {
  return {
    model: 'text-davinci-002',
    prompt: question,
    temperature: 0.7,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };
}

export function extractCompletionText(completion) {
  return completion?.data?.choices?.[0]?.text;
}

/**
 * @param {{ body: { question?: string } }} req
 * @param {{ status: (code: number) => { json: (body: unknown) => void } }} res
 * @param {{ createCompletion: (params: ReturnType<typeof buildCompletionRequest>) => Promise<unknown> }} deps
 */
export async function handleAiRequest(req, res, { createCompletion }) {
  const completion = await createCompletion(buildCompletionRequest(req.body.question));
  res.status(200).json({ result: extractCompletionText(completion) });
}
