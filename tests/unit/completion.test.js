import { describe, expect, it, vi } from 'vitest';
import {
  buildCompletionRequest,
  extractCompletionText,
  handleAiRequest,
} from '../../api/completion.js';

describe('buildCompletionRequest', () => {
  it('shapes the davinci completion payload from the question', () => {
    expect(buildCompletionRequest('what is life')).toEqual({
      model: 'text-davinci-002',
      prompt: 'what is life',
      temperature: 0.7,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });
  });
});

describe('extractCompletionText', () => {
  it('reads choices[0].text', () => {
    expect(
      extractCompletionText({
        data: { choices: [{ text: ' forty-two' }] },
      })
    ).toBe(' forty-two');
  });

  it('returns undefined when completion is empty', () => {
    expect(extractCompletionText({})).toBeUndefined();
  });
});

describe('handleAiRequest', () => {
  it('calls createCompletion with shaped params and returns JSON result', async () => {
    const createCompletion = vi.fn().mockResolvedValue({
      data: { choices: [{ text: 'mocked reply' }] },
    });
    const json = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json }),
    };

    await handleAiRequest({ body: { question: 'hello?' } }, res, { createCompletion });

    expect(createCompletion).toHaveBeenCalledWith(buildCompletionRequest('hello?'));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ result: 'mocked reply' });
  });
});
