/* ==========================================================================
   ASTRA AI IDE - APPLICATION MODULE
   Monaco Integration, Virtual File System, Live Iframe Compiler, Console logs
   ========================================================================== */

// 1. Initial Default Project VFS
let vfs = {
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Astro App</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="card">
        <h1>Welcome to Astra IDE!</h1>
        <p>This is a lightweight workspace where you can talk to an AI agent to build websites.</p>
        <button id="click-btn">Click Me</button>
        <div id="result" class="result-text"></div>
    </div>
    <script src="app.js"></script>
</body>
</html>`,
    "style.css": `body {
    background: linear-gradient(135deg, #0f172a, #1e1b4b);
    color: #f8fafc;
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 90vh;
    margin: 0;
}

.card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
    max-width: 400px;
}

h1 {
    margin-top: 0;
    color: #3b82f6;
}

button {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
}

button:hover {
    background: #2563eb;
}

.result-text {
    margin-top: 1rem;
    font-weight: 500;
    color: #10b981;
}`,
    "app.js": `// Interactive app script
const btn = document.getElementById("click-btn");
const result = document.getElementById("result");

btn.addEventListener("click", () => {
    result.textContent = "Hello World! Interactive script loaded successfully.";
    btn.style.transform = "scale(0.95)";
    setTimeout(() => btn.style.transform = "none", 150);
});`
};

// Application State
let activeFile = "index.html";
let openTabs = ["index.html", "style.css", "app.js"];
let editor = null;
let viewMode = "code";

// RequireJS Monaco Loader
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: vfs[activeFile],
        language: getLanguageFromExtension(activeFile),
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 13,
        fontFamily: "'Fira Code', Consolas, Monaco, monospace",
        minimap: { enabled: false }
    });

    editor.onDidChangeModelContent(() => {
        if (activeFile) {
            vfs[activeFile] = editor.getValue();
        }
    });

    logTerminal("Astra IDE Initialized.", "system-line");
    compilePreview();
});

// Helper: Monaco Language Map
function getLanguageFromExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'html') return 'html';
    if (ext === 'css') return 'css';
    if (ext === 'js' || ext === 'javascript') return 'javascript';
    if (ext === 'json') return 'json';
    return 'plaintext';
}

// Terminal Logging Helper
function logTerminal(text, type = "system-line") {
    const term = document.getElementById("ide-terminal-log");
    if (!term) return;
    const line = document.createElement("div");
    line.className = `terminal-line ${type}`;
    
    // Add prefix based on line type
    let prefix = "> ";
    if (type === "error-line") prefix = "[ERROR] ";
    if (type === "success-line") prefix = "[SUCCESS] ";
    if (type === "thought-line") prefix = "[THOUGHT] ";
    if (type === "tool-line") prefix = "[VFS] ";
    
    line.textContent = `${prefix}${text}`;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
}

// Clear Terminal Console
document.getElementById("btn-clear-terminal").addEventListener("click", () => {
    const term = document.getElementById("ide-terminal-log");
    if (term) {
        term.innerHTML = `<div class="terminal-line system-line">> Console cleared. Ready.</div>`;
    }
});

// UI State Refreshers
function updateStatus(text, isPulse = false) {
    const statusText = document.getElementById("status-text");
    const pulseDot = document.querySelector(".pulse-dot");
    statusText.textContent = text;
    if (isPulse) {
        pulseDot.classList.add("running");
    } else {
        pulseDot.classList.remove("running");
    }
}

function updateVFSStats() {
    const statsLabel = document.getElementById("vfs-status-label");
    const fileCount = Object.keys(vfs).length;
    statsLabel.textContent = `${fileCount} file${fileCount === 1 ? '' : 's'} in workspace`;
}

// Render Files Sidebar Explorer
function renderFileExplorer() {
    const explorer = document.getElementById("file-explorer-tree");
    explorer.innerHTML = "";

    Object.keys(vfs).sort().forEach(filename => {
        const item = document.createElement("div");
        item.className = `file-item ${filename === activeFile ? 'active' : ''}`;
        
        let iconClass = "bx bx-file";
        if (filename.endsWith(".html")) iconClass = "bx bxl-html5";
        if (filename.endsWith(".css")) iconClass = "bx bxl-css3";
        if (filename.endsWith(".js")) iconClass = "bx bxl-javascript";
        
        item.innerHTML = `
            <div class="file-label-group">
                <i class='${iconClass} file-icon'></i>
                <span class="file-name">${filename}</span>
            </div>
            <button class="delete-file-btn" title="Delete File"><i class='bx bx-x'></i></button>
        `;

        item.addEventListener("click", (e) => {
            if (e.target.closest(".delete-file-btn")) return;
            switchActiveFile(filename);
        });

        const delBtn = item.querySelector(".delete-file-btn");
        delBtn.addEventListener("click", () => {
            deleteFile(filename);
        });

        explorer.appendChild(item);
    });
    updateVFSStats();
}

// Render Editor Tabs
function renderTabs() {
    const tabList = document.getElementById("editor-tab-list");
    tabList.innerHTML = "";

    openTabs.forEach(tab => {
        const item = document.createElement("div");
        item.className = `tab-item ${tab === activeFile ? 'active' : ''}`;
        
        let iconClass = "bx bx-file";
        if (tab.endsWith(".html")) iconClass = "bx bxl-html5";
        if (tab.endsWith(".css")) iconClass = "bx bxl-css3";
        if (tab.endsWith(".js")) iconClass = "bx bxl-javascript";

        item.innerHTML = `
            <i class='${iconClass}'></i>
            <span>${tab}</span>
            <i class='bx bx-x tab-close'></i>
        `;

        item.addEventListener("click", (e) => {
            if (e.target.classList.contains("tab-close")) return;
            switchActiveFile(tab);
        });

        const closeBtn = item.querySelector(".tab-close");
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeTab(tab);
        });

        tabList.appendChild(item);
    });
}

// Switch Active Monaco File
function switchActiveFile(filename) {
    if (!vfs[filename]) return;
    activeFile = filename;

    if (!openTabs.includes(filename)) {
        openTabs.push(filename);
    }

    renderFileExplorer();
    renderTabs();

    // Update Topbar Breadcrumb
    document.getElementById("breadcrumb-file").textContent = filename;

    if (editor) {
        const model = editor.getModel();
        if (model) {
            vfs[model.filePath || activeFile] = editor.getValue();
        }

        const newModel = monaco.editor.createModel(vfs[filename], getLanguageFromExtension(filename));
        editor.setModel(newModel);
    }

    logTerminal(`Opened file in editor: ${filename}`, "info-line");
    showViewMode("code");
}

// Delete File
function deleteFile(filename) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    
    delete vfs[filename];
    openTabs = openTabs.filter(t => t !== filename);
    logTerminal(`Deleted file: ${filename}`, "tool-line");

    if (activeFile === filename) {
        const remaining = Object.keys(vfs);
        if (remaining.length > 0) {
            switchActiveFile(remaining[0]);
        } else {
            activeFile = "";
            openTabs = [];
            if (editor) editor.setValue("");
            document.getElementById("breadcrumb-file").textContent = "none";
            renderFileExplorer();
            renderTabs();
        }
    } else {
        renderFileExplorer();
        renderTabs();
    }
}

// Close tab
function closeTab(tabName) {
    openTabs = openTabs.filter(t => t !== tabName);
    if (activeFile === tabName) {
        if (openTabs.length > 0) {
            switchActiveFile(openTabs[openTabs.length - 1]);
        } else {
            const remaining = Object.keys(vfs);
            if (remaining.length > 0) {
                switchActiveFile(remaining[0]);
            }
        }
    } else {
        renderTabs();
    }
}

// Toggle View: Code vs Preview
function showViewMode(mode) {
    viewMode = mode;
    const btnCode = document.getElementById("view-mode-code");
    const btnPreview = document.getElementById("view-mode-preview");
    const editorEl = document.getElementById("editor-container");
    const previewEl = document.getElementById("preview-container");

    if (mode === "code") {
        btnCode.classList.add("active");
        btnPreview.classList.remove("active");
        editorEl.style.display = "block";
        previewEl.style.display = "none";
        if (editor) editor.layout();
    } else {
        btnCode.classList.remove("active");
        btnPreview.classList.add("active");
        editorEl.style.display = "none";
        previewEl.style.display = "flex";
        compilePreview();
    }
}

document.getElementById("view-mode-code").addEventListener("click", () => showViewMode("code"));
document.getElementById("view-mode-preview").addEventListener("click", () => showViewMode("preview"));

// Iframe Preview Compiler
function compilePreview() {
    logTerminal("Compiling workspace build...", "system-line");
    let htmlContent = vfs["index.html"];
    if (!htmlContent) {
        const frame = document.getElementById("app-preview-frame");
        if (frame) frame.srcdoc = "<html><body style='color:#ccc;background:#111;'><h1>No index.html found</h1></body></html>";
        logTerminal("Build failed: index.html not found.", "error-line");
        return;
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");

        const styleLinks = doc.querySelectorAll('link[rel="stylesheet"]');
        styleLinks.forEach(link => {
            const href = link.getAttribute("href");
            if (vfs[href]) {
                const style = doc.createElement("style");
                style.textContent = vfs[href];
                link.replaceWith(style);
            }
        });

        const scripts = doc.querySelectorAll('script[src]');
        scripts.forEach(script => {
            const src = script.getAttribute("src");
            if (vfs[src]) {
                const inlineScript = doc.createElement("script");
                inlineScript.textContent = vfs[src];
                script.replaceWith(inlineScript);
            }
        });

        const frame = document.getElementById("app-preview-frame");
        if (frame) {
            frame.srcdoc = doc.documentElement.outerHTML;
        }
        logTerminal("Build successful. Preview reloaded.", "success-line");
    } catch (e) {
        logTerminal(`Build error: ${e.message}`, "error-line");
    }
}

document.getElementById("btn-run-preview").addEventListener("click", () => {
    if (editor && activeFile) {
        vfs[activeFile] = editor.getValue();
    }
    compilePreview();
    showViewMode("preview");
});

document.getElementById("btn-reload-preview").addEventListener("click", () => {
    compilePreview();
});

document.getElementById("btn-reset-vfs").addEventListener("click", () => {
    if (!confirm("Are you sure you want to reset your workspace to the default project? All custom edits will be lost.")) return;
    location.reload();
});

document.getElementById("btn-new-file").addEventListener("click", () => {
    const filename = prompt("Enter new filename (e.g. page.html):");
    if (!filename) return;
    if (vfs[filename]) {
        alert("A file with this name already exists.");
        return;
    }
    vfs[filename] = "";
    logTerminal(`Created file: ${filename}`, "tool-line");
    switchActiveFile(filename);
});

// ==========================================================================
// 3. AI AGENT ASSISTANT (ASTRA)
// ==========================================================================
const chatLog = document.getElementById("chat-messages-log");
const promptInput = document.getElementById("agent-chat-prompt");
const sendBtn = document.getElementById("agent-send-prompt-btn");
const clearChatBtn = document.getElementById("btn-clear-conversation");

clearChatBtn.addEventListener("click", () => {
    chatLog.innerHTML = `
        <div class="chat-message system-message">
            <div class="avatar"><i class='bx bxs-bot'></i></div>
            <div class="message-bubble">Conversation cleared. How can I help you code today?</div>
        </div>
    `;
});

function appendChatMessage(role, htmlText, thoughts = "") {
    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-message ${role}-message`;
    
    let avatarIcon = "bx bx-user";
    if (role === "agent") avatarIcon = "bx bxs-bot";
    if (role === "system") avatarIcon = "bx bx-info-circle";

    let thoughtsHTML = "";
    if (thoughts) {
        thoughtsHTML = `
            <div class="thought-block">
                <div class="thought-header"><i class='bx bx-brain'></i> Astra Thought</div>
                <div>${thoughts}</div>
            </div>
        `;
    }

    msgDiv.innerHTML = `
        <div class="avatar"><i class='${avatarIcon}'></i></div>
        <div class="message-bubble">
            ${thoughtsHTML}
            <div class="message-text">${htmlText}</div>
        </div>
    `;
    
    chatLog.appendChild(msgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
    return msgDiv;
}

function parseCodingCommands(text) {
    const commands = [];
    const createRegex = /<create_file\s+path="([^"]+)">([\s\S]*?)<\/create_file>/gi;
    let match;
    while ((match = createRegex.exec(text)) !== null) {
        commands.push({ type: "create", path: match[1].trim(), content: match[2] });
    }
    const editRegex = /<edit_file\s+path="([^"]+)">([\s\S]*?)<\/edit_file>/gi;
    while ((match = editRegex.exec(text)) !== null) {
        commands.push({ type: "edit", path: match[1].trim(), content: match[2] });
    }
    const deleteRegex = /<delete_file\s+path="([^"]+)">\s*<\/delete_file>/gi;
    while ((match = deleteRegex.exec(text)) !== null) {
        commands.push({ type: "delete", path: match[1].trim() });
    }
    return commands;
}

function executeVfsCommands(commands, bubbleTextElement) {
    if (commands.length === 0) return;

    commands.forEach(cmd => {
        const opCard = document.createElement("div");
        opCard.className = "op-card";

        if (cmd.type === "create") {
            vfs[cmd.path] = cmd.content;
            opCard.innerHTML = `
                <div class="op-title"><i class='bx bx-file-plus'></i> Created File</div>
                <div class="op-desc">${cmd.path} (${cmd.content.length} chars)</div>
            `;
            logTerminal(`Created workspace file: ${cmd.path}`, "tool-line");
        } else if (cmd.type === "edit") {
            vfs[cmd.path] = cmd.content;
            opCard.innerHTML = `
                <div class="op-title"><i class='bx bx-edit-alt'></i> Updated File</div>
                <div class="op-desc">${cmd.path} (${cmd.content.length} chars)</div>
            `;
            logTerminal(`Edited workspace file: ${cmd.path}`, "tool-line");
        } else if (cmd.type === "delete") {
            delete vfs[cmd.path];
            openTabs = openTabs.filter(t => t !== cmd.path);
            opCard.className = "op-card deleted";
            opCard.innerHTML = `
                <div class="op-title"><i class='bx bx-trash'></i> Deleted File</div>
                <div class="op-desc">${cmd.path}</div>
            `;
            logTerminal(`Deleted workspace file: ${cmd.path}`, "tool-line");
        }

        bubbleTextElement.appendChild(opCard);
    });

    renderFileExplorer();
    renderTabs();

    if (activeFile && vfs[activeFile] !== undefined) {
        if (editor) {
            editor.setValue(vfs[activeFile]);
        }
    } else {
        const files = Object.keys(vfs);
        if (files.length > 0) {
            switchActiveFile(files[0]);
        }
    }

    compilePreview();
}

function compileSystemInstructions() {
    let filesSummary = "";
    Object.keys(vfs).forEach(key => {
        filesSummary += `--- FILE: ${key} ---\n${vfs[key]}\n\n`;
    });

    return `You are "Astra", a skilled autonomous AI coding assistant. You are operating inside a lightweight web IDE.
The project currently has the following files:
${filesSummary}

Your goal is to write or edit code to implement the user's requirements.
You have the power to create, edit, or delete files directly in the user's workspace using these custom tags. You MUST output your code changes wrapped inside these XML tags:

1. To create a new file:
<create_file path="filename.html">
...contents...
</create_file>

2. To edit/overwrite an existing file (you should provide the complete replacement content for the file):
<edit_file path="filename.css">
...new contents...
</edit_file>

3. To delete a file:
<delete_file path="filename.js"></delete_file>

Instructions:
- Always explain your thoughts step-by-step wrapped inside a <thought>...</thought> block first.
- Put any code updates inside <create_file> or <edit_file> tags.
- Any text outside these tags will be printed directly as explanations in the chat log.
- Keep explanations simple and clear for both technical and non-technical users.`;
}

// Fetch Gemini API from browser
async function fetchGeminiAPI(apiKey, promptText, systemInstruction) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: promptText }]
                }
            ]
        })
    });
    if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function triggerAstraAgent() {
    const promptText = promptInput.value.trim();
    if (!promptText) return;

    renderUserMessage("chat-messages-log", promptText);
    promptInput.value = "";

    updateStatus("Thinking...", true);
    logTerminal(`Astra received prompt: "${promptText}"`, "info-line");
    
    const agentMsg = createAgentMessagePlaceholder("chat-messages-log");

    const apiKey = document.getElementById("gemini-api-key").value.trim();
    let thoughts = "";
    let reply = "";

    if (apiKey) {
        logTerminal("Connecting to live Gemini API...", "system-line");
        try {
            const systemInst = compileSystemInstructions();
            const output = await fetchGeminiAPI(apiKey, promptText, systemInst);
            
            const thoughtMatch = output.match(/<thought>([\s\S]*?)<\/thought>/i);
            if (thoughtMatch) {
                thoughts = thoughtMatch[1].trim();
                reply = output.replace(/<thought>[\s\S]*?<\/thought>/i, "").trim();
            } else {
                thoughts = "Analyzing requirements and organizing project files.";
                reply = output;
            }
            logTerminal("Live coding response received.", "success-line");
        } catch (e) {
            updateStatus("Idle");
            agentMsg.remove();
            appendChatMessage("system", `<strong>Error calling Gemini API:</strong> ${e.message}. Make sure your API key is correct.`);
            logTerminal(`Gemini API Call failed: ${e.message}`, "error-line");
            return;
        }
    } else {
        // LOCAL DEMO MOCKS
        logTerminal("No API Key configured. Operating in mock simulation mode.", "system-line");
        await delay(1500);
        const lowerPrompt = promptText.toLowerCase();

        if (lowerPrompt.includes("clock")) {
            thoughts = "User wants an analog clock. Overwriting HTML, CSS, and JS to build a canvas-based ticking clock.";
            reply = `I have created an analog clock application in your workspace!
            
            <edit_file path="index.html"><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analog Clock</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="clock-box">
        <canvas id="clock-canvas" width="300" height="300"></canvas>
        <h2 id="digital-time">00:00:00</h2>
    </div>
    <script src="app.js"></script>
</body>
</html></edit_file>

<edit_file path="style.css">body {
    background: radial-gradient(circle, #1e1b4b, #090d16);
    color: #f8fafc;
    font-family: system-ui, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 90vh;
    margin: 0;
}

.clock-box {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 2.5rem;
    border-radius: 20px;
    backdrop-filter: blur(12px);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    text-align: center;
}

#clock-canvas {
    background: transparent;
}

h2 {
    font-family: monospace;
    font-size: 1.5rem;
    color: #3b82f6;
    margin-top: 1.5rem;
    letter-spacing: 2px;
}</edit_file>

<edit_file path="app.js">const canvas = document.getElementById("clock-canvas");
const ctx = canvas.getContext("2d");
const digitalTime = document.getElementById("digital-time");
const radius = canvas.height / 2;
ctx.translate(radius, radius);
const clockRadius = radius * 0.90;

function drawClock() {
  drawFace(ctx, clockRadius);
  drawNumbers(ctx, clockRadius);
  drawTime(ctx, clockRadius);
}

function drawFace(ctx, radius) {
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, 2 * Math.PI);
  ctx.fillStyle = '#111322';
  ctx.fill();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = radius * 0.03;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.06, 0, 2 * Math.PI);
  ctx.fillStyle = '#8b5cf6';
  ctx.fill();
}

function drawNumbers(ctx, radius) {
  ctx.font = radius * 0.15 + "px Arial";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  for(let num = 1; num < 13; num++){
    let ang = num * Math.PI / 6;
    ctx.rotate(ang);
    ctx.translate(0, -radius * 0.82);
    ctx.rotate(-ang);
    ctx.fillText(num.toString(), 0, 0);
    ctx.rotate(ang);
    ctx.translate(0, radius * 0.82);
    ctx.rotate(-ang);
  }
}

function drawTime(ctx, radius){
  const now = new Date();
  let hour = now.getHours();
  let minute = now.getMinutes();
  let second = now.getSeconds();
  
  digitalTime.textContent = now.toLocaleTimeString();

  hour = hour % 12;
  hour = (hour * Math.PI / 6) + (minute * Math.PI / (6 * 60)) + (second * Math.PI / (360 * 60));
  drawHand(ctx, hour, radius * 0.5, radius * 0.05, "#3b82f6");
  
  minute = (minute * Math.PI / 30) + (second * Math.PI / (30 * 60));
  drawHand(ctx, minute, radius * 0.7, radius * 0.03, "#8b5cf6");
  
  second = (second * Math.PI / 30);
  drawHand(ctx, second, radius * 0.85, radius * 0.01, "#f43f5e");
}

function drawHand(ctx, pos, length, width, color) {
  ctx.beginPath();
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.moveTo(0, 0);
  ctx.rotate(pos);
  ctx.lineTo(0, -length);
  ctx.stroke();
  ctx.rotate(-pos);
}

setInterval(drawClock, 1000);
drawClock();</edit_file>
            
            I have applied the code edits. Running build compiler now...`;
        } else if (lowerPrompt.includes("calculator")) {
            thoughts = "User wants a calculator. I will overwrite index.html, style.css, and app.js to create a responsive calculator UI.";
            reply = `I have successfully built a neat, interactive calculator inside your workspace!
            
            <edit_file path="index.html"><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sleek Calculator</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="calc-card">
        <div class="display" id="calc-display">0</div>
        <div class="btn-grid">
            <button class="c-btn fn">AC</button>
            <button class="c-btn fn">+/-</button>
            <button class="c-btn fn">%</button>
            <button class="c-btn op">/</button>
            <button class="c-btn">7</button>
            <button class="c-btn">8</button>
            <button class="c-btn">9</button>
            <button class="c-btn op">*</button>
            <button class="c-btn">4</button>
            <button class="c-btn">5</button>
            <button class="c-btn">6</button>
            <button class="c-btn op">-</button>
            <button class="c-btn">1</button>
            <button class="c-btn">2</button>
            <button class="c-btn">3</button>
            <button class="c-btn op">+</button>
            <button class="c-btn zero">0</button>
            <button class="c-btn">.</button>
            <button class="c-btn op">=</button>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html></edit_file>

<edit_file path="style.css">body {
    background: radial-gradient(circle, #111827, #030712);
    color: white;
    font-family: system-ui, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 90vh;
    margin: 0;
}

.calc-card {
    background: #1f2937;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 1.5rem;
    border-radius: 18px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    width: 280px;
}

.display {
    background: #0f172a;
    border-radius: 8px;
    padding: 1rem;
    font-size: 2rem;
    font-family: monospace;
    text-align: right;
    overflow-x: auto;
    margin-bottom: 1.25rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.btn-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.6rem;
}

.c-btn {
    border: none;
    border-radius: 50%;
    aspect-ratio: 1;
    font-size: 1.25rem;
    font-weight: 600;
    color: white;
    background: #374151;
    cursor: pointer;
    transition: filter 0.15s;
}

.c-btn:hover {
    filter: brightness(1.2);
}

.c-btn.fn {
    background: #4b5563;
    color: #e5e7eb;
}

.c-btn.op {
    background: #f97316;
    color: white;
}

.c-btn.zero {
    grid-column: span 2;
    aspect-ratio: auto;
    border-radius: 20px;
}</edit_file>

<edit_file path="app.js">const display = document.getElementById("calc-display");
const buttons = document.querySelectorAll(".c-btn");

let currentVal = "0";
let expression = "";

buttons.forEach(btn => {
    btn.addEventListener("click", () => {
        const text = btn.textContent;
        
        if (text === "AC") {
            currentVal = "0";
            expression = "";
        } else if (text === "=") {
            try {
                currentVal = eval(expression).toString();
                expression = currentVal;
            } catch (e) {
                currentVal = "Error";
                expression = "";
            }
        } else if (btn.classList.contains("op")) {
            expression += text;
            currentVal = text;
        } else {
            if (currentVal === "0" || btn.classList.contains("op")) {
                currentVal = text;
            } else {
                currentVal += text;
            }
            expression += text;
        }
        
        display.textContent = currentVal;
    });
});</edit_file>
            
            Calculation engine compiled. Press **Run Preview** to test it!`;
        } else {
            thoughts = `User prompt is: "${promptText}". I will add a dynamic heading inside index.html to confirm.`;
            reply = `I have processed your idea: "<strong>${promptText}</strong>"! 
            
            As no live Gemini API Key is entered in the topbar, I am running in **Demo Mode**. Try asking for a *"clock"* or *"calculator"* for complex multi-file codebase compiles.
            
            For fully customized AI development, paste your Gemini API key from Google AI Studio. 
            
            <edit_file path="index.html">${vfs["index.html"].replace("Welcome to Astra IDE!", `Welcome to Astra IDE! - Idea: ${promptText}`)}</edit_file>`;
        }
    }

    updateStatus("Idle");
    agentMsg.remove();

    if (thoughts) {
        logTerminal(`Thought: ${thoughts}`, "thought-line");
    }

    const formattedReply = formatMarkdownText(reply);
    const bubble = appendChatMessage("agent", formattedReply, thoughts);

    const vfsCommands = parseCodingCommands(reply);
    executeVfsCommands(vfsCommands, bubble.querySelector(".message-text"));
}

function formatMarkdownText(text) {
    let cleanText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    cleanText = cleanText
        .replace(/&lt;create_file\s+path="([^"]+)"&gt;([\s\S]*?)&lt;\/create_file&gt;/gi, '<create_file path="$1">$2</create_file>')
        .replace(/&lt;edit_file\s+path="([^"]+)"&gt;([\s\S]*?)&lt;\/edit_file&gt;/gi, '<edit_file path="$1">$2</edit_file>')
        .replace(/&lt;delete_file\s+path="([^"]+)"&gt;\s*&lt;\/delete_file&gt;/gi, '<delete_file path="$1"></delete_file>');

    cleanText = cleanText.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    cleanText = cleanText.replace(/`([^`]+)`/g, "<code class='inline-code'>$1</code>");
    cleanText = cleanText.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code class='language-$1'>$2</code></pre>");
    cleanText = cleanText.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
    return cleanText;
}

// Initial Bootstrapping
renderFileExplorer();
renderTabs();

sendBtn.addEventListener("click", triggerAstraAgent);
promptInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        triggerAstraAgent();
    }
});
