/**
 * VoxBot creator-feedback helpers. Separate from the homepage madlib / build-idea lead form.
 */
(function (global) {
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mwpljayb';
  const FORM_TYPE = 'voxbot-feedback';
  const DEFAULT_SOURCE = 'voxbot';

  function queryParams(search) {
    return new URLSearchParams(search || '');
  }

  function pathnameWithoutTrailingSlash(pathname) {
    return String(pathname || '').replace(/\/+$/, '') || '/';
  }

  function isFeedbackPath(pathname) {
    return pathnameWithoutTrailingSlash(pathname).endsWith('/feedback');
  }

  function isFeedbackDeepLink(locationLike) {
    const loc = locationLike || {};
    if (isFeedbackPath(loc.pathname)) return true;
    const hash = String(loc.hash || '');
    if (hash === '#feedback' || hash === '#/feedback') return true;
    const value = queryParams(loc.search).get('feedback');
    return value === '1' || value === 'true' || value === '';
  }

  function readFeedbackSource(locationLike) {
    const loc = locationLike || {};
    const params = queryParams(loc.search);
    const explicit = String(params.get('source') || params.get('from') || '').trim();
    if (explicit) return explicit;
    if (isFeedbackDeepLink(loc)) return DEFAULT_SOURCE;
    return DEFAULT_SOURCE;
  }

  function feedbackDeepLinkDestination(locationLike) {
    const source = readFeedbackSource(locationLike);
    return '/feedback?source=' + encodeURIComponent(source);
  }

  function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function buildFeedbackPayload({ feedback, name, contact, source } = {}) {
    const payload = {
      type: FORM_TYPE,
      form: FORM_TYPE,
      feedback: String(feedback || '').trim(),
      name: String(name || '').trim(),
      contact: String(contact || '').trim(),
      source: String(source || '').trim() || DEFAULT_SOURCE,
      _subject: 'VoxBot creator feedback',
    };
    if (looksLikeEmail(payload.contact)) {
      payload._replyto = payload.contact;
    }
    return payload;
  }

  async function submitVoxbotFeedback(payload, fetchImpl) {
    const fetchFn = fetchImpl || global.fetch;
    const response = await fetchFn(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return {
      ok: Boolean(response && response.ok),
      status: response ? response.status : 0,
    };
  }

  function bindVoxbotFeedbackForm(config) {
    const {
      header,
      formRoot,
      nodEl,
      messageEl,
      nameEl,
      contactEl,
      sourceEl,
      sendButton,
      thanksText = "Thanks!<br>I'll be in touch.",
    } = config;

    if (sourceEl) {
      sourceEl.value = readFeedbackSource(global.location);
    }

    sendButton.addEventListener('click', async function () {
      const payload = buildFeedbackPayload({
        feedback: messageEl && messageEl.value,
        name: nameEl && nameEl.value,
        contact: contactEl && contactEl.value,
        source: sourceEl ? sourceEl.value : readFeedbackSource(global.location),
      });

      if (!payload.feedback) {
        alert('Say something first — even one savage sentence.');
        return;
      }

      sendButton.disabled = true;
      try {
        const result = await submitVoxbotFeedback(payload);
        if (!result.ok) throw new Error('Failed to send');

        if (formRoot) formRoot.classList.add('fade-out');
        sendButton.classList.add('fade-out');
        if (nodEl) nodEl.classList.add('fade-out');

        setTimeout(() => {
          if (formRoot) formRoot.style.display = 'none';
          sendButton.style.display = 'none';
          if (nodEl) nodEl.style.display = 'none';
          if (header && typeof global.typeHeaderText === 'function') {
            global.typeHeaderText(header, thanksText, null);
          }
        }, 500);
      } catch (error) {
        sendButton.disabled = false;
        alert('Oops! Something went wrong. Please try again.');
      }
    });
  }

  global.VOXBOT_FEEDBACK_ENDPOINT = FORMSPREE_ENDPOINT;
  global.VOXBOT_FEEDBACK_TYPE = FORM_TYPE;
  global.isFeedbackDeepLink = isFeedbackDeepLink;
  global.readFeedbackSource = readFeedbackSource;
  global.feedbackDeepLinkDestination = feedbackDeepLinkDestination;
  global.buildFeedbackPayload = buildFeedbackPayload;
  global.submitVoxbotFeedback = submitVoxbotFeedback;
  global.bindVoxbotFeedbackForm = bindVoxbotFeedbackForm;
})(typeof window !== 'undefined' ? window : globalThis);
