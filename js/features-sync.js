function getSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    return raw ? JSON.parse(raw) : { apiUrl: '', token: '', email: '' };
  } catch (_) {
    return { apiUrl: '', token: '', email: '' };
  }
}

function saveSyncConfig(cfg) {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(cfg));
}

async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptPayload(obj, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(obj))
  );
  return {
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(ciphertext))
  };
}

async function decryptPayload(blob, passphrase) {
  const salt = new Uint8Array(blob.salt);
  const iv = new Uint8Array(blob.iv);
  const data = new Uint8Array(blob.data);
  const key = await deriveKey(passphrase, salt);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(dec));
}

async function syncLogin() {
  const url = document.getElementById('sync-api-url')?.value.trim().replace(/\/$/, '');
  const email = document.getElementById('sync-email')?.value.trim();
  const password = document.getElementById('sync-password')?.value;
  if (!url || !email || !password) {
    showAppToast('Completa URL, email y contraseña.');
    return;
  }
  const res = await fetch(url + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    showAppToast('Login fallido: ' + res.status);
    return;
  }
  const { token } = await res.json();
  saveSyncConfig({ apiUrl: url, token, email });
  showAppToast('Sesión iniciada.');
}

async function syncPush() {
  const cfg = getSyncConfig();
  const passphrase = document.getElementById('sync-passphrase')?.value;
  if (!cfg.apiUrl || !cfg.token || !passphrase) {
    showAppToast('Inicia sesión y define passphrase.');
    return;
  }
  const mapId = getCurrentMapId();
  const payload = {
    version: STORAGE_VERSION,
    rootNodes,
    rootConnections,
    updatedAt: new Date().toISOString()
  };
  const encrypted = await encryptPayload(payload, passphrase);
  const res = await fetch(cfg.apiUrl + '/maps/' + mapId, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + cfg.token
    },
    body: JSON.stringify({ encrypted, updatedAt: payload.updatedAt, name: getCurrentMapName() })
  });
  if (!res.ok) {
    showAppToast('Sync fallido: ' + res.status);
    return;
  }
  showAppToast('Mapa subido.');
}

async function syncPull() {
  const cfg = getSyncConfig();
  const passphrase = document.getElementById('sync-passphrase')?.value;
  if (!cfg.apiUrl || !cfg.token || !passphrase) {
    showAppToast('Inicia sesión y define passphrase.');
    return;
  }
  const mapId = getCurrentMapId();
  const res = await fetch(cfg.apiUrl + '/maps/' + mapId, {
    headers: { Authorization: 'Bearer ' + cfg.token }
  });
  if (!res.ok) {
    showAppToast('Descarga fallida: ' + res.status);
    return;
  }
  const remote = await res.json();
  if (!remote.encrypted) {
    showAppToast('No hay datos remotos.');
    return;
  }
  const localUpdated = getMapsIndex().find(m => m.id === mapId)?.updatedAt;
  if (localUpdated && remote.updatedAt && localUpdated > remote.updatedAt) {
    if (!confirm('El mapa local es más reciente. ¿Usar remoto igualmente?')) return;
  }
  const data = await decryptPayload(remote.encrypted, passphrase);
  applyMapData(data, false);
  showAppToast('Mapa descargado.');
}

function initSyncFeatures() {
  const panel = document.getElementById('sync-panel');
  const toggleBtn = document.getElementById('sync-toggle-btn');
  const closeBtn = document.getElementById('sync-panel-close');
  const loginBtn = document.getElementById('sync-login-btn');
  const pushBtn = document.getElementById('sync-push-btn');
  const pullBtn = document.getElementById('sync-pull-btn');

  const cfg = getSyncConfig();
  const urlEl = document.getElementById('sync-api-url');
  const emailEl = document.getElementById('sync-email');
  if (urlEl && cfg.apiUrl) urlEl.value = cfg.apiUrl;
  if (emailEl && cfg.email) emailEl.value = cfg.email;

  if (toggleBtn && panel) toggleBtn.onclick = () => {
    closeAllOverlays?.();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  };
  if (closeBtn && panel) closeBtn.onclick = () => {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  };
  if (loginBtn) loginBtn.onclick = syncLogin;
  if (pushBtn) pushBtn.onclick = syncPush;
  if (pullBtn) pullBtn.onclick = syncPull;
}
