import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const languages = ['uz', 'en', 'ru'];
const dictionaries = Object.fromEntries(
  languages.map((language) => [
    language,
    JSON.parse(
      fs.readFileSync(
        path.join(root, 'src/i18n/locales', `${language}.json`),
        'utf8',
      ),
    ),
  ]),
);

function flatten(value, prefix = '', output = new Set()) {
  for (const [key, child] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, full, output);
    } else {
      output.add(full);
    }
  }
  return output;
}

const base = flatten(dictionaries.uz);
for (const language of ['en', 'ru']) {
  const keys = flatten(dictionaries[language]);
  const missing = [...base].filter((key) => !keys.has(key));
  if (missing.length) {
    console.error(`${language}: missing ${missing.length} translation keys`);
    console.error(missing.slice(0, 30).join('\n'));
    process.exitCode = 1;
  }
}

const catalog = fs.readFileSync(
  path.join(root, 'src/features/games/catalog.ts'),
  'utf8',
);
if (!catalog.includes("export const GAME_IDS = [\n  'checkers'")) {
  console.error('Checkers must remain the first game in GAME_IDS.');
  process.exitCode = 1;
}
if (!catalog.includes("export const GAMES: readonly GameDefinition[] = [\n  { id:'checkers'")) {
  console.error('Checkers must remain the first visible game.');
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log('AqlBand V2 project verification passed.');
}
