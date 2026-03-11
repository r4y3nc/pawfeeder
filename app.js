// ── CONFIG ───────────────────────────────────────────────────
const BROKER           = 'wss://broker.hivemq.com:8884/mqtt';
const TOPIC_MONITORING = 'pakan/monitoring';
const TOPIC_KONTROL    = 'pakan/kontrol';
const BERAT_TARGET     = 3.0; // KG target wadah

// ── HELPERS ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function getTime() {
  return new Date().toLocaleTimeString('id-ID', { hour12: false });
}

function log(msg, type = 'info') {
  const mon = $('monitor');
  const el  = document.createElement('div');
  el.className = 'log';
  el.innerHTML = `<span class="lt">[${getTime()}]</span><span class="${type}">${msg}</span>`;
  mon.appendChild(el);
  mon.scrollTop = mon.scrollHeight;
}

function clearLog() {
  $('monitor').innerHTML = '';
  log('Monitor dibersihkan', 'warn');
}

// ── WADAH PAKAN UI (Load Cell) ───────────────────────────────
function updateWadah(berat) {
  const b    = parseFloat(berat) || 0;
  const pct  = Math.min((b / BERAT_TARGET) * 100, 100);

  // Fill visual container
  $('wadahFill').style.height = pct + '%';

  // Weight value
  $('wadahVal').textContent = b.toFixed(2);

  // Gauge ring (circumference = 2π×25 ≈ 157)
  const offset = 157 - (pct / 100) * 157;
  const gauge  = $('gaugeFill');
  gauge.style.strokeDashoffset = offset;

  // Color & stroke based on level
  let color, strokeColor;
  if (pct >= 90)      { color = '#22c55e'; strokeColor = '#22c55e'; }
  else if (pct >= 50) { color = '#eab308'; strokeColor = '#eab308'; }
  else if (pct >= 20) { color = '#f97316'; strokeColor = '#f97316'; }
  else                { color = '#ef4444'; strokeColor = '#ef4444'; }

  $('wadahFill').style.background = `linear-gradient(180deg, ${color}55 0%, ${color}99 100%)`;
  $('wadahFill').style.setProperty('--shimmer-color', color);
  gauge.style.stroke = strokeColor;

  // Status chip
  const chip   = $('wadahChip');
  let chipText, chipColor;
  if (b <= 0)         { chipText = '— Kosong';         chipColor = '#64748b'; }
  else if (pct < 20)  { chipText = '⚠️ Hampir kosong'; chipColor = '#ef4444'; }
  else if (pct < 50)  { chipText = '🟠 Sedang';        chipColor = '#f97316'; }
  else if (pct < 90)  { chipText = '🟡 Cukup';         chipColor = '#eab308'; }
  else                { chipText = '✅ Penuh';          chipColor = '#22c55e'; }

  chip.textContent          = chipText;
  chip.style.color          = chipColor;
  chip.style.borderColor    = chipColor + '55';
  chip.style.background     = chipColor + '11';
}

// ── STOK PAKAN UI (HC-SR04 — level bar only) ─────────────────
function updateStok(stok) {
  const bar = $('stokBar');
  let pct, color;

  if (stok === 'FULL')        { pct = 100; color = '#22c55e'; }
  else if (stok === 'SEDANG') { pct = 55;  color = '#eab308'; }
  else                        { pct = 8;   color = '#ef4444'; }

  bar.style.width      = pct + '%';
  bar.style.background = color;

  // Color the text value
  const valEl = $('valStok');
  valEl.textContent  = stok || '---';
  valEl.style.color  = color;
}

// ── SERVO UI ─────────────────────────────────────────────────
function updateServo(status) {
  const el   = $('valServo');
  const fill = $('servoStatusFill');

  if (status === 'BUKA') {
    el.textContent    = '🟢 BUKA';
    el.style.color    = '#22c55e';
    fill.style.width  = '100%';
    fill.style.background = '#22c55e';
  } else {
    el.textContent    = '🔴 TUTUP';
    el.style.color    = '#ef4444';
    fill.style.width  = '15%';
    fill.style.background = '#ef4444';
  }
}

// ── AUTO MODE UI ─────────────────────────────────────────────
function updateAutoModeUI(isOn) {
  $('infoAutoMode').textContent  = isOn ? 'ON' : 'OFF';
  $('infoAutoMode').style.color  = isOn ? '#22c55e' : '#64748b';
  $('btnBuka').disabled          = isOn;
  $('btnTutup').disabled         = isOn;
  $('servoLock').classList.toggle('show', isOn);
  if (isOn) log('🔒 Servo manual dinonaktifkan — Auto Mode ON', 'warn');
}

function enableControls(on) {
  const autoOn = $('toggleAuto').checked;
  $('btnBuka').disabled      = !on || autoOn;
  $('btnTutup').disabled     = !on || autoOn;
  $('btnSetPagi').disabled   = !on;
  $('btnSetMalam').disabled  = !on;
}

// ── MQTT CONNECT ─────────────────────────────────────────────
log('Memulai koneksi MQTT...', 'info');
log('Broker : ' + BROKER, 'info');
log('Sub    : ' + TOPIC_MONITORING, 'info');
log('Pub    : ' + TOPIC_KONTROL, 'info');
log('────────────────────────────────', 'div');

const client = mqtt.connect(BROKER, {
  clientId      : 'Web_PawFeeder_' + Math.random().toString(16).substr(2, 6),
  keepalive     : 60,
  reconnectPeriod: 3000
});

client.on('connect', () => {
  $('dot').className       = 'conn-dot on';
  $('connText').textContent = '✅ Terhubung';
  log('✅ MQTT Connected!', 'success');
  log('Client ID: ' + client.options.clientId, 'success');

  client.subscribe(TOPIC_MONITORING, err => {
    if (!err) log('📌 Subscribe: ' + TOPIC_MONITORING, 'success');
    else      log('❌ Subscribe error: ' + err, 'error');
  });

  enableControls(true);
  log('────────────────────────────────', 'div');
});

client.on('reconnect', () => {
  $('dot').className        = 'conn-dot mid';
  $('connText').textContent  = '🔄 Reconnecting...';
  enableControls(false);
  log('⚠️  Reconnecting...', 'warn');
});

client.on('error', err => {
  $('dot').className        = 'conn-dot';
  $('connText').textContent  = '❌ Error';
  log('❌ Error: ' + err.message, 'error');
});

client.on('offline', () => {
  $('dot').className        = 'conn-dot';
  $('connText').textContent  = '🔴 Offline';
  log('🔴 Client offline', 'error');
  enableControls(false);
});

// ── TERIMA DATA MONITORING ───────────────────────────────────
client.on('message', (topic, payload) => {
  if (topic !== TOPIC_MONITORING) return;

  let data;
  try { data = JSON.parse(payload.toString()); }
  catch (e) { log('❌ Parse error: ' + e, 'error'); return; }

  log('📩 Data diterima dari ESP32', 'recv');

  // Waktu
  $('valWaktu').textContent = data.waktu || '--:--';

  // Stok pakan — hanya dari HC-SR04 (FULL/SEDANG/HABIS)
  updateStok(data.stok_pakan);

  // Hewan & konsumsi
  const hewanEl = $('valHewan');
  hewanEl.textContent  = data.hewan || '---';
  hewanEl.style.color  = data.hewan === 'TERDETEKSI' ? '#f97316' : '#64748b';
  $('valMakan').textContent    = 'Makan: ' + (data.jumlah_makan ?? '--') + ' kali';
  $('valKonsumsi').textContent = (data.konsumsi ?? '0.00');

  // Servo
  updateServo(data.servo);

  // Berat wadah — dari Load Cell (ditampilkan di panel kanan)
  updateWadah(data.berat);

  // WiFi status
  if (data.wifi_connected !== undefined) {
    $('wifiStatus').textContent = data.wifi_connected ? '✅ Online' : '❌ Offline';
    $('wifiStatus').style.color = data.wifi_connected ? '#22c55e' : '#ef4444';
  }

  // Sync auto mode dari ESP32
  if (data.auto_mode) {
    const isOn = data.auto_mode === 'ON';
    $('toggleAuto').checked = isOn;
    updateAutoModeUI(isOn);
  }

  log(`STOK: ${data.stok_pakan} | BERAT: ${data.berat}kg | SERVO: ${data.servo}`, 'info');
});

// ── KIRIM KONTROL ────────────────────────────────────────────
function publish(obj) {
  const json = JSON.stringify(obj);
  client.publish(TOPIC_KONTROL, json, { qos: 0 }, err => {
    if (err) log('❌ Gagal kirim: ' + err, 'error');
    else     log('📤 Terkirim → ' + json, 'send');
  });
}

function kirimServo(val) {
  if ($('toggleAuto').checked) {
    log('⛔ Servo manual diblokir — Auto Mode sedang ON', 'warn');
    return;
  }
  publish({ servo_manual: val });
  log('SERVO → ' + val, val === 'ON' ? 'success' : 'warn');
}

function kirimJadwal() {
  const pagi   = $('inputPagi').value  || '08:00';
  const malam  = $('inputMalam').value || '19:00';
  const autoOn = $('toggleAuto').checked;

  publish({
    jadwal    : { pagi, malam },
    auto_mode : autoOn ? 'ON' : 'OFF'
  });

  $('infoPagi').textContent  = pagi;
  $('infoMalam').textContent = malam;
  updateAutoModeUI(autoOn);
  log(`JADWAL SET → Pagi: ${pagi} | Malam: ${malam}`, 'success');
}

function kirimAutoMode() {
  const autoOn = $('toggleAuto').checked;
  const pagi   = $('inputPagi').value  || '08:00';
  const malam  = $('inputMalam').value || '19:00';

  publish({
    jadwal    : { pagi, malam },
    auto_mode : autoOn ? 'ON' : 'OFF'
  });

  updateAutoModeUI(autoOn);
  log('AUTO MODE → ' + (autoOn ? 'ON' : 'OFF'), autoOn ? 'success' : 'warn');
}