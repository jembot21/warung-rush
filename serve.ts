import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameDirectory = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), 'game'));
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function isInsideGame(path: string): boolean {
  const fromGame = relative(gameDirectory, path);
  return fromGame !== '..' && !fromGame.startsWith('..' + sep) && !isAbsolute(fromGame);
}

const server = createServer(async (request, response) => {
  const sendText = (status: number, message: string) => {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : message + '\n');
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    sendText(405, 'Method not allowed');
    return;
  }

  let pathname: string;
  try {
    // Decode before resolving, including encoded traversal and separators.
    pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
    if (!pathname.startsWith('/') || pathname.includes('\0') || pathname.includes('\\')) {
      sendText(400, 'Bad request');
      return;
    }
  } catch {
    sendText(400, 'Bad request');
    return;
  }

  let filePath = resolve(gameDirectory, '.' + pathname);
  if (!isInsideGame(filePath)) {
    sendText(403, 'Forbidden');
    return;
  }

  try {
    // Check real paths too, so a symlink cannot expose files outside game/.
    filePath = await realpath(filePath);
    if (!isInsideGame(filePath)) {
      sendText(403, 'Forbidden');
      return;
    }
    if ((await stat(filePath)).isDirectory()) {
      filePath = await realpath(resolve(filePath, 'index.html'));
    }
    if (!isInsideGame(filePath)) {
      sendText(403, 'Forbidden');
      return;
    }
    if (!(await stat(filePath)).isFile()) {
      sendText(404, 'Not found');
      return;
    }

    const bytes = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': bytes.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    sendText(code === 'ENOENT' || code === 'ENOTDIR' ? 404 : 500,
      code === 'ENOENT' || code === 'ENOTDIR' ? 'Not found' : 'Internal server error');
  }
});

server.on('error', error => {
  console.error('Cannot start Warung Rush server:', error.message);
  process.exitCode = 1;
});

server.listen(8080, '127.0.0.1', () => {
  console.log('Warung Rush: http://127.0.0.1:8080');
});

// Local play-testing should leave no listener behind when stopped.
process.once('SIGINT', () => server.close());
process.once('SIGTERM', () => server.close());
