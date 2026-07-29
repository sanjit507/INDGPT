/* ── Tab switching ─────────────────────────────────────────────────────────── */
function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('panel-login').classList.toggle('active', isLogin);
  document.getElementById('panel-register').classList.toggle('active', !isLogin);
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-register').classList.toggle('active', !isLogin);
  const slider = document.querySelector('.tab-slider');
  if (slider) slider.classList.toggle('right', !isLogin);
}

// Redirect already logged-in users unless they explicitly requested an auth tab
(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');

  if (!tabParam && localStorage.getItem('token')) {
    window.location.href = '/chat';
    return;
  }

  if (tabParam === 'register') {
    switchTab('register');
  } else if (tabParam === 'login') {
    switchTab('login');
  }
})();

/* ── Shared helpers ─────────────────────────────────────────────────────────── */
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.querySelector('.btn-text').hidden = loading;
  btn.querySelector('.btn-spinner').hidden = !loading;
}

function showError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.add('visible');
}

function clearError(elId) {
  const el = document.getElementById(elId);
  el.textContent = '';
  el.classList.remove('visible');
}

function saveAuth(data) {
  if (data.access_token) localStorage.setItem('token', data.access_token);
  if (data.user_id) localStorage.setItem('user_id', data.user_id);
  if (data.email) localStorage.setItem('email', data.email);
  if (data.username) localStorage.setItem('username', data.username);
}

/* ── Login ─────────────────────────────────────────────────────────────────── */
async function handleLogin(e) {
  e.preventDefault();
  clearError('login-error');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showError('login-error', 'Please fill in all fields.');
    return;
  }

  setLoading('btn-login', true);
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    let data = {};
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    }
    if (!res.ok) throw new Error(data.detail || `Login failed (Status ${res.status})`);
    saveAuth(data);
    window.location.href = '/chat';
  } catch (err) {
    showError('login-error', err.message);
  } finally {
    setLoading('btn-login', false);
  }
}

/* ── Register ──────────────────────────────────────────────────────────────── */
async function handleRegister(e) {
  e.preventDefault();
  clearError('reg-error');
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  if (!username || !email || !password) {
    showError('reg-error', 'Please fill in all fields.');
    return;
  }
  if (password.length < 6) {
    showError('reg-error', 'Password must be at least 6 characters.');
    return;
  }

  setLoading('btn-register', true);
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });
    let data = {};
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    }
    if (!res.ok) throw new Error(data.detail || `Registration failed (Status ${res.status})`);
    saveAuth(data);
    window.location.href = '/chat';
  } catch (err) {
    showError('reg-error', err.message);
  } finally {
    setLoading('btn-register', false);
  }
}

/* ── Guest Mode ─────────────────────────────────────────────────────────────── */
function continueAsGuest() {
  const sessionId = crypto.randomUUID();
  sessionStorage.setItem('guest', 'true');
  sessionStorage.setItem('guest_session_id', sessionId);
  sessionStorage.setItem('guest_msgs', '0');
  sessionStorage.setItem('guest_threads', '[]');
  window.location.href = '/chat';
}
