/**
 * Pure terminal command catalog + dispatch (no DOM / jQuery).
 */

export const HELP_COMMANDS = [
  'ask',
  'boredgames',
  'cat',
  'cd',
  'clear',
  'cv',
  'dob',
  'email',
  'exit',
  'fox',
  'github',
  'help',
  'linkedin',
  'lola',
  'ls',
  'medium',
  'name',
  'neofetch',
  'open',
  'phone',
  'pwd',
  'ruleofthree',
  'vibecade',
  'whoami',
];

export const HELP_MESSAGE =
  `\nThe available known commands are ${formatCommandList(HELP_COMMANDS)}.\n`;

export const ASK_NEED_QUESTION =
  "\nYou'll need to ask a question to get an answer. ask --help\n";

export const ASK_HELP =
  '\nask <question>\n' +
  'Replies are chunk-typed as they arrive.\n' +
  '/api/ai is one-shot, so the shell splits the reply into short chunks instead of dumping one block.\n' +
  'ask --help    show this\n';

export const UNIX_DENIED = "\nYour old magic won't work here.\n";

export const IDENTITY = {
  name: 'Andrew Carvajal',
  email: 'andrew.carvajal@me.com',
  phone: '(954) 292-5454',
  dob: 'April 26, 1990',
};

export const IDENTITY_PANEL =
  `\n${IDENTITY.name}\n` +
  'guest@andrewos\n' +
  `email  ${IDENTITY.email}\n` +
  `phone  ${IDENTITY.phone}\n` +
  `born   ${IDENTITY.dob}\n`;

/** Pre-PR#3 greetings wordmark. One block so the sticky ASCII rules size the whole mark. */
export const ASCII_BANNER =
  '\n\n\n                       ▀██                               ▄▄█▀▀██    ▄█▀▀▀▄█\n' +
  '   ▄▄▄▄   ▄▄ ▄▄▄     ▄▄ ██  ▄▄▄ ▄▄    ▄▄▄▄  ▄▄▄ ▄▄▄ ▄▄▄ ▄█▀    ██   ██▄▄  ▀\n' +
  '  ▀▀ ▄██   ██  ██  ▄▀  ▀██   ██▀ ▀▀ ▄█▄▄▄██  ██  ██  █  ██      ██   ▀▀███▄\n' +
  '  ▄█▀ ██   ██  ██  █▄   ██   ██     ██        ███ ███   ▀█▄     ██ ▄     ▀██\n' +
  '  ▀█▄▄▀█▀ ▄██▄ ██▄ ▀█▄▄▀██▄ ▄██▄     ▀█▄▄▄▀    █   █     ▀▀█▄▄▄█▀  █▀▄▄▄▄█▀\n' +
  '\n///////////////////\n//// Build 302 ////\n///////////////////\n';

export const BOOT_LINES = ['andrewOS', 'power  ok', 'Build 302', 'guest session'];

/**
 * Phone screens skip the extra POST lines so the ASCII mark and prompt
 * stay on the first screen. The wordmark already carries andrewOS / Build 302.
 */
export function bootLinesForWidth(width) {
  if (Number(width) > 0 && Number(width) <= 700) return [];
  return BOOT_LINES;
}

export const BOOT_HINT = 'try help, ls, or ask …';

/** Commands that type out a fixed string via typeText */
export const TYPED_RESPONSES = {
  dob: `\n${IDENTITY.dob}\n`,
  email: `\n${IDENTITY.email}\n`,
  hello: '\nHello back.\n',
  hey: '\nHey there.\n',
  marco: '\nPolo!\n',
  name: `\n${IDENTITY.name}\n`,
  phone: `\n${IDENTITY.phone}\n`,
  mkdir: UNIX_DENIED,
  vim: UNIX_DENIED,
};

/** Commands that echo a jQuery Terminal link markup string */
export const LINK_RESPONSES = {
  boredgames:
    '\n[[!;;;;https://apps.apple.com/us/app/bored-games/id1644618221]Bored Games]\n',
  cv: '\n[[!;;;;https://andrewos.com/docs/cv.pdf]CV]\n',
  fox: '\n[[!;;;;https://apps.apple.com/us/app/fox-sports-watch-live/id294056623]Fox Sports]\n',
  github: '\n[[!;;;;https://github.com/andrewcar]GitHub]\n',
  instagram: '\n[[!;;;;https://www.instagram.com/andrewsphone]Instagram]\n',
  linkedin: '\n[[!;;;;https://www.linkedin.com/in/andrew-carvajal]Linkedin]\n',
  medium: '\n[[!;;;;https://medium.com/@andrewcarvajal]Medium]\n',
  ruleofthree:
    '\n[[!;;;;https://apps.apple.com/us/app/rule-of-three-no-ads/id6443475294]Rule of Three]\n',
};

export function formatCommandList(commands) {
  if (commands.length === 0) return '';
  if (commands.length === 1) return commands[0];
  if (commands.length === 2) return `${commands[0]} and ${commands[1]}`;
  return `${commands.slice(0, -1).join(', ')} and ${commands[commands.length - 1]}`;
}

const FS = {
  projects: {
    type: 'dir',
    children: {
      'andrewos.txt': { type: 'file', text: 'andrewOS. The house site.\n' },
      'voxbot.txt': { type: 'file', text: 'VoxBot. The creator egg is the feedback form.\n' },
    },
  },
  apps: {
    type: 'dir',
    children: {
      'boredgames.txt': {
        type: 'file',
        text: 'Bored Games\nhttps://apps.apple.com/us/app/bored-games/id1644618221\n',
      },
      'fox.txt': {
        type: 'file',
        text: 'Fox Sports\nhttps://apps.apple.com/us/app/fox-sports-watch-live/id294056623\n',
      },
      'ruleofthree.txt': {
        type: 'file',
        text: 'Rule of Three\nhttps://apps.apple.com/us/app/rule-of-three-no-ads/id6443475294\n',
      },
      'vibecade.txt': { type: 'file', text: 'Type vibecade to play.\n' },
    },
  },
  social: {
    type: 'dir',
    children: {
      'github.txt': { type: 'file', text: 'https://github.com/andrewcar\n' },
      'instagram.txt': { type: 'file', text: 'https://www.instagram.com/andrewsphone\n' },
      'linkedin.txt': { type: 'file', text: 'https://www.linkedin.com/in/andrew-carvajal\n' },
      'medium.txt': { type: 'file', text: 'https://medium.com/@andrewcarvajal\n' },
    },
  },
  littlefly: {
    type: 'dir',
    portal: '/littleflywholeworld',
    children: {
      'readme.txt': {
        type: 'file',
        text: 'Little Fly lives at /littleflywholeworld.\nopen door\n',
      },
      door: { type: 'file', href: '/littleflywholeworld', text: '/littleflywholeworld\n' },
    },
  },
  feedback: {
    type: 'file',
    href: '/feedback',
    text: 'Signature egg: the VoxBot feedback form.\nopen feedback\n',
  },
};

export function shellPrompt(cwd = '/') {
  const place = !cwd || cwd === '/' ? '~' : `~${cwd}`;
  return `guest@andrewos:${place}$ `;
}

function normalizeCwd(cwd) {
  const raw = String(cwd ?? '/').trim() || '/';
  if (raw === '~') return '/';
  const parts = raw.replace(/^~/, '').split('/').filter(Boolean);
  return parts.length ? `/${parts.join('/')}` : '/';
}

function pathParts(cwd, input) {
  const raw = String(input ?? '').trim();
  if (!raw || raw === '~') return [];
  const absolute = raw.startsWith('/') || raw.startsWith('~');
  const parts = absolute ? [] : normalizeCwd(cwd).split('/').filter(Boolean);
  const body = raw.replace(/^~/, '').replace(/^\//, '');
  for (const part of body.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts;
}

function nodeAt(parts) {
  let node = { type: 'dir', children: FS };
  for (const part of parts) {
    if (!node || node.type !== 'dir' || !node.children?.[part]) return null;
    node = node.children[part];
  }
  return node;
}

function cwdFromParts(parts) {
  return parts.length ? `/${parts.join('/')}` : '/';
}

function listText(node) {
  const lines = Object.keys(node.children)
    .sort()
    .map((name) => (node.children[name].type === 'dir' ? `${name}/` : name));
  return `\n${lines.join('\n')}\n`;
}

function resolveFs(key, args, cwd) {
  const input = args.filter(Boolean).join(' ').trim();
  if (key === 'pwd') {
    const place = cwd === '/' ? '~' : `~${cwd}`;
    return { kind: 'echo', text: `\n${place}\n` };
  }

  if (key === 'ls') {
    const parts = input ? pathParts(cwd, input) : normalizeCwd(cwd).split('/').filter(Boolean);
    const node = nodeAt(parts);
    if (!node) return { kind: 'echo', text: '\nno such path\n' };
    if (node.type !== 'dir') return { kind: 'echo', text: `\n${parts[parts.length - 1]}\n` };
    return { kind: 'echo', text: listText(node) };
  }

  if (key === 'cd') {
    if (!input || input === '~' || input === '/') return { kind: 'cd', cwd: '/' };
    const parts = pathParts(cwd, input);
    const node = nodeAt(parts);
    if (!node) return { kind: 'echo', text: '\nno such path\n' };
    if (node.type !== 'dir') return { kind: 'echo', text: '\nnot a directory\n' };
    return { kind: 'cd', cwd: cwdFromParts(parts) };
  }

  if (key === 'cat' || key === 'open') {
    if (!input) return { kind: 'echo', text: `\n${key} needs a path\n` };
    const parts = pathParts(cwd, input);
    const node = nodeAt(parts);
    if (!node) return { kind: 'echo', text: '\nno such path\n' };
    if (node.type === 'dir') {
      if (key === 'open' && node.portal) {
        return { kind: 'navigate', href: node.portal, text: `\n${node.portal}\n` };
      }
      if (key === 'open') return { kind: 'cd', cwd: cwdFromParts(parts) };
      return { kind: 'echo', text: '\nthat is a directory\n' };
    }
    if (key === 'open' && node.href) {
      return { kind: 'navigate', href: node.href, text: `\n${node.text || node.href}` };
    }
    return { kind: 'echo', text: `\n${node.text || ''}` };
  }

  return null;
}

/** Word-aware chunks so a one-shot reply can be typed as a stream. */
export function chunkAnswer(text, maxLen = 24) {
  const clean = String(text ?? '').replace(/\r\n/g, '\n');
  if (!clean) return [];
  const parts = [];
  let buf = '';
  for (const piece of clean.split(/(\s+)/)) {
    if (!piece) continue;
    if (buf && buf.length + piece.length > maxLen && buf.trim()) {
      parts.push(buf);
      buf = piece;
    } else {
      buf += piece;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

/**
 * Resolve a command name + args into a pure action descriptor.
 * @returns {{ kind: string, text?: string, question?: string }}
 */
export function resolveCommand(name, args = [], context = {}) {
  const key = String(name ?? '')
    .trim()
    .toLowerCase();
  const cwd = normalizeCwd(context.cwd);

  if (!key) return { kind: 'unknown' };

  if (key === 'help') return { kind: 'type', text: HELP_MESSAGE };
  if (key === 'clear') return { kind: 'clear' };
  if (key === 'ask') {
    const tokens = args.filter(Boolean);
    if (tokens[0] === '--help' || tokens[0] === '-h') return { kind: 'echo', text: ASK_HELP };
    const question = tokens.join(' ').trim();
    if (!question) return { kind: 'type', text: ASK_NEED_QUESTION };
    return { kind: 'ask', question };
  }
  if (key === 'whoami' || key === 'neofetch') return { kind: 'echo', text: IDENTITY_PANEL };
  const fsAction = resolveFs(key, args, cwd);
  if (fsAction) return fsAction;
  if (Object.prototype.hasOwnProperty.call(TYPED_RESPONSES, key)) {
    return { kind: 'type', text: TYPED_RESPONSES[key] };
  }
  if (Object.prototype.hasOwnProperty.call(LINK_RESPONSES, key)) {
    return { kind: 'echo', text: LINK_RESPONSES[key] };
  }
  if (key === 'exit') return { kind: 'exit' };
  if (key === 'vibecade') return { kind: 'vibecade' };
  if (key === 'lola') return { kind: 'image', src: 'https://i.imgur.com/WzLhVEd.jpg' };
  if (key === 'surprise') return { kind: 'image', src: 'https://i.imgur.com/6JRUWIq.png' };
  if (key === 'ping') return { kind: 'pong' };
  if (key === 'title') return { kind: 'title' };
  if (key === 'smellyalater') return { kind: 'smellyalater' };

  return { kind: 'unknown', name: key };
}

export function isKnownHelpCommand(name) {
  return HELP_COMMANDS.includes(String(name ?? '').toLowerCase());
}
