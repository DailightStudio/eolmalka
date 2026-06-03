#!/usr/bin/env node
/**
 * EAS iOS build automation using node-pty (real PTY).
 * Fixes: extra chars from PTY init → use Ctrl+U+delay before typing
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pty     = require('node-pty');

const __dir     = dirname(fileURLToPath(import.meta.url));
const STATUS    = join(__dir, 'eas_status.txt');
const CODE_FILE = join(__dir, 'eas_2fa_code.txt');

const APPLE_ID   = 'wjs9280@naver.com';
const APPLE_PASS = 'tjwlsghWkd1!';
const EXPO_TOKEN = '3XKoFHG05ir3pxLM-22V3Wn9Dl1RpiUomLLq7B66';
const PROJECT    = 'C:\\Users\\Jay-server\\Desktop\\projects\\eolmalka';

function setStatus(msg) {
  writeFileSync(STATUS, msg, 'utf8');
  process.stderr.write(`[STATUS] ${msg}\n`);
}

function waitForCode(timeoutMs = 120000) {
  setStatus('WAITING_FOR_2FA');
  if (existsSync(CODE_FILE)) unlinkSync(CODE_FILE);
  process.stderr.write('>>> eas_2fa_code.txt 에 아이폰 2FA 코드 입력 <<<\n');
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (existsSync(CODE_FILE)) {
        const code = readFileSync(CODE_FILE, 'utf8').trim();
        if (code) {
          clearInterval(interval);
          clearTimeout(timer);
          unlinkSync(CODE_FILE);
          setStatus('GOT_2FA_CODE');
          resolve(code);
        }
      }
    }, 500);
    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error('2FA timeout'));
    }, timeoutMs);
  });
}

setStatus('STARTING');

const env = { ...process.env, EXPO_TOKEN, APPLE_ID, TERM: 'xterm-256color' };
const shell = 'cmd.exe';
const args  = ['/c', 'C:\\Users\\Jay-server\\AppData\\Roaming\\npm\\eas.cmd',
               'build', '--platform', 'ios', '--profile', 'preview'];

process.stderr.write(`[eas_auto] Spawning EAS iOS build...\n`);

const proc = pty.spawn(shell, args, {
  name: 'xterm-256color',
  cols: 180,
  rows: 40,
  cwd: PROJECT,
  env,
});

let buf = '';
let sentAppleId  = false;
let sentPassword = false;
let in2fa        = false;
let lastSend     = 0;
let retrying     = false;  // true after "try again?" — Apple ID pre-filled, just press Enter

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function strip(s) {
  return s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\r/g, '');
}

// Send text: Ctrl+U (clear line) then wait 400ms then type, then Enter
async function sendInput(text) {
  const now = Date.now();
  if (now - lastSend < 600) await delay(600 - (now - lastSend));
  process.stderr.write(`  [SEND] Ctrl+U + "${text}"\n`);
  proc.write('\x15');          // Ctrl+U: kill line
  await delay(400);            // wait for terminal to clear
  proc.write(text + '\r');
  lastSend = Date.now();
}

proc.onData(chunk => {
  process.stdout.write(chunk);
  buf += chunk;
  const cleanFull = strip(buf).slice(-4000);
  const cleanChunk = strip(chunk);

  // Apple ID interactive prompt (»가 있는 경우만 — 확인된 √ 줄은 무시)
  if (/Apple\s*ID\s*:.*»/i.test(cleanChunk) && !sentAppleId) {
    sentAppleId = true;
    if (retrying) {
      // 재시도: EAS가 Apple ID를 pre-fill → Ctrl+U 없이 Enter만 보내야 함
      // Ctrl+U를 보내면 필드가 비어서 제출됨
      retrying = false;
      process.stderr.write('  [SEND] Enter only (pre-filled Apple ID on retry)\n');
      delay(300).then(() => proc.write('\r'));
    } else {
      sendInput(APPLE_ID).catch(e => process.stderr.write(`[ERR] ${e}\n`));
    }
    return;
  }

  // Password interactive prompt (»가 있는 경우만, sentAppleId 불필요 — 재시도 시 auto-fill 고려)
  if (/[Pp]assword\s*\(for[^)]*\):.*»/.test(cleanChunk) && !sentPassword) {
    sentPassword = true;
    sendInput(APPLE_PASS).catch(e => process.stderr.write(`[ERR] ${e}\n`));
    return;
  }

  // 2FA
  if (!in2fa && /(one.time code|verification code|two.factor|2FA|Two-Factor)/i.test(cleanFull)) {
    in2fa = true;
    waitForCode()
      .then(code => { in2fa = false; sendInput(code); })
      .catch(e => { process.stderr.write(`[ERROR] 2FA: ${e.message}\n`); process.exit(1); });
    return;
  }

  // "try again?" → 오른쪽 화살표로 "yes" 선택 후 Enter, 플래그 리셋
  if (/try again\?/i.test(cleanChunk) || /»\s*no\s*\/\s*yes/i.test(cleanChunk)) {
    buf = '';  // 누적 버퍼 초기화 — 오래된 프롬프트가 재매칭되지 않도록
    retrying     = true;
    sentAppleId  = false;
    sentPassword = false;
    delay(400).then(() => {
      proc.write('\x1b[C'); // 오른쪽 화살표 → "yes"로 이동
      return delay(200);
    }).then(() => proc.write('\r'));
    return;
  }

  // Generic Y/n → Enter (default yes)
  if (/\?\s*»\s*\(Y\/n\)|\?\s*»\s*\(y\/N\)/i.test(cleanChunk)) {
    delay(300).then(() => proc.write('\r'));
  }
});

proc.onExit(({ exitCode }) => {
  setStatus(`DONE exitcode=${exitCode}`);
  process.stderr.write(`[eas_auto] Exit: ${exitCode}\n`);
  process.exit(exitCode ?? 0);
});

setTimeout(() => {
  setStatus('TIMEOUT');
  proc.kill();
  process.exit(1);
}, 600000);
