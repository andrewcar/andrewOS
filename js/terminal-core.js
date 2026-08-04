/**
 * Pure terminal command catalog + dispatch (no DOM / jQuery).
 */

export const HELP_COMMANDS = [
  'boredgames',
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
  'medium',
  'name',
  'phone',
  'ruleofthree',
  'vibecade',
];

export const HELP_MESSAGE =
  `\nThe available known commands are ${formatCommandList(HELP_COMMANDS)}.\n`;

export const ASK_NEED_QUESTION =
  "\nYou'll need to ask a question to get an answer.\n";

export const UNIX_DENIED = "\nYour old magic won't work here.\n";

/** Commands that type out a fixed string via typeText */
export const TYPED_RESPONSES = {
  dob: '\nApril 26, 1990\n',
  email: '\nandrew.carvajal@me.com\n',
  hello: '\nHello back.\n',
  hey: '\nHey there.\n',
  marco: '\nPolo!\n',
  name: '\nAndrew Carvajal\n',
  phone: '\n(954) 292-5454\n',
  cd: UNIX_DENIED,
  ls: UNIX_DENIED,
  mkdir: UNIX_DENIED,
  pwd: UNIX_DENIED,
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

/**
 * Resolve a command name + args into a pure action descriptor.
 * @returns {{ kind: string, text?: string, question?: string }}
 */
export function resolveCommand(name, args = []) {
  const key = String(name ?? '')
    .trim()
    .toLowerCase();

  if (!key) return { kind: 'unknown' };

  if (key === 'help') return { kind: 'type', text: HELP_MESSAGE };
  if (key === 'clear') return { kind: 'clear' };
  if (key === 'ask') {
    const question = args.filter(Boolean).join(' ').trim();
    if (!question) return { kind: 'type', text: ASK_NEED_QUESTION };
    return { kind: 'ask', question };
  }
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
