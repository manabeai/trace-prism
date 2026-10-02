#!/usr/bin/env node
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTraceValidator } from '../protocol/v2/validate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runDir = join(root, '.viz', 'runs');
const binDir = join(root, '.viz', 'bin');
const distDir = join(root, 'dist');
const port = Number(process.env.VIZ_PORT || 4317);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

async function loadRuns() {
  if (!existsSync(runDir)) return [];
  const files = (await readdir(runDir)).filter((name) => name.endsWith('.meta.json'));
  const runs = await Promise.all(
    files.map(async (name) => {
      try {
        const meta = JSON.parse(await readFile(join(runDir, name), 'utf8'));
        const tracePath = join(runDir, `${meta.id}.jsonl`);
        const raw = existsSync(tracePath) ? await readFile(tracePath, 'utf8') : '';
        const lines = raw.split('\n');
        if (lines.at(-1) !== '') lines.pop(); // Ignore a frame still being written.
        return { ...meta, frames: lines.filter(Boolean).map((line) => JSON.parse(line)) };
      } catch (error) {
        console.error(`algo-vis: failed to read ${name}:`, error);
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
  const validators = new Map();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      if (req.method === 'POST' && url.pathname === '/api/record') {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 10_000_000) {
            res.writeHead(413);
            res.end();
            return;
          }
          chunks.push(chunk);
        }
        const event = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (
          event.format !== 'viz.trace/v2' ||
          typeof event.runId !== 'string' ||
          !/^[A-Za-z0-9_-]{1,128}$/.test(event.runId)
        ) {
          res.writeHead(400);
          res.end();
          return;
        }
        const metaPath = join(runDir, `${event.runId}.meta.json`);
        const tracePath = join(runDir, `${event.runId}.jsonl`);
        await mkdir(runDir, { recursive: true });
        let validator = validators.get(event.runId);
        if (!validator) {
          validator = createTraceValidator();
          if (existsSync(tracePath)) {
            const existing = (await readFile(tracePath, 'utf8')).split('\n').filter(Boolean);
            for (const [index, line] of existing.entries())
              validator.accept(JSON.parse(line), `stored line ${index + 1}`);
          }
          validators.set(event.runId, validator);
        }
        try {
          validator.accept(event);
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(String(error));
          return;
        }
        const now = new Date().toISOString();
        const meta = existsSync(metaPath)
          ? JSON.parse(await readFile(metaPath, 'utf8'))
          : {
              id: event.runId,
              source: event.source?.file || 'main.rs',
              input: 'stdin',
              startedAt: now,
              durationMs: 0,
              status: 'running',
              pid: event.pid,
            };
        meta.durationMs = Date.now() - Date.parse(meta.startedAt);
        await appendFile(tracePath, `${JSON.stringify(event)}\n`);
        await writeFile(metaPath, JSON.stringify(meta));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
        return;
      }
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
        `.${requested === '/' || requested === '/flavors' ? '/index.html' : requested}`,
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
  console.log(`algo-vis: http://127.0.0.1:${port}/`);
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

async function run(source, noServe) {
  if (!source || !source.endsWith('.rs')) throw new Error('Usage: viz run main.rs [--no-serve]');
  const absolute = resolve(source);
  if (!existsSync(absolute)) throw new Error(`Source not found: ${source}`);
  await mkdir(runDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  const cargo = spawnSync(
    'cargo',
    ['build', '--offline', '--manifest-path', join(root, 'sdk/rust/Cargo.toml')],
    { stdio: 'inherit' },
  );
  if (cargo.status !== 0) process.exit(cargo.status || 1);
  const id = `run-${Date.now()}-${process.pid}`;
  const binary = join(binDir, id);
  const deps = join(root, 'sdk/rust/target/debug/deps');
  const sdk = join(root, 'sdk/rust/target/debug/libalgo_vis.rlib');
  const compile = spawnSync(
    'rustc',
    [
      '--edition=2021',
      '--cfg',
      'feature="viz"',
      '--extern',
      `algo_vis=${sdk}`,
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
  await writeFile(metaPath, JSON.stringify(meta));
  let ownServer = false;
  if (!noServe && !(await serverAlreadyRunning())) {
    if (!existsSync(join(distDir, 'index.html'))) {
      const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
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
  await writeFile(
    metaPath,
    JSON.stringify({
      ...meta,
      durationMs: Date.now() - started,
      status: code === 0 ? 'completed' : 'interrupted',
    }),
  );
  console.error(`algo-vis: saved ${id} (${code === 0 ? 'completed' : `exit ${code}`})`);
  if (ownServer) console.log('algo-vis: Ctrl+C to stop the web view');
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
  else throw new Error('Usage: viz run main.rs [--no-serve] | viz serve');
} catch (error) {
  console.error(`algo-vis: ${error.message}`);
  process.exitCode = 1;
}
