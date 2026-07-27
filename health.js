/*
  VALERIA OS — Health Intelligence Page
  Real-time biometrics simulation + AI consultation + health score computation
*/

// ── Live Metrics State ──────────────────────────────────────────────────────
let metrics = {
    glucose: 98, glucoseStatus: "Stable baseline",
    heartRate: 72, hrv: 89, hrvStatus: "Good vagal tone",
    sleep: "7h 42m", sleepEff: 88, sleepStatus: "Fully recovered",
    energy: 84, energyStatus: "Optimal mitochondrial state",
    steps: 8432,
    cortisol: 0.12, cortisolStatus: "Low stress baseline",
    healthScore: 78
};

let consultHistory = [];
let isStreaming = false;

// ── Init ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    updateLastSync();
    renderHRVBars();
    initMetricsSimulation();
    initConsultation();
    computeHealthScore();

    // Run initial AI analysis after 1s (gives page time to render)
    setTimeout(runInitialAnalysis, 1200);
});

// ── Last Sync Clock ─────────────────────────────────────────────────────────
function updateLastSync() {
    const el = document.getElementById("last-sync-time");
    if (el) el.textContent = new Date().toTimeString().split(" ")[0];
    setTimeout(updateLastSync, 1000);
}

// ── HRV Bars (7-day) ────────────────────────────────────────────────────────
function renderHRVBars() {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const values = [72, 85, 68, 91, 78, 88, 89];
    const container = document.getElementById("hrv-bars-container");
    const labelContainer = document.getElementById("hrv-bar-labels");
    if (!container || !labelContainer) return;

    const maxVal = Math.max(...values);
    container.innerHTML = "";
    labelContainer.innerHTML = "";

    values.forEach((v, i) => {
        const pct = (v / maxVal) * 100;
        const bar = document.createElement("div");
        bar.className = "hrv-bar";
        bar.style.height = "0%";
        bar.title = `${days[i]}: ${v}ms HRV`;
        container.appendChild(bar);

        const lbl = document.createElement("span");
        lbl.textContent = days[i].slice(0, 2);
        labelContainer.appendChild(lbl);

        // Animate in
        setTimeout(() => { bar.style.height = `${pct}%`; }, 300 + i * 80);
    });
}

// ── Metrics Simulation (every 3s) ───────────────────────────────────────────
function initMetricsSimulation() {
    setInterval(() => {
        // Glucose drift ±2
        metrics.glucose = clamp(metrics.glucose + randInt(-2, 2), 72, 145);
        const glcPct = ((metrics.glucose - 70) / (145 - 70)) * 100;
        setEl("metric-glucose", `${metrics.glucose} <span class="metric-unit">mg/dL</span>`);
        setWidth("glucose-bar", `${Math.min(100, Math.max(5, glcPct))}%`);
        updateGlucoseBadge(metrics.glucose);
        updateCGMChart(metrics.glucose);

        // HRV drift ±5
        metrics.hrv = clamp(metrics.hrv + randInt(-5, 5), 55, 115);
        setEl("hrv-sub", `HRV: ${metrics.hrv}ms`);
        const hrvPct = ((metrics.hrv - 40) / (130 - 40)) * 100;
        setWidth("hrv-bar", `${clamp(hrvPct, 5, 100)}%`);

        // Steps increment
        metrics.steps += randInt(0, 8);
        const stepsPct = Math.min(100, (metrics.steps / 10000) * 100);
        setEl("metric-steps", metrics.steps.toLocaleString());
        setEl("steps-pct", `${Math.round(stepsPct)}%`);
        setWidth("steps-bar", `${stepsPct}%`);

        // Energy drift ±1
        metrics.energy = clamp(metrics.energy + randInt(-1, 1), 60, 100);
        setEl("metric-energy", `${metrics.energy} <span class="metric-unit">/ 100</span>`);
        setWidth("energy-bar", `${metrics.energy}%`);
        setEl("dim-energy-val", metrics.energy);
        setWidth("dim-energy", `${metrics.energy}%`);

        // Cortisol drift ±0.01
        metrics.cortisol = Math.max(0.05, Math.min(0.8, metrics.cortisol + (Math.random() * 0.02 - 0.01)));
        setEl("metric-cortisol", `${metrics.cortisol.toFixed(2)} <span class="metric-unit">μg/dL</span>`);
        const cortisolPct = (metrics.cortisol / 0.8) * 100;
        setWidth("cortisol-bar", `${cortisolPct}%`);

        computeHealthScore();
    }, 3000);
}

function updateGlucoseBadge(g) {
    const badge = document.getElementById("glucose-badge");
    const rangeBadge = document.getElementById("glucose-range-badge");
    const sub = document.getElementById("glucose-sub");
    if (!badge) return;
    if (g < 70) {
        badge.textContent = "LOW"; badge.className = "metric-status-badge badge-warn";
        rangeBadge.textContent = "BELOW RANGE"; rangeBadge.className = "metric-secondary-badge orange";
        sub.textContent = `LOW ALERT: ${g} mg/dL`;
    } else if (g > 140) {
        badge.textContent = "HIGH"; badge.className = "metric-status-badge badge-warn";
        rangeBadge.textContent = "ABOVE RANGE"; rangeBadge.className = "metric-secondary-badge orange";
        sub.textContent = `HIGH: ${g} mg/dL`;
    } else {
        badge.textContent = "STABLE"; badge.className = "metric-status-badge badge-good";
        rangeBadge.textContent = "IN RANGE"; rangeBadge.className = "metric-secondary-badge";
        sub.textContent = `TARGET: 70–140 mg/dL`;
    }
}

function updateCGMChart(glucose) {
    const path = document.getElementById("cgm-path");
    const pathGlow = document.getElementById("cgm-path-glow");
    const pathFill = document.getElementById("cgm-path-fill");
    const liveDot = document.getElementById("cgm-live-dot");
    const liveDotInner = document.getElementById("cgm-live-dot-inner");
    if (!path) return;

    // Map glucose 70–180 → y 116–34 (SVG viewBox 0 0 700 160)
    const gToY = (g) => 116 - ((g - 70) / (180 - 70)) * 82;
    const endY = gToY(glucose);
    const midY = gToY(glucose - 8 + randInt(-5, 5));

    const newD = `M0,95 C80,100 140,85 200,88 C260,91 320,78 380,82 C440,86 500,75 560,${midY} C610,${midY + 3} 650,${endY + 2} 700,${endY}`;
    const fillD = newD + ` L700,160 L0,160 Z`;

    path.setAttribute("d", newD);
    if (pathGlow) pathGlow.setAttribute("d", newD);
    if (pathFill) pathFill.setAttribute("d", fillD);
    if (liveDot) { liveDot.setAttribute("cy", endY); }
    if (liveDotInner) { liveDotInner.setAttribute("cy", endY); }
}

// ── Health Score Computation ────────────────────────────────────────────────
function computeHealthScore() {
    const glcScore = metrics.glucose >= 70 && metrics.glucose <= 140
        ? 100 - Math.abs(metrics.glucose - 95) * 0.5
        : metrics.glucose < 70 ? 40 : 60;
    const hrvScore = Math.min(100, ((metrics.hrv - 40) / (130 - 40)) * 100);
    const sleepScore = metrics.sleepEff;
    const energyScore = metrics.energy;
    const activityScore = Math.min(100, (metrics.steps / 10000) * 100);
    const stressScore = Math.max(0, 100 - (metrics.cortisol / 0.8) * 100);

    const overall = Math.round(
        glcScore * 0.25 + hrvScore * 0.20 + sleepScore * 0.20 +
        energyScore * 0.15 + activityScore * 0.10 + stressScore * 0.10
    );

    metrics.healthScore = overall;

    // Update ring
    const arc = document.getElementById("score-arc");
    const circumference = 314;
    if (arc) {
        arc.setAttribute("stroke-dashoffset", Math.round(circumference - (circumference * overall / 100)));
        arc.setAttribute("stroke", overall >= 80 ? "#00FF66" : overall >= 60 ? "#F59E0B" : "#EF4444");
    }
    setEl("score-value", overall);
    const label = overall >= 85 ? "EXCELLENT" : overall >= 70 ? "GOOD STATUS" : overall >= 55 ? "FAIR" : "NEEDS ATTENTION";
    setEl("score-label", label);

    // Update dimension bars
    const dims = [
        ["dim-glucose", "dim-glucose-val", Math.round(glcScore)],
        ["dim-hrv", "dim-hrv-val", Math.round(hrvScore)],
        ["dim-sleep", "dim-sleep-val", sleepScore],
        ["dim-energy", "dim-energy-val", energyScore],
        ["dim-activity", "dim-activity-val", Math.round(activityScore)],
        ["dim-stress", "dim-stress-val", Math.round(stressScore)],
    ];
    dims.forEach(([barId, valId, val]) => {
        setWidth(barId, `${val}%`);
        setEl(valId, val);
    });
}

// ── AI Consultation ─────────────────────────────────────────────────────────
function initConsultation() {
    const messagesEl = document.getElementById("consult-messages");
    const input = document.getElementById("consult-input");
    const sendBtn = document.getElementById("consult-send");
    const chips = document.querySelectorAll(".consult-chip");

    // Greeting message
    appendAIMessage(`System online. I'm Valeria — your health intelligence agent.\n\nI have access to your live biometric data. Ask me anything about your glucose trends, HRV, sleep quality, or request a full health analysis.`);

    // Chip clicks
    chips.forEach(chip => {
        chip.addEventListener("click", () => {
            const q = chip.getAttribute("data-q");
            if (q && !isStreaming) sendConsultMessage(q);
        });
    });

    // Send button
    sendBtn.addEventListener("click", () => {
        const text = input.value.trim();
        if (text && !isStreaming) {
            sendConsultMessage(text);
            input.value = "";
        }
    });

    // Enter key
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const text = input.value.trim();
            if (text && !isStreaming) {
                sendConsultMessage(text);
                input.value = "";
            }
        }
    });
}

function sendConsultMessage(text) {
    appendUserMessage(text);
    consultHistory.push({ role: "user", content: text });
    scrollMessages();
    streamHealthResponse(text);
}

async function streamHealthResponse(userText) {
    isStreaming = true;
    const sendBtn = document.getElementById("consult-send");
    if (sendBtn) sendBtn.disabled = true;

    // Build current metrics context
    const currentMetrics = {
        glucose: metrics.glucose, glucoseStatus: metrics.glucoseStatus,
        heartRate: metrics.heartRate, hrv: metrics.hrv, hrvStatus: metrics.hrvStatus,
        sleep: metrics.sleep, sleepEff: metrics.sleepEff, sleepStatus: metrics.sleepStatus,
        energy: metrics.energy, energyStatus: metrics.energyStatus,
        steps: metrics.steps, cortisol: metrics.cortisol, cortisolStatus: metrics.cortisolStatus,
        healthScore: metrics.healthScore
    };

    // Show typing indicator
    const typingId = appendAIMessage("", true);
    scrollMessages();

    try {
        const resp = await fetch("/api/health-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: consultHistory,
                metrics: currentMetrics,
                jsonMode: false
            })
        });

        if (!resp.ok) {
            const err = await resp.json();
            finalizeMessage(typingId, `⚠️ ${err.error || "API error"}`);
            isStreaming = false;
            if (sendBtn) sendBtn.disabled = false;
            return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const payload = line.slice(6).trim();
                if (payload === "[DONE]") break;

                try {
                    const parsed = JSON.parse(payload);
                    if (parsed.error) {
                        fullText += `\n⚠️ ${parsed.error}`;
                    } else if (parsed.token) {
                        fullText += parsed.token;
                    }
                    updateStreamingMessage(typingId, fullText);
                    scrollMessages();
                } catch (_) {}
            }
        }

        finalizeMessage(typingId, fullText || "Analysis complete.");
        consultHistory.push({ role: "assistant", content: fullText });

    } catch (err) {
        finalizeMessage(typingId, `⚠️ Network error: ${err.message}. Ensure the server is running.`);
    }

    isStreaming = false;
    if (sendBtn) sendBtn.disabled = false;
    scrollMessages();
}

// ── Initial AI Analysis (populates Insights & Action Plan) ───────────────────
async function runInitialAnalysis() {
    const currentMetrics = { ...metrics };

    try {
        const resp = await fetch("/api/health-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [{ role: "user", content: "Analyze my biometrics and provide insights and action plan." }],
                metrics: currentMetrics,
                jsonMode: true
            })
        });

        if (!resp.ok) {
            renderFallbackInsights();
            return;
        }

        const data = await resp.json();
        if (data.error) { renderFallbackInsights(); return; }

        renderInsights(data.insights || []);
        renderActionPlan(data.actionPlan || []);

    } catch (_) {
        renderFallbackInsights();
    }
}

function renderInsights(insights) {
    const el = document.getElementById("insights-list");
    if (!el) return;
    if (!insights.length) { el.innerHTML = fallbackInsightsHTML(); return; }
    el.innerHTML = insights.map(text => `
        <div class="insight-item-card">
            <div class="insight-icon-wrap">💡</div>
            <div class="insight-text-body">${escapeHtml(text)}</div>
        </div>
    `).join("");
}

function renderActionPlan(actions) {
    const el = document.getElementById("action-list");
    if (!el) return;
    if (!actions.length) { el.innerHTML = fallbackActionHTML(); return; }
    el.innerHTML = `<div class="insight-list">${actions.map((text, i) => `
        <div class="action-item">
            <div class="action-num">0${i+1}</div>
            <div class="action-text">${escapeHtml(text)}</div>
        </div>
    `).join("")}</div>`;
}

function renderFallbackInsights() {
    const insightsEl = document.getElementById("insights-list");
    const actionEl = document.getElementById("action-list");
    if (insightsEl) insightsEl.innerHTML = fallbackInsightsHTML();
    if (actionEl) actionEl.innerHTML = fallbackActionHTML();
}

function fallbackInsightsHTML() {
    const items = [
        { icon: "💧", text: `Glucose at ${metrics.glucose} mg/dL — within target range. Your glycemic control is stable. Post-meal readings are trending well below 140 mg/dL threshold.` },
        { icon: "❤️", text: `HRV at ${metrics.hrv}ms indicates good autonomic recovery. Your nervous system is balanced. Low stress load detected across the last 24 hours.` },
        { icon: "🌙", text: `Sleep efficiency at ${metrics.sleepEff}% — excellent. Deep sleep quota met. REM cycles support cognitive performance and glucose regulation.` },
    ];
    return items.map(i => `
        <div class="insight-item-card">
            <div class="insight-icon-wrap">${i.icon}</div>
            <div class="insight-text-body">${i.text}</div>
        </div>
    `).join("");
}

function fallbackActionHTML() {
    const actions = [
        "Maintain current meal timing. Protein-first eating pattern is helping flatten post-meal glucose spikes.",
        "10-minute walk after lunch will support afternoon glycemic control and step count toward 10K target.",
        "Continue sleep schedule. Lights-out before 23:00 to maintain melatonin surge and deep sleep quota.",
        "Hydrate: 500ml water + electrolytes now. Cellular hydration supports HRV and energy score.",
    ];
    return `<div class="insight-list">${actions.map((text, i) => `
        <div class="action-item">
            <div class="action-num">0${i+1}</div>
            <div class="action-text">${text}</div>
        </div>
    `).join("")}</div>`;
}

// ── Message Rendering Helpers ────────────────────────────────────────────────
function appendAIMessage(text, isTyping = false) {
    const container = document.getElementById("consult-messages");
    if (!container) return null;
    const id = "msg-" + Date.now();
    const div = document.createElement("div");
    div.className = "consult-msg"; div.id = id;

    const bodyClass = isTyping ? "consult-msg-body typing-cursor" : "consult-msg-body";
    div.innerHTML = `
        <div class="consult-msg-sender ai">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00FF66" stroke-width="2.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 17v-5h6v5"/><circle cx="12" cy="8" r="1"/>
            </svg>
            VALERIA
            <span class="consult-msg-time">${timeNow()}</span>
        </div>
        <div class="${bodyClass}" id="${id}-body">${isTyping ? "" : formatMsgText(text)}</div>
    `;
    container.appendChild(div);
    return id;
}

function appendUserMessage(text) {
    const container = document.getElementById("consult-messages");
    if (!container) return;
    const div = document.createElement("div");
    div.className = "consult-msg";
    div.innerHTML = `
        <div class="consult-msg-sender user">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
            </svg>
            YOU
            <span class="consult-msg-time">${timeNow()}</span>
        </div>
        <div class="consult-msg-body user-body">&gt; ${escapeHtml(text)}</div>
    `;
    container.appendChild(div);
}

function updateStreamingMessage(id, text) {
    const body = document.getElementById(`${id}-body`);
    if (!body) return;
    body.className = "consult-msg-body typing-cursor";
    body.innerHTML = formatMsgText(text);
}

function finalizeMessage(id, text) {
    const body = document.getElementById(`${id}-body`);
    if (!body) return;
    body.className = "consult-msg-body";
    body.innerHTML = formatMsgText(text);
}

function formatMsgText(text) {
    return escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#00FF66;">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em style="color:#8B5CF6;">$1</em>')
        .replace(/^- (.*?)$/gm, '• $1')
        .replace(/\n/g, "<br>");
}

function scrollMessages() {
    const el = document.getElementById("consult-messages");
    if (el) el.scrollTop = el.scrollHeight;
}

// ── Utilities ────────────────────────────────────────────────────────────────
function setEl(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = String(html);
}
function setWidth(id, w) {
    const el = document.getElementById(id);
    if (el) el.style.width = w;
}
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function timeNow() { return new Date().toTimeString().split(" ")[0]; }
function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[m]);
}
