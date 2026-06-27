/* ================================================================
   ASTRA AI IDE — APPLICATION CORE v2.0
   Virtual File System · Monaco Integration · Live Compiler
   Gemini Agent · Resizable Panels · Auto-Save · Keyboard Shortcuts
   ================================================================ */

'use strict';

/* ── INITIAL VIRTUAL FILE SYSTEM ── */
const DEFAULT_VFS = {
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="card">
    <div class="icon">✦</div>
    <h1>Welcome to Astra IDE</h1>
    <p>Your AI-powered development workspace is ready.</p>
    <p>Chat with <strong>Astra</strong> to build any application.</p>
    <button id="btn">Get Started</button>
    <div id="msg" class="msg"></div>
  </div>
  <script src="app.js"><\/script>
</body>
</html>`,
    "style.css": `* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: linear-gradient(135deg, #0a0f1e 0%, #131b35 50%, #0e1628 100%);
  color: #e8edf7;
  font-family: 'Inter', system-ui, sans-serif;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 3rem 2.5rem;
  text-align: center;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}

.icon {
  font-size: 2.5rem;
  color: #06b6d4;
  margin-bottom: 1rem;
  animation: spin 8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

h1 {
  font-size: 1.6rem;
  font-weight: 800;
  margin-bottom: 0.75rem;
  background: linear-gradient(135deg, #06b6d4, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

p { color: #8899b8; margin-bottom: 0.5rem; font-size: 0.95rem; }
strong { color: #e8edf7; }

button {
  margin-top: 1.5rem;
  background: linear-gradient(135deg, #06b6d4, #8b5cf6);
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, filter 0.2s;
}

button:hover { transform: translateY(-2px); filter: brightness(1.1); }

.msg {
  margin-top: 1rem;
  font-size: 0.85rem;
  color: #10b981;
  min-height: 1.2em;
  font-weight: 500;
}`,
    "app.js": `// Interactive script
const btn = document.getElementById('btn');
const msg = document.getElementById('msg');

btn.addEventListener('click', () => {
  msg.textContent = '🚀 Astra IDE is ready. Chat to build anything!';
  btn.style.transform = 'scale(0.95)';
  setTimeout(() => btn.style.transform = '', 150);
});`
};

/* ── STATE ── */
const state = {
    vfs: JSON.parse(JSON.stringify(DEFAULT_VFS)),
    activeFile: 'index.html',
    openTabs: ['index.html', 'style.css', 'app.js'],
    dirtyFiles: new Set(),
    editor: null,
    currentFilter: 'all',
    activePanel: 'explorer',
    currentDevice: 'desktop',
    lastPreviewContent: '',
    isTerminalCollapsed: false,
    isDark: true,
    lastPrompt: '',
    contextMenuTarget: null,
    autosaveTimer: null,
    editorSettings: { fontSize: 13, tabSize: 2, wordWrap: 'on', minimap: false, theme: 'vs-dark' }
};

/* ── HELPERS ── */
const $ = id => document.getElementById(id);
const fmt = t => new Date(t).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const now = () => fmt(Date.now());

function getLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = { html: 'html', css: 'css', js: 'javascript', ts: 'typescript', json: 'json', md: 'markdown', py: 'python' };
    return map[ext] || 'plaintext';
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        html: { cls: 'bxl-html5', color: 'fi-html' },
        css:  { cls: 'bxl-css3',  color: 'fi-css'  },
        js:   { cls: 'bxl-javascript', color: 'fi-js' },
        json: { cls: 'bx-code-curly', color: 'fi-json' },
        md:   { cls: 'bx-file-blank',  color: 'fi-md'   },
    };
    return icons[ext] || { cls: 'bx-file-blank', color: '' };
}

function getLangDisplay(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = { html: 'HTML', css: 'CSS', js: 'JavaScript', ts: 'TypeScript', json: 'JSON', md: 'Markdown', py: 'Python' };
    return map[ext] || 'Plain Text';
}

/* ── TERMINAL LOG ── */
function log(msg, level = 'info') {
    const body = $('terminal-body');
    if (!body) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    line.dataset.level = level;
    const levelLabels = { info: 'INFO', success: 'OK', warn: 'WARN', error: 'ERR', agent: 'AGNT' };
    line.innerHTML = `
        <span class="log-ts">${now()}</span>
        <span class="log-level">${levelLabels[level] || level.toUpperCase()}</span>
        <span class="log-msg">${msg}</span>
    `;
    if (state.currentFilter !== 'all' && state.currentFilter !== level) {
        line.classList.add('filtered');
    }
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
}

/* ── STATUS BAR ── */
function updateStatusBar() {
    const file = state.activeFile;
    $('sb-lang').textContent = getLangDisplay(file);
    const content = state.vfs[file] || '';
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    $('sb-words').textContent = `${words} words`;
    $('breadcrumb-file').textContent = file;
}

function updateCursorStatus(position) {
    if (position) $('sb-cursor').textContent = `Ln ${position.lineNumber}, Col ${position.column}`;
}

function setAutosaveState(status) {
    const el = $('sb-autosave');
    if (status === 'saving') {
        el.innerHTML = `<i class='bx bx-loader-alt' style="animation: spin-sb 1s linear infinite;"></i> Saving...`;
    } else {
        el.innerHTML = `<i class='bx bx-cloud-upload'></i> Saved`;
        el.style.color = '';
    }
}

/* ── DIRTY FILE TRACKING (auto-save debounce) ── */
function markDirty(file) {
    state.dirtyFiles.add(file);
    $('sb-autosave').innerHTML = `<i class='bx bx-edit'></i> Unsaved`;
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(() => autoSave(), 2000);
    renderFileTree();
    renderTabs();
}

function autoSave() {
    if (state.editor && state.activeFile) {
        state.vfs[state.activeFile] = state.editor.getValue();
        state.dirtyFiles.delete(state.activeFile);
    }
    setAutosaveState('saved');
    renderFileTree();
    renderTabs();
    log('Auto-saved workspace files.', 'info');
}

/* ── FILE TREE ── */
function renderFileTree() {
    const tree = $('file-tree');
    if (!tree) return;
    tree.innerHTML = '';
    const files = Object.keys(state.vfs).sort();
    files.forEach(fname => {
        const item = document.createElement('div');
        item.className = `file-item${fname === state.activeFile ? ' active' : ''}`;
        item.setAttribute('role', 'treeitem');
        item.dataset.file = fname;
        const ico = getFileIcon(fname);
        const isDirty = state.dirtyFiles.has(fname);
        item.innerHTML = `
            <i class='bx ${ico.cls} fi-icon ${ico.color}'></i>
            <span class="fi-name">${fname}</span>
            ${isDirty ? '<span class="fi-dirty">●</span>' : ''}
            <i class='bx bx-x fi-delete' data-file="${fname}" title="Delete"></i>
        `;
        item.addEventListener('click', e => {
            if (e.target.closest('.fi-delete')) return;
            switchFile(fname);
        });
        item.addEventListener('contextmenu', e => {
            e.preventDefault();
            state.contextMenuTarget = fname;
            showContextMenu(e.clientX, e.clientY);
        });
        item.querySelector('.fi-delete').addEventListener('click', e => {
            e.stopPropagation();
            deleteFile(fname);
        });
        tree.appendChild(item);
    });
    $('vfs-stats').textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
}

/* ── TABS ── */
function renderTabs() {
    const list = $('tab-list');
    if (!list) return;
    list.innerHTML = '';
    state.openTabs.forEach(tab => {
        if (!state.vfs[tab]) return;
        const item = document.createElement('div');
        item.className = `tab-item${tab === state.activeFile ? ' active' : ''}`;
        item.setAttribute('role', 'tab');
        item.dataset.tab = tab;
        const ico = getFileIcon(tab);
        const isDirty = state.dirtyFiles.has(tab);
        item.innerHTML = `
            <i class='bx ${ico.cls} ti-icon ${ico.color}'></i>
            <span class="ti-name">${tab}</span>
            ${isDirty ? '<span class="ti-dirty">●</span>' : ''}
            <i class='bx bx-x ti-close' data-tab="${tab}"></i>
        `;
        item.addEventListener('click', e => {
            if (e.target.closest('.ti-close')) return;
            switchFile(tab);
        });
        item.querySelector('.ti-close').addEventListener('click', e => {
            e.stopPropagation();
            closeTab(tab);
        });
        list.appendChild(item);
    });
}

/* ── SWITCH ACTIVE FILE ── */
function switchFile(filename) {
    if (!state.vfs[filename]) return;

    // Flush current file
    if (state.editor && state.activeFile) {
        state.vfs[state.activeFile] = state.editor.getValue();
    }

    state.activeFile = filename;
    if (!state.openTabs.includes(filename)) state.openTabs.push(filename);

    if (state.editor) {
        const newModel = monaco.editor.createModel(state.vfs[filename], getLanguage(filename));
        state.editor.setModel(newModel);

        newModel.onDidChangeContent(() => markDirty(filename));
    }

    renderFileTree();
    renderTabs();
    updateStatusBar();
    $('sb-lang').textContent = getLangDisplay(filename);
    $('breadcrumb-file').textContent = filename;
    log(`Opened: ${filename}`, 'info');
}

/* ── CLOSE TAB ── */
function closeTab(tab) {
    state.openTabs = state.openTabs.filter(t => t !== tab);
    if (state.activeFile === tab) {
        const fallback = state.openTabs[state.openTabs.length - 1] || Object.keys(state.vfs)[0];
        if (fallback) switchFile(fallback);
    } else {
        renderTabs();
    }
}

/* ── DELETE FILE ── */
function deleteFile(filename) {
    if (!confirm(`Delete "${filename}" permanently?`)) return;
    delete state.vfs[filename];
    state.openTabs = state.openTabs.filter(t => t !== filename);
    state.dirtyFiles.delete(filename);
    log(`Deleted file: ${filename}`, 'warn');

    if (state.activeFile === filename) {
        const remaining = Object.keys(state.vfs);
        if (remaining.length) switchFile(remaining[0]);
        else {
            state.activeFile = '';
            if (state.editor) state.editor.setValue('');
        }
    }
    renderFileTree();
    renderTabs();
    updateStatusBar();
}

/* ── COMPILE PREVIEW ── */
function compilePreview() {
    log('Compiling workspace...', 'info');
    const buildStatus = $('sb-build-status');
    buildStatus.innerHTML = `<i class='bx bx-loader-alt'></i> Building...`;
    buildStatus.className = 'status-item';

    const htmlContent = state.vfs['index.html'];
    if (!htmlContent) {
        log('Build failed: index.html not found.', 'error');
        buildStatus.innerHTML = `<i class='bx bx-error-circle'></i> Build Error`;
        buildStatus.className = 'status-item status-error';
        return;
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && state.vfs[href]) {
                const style = doc.createElement('style');
                style.textContent = state.vfs[href];
                link.replaceWith(style);
            }
        });

        doc.querySelectorAll('script[src]').forEach(script => {
            const src = script.getAttribute('src');
            if (src && state.vfs[src]) {
                const inlineScript = doc.createElement('script');
                inlineScript.textContent = state.vfs[src];
                script.replaceWith(inlineScript);
            }
        });

        const frame = $('preview-frame');
        if (frame) {
            frame.srcdoc = doc.documentElement.outerHTML;
            state.lastPreviewContent = doc.documentElement.outerHTML;
        }

        log('Build successful — preview updated.', 'success');
        buildStatus.innerHTML = `<i class='bx bx-check-circle'></i> Build OK`;
        buildStatus.className = 'status-item status-ok';
        $('addr-url').textContent = `astra://workspace/index.html`;
    } catch (err) {
        log(`Build error: ${err.message}`, 'error');
        buildStatus.innerHTML = `<i class='bx bx-error-circle'></i> Build Error`;
        buildStatus.className = 'status-item status-error';
    }
}

/* ── VIEW SWITCH (Code vs Preview) ── */
function switchView(mode) {
    const monacoEl = $('monaco-editor');
    const previewEl = $('preview-wrap');
    const codeBtn   = $('view-code');
    const prevBtn   = $('view-preview');

    if (mode === 'code') {
        monacoEl.style.display = '';
        previewEl.classList.add('hidden');
        codeBtn.classList.add('active');
        prevBtn.classList.remove('active');
        if (state.editor) state.editor.layout();
    } else {
        if (state.editor && state.activeFile) state.vfs[state.activeFile] = state.editor.getValue();
        compilePreview();
        monacoEl.style.display = 'none';
        previewEl.classList.remove('hidden');
        codeBtn.classList.remove('active');
        prevBtn.classList.add('active');

        // Apply device frame
        const wrapper = $('device-frame-wrapper');
        wrapper.dataset.device = state.currentDevice;
    }
}

/* ── DEVICE FRAMES ── */
$('device-toggle-group').addEventListener('click', e => {
    const btn = e.target.closest('.device-btn');
    if (!btn) return;
    const device = btn.dataset.device;
    state.currentDevice = device;
    document.querySelectorAll('.device-btn').forEach(b => b.classList.toggle('active', b.dataset.device === device));
    const wrapper = $('device-frame-wrapper');
    wrapper.dataset.device = device;
    log(`Device view: ${device}`, 'info');
});

/* ── SIDEBAR PANEL SWITCH ── */
function switchSidebarPanel(panelId) {
    state.activePanel = panelId;
    document.querySelectorAll('.side-panel').forEach(p => {
        p.classList.toggle('hidden', p.id !== `panel-${panelId}`);
        p.classList.toggle('active-panel', p.id === `panel-${panelId}`);
    });
    document.querySelectorAll('.activity-btn[data-panel]').forEach(b => {
        b.classList.toggle('active', b.dataset.panel === panelId);
    });
}

document.querySelectorAll('.activity-btn[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => switchSidebarPanel(btn.dataset.panel));
});

/* ── CONTEXT MENU ── */
function showContextMenu(x, y) {
    const menu = $('context-menu');
    menu.classList.remove('hidden');
    const cw = document.body.clientWidth;
    const ch = document.body.clientHeight;
    menu.style.left = (x + 150 > cw ? x - 160 : x) + 'px';
    menu.style.top  = (y + 120 > ch ? y - 100 : y) + 'px';
}

document.addEventListener('click', () => $('context-menu').classList.add('hidden'));

$('ctx-rename').addEventListener('click', () => {
    const old = state.contextMenuTarget;
    if (!old) return;
    const newName = prompt('Rename file:', old);
    if (!newName || newName === old || !newName.trim()) return;
    state.vfs[newName.trim()] = state.vfs[old];
    delete state.vfs[old];
    state.openTabs = state.openTabs.map(t => t === old ? newName.trim() : t);
    if (state.activeFile === old) state.activeFile = newName.trim();
    log(`Renamed: ${old} → ${newName.trim()}`, 'info');
    renderFileTree(); renderTabs(); updateStatusBar();
});

$('ctx-duplicate').addEventListener('click', () => {
    const src = state.contextMenuTarget;
    if (!src) return;
    const parts = src.split('.');
    const ext = parts.length > 1 ? '.' + parts.pop() : '';
    const base = parts.join('.');
    let newName = `${base}_copy${ext}`;
    let i = 2;
    while (state.vfs[newName]) newName = `${base}_copy${i++}${ext}`;
    state.vfs[newName] = state.vfs[src];
    log(`Duplicated: ${src} → ${newName}`, 'info');
    renderFileTree();
});

$('ctx-delete').addEventListener('click', () => {
    const file = state.contextMenuTarget;
    if (file) deleteFile(file);
});

/* ── QUICK OPEN ── */
function openQuickOpen() {
    const modal = $('quickopen-modal');
    modal.classList.remove('hidden');
    const input = $('quickopen-input');
    input.value = '';
    input.focus();
    renderQuickOpenResults('');
}

$('quickopen-input').addEventListener('input', e => renderQuickOpenResults(e.target.value));

function renderQuickOpenResults(query) {
    const results = $('quickopen-results');
    results.innerHTML = '';
    const files = Object.keys(state.vfs).filter(f => !query || f.toLowerCase().includes(query.toLowerCase()));
    files.forEach(f => {
        const item = document.createElement('div');
        item.className = 'qo-item';
        const ico = getFileIcon(f);
        item.innerHTML = `<i class='bx ${ico.cls} ${ico.color}'></i> ${f}`;
        item.addEventListener('click', () => {
            switchFile(f);
            $('quickopen-modal').classList.add('hidden');
        });
        results.appendChild(item);
    });
}

$('quickopen-input').addEventListener('keydown', e => {
    if (e.key === 'Escape') $('quickopen-modal').classList.add('hidden');
});

$('quickopen-modal').addEventListener('click', e => {
    if (e.target === $('quickopen-modal')) $('quickopen-modal').classList.add('hidden');
});

/* ── KEYBOARD SHORTCUTS MODAL ── */
$('act-keyboard-shortcuts').addEventListener('click', () => $('shortcuts-modal').classList.remove('hidden'));
$('btn-close-shortcuts').addEventListener('click', () => $('shortcuts-modal').classList.add('hidden'));
$('shortcuts-modal').addEventListener('click', e => { if (e.target === $('shortcuts-modal')) $('shortcuts-modal').classList.add('hidden'); });

/* ── GLOBAL KEYBOARD SHORTCUTS ── */
document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 's') {
        e.preventDefault();
        if (state.editor && state.activeFile) state.vfs[state.activeFile] = state.editor.getValue();
        state.dirtyFiles.clear();
        setAutosaveState('saved');
        renderFileTree(); renderTabs();
        compilePreview();
        log('Manual save + recompile.', 'info');
    }
    if (ctrl && e.key === 'p' && !e.shiftKey) { e.preventDefault(); openQuickOpen(); }
    if (ctrl && e.shiftKey && e.key === 'P') { e.preventDefault(); switchView('preview'); }
    if (e.key === 'Escape') {
        $('shortcuts-modal').classList.add('hidden');
        $('quickopen-modal').classList.add('hidden');
        $('context-menu').classList.add('hidden');
    }
});

/* ── TERMINAL FILTER TABS ── */
document.querySelectorAll('.log-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        state.currentFilter = tab.dataset.filter;
        document.querySelectorAll('.log-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.log-line').forEach(line => {
            const level = line.dataset.level;
            line.classList.toggle('filtered', state.currentFilter !== 'all' && level !== state.currentFilter);
        });
    });
});

/* ── TERMINAL CONTROLS ── */
$('btn-clear-logs').addEventListener('click', () => {
    $('terminal-body').innerHTML = '';
    log('Console cleared.', 'info');
});

$('btn-copy-logs').addEventListener('click', () => {
    const lines = [...document.querySelectorAll('.log-line .log-msg')].map(el => el.textContent).join('\n');
    navigator.clipboard?.writeText(lines).then(() => log('Logs copied to clipboard.', 'info'));
});

$('btn-toggle-terminal').addEventListener('click', () => {
    const panel = $('terminal-panel');
    const btn   = $('btn-toggle-terminal').querySelector('i');
    state.isTerminalCollapsed = !state.isTerminalCollapsed;
    panel.classList.toggle('collapsed', state.isTerminalCollapsed);
    btn.className = state.isTerminalCollapsed ? 'bx bx-chevron-up' : 'bx bx-chevron-down';
});

/* ── HEADER TOOLBAR ── */
$('btn-run-preview').addEventListener('click', () => {
    if (state.editor && state.activeFile) state.vfs[state.activeFile] = state.editor.getValue();
    switchView('preview');
});

$('btn-format-code').addEventListener('click', () => {
    if (state.editor) {
        state.editor.getAction('editor.action.formatDocument')?.run();
        log('Document formatted.', 'info');
    }
});

$('btn-reset-vfs').addEventListener('click', () => {
    if (!confirm('Reset all workspace files to defaults? All edits will be lost.')) return;
    state.vfs = JSON.parse(JSON.stringify(DEFAULT_VFS));
    state.openTabs = ['index.html', 'style.css', 'app.js'];
    state.dirtyFiles.clear();
    switchFile('index.html');
    log('Workspace reset to default project.', 'warn');
});

$('view-code').addEventListener('click', () => switchView('code'));
$('view-preview').addEventListener('click', () => switchView('preview'));

$('addr-reload').addEventListener('click', () => compilePreview());

$('btn-open-new-window').addEventListener('click', () => {
    if (state.lastPreviewContent) {
        const blob = new Blob([state.lastPreviewContent], { type: 'text/html' });
        window.open(URL.createObjectURL(blob));
    }
});

/* ── NEW FILE ── */
$('btn-new-file').addEventListener('click', () => {
    const name = prompt('Enter new filename (e.g., about.html):');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (state.vfs[trimmed]) { alert('A file with that name already exists.'); return; }
    state.vfs[trimmed] = '';
    log(`Created file: ${trimmed}`, 'success');
    switchFile(trimmed);
});

/* ── NEW FOLDER (creates a placeholder) ── */
$('btn-new-folder').addEventListener('click', () => {
    const name = prompt('Enter folder name:');
    if (!name || !name.trim()) return;
    const placeholder = `${name.trim()}/index.html`;
    if (state.vfs[placeholder]) { alert('Folder already exists.'); return; }
    state.vfs[placeholder] = `<!-- ${name.trim()}/index.html -->`;
    log(`Created: ${placeholder}`, 'success');
    renderFileTree();
});

/* ── THEME TOGGLE ── */
$('act-theme-toggle').addEventListener('click', () => {
    state.isDark = !state.isDark;
    document.body.classList.toggle('light-theme', !state.isDark);
    const btn = $('act-theme-toggle').querySelector('i');
    btn.className = state.isDark ? 'bx bx-moon' : 'bx bx-sun';
    if (state.editor) {
        const theme = state.isDark ? state.editorSettings.theme : 'vs';
        monaco.editor.setTheme(theme);
    }
    log(`Theme: ${state.isDark ? 'dark' : 'light'}`, 'info');
});

/* ── API KEY REVEAL TOGGLE ── */
$('btn-reveal-api').addEventListener('click', () => {
    const input = $('gemini-api-key');
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    $('btn-reveal-api').querySelector('i').className = isPassword ? 'bx bx-show' : 'bx bx-hide';
});

/* ── API KEY CHANGE → update model chip ── */
$('gemini-api-key').addEventListener('input', e => {
    const hasKey = !!e.target.value.trim();
    $('model-chip-display').innerHTML = hasKey
        ? `<i class='bx bx-chip'></i> Gemini 2.5 Flash`
        : `<i class='bx bx-chip'></i> Demo Mode`;
    $('model-name-text').textContent = hasKey ? 'Gemini 2.5' : 'Demo Mode';
    const dot = document.querySelector('.model-badge .model-dot');
    if (dot) dot.classList.toggle('live', hasKey);
    log(hasKey ? 'Live Gemini API key set.' : 'Switched to Demo Mode.', 'info');
});

/* ── GLOBAL SEARCH ── */
$('btn-do-search').addEventListener('click', doGlobalSearch);
$('global-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') doGlobalSearch(); });

function doGlobalSearch() {
    const query = $('global-search-input').value.trim();
    const results = $('search-results');
    results.innerHTML = '';
    if (!query) return;
    let totalMatches = 0;
    Object.entries(state.vfs).forEach(([fname, content]) => {
        const lines = content.split('\n');
        lines.forEach((line, i) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
                totalMatches++;
                const match = document.createElement('div');
                match.className = 'search-match';
                const highlighted = line.replace(new RegExp(query, 'gi'), m => `<mark>${m}</mark>`);
                match.innerHTML = `
                    <div class="search-match-file">${fname}:${i+1}</div>
                    <div class="search-match-line">${highlighted}</div>
                `;
                match.addEventListener('click', () => {
                    switchFile(fname);
                    switchSidebarPanel('explorer');
                    if (state.editor) {
                        state.editor.revealLine(i + 1);
                        state.editor.setPosition({ lineNumber: i + 1, column: 1 });
                        state.editor.focus();
                    }
                });
                results.appendChild(match);
            }
        });
    });
    if (totalMatches === 0) results.innerHTML = `<div style="padding:0.75rem;color:var(--c-text-muted);font-size:0.78rem;">No results found for "${query}"</div>`;
    log(`Search "${query}" → ${totalMatches} match(es).`, 'info');
}

/* ── EDITOR SETTINGS ── */
function applyEditorSettings() {
    if (!state.editor) return;
    state.editor.updateOptions({
        fontSize:   state.editorSettings.fontSize,
        tabSize:    state.editorSettings.tabSize,
        wordWrap:   state.editorSettings.wordWrap,
        minimap:    { enabled: state.editorSettings.minimap }
    });
    monaco.editor.setTheme(state.editorSettings.theme);
}

$('setting-font-size').addEventListener('change', e => { state.editorSettings.fontSize = parseInt(e.target.value); applyEditorSettings(); });
$('setting-tab-size').addEventListener('change',  e => { state.editorSettings.tabSize = parseInt(e.target.value); applyEditorSettings(); });
$('setting-word-wrap').addEventListener('change', e => { state.editorSettings.wordWrap = e.target.value; applyEditorSettings(); });
$('setting-minimap').addEventListener('change',   e => { state.editorSettings.minimap = e.target.value === 'true'; applyEditorSettings(); });
$('setting-theme').addEventListener('change',     e => { state.editorSettings.theme = e.target.value; applyEditorSettings(); });

/* ── RESIZABLE PANELS ── */
function makeResizable(handleId, targetId, direction) {
    const handle = $(handleId);
    if (!handle) return;
    let dragging = false, startPos, startSize;

    handle.addEventListener('mousedown', e => {
        dragging = true;
        startPos = direction === 'h' ? e.clientX : e.clientY;
        const target = $(targetId);
        startSize = direction === 'h' ? target.offsetWidth : target.offsetHeight;
        document.body.style.cursor = direction === 'h' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const target = $(targetId);
        const delta = direction === 'h' ? e.clientX - startPos : e.clientY - startPos;
        if (direction === 'h') {
            const newW = Math.max(180, Math.min(500, startSize + delta));
            target.style.width = newW + 'px';
        } else {
            const newH = Math.max(38, Math.min(400, startSize - delta));
            target.style.height = newH + 'px';
            $('terminal-panel').style.height = newH + 'px';
        }
        if (state.editor) state.editor.layout();
    });

    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (state.editor) state.editor.layout();
    });
}

makeResizable('resize-sidebar',  'sidebar',       'h');
makeResizable('resize-chat',     'chat-sidebar',  'h');
makeResizable('resize-terminal', 'terminal-panel','v');

/* ── CHAT INPUT ── */
const chatInput = $('chat-input');
const charCounter = $('char-counter');

chatInput.addEventListener('input', () => {
    charCounter.textContent = chatInput.value.length;
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
});

chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
    if (e.key === 'ArrowUp' && !chatInput.value) {
        chatInput.value = state.lastPrompt;
        charCounter.textContent = state.lastPrompt.length;
    }
});

$('btn-send').addEventListener('click', sendMessage);

/* ── QUICK PROMPT CHIPS ── */
document.addEventListener('click', e => {
    const chip = e.target.closest('.prompt-chip');
    if (!chip) return;
    chatInput.value = chip.dataset.prompt;
    charCounter.textContent = chip.dataset.prompt.length;
    chatInput.focus();
    sendMessage();
});

/* ── CLEAR / EXPORT CHAT ── */
$('btn-clear-chat').addEventListener('click', () => {
    $('chat-messages').innerHTML = '';
    appendAgentMsg('Chat cleared. How can I help?', '', true);
});

$('btn-export-chat').addEventListener('click', () => {
    const msgs = [...document.querySelectorAll('.msg-bubble')].map(b => b.innerText).join('\n---\n');
    const blob = new Blob([msgs], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'astra-chat.txt';
    a.click();
    log('Chat exported.', 'info');
});

/* ── TIMESTAMP ── */
$('welcome-time').textContent = now();

/* ── STATUS: Running ── */
function setStatus(text, running = false) {
    $('status-text').textContent = text;
    $('pulse-dot').classList.toggle('running', running);
}

/* ── CHAT MESSAGES ── */
function appendUserMsg(text) {
    const messages = $('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg user-msg';
    div.innerHTML = `
        <div class="msg-avatar user-avatar"><i class='bx bx-user'></i></div>
        <div class="msg-content">
            <div class="msg-meta"><span class="msg-sender">You</span><span class="msg-time">${now()}</span></div>
            <div class="msg-bubble"><p>${escapeHtml(text)}</p></div>
        </div>
    `;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function appendAgentMsg(html, thoughts = '', skipAnim = false) {
    const messages = $('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg agent-msg';

    let thoughtHTML = '';
    if (thoughts) {
        thoughtHTML = `
            <div class="thought-block">
                <button class="thought-toggle">
                    <i class='bx bx-brain'></i> Astra's Reasoning
                    <i class='bx bx-chevron-down tt-chevron'></i>
                </button>
                <div class="thought-body">${escapeHtml(thoughts)}</div>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="msg-avatar agent-avatar">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.6"/>
            </svg>
        </div>
        <div class="msg-content">
            <div class="msg-meta"><span class="msg-sender">Astra</span><span class="msg-time">${now()}</span></div>
            <div class="msg-bubble">
                ${thoughtHTML}
                <div class="msg-text">${html}</div>
            </div>
        </div>
    `;

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;

    // Thought toggle
    const toggle = div.querySelector('.thought-toggle');
    const body   = div.querySelector('.thought-body');
    if (toggle && body) {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('open');
            body.classList.toggle('open');
        });
    }

    return div.querySelector('.msg-text');
}

function showTypingIndicator() {
    const messages = $('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg agent-msg';
    div.id = 'typing-indicator';
    div.innerHTML = `
        <div class="msg-avatar agent-avatar">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.6"/></svg>
        </div>
        <div class="msg-content">
            <div class="msg-meta"><span class="msg-sender">Astra</span></div>
            <div class="msg-bubble">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function removeTypingIndicator() {
    const el = $('typing-indicator');
    if (el) el.remove();
}

/* ── VFS COMMAND PARSING ── */
function parseVfsCommands(text) {
    const cmds = [];
    const re_create = /<create_file\s+path="([^"]+)">([\s\S]*?)<\/create_file>/gi;
    const re_edit   = /<edit_file\s+path="([^"]+)">([\s\S]*?)<\/edit_file>/gi;
    const re_delete = /<delete_file\s+path="([^"]+)">\s*<\/delete_file>/gi;
    let m;
    while ((m = re_create.exec(text)) !== null) cmds.push({ type: 'create', path: m[1].trim(), content: m[2] });
    while ((m = re_edit.exec(text)) !== null)   cmds.push({ type: 'edit',   path: m[1].trim(), content: m[2] });
    while ((m = re_delete.exec(text)) !== null) cmds.push({ type: 'delete', path: m[1].trim() });
    return cmds;
}

function executeVfsCommands(cmds, targetEl) {
    if (!cmds.length) return;
    cmds.forEach(cmd => {
        const card = document.createElement('div');
        if (cmd.type === 'create') {
            state.vfs[cmd.path] = cmd.content;
            if (!state.openTabs.includes(cmd.path)) state.openTabs.push(cmd.path);
            card.className = 'op-card create';
            card.innerHTML = `<div class="op-card-header"><i class='bx bx-file-plus'></i>Created</div><div class="op-card-desc">${cmd.path} (${cmd.content.length} chars)</div>`;
            log(`Created: ${cmd.path}`, 'success');
        } else if (cmd.type === 'edit') {
            state.vfs[cmd.path] = cmd.content;
            state.dirtyFiles.delete(cmd.path);
            card.className = 'op-card edit';
            card.innerHTML = `<div class="op-card-header"><i class='bx bx-edit-alt'></i>Updated</div><div class="op-card-desc">${cmd.path} (${cmd.content.length} chars)</div>`;
            log(`Updated: ${cmd.path}`, 'success');
        } else if (cmd.type === 'delete') {
            delete state.vfs[cmd.path];
            state.openTabs = state.openTabs.filter(t => t !== cmd.path);
            card.className = 'op-card delete';
            card.innerHTML = `<div class="op-card-header"><i class='bx bx-trash'></i>Deleted</div><div class="op-card-desc">${cmd.path}</div>`;
            log(`Deleted: ${cmd.path}`, 'warn');
        }
        if (targetEl) targetEl.appendChild(card);
    });

    renderFileTree();
    renderTabs();

    const primaryFile = cmds.find(c => c.type !== 'delete' && state.vfs[c.path]);
    if (primaryFile) {
        switchFile(primaryFile.path);
    } else {
        const first = Object.keys(state.vfs)[0];
        if (first) switchFile(first);
    }

    setTimeout(() => compilePreview(), 100);
    setTimeout(() => switchView('preview'), 300);
}

/* ── SYSTEM INSTRUCTIONS ── */
function buildSystemPrompt() {
    let files = '';
    Object.entries(state.vfs).forEach(([k, v]) => files += `--- ${k} ---\n${v}\n\n`);

    return `You are "Astra", an expert autonomous AI coding assistant embedded in a lightweight web IDE.

CURRENT WORKSPACE FILES:
${files}

CAPABILITIES:
You can directly create, edit, or delete files in the user's workspace using these XML tags:
- <create_file path="filename">content</create_file>
- <edit_file path="filename">full new content</edit_file>  
- <delete_file path="filename"></delete_file>

RULES:
1. Start each response with a <thought>...</thought> block explaining your reasoning step by step.
2. Always provide the COMPLETE replacement content for any file you edit (not partial diffs).
3. Write clean, modern, beautiful code. Use modern CSS (flexbox, grid, custom properties). Make UIs visually stunning.
4. Add micro-animations, hover effects, and premium styling to all UIs.
5. Any text outside XML tags will be shown directly in the chat as explanation.
6. Be conversational, concise, and helpful.
7. When building multi-file apps, always include proper linking between HTML, CSS, and JS.`;
}

/* ── GEMINI API CALL ── */
async function callGemini(apiKey, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
}

/* ── DEMO MOCK RESPONSES ── */
function getDemoResponse(prompt) {
    const lc = prompt.toLowerCase();

    if (lc.includes('clock') || lc.includes('analog')) {
        return {
            thoughts: 'User wants an analog clock. I will create a beautiful canvas-based clock with neon glow styling.',
            text: 'I\'ve built a stunning neon analog clock! The canvas renders hour, minute, and second hands with glowing effects.',
            files: [{
                type: 'edit', path: 'index.html',
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neon Clock</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="clock-wrap">
    <canvas id="clock" width="320" height="320"></canvas>
    <div class="digital" id="digital"></div>
  </div>
  <script src="app.js"><\/script>
</body>
</html>`
            }, {
                type: 'edit', path: 'style.css',
                content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: radial-gradient(ellipse at center, #0d1b2a 0%, #030710 100%);
  display: flex; justify-content: center; align-items: center;
  min-height: 100vh; font-family: 'Inter', sans-serif;
}
.clock-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 1.5rem;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(6,182,212,0.15);
  padding: 3rem; border-radius: 24px;
  box-shadow: 0 0 60px rgba(6,182,212,0.08), inset 0 1px 0 rgba(255,255,255,0.05);
}
#clock { filter: drop-shadow(0 0 18px rgba(6,182,212,0.4)); }
.digital {
  font-family: 'JetBrains Mono', monospace; font-size: 1.6rem; font-weight: 600;
  color: #06b6d4; letter-spacing: 0.15em;
  text-shadow: 0 0 20px rgba(6,182,212,0.7);
}`
            }, {
                type: 'edit', path: 'app.js',
                content: `const canvas = document.getElementById('clock');
const ctx = canvas.getContext('2d');
const digital = document.getElementById('digital');
const cx = canvas.width / 2, cy = canvas.height / 2, r = cx * 0.9;

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const now = new Date();
  const sec = now.getSeconds(), min = now.getMinutes(), hr = now.getHours() % 12;
  const secA = (sec/60)*Math.PI*2 - Math.PI/2;
  const minA = ((min + sec/60)/60)*Math.PI*2 - Math.PI/2;
  const hrA  = ((hr + min/60)/12)*Math.PI*2 - Math.PI/2;

  // Face
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = '#060d1a'; ctx.fill();
  ctx.strokeStyle = 'rgba(6,182,212,0.5)'; ctx.lineWidth = 2; ctx.stroke();

  // Tick marks
  for(let i = 0; i < 60; i++){
    const a = (i/60)*Math.PI*2;
    const len = i % 5 === 0 ? 12 : 5;
    const x1 = cx + Math.cos(a)*(r-2), y1 = cy + Math.sin(a)*(r-2);
    const x2 = cx + Math.cos(a)*(r-2-len), y2 = cy + Math.sin(a)*(r-2-len);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
    ctx.strokeStyle = i%5===0 ? 'rgba(6,182,212,0.8)' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = i%5===0 ? 2 : 1; ctx.stroke();
  }

  // Numbers
  ctx.font = 'bold 14px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(232,237,247,0.7)';
  for(let i = 1; i <= 12; i++){
    const a = (i/12)*Math.PI*2 - Math.PI/2;
    ctx.fillText(i, cx + Math.cos(a)*(r-28), cy + Math.sin(a)*(r-28));
  }

  // Hands
  function hand(angle, length, width, color, glow) {
    ctx.save();
    ctx.shadowColor = glow; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle)*length, cy + Math.sin(angle)*length);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  }

  hand(hrA,  r*0.55, 5, '#06b6d4', '#06b6d4');
  hand(minA, r*0.75, 3, '#8b5cf6', '#8b5cf6');
  hand(secA, r*0.88, 1.5, '#f43f5e', '#f43f5e');

  // Center dot
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2);
  ctx.fillStyle = '#fff'; ctx.fill();

  // Digital
  digital.textContent = now.toLocaleTimeString('en', {hour12:false});
  requestAnimationFrame(draw);
}
draw();`
            }]
        };
    }

    if (lc.includes('calculator') || lc.includes('calc')) {
        return {
            thoughts: 'User wants a calculator. Building a sleek, modern glassmorphism calculator with full operations.',
            text: 'Here\'s a premium glassmorphism calculator with full arithmetic, keyboard support, and smooth animations!',
            files: [{
                type: 'edit', path: 'index.html',
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Calculator</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="calc">
    <div class="display">
      <div class="display-expr" id="expr"></div>
      <div class="display-val" id="val">0</div>
    </div>
    <div class="grid">
      <button class="btn fn" data-op="AC">AC</button>
      <button class="btn fn" data-op="+/-">±</button>
      <button class="btn fn" data-op="%">%</button>
      <button class="btn op" data-op="/">÷</button>
      <button class="btn" data-op="7">7</button>
      <button class="btn" data-op="8">8</button>
      <button class="btn" data-op="9">9</button>
      <button class="btn op" data-op="*">×</button>
      <button class="btn" data-op="4">4</button>
      <button class="btn" data-op="5">5</button>
      <button class="btn" data-op="6">6</button>
      <button class="btn op" data-op="-">−</button>
      <button class="btn" data-op="1">1</button>
      <button class="btn" data-op="2">2</button>
      <button class="btn" data-op="3">3</button>
      <button class="btn op" data-op="+">+</button>
      <button class="btn zero" data-op="0">0</button>
      <button class="btn" data-op=".">.</button>
      <button class="btn eq" data-op="=">=</button>
    </div>
  </div>
  <script src="app.js"><\/script>
</body>
</html>`
            }, {
                type: 'edit', path: 'style.css',
                content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: radial-gradient(ellipse at 30% 60%, #1e1b4b 0%, #0f0f1a 60%);
  min-height: 100vh; display: flex; justify-content: center; align-items: center;
  font-family: 'Inter', sans-serif;
}
.calc {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(30px); border-radius: 20px; width: 300px;
  box-shadow: 0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
  overflow: hidden;
}
.display { padding: 1.5rem 1.25rem 1rem; text-align: right; min-height: 100px; display: flex; flex-direction: column; justify-content: flex-end; }
.display-expr { font-size: 0.8rem; color: rgba(255,255,255,0.35); min-height: 1.2em; margin-bottom: 0.25rem; }
.display-val { font-size: 2.4rem; font-weight: 300; color: #fff; letter-spacing: -1px; overflow: hidden; text-overflow: ellipsis; }
.grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: rgba(255,255,255,0.04); }
.btn {
  aspect-ratio: 1; border: none; font-size: 1.1rem; font-weight: 500; cursor: pointer;
  color: #e8edf7; background: rgba(255,255,255,0.05);
  transition: background 0.15s, transform 0.1s; display: flex; align-items: center; justify-content: center;
}
.btn:hover { background: rgba(255,255,255,0.1); }
.btn:active { transform: scale(0.94); }
.btn.fn { background: rgba(255,255,255,0.08); color: #e8edf7; }
.btn.op { background: rgba(139,92,246,0.15); color: #c4b5fd; }
.btn.op:hover { background: rgba(139,92,246,0.25); }
.btn.eq { background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; }
.btn.eq:hover { filter: brightness(1.15); }
.btn.zero { grid-column: span 2; aspect-ratio: auto; justify-content: flex-start; padding-left: 1.5rem; border-radius: 0 0 0 20px; }`
            }, {
                type: 'edit', path: 'app.js',
                content: `const val  = document.getElementById('val');
const expr = document.getElementById('expr');
let state = { cur: '0', expr: '', op: '', prev: '' };

document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', () => handle(btn.dataset.op));
});

document.addEventListener('keydown', e => {
  const map = { Enter: '=', Backspace: 'AC', Escape: 'AC' };
  handle(map[e.key] || e.key);
});

function handle(op) {
  if ('0123456789.'.includes(op)) {
    if (state.cur === '0' && op !== '.') state.cur = op;
    else if (op === '.' && state.cur.includes('.')) return;
    else state.cur += op;
  } else if (['+','-','*','/'].includes(op)) {
    state.prev = state.cur; state.op = op; state.expr = state.cur + ' ' + op; state.cur = '0';
  } else if (op === '=') {
    if (!state.op) return;
    try {
      const r = eval(state.prev + state.op + state.cur);
      expr.textContent = state.expr + ' ' + state.cur + ' =';
      state.cur = String(parseFloat(r.toFixed(10))); state.op = ''; state.prev = '';
    } catch(e) { state.cur = 'Error'; }
  } else if (op === 'AC') { state = { cur:'0', expr:'', op:'', prev:'' }; expr.textContent = ''; }
  else if (op === '+/-') state.cur = String(-parseFloat(state.cur));
  else if (op === '%') state.cur = String(parseFloat(state.cur)/100);
  val.textContent = state.cur.length > 11 ? parseFloat(state.cur).toExponential(4) : state.cur;
}`
            }]
        };
    }

    if (lc.includes('kanban') || lc.includes('board') || lc.includes('todo')) {
        return {
            thoughts: 'User wants a kanban board. I will build a drag-and-drop kanban with three columns.',
            text: 'Built a full drag-and-drop Kanban board with three columns, add/delete cards, and smooth drag animations!',
            files: [{
                type: 'edit', path: 'index.html',
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kanban Board</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>✦ Project Board</h1>
    <button id="add-task">+ New Task</button>
  </header>
  <main class="board">
    <div class="col" data-col="todo"><h2 class="col-title todo">📋 To Do</h2><div class="cards" id="todo"></div></div>
    <div class="col" data-col="doing"><h2 class="col-title doing">⚡ In Progress</h2><div class="cards" id="doing"></div></div>
    <div class="col" data-col="done"><h2 class="col-title done">✅ Done</h2><div class="cards" id="done"></div></div>
  </main>
  <script src="app.js"><\/script>
</body>
</html>`
            }, {
                type: 'edit', path: 'style.css',
                content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0a0f1e; color: #e8edf7; font-family: 'Inter', sans-serif; min-height: 100vh; }
header { display: flex; align-items: center; justify-content: space-between; padding: 1.5rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
h1 { font-size: 1.25rem; font-weight: 700; background: linear-gradient(135deg,#06b6d4,#8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
#add-task { background: linear-gradient(135deg,#06b6d4,#8b5cf6); color:#fff; border:none; padding:0.5rem 1rem; border-radius:8px; font-size:0.85rem; font-weight:600; cursor:pointer; }
.board { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.5rem; padding: 2rem; height: calc(100vh - 76px); }
.col { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; overflow: hidden; }
.col-title { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.5px; padding: 0.5rem 0.75rem; border-radius: 8px; margin-bottom: 0.25rem; }
.col-title.todo  { background: rgba(56,189,248,0.08); color: #38bdf8; }
.col-title.doing { background: rgba(245,158,11,0.08); color: #f59e0b; }
.col-title.done  { background: rgba(16,185,129,0.08); color: #10b981; }
.cards { flex: 1; display: flex; flex-direction: column; gap: 0.6rem; overflow-y: auto; min-height: 60px; border-radius: 8px; padding: 4px; transition: background 0.2s; }
.cards.drag-over { background: rgba(6,182,212,0.05); border: 1px dashed rgba(6,182,212,0.3); }
.card {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px; padding: 0.75rem; font-size: 0.82rem; line-height: 1.4;
  cursor: grab; user-select: none; display: flex; justify-content: space-between;
  align-items: flex-start; gap: 0.5rem; transition: transform 0.15s, box-shadow 0.15s;
}
.card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
.card.dragging { opacity: 0.4; cursor: grabbing; }
.card-del { background: none; border: none; color: rgba(255,255,255,0.25); cursor: pointer; font-size: 1.1rem; padding: 0; line-height: 1; }
.card-del:hover { color: #f43f5e; }`
            }, {
                type: 'edit', path: 'app.js',
                content: `let tasks = [
  { id:1, text:'Design landing page', col:'todo' },
  { id:2, text:'Build API endpoints', col:'todo' },
  { id:3, text:'Set up database', col:'doing' },
  { id:4, text:'Write unit tests', col:'doing' },
  { id:5, text:'Deploy to production', col:'done' },
];
let nextId = 6;
let dragged = null;

function render() {
  ['todo','doing','done'].forEach(col => {
    const el = document.getElementById(col);
    el.innerHTML = '';
    tasks.filter(t => t.col === col).forEach(task => {
      const card = document.createElement('div');
      card.className = 'card'; card.draggable = true; card.dataset.id = task.id;
      card.innerHTML = \`<span>\${task.text}</span><button class="card-del" data-id="\${task.id}">×</button>\`;
      card.addEventListener('dragstart', () => { dragged = task.id; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.querySelector('.card-del').addEventListener('click', () => { tasks = tasks.filter(t => t.id !== task.id); render(); });
      el.appendChild(card);
    });
  });
  document.querySelectorAll('.cards').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', () => {
      zone.classList.remove('drag-over');
      const col = zone.closest('.col').dataset.col;
      const task = tasks.find(t => t.id === dragged);
      if (task) { task.col = col; render(); }
    });
  });
}

document.getElementById('add-task').addEventListener('click', () => {
  const text = prompt('Task description:');
  if (text?.trim()) { tasks.push({ id: nextId++, text: text.trim(), col: 'todo' }); render(); }
});

render();`
            }]
        };
    }

    if (lc.includes('markdown') || lc.includes('md') || lc.includes('editor')) {
        return {
            thoughts: 'User wants a markdown preview editor. Building a split-pane markdown editor with live rendering.',
            text: 'Here\'s a split-pane Markdown editor with live preview, syntax highlighting, and toolbar buttons!',
            files: [{
                type: 'edit', path: 'index.html',
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Markdown Editor</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <span class="logo">✦ MD Editor</span>
    <div class="toolbar">
      <button data-fmt="**Bold**">B</button>
      <button data-fmt="*Italic*">I</button>
      <button data-fmt="# ">H</button>
      <button data-fmt="\`Code\`">{ }</button>
      <button id="copy-btn">Copy</button>
    </div>
  </header>
  <div class="split">
    <textarea id="editor" spellcheck="false" placeholder="# Start writing..."></textarea>
    <div id="preview" class="preview"></div>
  </div>
  <script src="app.js"><\/script>
</body>
</html>`
            }, {
                type: 'edit', path: 'style.css',
                content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0a0f1e; color: #e8edf7; font-family: 'Inter', sans-serif; height: 100vh; display: flex; flex-direction: column; }
header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.07); }
.logo { font-weight: 700; font-size: 1rem; background: linear-gradient(135deg,#06b6d4,#8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.toolbar { display: flex; gap: 0.4rem; }
.toolbar button { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #e8edf7; padding: 0.3rem 0.75rem; border-radius: 5px; font-size: 0.8rem; cursor: pointer; transition: background 0.15s; }
.toolbar button:hover { background: rgba(6,182,212,0.1); border-color: rgba(6,182,212,0.3); }
.split { flex: 1; display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; }
#editor { background: #060d1a; color: #c9d1e0; border: none; border-right: 1px solid rgba(255,255,255,0.07); padding: 1.5rem; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; line-height: 1.7; resize: none; outline: none; }
.preview { padding: 1.5rem 2rem; overflow-y: auto; line-height: 1.7; }
.preview h1 { font-size: 1.8rem; margin-bottom: 1rem; color: #06b6d4; }
.preview h2 { font-size: 1.3rem; margin: 1.25rem 0 0.5rem; color: #8b5cf6; }
.preview h3 { font-size: 1.05rem; margin: 1rem 0 0.4rem; color: #38bdf8; }
.preview p { margin-bottom: 0.75rem; color: #c9d1e0; }
.preview code { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 0.1rem 0.4rem; font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: #10b981; }
.preview pre { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 1rem; margin: 0.75rem 0; overflow-x: auto; }
.preview pre code { background: none; border: none; padding: 0; }
.preview blockquote { border-left: 3px solid #8b5cf6; padding-left: 1rem; color: #8899b8; margin: 0.75rem 0; }
.preview ul, .preview ol { padding-left: 1.5rem; margin-bottom: 0.75rem; color: #c9d1e0; }
.preview hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.5rem 0; }`
            }, {
                type: 'edit', path: 'app.js',
                content: `const editor  = document.getElementById('editor');
const preview = document.getElementById('preview');
editor.value = \`# Hello, Markdown!

Write here and see **live preview** on the right.

## Features
- ✦ Real-time rendering
- \\\`inline code\\\` support
- **Bold** and *italic*
- Blockquotes

> "Design is not what it looks like. Design is how it works." – Steve Jobs

\\\`\\\`\\\`javascript
function greet(name) {
  return \\\`Hello, \\\${name}!\\\`;
}
\\\`\\\`\\\`

---
Happy coding!\`;

function markdownToHtml(md) {
  return md
    .replace(/\`\`\`(\\w*)?\\n([\\s\\S]*?)\`\`\`/g, (_,l,c)=>\`<pre><code>\${c.replace(/</g,'&lt;')}</code></pre>\`)
    .replace(/^### (.+)/gm,'<h3>$1</h3>')
    .replace(/^## (.+)/gm,'<h2>$1</h2>')
    .replace(/^# (.+)/gm,'<h1>$1</h1>')
    .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g,'<em>$1</em>')
    .replace(/\`(.+?)\`/g,'<code>$1</code>')
    .replace(/^> (.+)/gm,'<blockquote>$1</blockquote>')
    .replace(/^---$/gm,'<hr>')
    .replace(/^\\- (.+)/gm,'<li>$1</li>')
    .replace(/(<li>.*<\\/li>\\n?)+/g,s=>\`<ul>\${s}</ul>\`)
    .replace(/\\n\\n/g,'</p><p>')
    .replace(/^(?!<[h|u|b|p|h|o])/gm,'');
}

editor.addEventListener('input', render);

document.querySelectorAll('.toolbar button[data-fmt]').forEach(btn => {
  btn.addEventListener('click', () => {
    const s = editor.selectionStart, e = editor.selectionEnd;
    const sel = editor.value.substring(s, e) || 'text';
    const rep = btn.dataset.fmt.replace('text', sel);
    editor.setRangeText(rep, s, e, 'end');
    render();
  });
});

document.getElementById('copy-btn').addEventListener('click', () => {
  navigator.clipboard?.writeText(editor.value);
});

function render() {
  preview.innerHTML = '<p>' + markdownToHtml(editor.value) + '</p>';
}
render();`
            }]
        };
    }

    // Generic fallback
    return {
        thoughts: `Received: "${prompt}". I'll update the welcome message to acknowledge the request and suggest using a Gemini API key for full AI capabilities.`,
        text: `I received your idea: <strong>"${escapeHtml(prompt)}"</strong>.<br><br>
            For full AI-powered code generation, add your <strong>Gemini API key</strong> in the top-right field.<br><br>
            Or try one of the quick-start chips above — I can build: <em>Analog Clock, Calculator, Kanban Board, Markdown Editor, or Music Player</em> in demo mode.`,
        files: []
    };
}

/* ── SEND MESSAGE ── */
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    state.lastPrompt = text;
    chatInput.value = '';
    charCounter.textContent = '0';
    chatInput.style.height = '';

    appendUserMsg(text);
    showTypingIndicator();
    setStatus('Thinking...', true);
    log(`Prompt received: "${text}"`, 'agent');
    $('btn-send').disabled = true;

    const apiKey = $('gemini-api-key').value.trim();

    try {
        let thoughts = '', replyText = '', fileCommands = [];

        if (apiKey) {
            log('Calling Gemini API...', 'agent');
            const raw = await callGemini(apiKey, text);

            const thoughtMatch = raw.match(/<thought>([\s\S]*?)<\/thought>/i);
            thoughts = thoughtMatch ? thoughtMatch[1].trim() : '';

            const cleanText = raw
                .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
                .replace(/<create_file[\s\S]*?<\/create_file>/gi, '')
                .replace(/<edit_file[\s\S]*?<\/edit_file>/gi, '')
                .replace(/<delete_file[\s\S]*?<\/delete_file>/gi, '')
                .trim();

            replyText = formatMarkdown(cleanText);
            fileCommands = parseVfsCommands(raw);
            log('Gemini response received.', 'success');
        } else {
            await new Promise(r => setTimeout(r, 1400));
            const demo = getDemoResponse(text);
            thoughts   = demo.thoughts;
            replyText  = demo.text;
            fileCommands = demo.files || [];
            log('Demo response generated.', 'agent');
        }

        removeTypingIndicator();
        const textEl = appendAgentMsg(replyText, thoughts);
        if (fileCommands.length) executeVfsCommands(fileCommands, textEl);
    } catch (err) {
        removeTypingIndicator();
        appendAgentMsg(`<strong>Error:</strong> ${escapeHtml(err.message)}`);
        log(`Error: ${err.message}`, 'error');
    } finally {
        setStatus('Ready', false);
        $('btn-send').disabled = false;
    }
}

/* ── FORMAT MARKDOWN → HTML ── */
function formatMarkdown(text) {
    return text
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/```(\w*)\n([\s\S]*?)```/g,'<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g,'<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g,'<em>$1</em>')
        .replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>');
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── MONACO SETUP ── */
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
require(['vs/editor/editor.main'], () => {
    state.editor = monaco.editor.create($('monaco-editor'), {
        value: state.vfs[state.activeFile],
        language: getLanguage(state.activeFile),
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: state.editorSettings.fontSize,
        fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
        fontLigatures: true,
        tabSize: state.editorSettings.tabSize,
        wordWrap: state.editorSettings.wordWrap,
        minimap: { enabled: state.editorSettings.minimap },
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        bracketPairColorization: { enabled: true },
        renderLineHighlight: 'gutter',
        padding: { top: 12, bottom: 12 },
        scrollBeyondLastLine: false,
        lineHeight: 22,
    });

    state.editor.getModel().onDidChangeContent(() => {
        if (state.activeFile) {
            state.vfs[state.activeFile] = state.editor.getValue();
            markDirty(state.activeFile);
        }
        updateStatusBar();
    });

    state.editor.onDidChangeCursorPosition(e => updateCursorStatus(e.position));

    // Ctrl+S inside Monaco
    state.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        state.vfs[state.activeFile] = state.editor.getValue();
        state.dirtyFiles.clear();
        setAutosaveState('saved');
        renderFileTree(); renderTabs();
        compilePreview();
        log('Saved & recompiled.', 'success');
    });

    log('Monaco Editor v0.44 loaded.', 'success');
    log('Astra AI IDE v2.0 ready. Happy building!', 'success');
    log('Tip: Use Ctrl+P to quick-open files, Ctrl+S to save & run.', 'info');
    renderFileTree();
    renderTabs();
    updateStatusBar();
    compilePreview();
});
