/* ═══════════════════════════════════════════════════════════
   chat.js — ChatGPT Clone Main Chat Logic
   ═══════════════════════════════════════════════════════════ */

// ── Guest limits ─────────────────────────────────────────────────────────────
const GUEST_MSG_LIMIT    = 5;
const GUEST_THREAD_LIMIT = 2;

// ── App state ─────────────────────────────────────────────────────────────────
let currentThreadId   = null;
let isStreaming        = false;
let threads           = [];      // { thread_id, title }[] for auth users
let sidebarOpen       = true;

// ── Auth helpers ───────────────────────────────────────────────────────────────
const token    = () => localStorage.getItem('token');
const isGuest  = () => sessionStorage.getItem('guest') === 'true';
const isAuth   = () => !!token();

function authHeaders() {
  const t = token();
  if (t) return { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` };
  return { 'Content-Type': 'application/json' };
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
(async function init() {
  if (!isAuth() && !isGuest()) {
    window.location.href = '/';
    return;
  }

  setupMarked();
  renderUserInfo();

  if (isAuth()) {
    await loadThreadList();
  } else {
    renderGuestSidebar();
  }

  updateGuestCounter();
  document.getElementById('chat-input').addEventListener('input', onInputChange);

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeSidebarMobile();
    }
  });
})();

// ── Marked.js setup ────────────────────────────────────────────────────────────
function setupMarked() {
  marked.setOptions({
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
      return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true,
  });
}

// Helper to decode JWT payload on the frontend safely
function decodeToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// ── User info in sidebar ───────────────────────────────────────────────────────
function renderUserInfo() {
  const el = document.getElementById('user-info');
  if (isGuest()) {
    el.innerHTML = `
      <div class="user-avatar">G</div>
      <div class="user-details">
        <div class="user-name">Guest</div>
        <div class="user-email">Temporary session</div>
      </div>`;
    // show login CTA in topbar
    document.getElementById('topbar-right').innerHTML = `
      <button class="icon-btn" onclick="goToAuth('login')" title="Sign in" style="width:auto;padding:0 12px;font-size:.82rem;gap:6px;color:#10a37f;font-weight:600;">
        Sign In
      </button>`;
  } else {
    let username = localStorage.getItem('username');
    let email    = localStorage.getItem('email');

    // Decode token if localStorage values are missing, "undefined", or "null"
    if (!username || username === 'undefined' || username === 'null' || !email || email === 'undefined' || email === 'null') {
      const t = token();
      if (t) {
        const payload = decodeToken(t);
        if (payload) {
          username = payload.username || username;
          email = payload.email || email;
          if (payload.username) localStorage.setItem('username', payload.username);
          if (payload.email) localStorage.setItem('email', payload.email);
        }
      }
    }

    username = username || 'User';
    email    = email || '';
    const initial  = username.charAt(0).toUpperCase();
    el.innerHTML = `
      <div class="user-avatar">${initial}</div>
      <div class="user-details">
        <div class="user-name">${escHtml(username)}</div>
        <div class="user-email">${escHtml(email)}</div>
      </div>`;
  }
}

// ── Load thread list (auth only) ───────────────────────────────────────────────
async function loadThreadList() {
  try {
    const res = await fetch('/api/threads', { headers: authHeaders() });
    if (!res.ok) { logout(); return; }
    const data = await res.json();
    threads = data.threads;
    renderThreadList();
  } catch {
    console.error('Failed to load threads');
  }
}

function renderThreadList() {
  const list = document.getElementById('thread-list');
  list.innerHTML = '';

  if (!threads.length) {
    list.innerHTML = '<div style="padding:10px 12px;font-size:.83rem;color:var(--text-dim);">No conversations yet</div>';
    return;
  }

  threads.forEach(({ thread_id, title }) => {
    const item = document.createElement('div');
    item.className = 'thread-item' + (thread_id === currentThreadId ? ' active' : '');
    item.dataset.tid = thread_id;

    const btn = document.createElement('button');
    btn.className = 'thread-btn';
    btn.textContent = title || 'Untitled';
    btn.title = title || '';
    btn.onclick = () => switchThread(thread_id);

    const del = document.createElement('button');
    del.className = 'thread-del-btn';
    del.title = 'Delete conversation';
    del.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="pointer-events:none;"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;
    del.onclick = (e) => { e.stopPropagation(); deleteThread(thread_id); };

    item.appendChild(btn);
    item.appendChild(del);
    list.appendChild(item);
  });
}

// Guest sidebar — just shows the current session's threads from sessionStorage
function renderGuestSidebar() {
  const guestThreads = JSON.parse(sessionStorage.getItem('guest_threads') || '[]');
  const list = document.getElementById('thread-list');
  list.innerHTML = '';

  if (!guestThreads.length) {
    list.innerHTML = '<div style="padding:10px 12px;font-size:.83rem;color:var(--text-dim);">No conversations yet</div>';
    return;
  }

  guestThreads.slice().reverse().forEach(({ thread_id, title }) => {
    const item = document.createElement('div');
    item.className = 'thread-item' + (thread_id === currentThreadId ? ' active' : '');
    item.dataset.tid = thread_id;

    const btn = document.createElement('button');
    btn.className = 'thread-btn';
    btn.textContent = title || 'Guest chat';
    btn.onclick = () => {
      // Guest threads aren't persistently loadable from server
      // Just switch to that thread context
      setActiveThread(thread_id);
      clearMessages();
      hideWelcome();
      closeSidebarMobile();
    };

    const del = document.createElement('button');
    del.className = 'thread-del-btn';
    del.title = 'Delete conversation';
    del.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="pointer-events:none;"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;
    del.onclick = (e) => { e.stopPropagation(); deleteThread(thread_id); };

    item.appendChild(btn);
    item.appendChild(del);
    list.appendChild(item);
  });
}

// ── Thread management ──────────────────────────────────────────────────────────
function startNewChat() {
  if (isGuest()) {
    const guestThreads = JSON.parse(sessionStorage.getItem('guest_threads') || '[]');
    if (guestThreads.length >= GUEST_THREAD_LIMIT) {
      showSignupModal();
      return;
    }
  }
  currentThreadId = null;
  clearMessages();
  showWelcome();
  highlightActiveThread(null);
  closeSidebarMobile();
}

async function switchThread(thread_id) {
  if (isStreaming) return;
  closeSidebarMobile();
  setActiveThread(thread_id);
  clearMessages();

  // Load conversation from server
  try {
    const res = await fetch(`/api/thread_messages/${thread_id}`, { headers: authHeaders() });
    if (!res.ok) {
      showWelcome();
      return;
    }
    const data = await res.json();
    if (data.messages && data.messages.length > 0) {
      hideWelcome();
      data.messages.forEach(msg => {
        appendMessage(msg.role === 'user' ? 'user' : 'ai', msg.content);
      });
      hljs.highlightAll();
      scrollToBottom();
    } else {
      showWelcome();
    }
  } catch (e) {
    console.error('Failed to load thread messages:', e);
    showWelcome();
  }

  // Highlight in sidebar
  highlightActiveThread(thread_id);
}

function setActiveThread(tid) {
  currentThreadId = tid;
  highlightActiveThread(tid);
}

function highlightActiveThread(tid) {
  document.querySelectorAll('.thread-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tid === tid);
  });
}

async function deleteThread(thread_id) {
  if (!confirm('Delete this conversation?')) return;

  if (isGuest()) {
    let guestThreads = JSON.parse(sessionStorage.getItem('guest_threads') || '[]');
    guestThreads = guestThreads.filter(t => t.thread_id !== thread_id);
    sessionStorage.setItem('guest_threads', JSON.stringify(guestThreads));
    if (currentThreadId === thread_id) { startNewChat(); }
    renderGuestSidebar();
    return;
  }

  try {
    const res = await fetch(`/api/thread/${encodeURIComponent(thread_id)}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) {
      threads = threads.filter(t => t.thread_id !== thread_id);
      if (currentThreadId === thread_id) { startNewChat(); }
      renderThreadList();
    } else {
      alert('Could not delete conversation.');
    }
  } catch (e) {
    console.error('Delete failed', e);
    alert('Could not delete conversation.');
  }
}

async function clearAllChats() {
  if (!confirm('Clear ALL conversations? This cannot be undone.')) return;
  try {
    await fetch('/api/threads/all', { method: 'DELETE', headers: authHeaders() });
    threads = [];
    currentThreadId = null;
    clearMessages(); showWelcome();
    renderThreadList();
  } catch (e) {
    console.error('Clear all failed', e);
  }
}

// ── Guest limit helpers ────────────────────────────────────────────────────────
function getGuestMsgCount() { return parseInt(sessionStorage.getItem('guest_msgs') || '0'); }
function incGuestMsgCount() { sessionStorage.setItem('guest_msgs', getGuestMsgCount() + 1); }

function checkGuestLimit() {
  if (!isGuest()) return true;
  const guestThreads = JSON.parse(sessionStorage.getItem('guest_threads') || '[]');
  const isNewThread  = !currentThreadId;
  if (isNewThread && guestThreads.length >= GUEST_THREAD_LIMIT) {
    showSignupModal(); return false;
  }
  if (getGuestMsgCount() >= GUEST_MSG_LIMIT) {
    showSignupModal(); return false;
  }
  return true;
}

function updateGuestCounter() {
  const el = document.getElementById('guest-counter');
  if (!isGuest()) { el.style.display = 'none'; return; }
  const used = getGuestMsgCount();
  const left = GUEST_MSG_LIMIT - used;
  el.style.display = 'inline';
  el.textContent = `${left} message${left !== 1 ? 's' : ''} remaining (guest) •`;
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function showSignupModal()   { document.getElementById('modal-overlay').hidden = false; }
function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').hidden = true;
  }
}

// ── Message sending ────────────────────────────────────────────────────────────
async function sendMessage() {
  const textarea = document.getElementById('chat-input');
  const message  = textarea.value.trim();
  if (!message || isStreaming) return;
  if (!checkGuestLimit()) return;

  textarea.value = '';
  autoResize(textarea);
  setSendDisabled(true);
  hideWelcome();

  // Render user message
  appendMessage('user', message);

  // Show typing indicator
  const typingEl = appendTypingIndicator();

  isStreaming = true;

  try {
    const body = {
      message,
      thread_id: currentThreadId || null,
      guest_session_id: sessionStorage.getItem('guest_session_id'),
    };

    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      removeTypingIndicator(typingEl);
      appendMessage('ai', '⚠️ Error: ' + res.statusText);
      return;
    }

    // Create AI message bubble to stream into
    removeTypingIndicator(typingEl);
    const aiBubble = createAiMessageBubble();
    let   fullText = '';
    let   isFirstChunk = true;

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let evt;
        try { evt = JSON.parse(line.slice(6)); } catch { continue; }

        if (evt.type === 'thread_id') {
          const wasNew = !currentThreadId;
          currentThreadId = evt.thread_id;

          if (wasNew) {
            if (isGuest()) {
              // Track in sessionStorage
              const guestThreads = JSON.parse(sessionStorage.getItem('guest_threads') || '[]');
              guestThreads.push({ thread_id: evt.thread_id, title: message.slice(0, 28) });
              sessionStorage.setItem('guest_threads', JSON.stringify(guestThreads));
              renderGuestSidebar();
            }
            // For auth users thread list updated at end
          }
        } else if (evt.type === 'token') {
          fullText += evt.content;
          if (isFirstChunk) { isFirstChunk = false; }
          renderAiBubble(aiBubble, fullText);
          scrollToBottom();
        } else if (evt.type === 'done') {
          renderAiBubble(aiBubble, fullText, true);
          addCopyButtons(aiBubble);
          if (isAuth()) {
            // Refresh thread list to pick up new/renamed thread
            await loadThreadList();
            highlightActiveThread(currentThreadId);
          }
          if (isGuest()) { incGuestMsgCount(); updateGuestCounter(); }
        } else if (evt.type === 'error') {
          renderAiBubble(aiBubble, '⚠️ ' + evt.message, true);
        }
      }
    }
  } catch (err) {
    removeTypingIndicator(typingEl);
    appendMessage('ai', '⚠️ Network error: ' + err.message);
  } finally {
    isStreaming = false;
    setSendDisabled(false);
    scrollToBottom();
  }
}

// ── DOM helpers ────────────────────────────────────────────────────────────────
function appendMessage(role, text) {
  const list = document.getElementById('messages-list');
  const row  = document.createElement('div');
  row.className = `message-row ${role}`;

  const initial = role === 'user'
    ? (isAuth() ? (localStorage.getItem('username') || 'U').charAt(0).toUpperCase() : 'G')
    : '✦';

  const avatarClass = role === 'user' ? 'user' : 'ai';
  const bubble = role === 'user'
    ? `<div class="message-bubble">${escHtml(text)}</div>`
    : `<div class="message-bubble">${marked.parse(text)}</div>`;

  row.innerHTML = `
    <div class="message-inner">
      <div class="msg-avatar ${avatarClass}">${initial}</div>
      <div class="message-content-wrap">${bubble}</div>
    </div>`;

  if (role === 'ai') addCopyButtons(row);
  list.appendChild(row);
  scrollToBottom();
  return row;
}

function appendTypingIndicator() {
  const list = document.getElementById('messages-list');
  const row  = document.createElement('div');
  row.className = 'message-row ai typing-row';
  row.innerHTML = `
    <div class="message-inner">
      <div class="msg-avatar ai">✦</div>
      <div class="message-content-wrap">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    </div>`;
  list.appendChild(row);
  scrollToBottom();
  return row;
}

function removeTypingIndicator(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

function createAiMessageBubble() {
  const list = document.getElementById('messages-list');
  const row  = document.createElement('div');
  row.className = 'message-row ai';
  row.innerHTML = `
    <div class="message-inner">
      <div class="msg-avatar ai">✦</div>
      <div class="message-content-wrap">
        <div class="message-bubble"></div>
      </div>
    </div>`;
  list.appendChild(row);
  return row;
}

function renderAiBubble(row, text, final = false) {
  const bubble = row.querySelector('.message-bubble');
  bubble.innerHTML = marked.parse(text);
  if (final) hljs.highlightAll();
  scrollToBottom();
}

function addCopyButtons(container) {
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.copy-code-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.textContent = 'Copy';
    btn.onclick = async () => {
      const code = pre.querySelector('code')?.textContent || pre.textContent;
      await navigator.clipboard.writeText(code);
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = 'Copy'), 1800);
    };
    pre.style.position = 'relative';
    pre.appendChild(btn);
  });
}

function clearMessages() {
  document.getElementById('messages-list').innerHTML = '';
}

function showWelcome() {
  document.getElementById('welcome-screen').classList.remove('hidden');
  const name = isAuth() ? localStorage.getItem('username') : 'there';
  document.getElementById('welcome-title').textContent = `How can I help you, ${name}?`;
}

function hideWelcome() {
  document.getElementById('welcome-screen').classList.add('hidden');
}

function scrollToBottom() {
  const wrap = document.getElementById('messages-wrap');
  wrap.scrollTop = wrap.scrollHeight;
}

function setSendDisabled(disabled) {
  document.getElementById('send-btn').disabled = disabled;
}

// ── Input handlers ─────────────────────────────────────────────────────────────
function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  onInputChange();
}

function onInputChange() {
  const val = document.getElementById('chat-input').value.trim();
  document.getElementById('send-btn').disabled = !val || isStreaming;
}

// ── Sidebar toggle ─────────────────────────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
    } else {
      sidebar.classList.add('open');
      if (overlay) overlay.classList.add('active');
    }
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

function closeSidebarMobile() {
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────────
function goToAuth(tab = 'login') {
  if (isGuest()) {
    localStorage.removeItem('token');
  }
  window.location.href = `/?tab=${tab}`;
}

// ── Logout ─────────────────────────────────────────────────────────────────────
function logout() {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/';
}

// ── Escape HTML ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
