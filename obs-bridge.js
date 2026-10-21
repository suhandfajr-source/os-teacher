const http = require('http');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'obs-bridge.log');
function log(msg) {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
}

const OBS_EXE = 'C:/Program Files/obs-studio/bin/64bit/obs64.exe';
// OBS butuh +-11 detik dari spawn sampai Recording Start (tes terukur)
const STARTUP_GRACE_MS = 13000;

let isRecording = false;
let spawnTime = 0;

function run(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true }, (err, stdout) => resolve({ err, out: (stdout || '') }));
  });
}

async function obsAlive() {
  const { out } = await run('tasklist /FI "IMAGENAME eq obs64.exe" /FO CSV /NH');
  return out.toLowerCase().includes('obs64.exe');
}

async function stopObsCleanly() {
  // 1. Pastikan OBS sudah lewat fase startup (rekaman sudah berjalan)
  const elapsed = Date.now() - spawnTime;
  if (elapsed < STARTUP_GRACE_MS) {
    const waitMs = STARTUP_GRACE_MS - elapsed;
    log(`OBS masih startup (${(elapsed / 1000).toFixed(1)}s), tunggu ${(waitMs / 1000).toFixed(1)}s agar rekaman mulai...`);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  // 2. Tutup graceful (ConfirmOnExit=false -> OBS stop record + finalisasi file saat shutdown)
  await run('taskkill /IM obs64.exe');
  log('Sinyal tutup terkirim');

  // 3. Polling maks 10 detik; kalau bandel, paksa (file sudah aman difinalisasi OBS? force hanya jika benar2 hang)
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (!(await obsAlive())) {
      log('OBS tertutup bersih, file tersimpan');
      return;
    }
  }
  log('OBS tidak merespons, force kill');
  await run('taskkill /F /IM obs64.exe');
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost:9876');
  log(`Request: ${req.method} ${url.pathname}`);

  if (url.pathname === '/start') {
    if (!isRecording) {
      isRecording = true;
      spawnTime = Date.now();
      log('START RECORDING (1920x1200@60fps MP4, audio via CABLE Input)');
      try {
        const obs = spawn(OBS_EXE, ['--startrecording', '--disable-shutdown-check'],
          { cwd: path.dirname(OBS_EXE), detached: true, stdio: 'ignore' });
        obs.unref();
        log(`OBS spawned PID: ${obs.pid}`);
      } catch (err) { log(`Spawn error: ${err.message}`); }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'recording' }));
  } else if (url.pathname === '/stop') {
    isRecording = false;
    log('STOP RECORDING (graceful + startup-grace)');
    stopObsCleanly().catch((e) => log('Stop error: ' + e.message));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'stopped' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: isRecording ? 'recording' : 'idle' }));
  }
});

server.listen(9876, () => log('Bridge aktif (v4: startup-grace + polling close) port 9876'));
