// One job: send a prompt to a model and return its text.
// Providers: the Claude Code CLI, the Codex CLI, the Claude API, or any command.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadBrand } from './store.mjs';

const SYSTEM =
  'You write Instagram carousels for one person, in that person\'s voice, from the craft rules and the context you are given. You answer in exactly the output format the request asks for, with nothing before or after it.';

const TIMEOUT_MS = 8 * 60 * 1000;

function onPath(bin) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  return r.status === 0;
}

export function resolveProvider(config = loadBrand()) {
  const asked = process.env.CAROUSEL_WRITER || config.writer.provider || 'auto';
  if (asked !== 'auto') return asked;
  if (config.writer.command) return 'command';
  if (onPath('claude')) return 'claude-cli';
  if (onPath('codex')) return 'codex-cli';
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return 'claude-api';
  throw new Error(
    'No writer found. Install Claude Code or Codex, or set ANTHROPIC_API_KEY, or set writer.command in studio/brand.json.',
  );
}

function run(bin, args, input, { cwd, shell = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: cwd || os.tmpdir(), shell, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${bin} gave no answer within ${TIMEOUT_MS / 60000} minutes.`));
    }, TIMEOUT_MS);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`Could not start ${bin}: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`${bin} exited with code ${code}: ${(err || out).trim().slice(-600)}`));
      else resolve(out);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

// Runs away from this folder with no tools and no settings, so the call is a
// plain completion and the agent instructions in this repository stay out of it.
async function claudeCli(prompt, config) {
  const args = [
    '-p',
    '--system-prompt', SYSTEM,
    '--tools', '',
    '--setting-sources', '',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
  ];
  if (config.writer.model) args.push('--model', config.writer.model);
  return run('claude', args, prompt);
}

async function codexCli(prompt, config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-codex-'));
  const outFile = path.join(dir, 'answer.txt');
  const args = ['exec', '--skip-git-repo-check', '--ephemeral', '--ignore-rules', '-s', 'read-only', '-o', outFile];
  if (config.writer.model) args.push('-m', config.writer.model);
  args.push('-');
  try {
    await run('codex', args, `${SYSTEM}\n\n${prompt}`, { cwd: dir });
    return fs.readFileSync(outFile, 'utf8');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function claudeApi(prompt, config) {
  let Anthropic;
  try {
    ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
  } catch {
    throw new Error('The claude-api writer needs the SDK. Run "npm install" in this folder first.');
  }
  const client = new Anthropic();
  try {
    // The fallbacks beta reruns a request on another model if a safety
    // classifier declines it, inside the same call.
    const response = await client.beta.messages.create({
      model: config.writer.model || 'claude-opus-5-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') {
      throw new Error('The model declined this request. Change the topic and try again.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('The answer was cut off at the token limit. Shorten studio/context.md or the voice rules.');
    }
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      throw new Error('The Claude API rejected the credentials. Check ANTHROPIC_API_KEY.');
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new Error('The Claude API rate limit was reached. Wait a minute and try again.');
    }
    if (e instanceof Anthropic.APIConnectionError) {
      throw new Error('Could not reach the Claude API. Check the network connection.');
    }
    if (e instanceof Anthropic.APIError) {
      throw new Error(`Claude API error ${e.status}: ${e.message}`);
    }
    throw e;
  }
}

export async function complete(prompt, config = loadBrand()) {
  const provider = resolveProvider(config);
  let text;
  if (provider === 'claude-cli') text = await claudeCli(prompt, config);
  else if (provider === 'codex-cli') text = await codexCli(prompt, config);
  else if (provider === 'claude-api') text = await claudeApi(prompt, config);
  else if (provider === 'command') {
    if (!config.writer.command) throw new Error('writer.provider is "command" and writer.command is empty.');
    text = await run(config.writer.command, [], prompt, { shell: true, cwd: process.cwd() });
  } else throw new Error(`Unknown writer provider "${provider}".`);
  if (!text || !text.trim()) throw new Error(`The ${provider} writer returned nothing.`);
  return text;
}
