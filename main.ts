import { cpSync, mkdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const entryDirectory = dirname(fileURLToPath(import.meta.url));
const requestedOutput = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

mkdirSync(requestedOutput, { recursive: true });
const outputDirectory = realpathSync(requestedOutput);
const copies = ['game', 'screenshots'].map(directory => ({
  source: join(entryDirectory, directory),
  destination: join(outputDirectory, directory),
}));

// Reject overlapping trees before replacing output, including a symlink to the entry.
for (const { source, destination } of copies) {
  if (source === destination || source.startsWith(destination + sep) || destination.startsWith(source + sep)) {
    throw new Error('The output game/ and screenshots/ must not overlap the input directories.');
  }
}

// Replacing these trees also makes a reused output independent of stale files.
rmSync(join(outputDirectory, 'dossier.json'), { force: true });
for (const { source, destination } of copies) {
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
}

const copiedPage = join(outputDirectory, 'game', 'index.html');
if (!statSync(copiedPage, { throwIfNoEntry: false })?.isFile()) {
  throw new Error(`Cannot build dossier: copied game/index.html is missing or is not a file: ${copiedPage}`);
}

// buildDossier supplies canonical JSON bytes; do not reserialize or add a newline.
writeFileSync(join(outputDirectory, 'dossier.json'), buildDossier(outputDirectory, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
}));
