import { describe, expect, it, vi } from 'vitest';
import '../../js/voxbot-feedback.js';

const {
  isFeedbackDeepLink,
  readFeedbackSource,
  feedbackDeepLinkDestination,
  buildFeedbackPayload,
  submitVoxbotFeedback,
  VOXBOT_FEEDBACK_ENDPOINT,
  VOXBOT_FEEDBACK_TYPE,
} = globalThis;

describe('isFeedbackDeepLink', () => {
  it('treats /feedback as a deep link', () => {
    expect(isFeedbackDeepLink({ pathname: '/feedback', search: '', hash: '' })).toBe(true);
    expect(isFeedbackDeepLink({ pathname: '/feedback/', search: '', hash: '' })).toBe(true);
  });

  it('treats ?feedback=1 and #feedback as deep links', () => {
    expect(isFeedbackDeepLink({ pathname: '/', search: '?feedback=1', hash: '' })).toBe(true);
    expect(isFeedbackDeepLink({ pathname: '/', search: '?feedback=true', hash: '' })).toBe(true);
    expect(isFeedbackDeepLink({ pathname: '/', search: '?feedback', hash: '' })).toBe(true);
    expect(isFeedbackDeepLink({ pathname: '/', search: '', hash: '#feedback' })).toBe(true);
  });

  it('does not treat the homepage madlib as a feedback deep link', () => {
    expect(isFeedbackDeepLink({ pathname: '/', search: '', hash: '' })).toBe(false);
    expect(isFeedbackDeepLink({ pathname: '/', search: '?feedback=0', hash: '' })).toBe(false);
  });
});

describe('readFeedbackSource', () => {
  it('defaults to voxbot on the feedback page and other deep links', () => {
    expect(readFeedbackSource({ pathname: '/feedback', search: '' })).toBe('voxbot');
    expect(readFeedbackSource({ pathname: '/', search: '?feedback=1' })).toBe('voxbot');
  });

  it('prefers source= then from=', () => {
    expect(readFeedbackSource({ pathname: '/feedback', search: '?source=contest' })).toBe('contest');
    expect(readFeedbackSource({ pathname: '/', search: '?feedback=1&from=voxbot' })).toBe('voxbot');
    expect(
      readFeedbackSource({ pathname: '/feedback', search: '?from=ig&source=homepage' })
    ).toBe('homepage');
  });
});

describe('feedbackDeepLinkDestination', () => {
  it('sends homepage ?feedback=1 to /feedback with source', () => {
    expect(feedbackDeepLinkDestination({ pathname: '/', search: '?feedback=1' })).toBe(
      '/feedback?source=voxbot'
    );
    expect(
      feedbackDeepLinkDestination({ pathname: '/', search: '?feedback=1&source=egg' })
    ).toBe('/feedback?source=egg');
  });
});

describe('buildFeedbackPayload', () => {
  it('tags submissions as voxbot-feedback and keeps madlib fields out', () => {
    const payload = buildFeedbackPayload({
      feedback: '  the voice is too smug  ',
      name: ' Sam ',
      contact: 'sam@example.com',
      source: 'voxbot',
    });
    expect(payload).toMatchObject({
      type: VOXBOT_FEEDBACK_TYPE,
      form: VOXBOT_FEEDBACK_TYPE,
      feedback: 'the voice is too smug',
      name: 'Sam',
      contact: 'sam@example.com',
      source: 'voxbot',
      _subject: 'VoxBot creator feedback',
      _replyto: 'sam@example.com',
    });
    expect(payload).not.toHaveProperty('idea');
    expect(payload).not.toHaveProperty('what');
    expect(payload).not.toHaveProperty('does');
  });

  it('does not set _replyto for IG handles', () => {
    const payload = buildFeedbackPayload({
      feedback: 'mid',
      contact: '@andrewslaptop',
      source: '',
    });
    expect(payload.contact).toBe('@andrewslaptop');
    expect(payload.source).toBe('voxbot');
    expect(payload).not.toHaveProperty('_replyto');
  });
});

describe('submitVoxbotFeedback', () => {
  it('POSTs JSON to the existing Formspree endpoint', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    const payload = buildFeedbackPayload({ feedback: 'hello', source: 'voxbot' });
    const result = await submitVoxbotFeedback(payload, fetchImpl);
    expect(result).toEqual({ ok: true, status: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(VOXBOT_FEEDBACK_ENDPOINT);
    expect(url).toBe('https://formspree.io/f/mwpljayb');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toMatchObject({
      type: 'voxbot-feedback',
      feedback: 'hello',
      source: 'voxbot',
    });
  });
});
