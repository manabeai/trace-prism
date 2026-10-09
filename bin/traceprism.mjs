#!/usr/bin/env node
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(process.cwd(), '.viz');
const defaultDataDir =
  process.platform === 'win32'
    ? process.env.APPDATA || process.env.LOCALAPPDATA
    : process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Application Support')
      : process.env.XDG_DATA_HOME && isAbsolute(process.env.XDG_DATA_HOME)
        ? process.env.XDG_DATA_HOME
        : join(homedir(), '.local', 'share');
const runDir = process.env.TRACEPRISM_RUN_DIR || join(defaultDataDir || homedir(), 'traceprism', 'runs');
if (!isAbsolute(runDir)) throw new Error('TRACEPRISM_RUN_DIR must be absolute');
const binDir = join(dataDir, 'bin');
const sdkTargetDir = join(dataDir, 'sdk-target');
const distDir = join(root, 'dist');
const port = Number(process.env.VIZ_PORT || 4317);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

async function loadRuns() {
  if (!existsSync(runDir)) return [];
  const files = (await readdir(runDir)).filter((name) => name.endsWith('.jsonl'));
  const runs = await Promise.all(
    files.map(async (name) => {
      try {
        const id = name.slice(0, -'.jsonl'.length);
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
        const tracePath = join(runDir, name);
        const raw = await readFile(tracePath, 'utf8');
        const lines = raw.split('\n');
        if (lines.at(-1) !== '') lines.pop(); // Ignore a frame still being written.
        const frames = lines.filter(Boolean).map((line) => JSON.parse(line));
        if (!frames.length) return null;
        const metaPath = join(runDir, `${id}.meta.json`);
        const saved = existsSync(metaPath) ? JSON.parse(await readFile(metaPath, 'utf8')) : {};
        const fileInfo = await stat(tracePath);
        const startedAt =
          saved.startedAt ||
          new Date(Number(id.match(/^run-(\d+)-/)?.[1]) || fileInfo.birthtimeMs).toISOString();
        return {
          id,
          source: saved.source || frames[0].source?.file || 'main.rs',
          input: saved.input || 'stdin',
          startedAt,
          durationMs: saved.durationMs || Math.max(0, fileInfo.mtimeMs - Date.parse(startedAt)),
          status: saved.status || 'running',
          pid: saved.pid || frames[0].pid,
          frames,
        };
      } catch (error) {
        console.error(`TracePrism: failed to read ${name}:`, error);
        return null;
      }
    }),
  );
  return runs.filter(Boolean).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

async function serve() {
  if (!existsSync(join(distDir, 'index.html'))) {
    throw new Error('Web build is missing. Run npm run build first.');
  }
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      if (url.pathname === '/api/runs') {
        const runs = await loadRuns();
        for (const run of runs)
          if (run.status === 'running' && Number.isInteger(run.pid)) {
            try {
              process.kill(run.pid, 0);
            } catch {
              run.status = 'completed';
            }
          }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify({ runs }));
        return;
      }
      const requested = decodeURIComponent(url.pathname);
      const path = resolve(
        distDir,
        `.${requested === '/' || requested === '/flavors' || requested === '/catalog' ? '/index.html' : requested}`,
      );
      if (path !== distDir && !path.startsWith(distDir + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!existsSync(path)) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': mime[extname(path)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      createReadStream(path).pipe(res);
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });
  await new Promise((ok, fail) => server.once('error', fail).listen(port, '127.0.0.1', ok));
  console.log(`TracePrism: http://127.0.0.1:${port}/`);
  return server;
}

async function serverAlreadyRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/runs`, { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function writeMeta(path, meta) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(meta));
  await rename(temporary, path);
}

async function run(source, noServe) {
  if (!source || !source.endsWith('.rs')) throw new Error('Usage: traceprism run main.rs [--no-serve]');
  const absolute = resolve(source);
  if (!existsSync(absolute)) throw new Error(`Source not found: ${source}`);
  await mkdir(runDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  const cargo = spawnSync('cargo', ['build', '--manifest-path', join(root, 'sdk/rust/Cargo.toml')], {
    stdio: 'inherit',
    env: { ...process.env, CARGO_TARGET_DIR: sdkTargetDir },
  });
  if (cargo.status !== 0) process.exit(cargo.status || 1);
  const id = `run-${Date.now()}-${process.pid}`;
  const binary = join(binDir, process.platform === 'win32' ? `${id}.exe` : id);
  const deps = join(sdkTargetDir, 'debug/deps');
  const sdk = join(sdkTargetDir, 'debug/libtraceprism.rlib');
  const compile = spawnSync(
    'rustc',
    [
      '--edition=2021',
      '--cfg',
      'feature="viz"',
      '--extern',
      `traceprism=${sdk}`,
      '-L',
      `dependency=${deps}`,
      absolute,
      '-o',
      binary,
    ],
    { stdio: 'inherit' },
  );
  if (compile.status !== 0) process.exit(compile.status || 1);
  const metaPath = join(runDir, `${id}.meta.json`);
  const meta = {
    id,
    source: relative(process.cwd(), absolute),
    input: 'stdin',
    startedAt: new Date().toISOString(),
    durationMs: 0,
    status: 'running',
  };
  await writeMeta(metaPath, meta);
  let ownServer = false;
  if (!noServe && !(await serverAlreadyRunning())) {
    if (!existsSync(join(distDir, 'index.html'))) {
      const build = spawnSync(npmCommand, ['run', 'build'], { cwd: root, stdio: 'inherit' });
      if (build.status !== 0) process.exit(build.status || 1);
    }
    await serve();
    ownServer = true;
  }
  const started = Date.now();
  const child = spawn(binary, [], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, VIZ_TRACE_PATH: join(runDir, `${id}.jsonl`), VIZ_RUN_ID: id },
  });
  const code = await new Promise((ok, fail) => {
    child.once('error', fail);
    child.once('exit', (exit, signal) => ok(signal ? 128 : (exit ?? 1)));
  });
  await writeMeta(metaPath, {
    ...meta,
    durationMs: Date.now() - started,
    status: code === 0 ? 'completed' : 'interrupted',
  });
  console.error(`TracePrism: saved ${id} (${code === 0 ? 'completed' : `exit ${code}`})`);
  if (ownServer) console.log('TracePrism: Ctrl+C to stop the web view');
  else process.exitCode = code;
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'serve') await serve();
  else if (command === 'run')
    await run(
      args.find((arg) => !arg.startsWith('--')),
      args.includes('--no-serve'),
    );
  else throw new Error('Usage: traceprism run main.rs [--no-serve] | traceprism serve');
} catch (error) {
  console.error(`TracePrism: ${error.message}`);
  process.exitCode = 1;
}
