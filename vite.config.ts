import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

function axonSourcePlugin(): Plugin {
  return {
    name: 'axon-source-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const parsedUrl = new URL(req.url, 'http://localhost');

        if (parsedUrl.pathname === '/api/source/tree') {
          try {
            const rootDir = process.cwd();
            const IGNORE = new Set(['node_modules', '.git', 'dist', '.cache', 'bun.lock', '.DS_Store', '.env', '.env.local', '.env.development', '.env.production', '.env.test']);

            function scan(dir: string, base = ''): any[] {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              const result: any[] = [];
              for (const ent of entries) {
                if (IGNORE.has(ent.name)) continue;
                const relPath = base ? `${base}/${ent.name}` : ent.name;
                const fullPath = path.join(dir, ent.name);
                if (ent.isDirectory()) {
                  result.push({
                    name: ent.name,
                    path: relPath,
                    type: 'directory',
                    children: scan(fullPath, relPath),
                  });
                } else {
                  const stats = fs.statSync(fullPath);
                  result.push({
                    name: ent.name,
                    path: relPath,
                    type: 'file',
                    size: stats.size,
                    mtime: Math.floor(stats.mtimeMs),
                  });
                }
              }
              // Sort directories first, then files alphabetically
              return result.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'directory' ? -1 : 1;
              });
            }

            const tree = scan(rootDir);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, tree, scannedAt: Date.now() }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
        }

        if (parsedUrl.pathname === '/api/source/file') {
          try {
            const targetRelPath = parsedUrl.searchParams.get('path');
            if (!targetRelPath) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Missing path parameter' }));
              return;
            }

            const rootDir = process.cwd();
            const fullPath = path.resolve(rootDir, targetRelPath);

            // Path traversal guard
            if (fullPath !== rootDir && !fullPath.startsWith(rootDir + path.sep)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ success: false, error: 'Access denied' }));
              return;
            }

            if (/^\.env(\..+)?$/.test(path.basename(fullPath)) && path.basename(fullPath) !== '.env.example') {
              res.statusCode = 403;
              res.end(JSON.stringify({ success: false, error: 'Access denied' }));
              return;
            }

            if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, error: 'File not found' }));
              return;
            }

            const stats = fs.statSync(fullPath);
            const content = fs.readFileSync(fullPath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                path: targetRelPath,
                name: path.basename(fullPath),
                content,
                size: stats.size,
                mtime: Math.floor(stats.mtimeMs),
              })
            );
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
        }

        if (parsedUrl.pathname === '/api/source/all') {
          try {
            const rootDir = process.cwd();
            const IGNORE = new Set(['node_modules', '.git', 'dist', '.cache', 'bun.lock', '.DS_Store', '.env', '.env.local', '.env.development', '.env.production', '.env.test']);
            const files: { path: string; name: string; content: string; size: number; mtime: number }[] = [];

            function collect(dir: string, base = '') {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const ent of entries) {
                if (IGNORE.has(ent.name)) continue;
                const relPath = base ? `${base}/${ent.name}` : ent.name;
                const fullPath = path.join(dir, ent.name);
                if (ent.isDirectory()) {
                  collect(fullPath, relPath);
                } else {
                  const stats = fs.statSync(fullPath);
                  let content = '';
                  try {
                    const bytes = fs.readFileSync(fullPath);
                    // Binary files cannot be copied as text without being corrupted: skip them.
                    if (bytes.includes(0)) continue;
                    content = bytes.toString('utf8');
                  } catch {
                    continue;
                  }
                  files.push({
                    path: relPath,
                    name: ent.name,
                    content,
                    size: stats.size,
                    mtime: Math.floor(stats.mtimeMs),
                  });
                }
              }
            }

            collect(rootDir);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, files, scannedAt: Date.now() }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), axonSourcePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

