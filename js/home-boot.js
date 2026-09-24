/**
 * Homepage startup. Shared by the first visit and by `exit` after a document swap
 * so the shell door, madlib, and feedback link rebind the same way.
 */
function prefersReducedMotion() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (error) {
    return false;
  }
}

function motionWait(ms) {
  return prefersReducedMotion() ? 0 : ms;
}

function bootAndrewHome(options) {
  const returning = Boolean(options && options.returning);
  const pair = pickMadlibPlaceholder();
  const inputs = document.querySelectorAll('.madlib input');

  const header = document.querySelector('.header');
  typeHeaderText(header, "Let's build<br>something.", () => {
    const shell = document.querySelector('.shell-entry');
    if (shell) {
      shell.classList.add('fade-in');
      if (returning) shell.focus();
    }
    setTimeout(() => {
      document.querySelector('.madlib').classList.add('fade-in');
      setTimeout(() => {
        document.querySelector('.initial-button').classList.add('fade-in');
        const feedbackOpen = document.querySelector('.feedback-open-button');
        if (feedbackOpen) feedbackOpen.classList.add('fade-in');
      }, motionWait(200));
    }, motionWait(200));
  });

  document.querySelector('.initial-button').addEventListener('click', function () {
    const madlib = document.querySelector('.madlib');
    const contact = document.querySelector('.contact-form');
    const headerEl = document.querySelector('.header');
    const initialButton = document.querySelector('.initial-button');
    const sendButton = document.querySelector('.send-button');
    const feedbackOpen = document.querySelector('.feedback-open-button');

    madlib.classList.add('fade-out');
    initialButton.classList.add('fade-out');
    if (feedbackOpen) feedbackOpen.classList.add('fade-out');

    setTimeout(() => {
      madlib.style.display = 'none';
      initialButton.style.display = 'none';
      if (feedbackOpen) feedbackOpen.style.display = 'none';
      typeHeaderText(headerEl, "Want me to<br>follow up?", () => {
        contact.style.display = 'block';
        contact.offsetHeight;
        contact.classList.add('fade-in');
        const contactInput = document.getElementById('contact');
        if (returning && contactInput) contactInput.focus();
        setTimeout(() => {
          sendButton.style.display = 'block';
          sendButton.offsetHeight;
          sendButton.classList.add('fade-in');
          setTimeout(() => {
            const subtitle = document.querySelector('.final-subtitle');
            subtitle.style.display = 'block';
            subtitle.offsetHeight;
            subtitle.classList.add('fade-in');
          }, motionWait(600));
        }, motionWait(600));
      });
    }, motionWait(500));
  });

  const calculateFontSize = (text) => {
    const length = text.length;
    if (length > 18) {
      return Math.max(0.35, 2 * Math.pow(0.96, length - 18));
    }
    return 2;
  };

  inputs.forEach((input, i) => {
    input.placeholder = pair[i];
    input.style.fontSize = calculateFontSize(input.placeholder) + 'rem';
    input.addEventListener('input', function () {
      const source = this.value || this.placeholder;
      this.style.fontSize = calculateFontSize(source) + 'rem';
    });
  });

  const contactInput = document.getElementById('contact');
  contactInput.style.fontSize = calculateFontSize(contactInput.placeholder) + 'rem';
  contactInput.addEventListener('input', function () {
    const source = this.value || this.placeholder;
    this.style.fontSize = calculateFontSize(source) + 'rem';
  });

  document.querySelector('.send-button').addEventListener('click', async function () {
    const whatText = document.getElementById('what').value || document.getElementById('what').placeholder;
    const doesText = document.getElementById('does').value || document.getElementById('does').placeholder;
    const contactInfo = document.getElementById('contact').value;

    if (!contactInfo) {
      alert('Please enter your contact info!');
      return;
    }

    try {
      const response = await fetch('https://formspree.io/f/mwpljayb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: `I want to build ${whatText} that ${doesText}.`,
          contact: contactInfo,
        }),
      });

      if (!response.ok) throw new Error('Failed to send');

      const contact = document.querySelector('.contact-form');
      const sendButton = document.querySelector('.send-button');
      const subtitle = document.querySelector('.final-subtitle');
      const headerEl = document.querySelector('.header');

      contact.classList.add('fade-out');
      sendButton.classList.add('fade-out');
      subtitle.classList.add('fade-out');

      setTimeout(() => {
        contact.style.display = 'none';
        sendButton.style.display = 'none';
        subtitle.style.display = 'none';
        typeHeaderText(headerEl, "Thanks!<br>I'll be in touch.", null);
      }, motionWait(500));
    } catch (error) {
      alert('Oops! Something went wrong. Please try again.');
    }
  });

  const xButton = document.querySelector('.x-button');
  if (xButton) {
    setTimeout(() => xButton.classList.add('fade-in'), motionWait(1000));
  }

  if (returning) revealSupportButton();
}

function revealSupportButton() {
  const existing = document.querySelector('script[src*="overlay-widget.js"]');
  if (existing && typeof window.kofiWidgetOverlay !== 'undefined') {
    paintSupportButton();
    return;
  }
  const kofiScript = document.createElement('script');
  kofiScript.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
  kofiScript.onload = () => {
    if (!window.kofiWidgetOverlay) return;
    window.kofiWidgetOverlay.draw('andrewos', {
      type: 'floating-chat',
      'floating-chat.donateButton.text': 'Support',
      'floating-chat.donateButton.background-color': '#2ecc71',
      'floating-chat.donateButton.text-color': '#ffffff',
      'floating-chat.width': 'auto',
      'floating-chat.position.bottom': '32px',
      'floating-chat.position.right': '16px',
      'floating-chat.animation.type': 'fade-in',
    });
    paintSupportButton();
  };
  document.head.appendChild(kofiScript);
}

function paintSupportButton() {
  setTimeout(() => {
    const kofiIframe = document.querySelector('iframe[title="Ko-fi donations"]');
    if (!kofiIframe || !kofiIframe.parentElement) return;
    kofiIframe.parentElement.classList.add('floating-kofi-button');
    setTimeout(() => {
      kofiIframe.parentElement.classList.add('fade-in');
    }, motionWait(200));
  }, motionWait(1000));
}
