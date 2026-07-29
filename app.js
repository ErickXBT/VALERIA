/*
   VALERIA OS - INTERACTIVE APPLICATION CONTROLLER
   Manages animations, terminal interactions, simulation updates, and state toggles.
*/

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initWalletConnection();
    initTelemetrySimulation();
    initCommandCenter();
    initLoreDossier();
});

/* ==========================================================================
   1. NAVIGATION & LAYOUT
   ========================================================================== */
function initNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll(".section-container");
    const mobileToggle = document.getElementById("mobile-menu-toggle");
    const mobileDrawer = document.getElementById("mobile-nav-drawer");
    const mobileLinks = document.querySelectorAll(".mobile-nav-link");

    // Scroll Spy active state
    window.addEventListener("scroll", () => {
        let currentSection = "overview";
        const scrollPosition = window.scrollY + 100;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                currentSection = section.getAttribute("id");
            }
        });

        navLinks.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${currentSection}`) {
                link.classList.add("active");
            }
        });

        mobileLinks.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${currentSection}`) {
                link.classList.add("active");
            }
        });
    });

    // Mobile Menu Drawer Toggle
    if (mobileToggle) {
        mobileToggle.addEventListener("click", () => {
            const isVisible = mobileDrawer.style.display === "flex";
            mobileDrawer.style.display = isVisible ? "none" : "flex";
        });
    }

    // Close mobile menu when link clicked
    mobileLinks.forEach(link => {
        link.addEventListener("click", () => {
            mobileDrawer.style.display = "none";
        });
    });
}

/* ==========================================================================
   2. WALLET CONNECTION — Real popup with injected wallet support
   ========================================================================== */
let _walletConnected = false;
let _connectedAddress = null;
let _connectedWalletName = null;

function initWalletConnection() {
    const connectBtn = document.getElementById("connect-wallet-btn");
    const overlay    = document.getElementById("wallet-modal-overlay");
    const closeBtn   = document.getElementById("wallet-modal-close");
    const networkStatus = document.querySelector(".network-indicator");

    if (!connectBtn) return;

    // Open modal or disconnect
    connectBtn.addEventListener("click", () => {
        if (_walletConnected) {
            disconnectWallet(connectBtn, networkStatus);
        } else {
            openWalletModal();
        }
    });

    // Close modal on overlay click or X
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeWalletModal();
        });
    }
    if (closeBtn) closeBtn.addEventListener("click", closeWalletModal);

    // Wallet option clicks
    document.querySelectorAll(".wallet-option").forEach(btn => {
        btn.addEventListener("click", () => {
            const wallet = btn.getAttribute("data-wallet");
            handleWalletConnect(wallet, connectBtn, networkStatus);
        });
    });
}

function openWalletModal() {
    const overlay = document.getElementById("wallet-modal-overlay");
    const connecting = document.getElementById("wallet-connecting-state");
    if (!overlay) return;
    if (connecting) connecting.style.display = "none";
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeWalletModal() {
    const overlay = document.getElementById("wallet-modal-overlay");
    if (overlay) overlay.classList.remove("active");
    document.body.style.overflow = "";
}

async function handleWalletConnect(walletType, connectBtn, networkStatus) {
    const connectingState = document.getElementById("wallet-connecting-state");
    const connectingText  = document.getElementById("wallet-connecting-text");
    const optionsGrid     = document.querySelector(".wallet-options-grid");

    const walletNames = {
        metamask: "MetaMask", phantom: "Phantom",
        coinbase: "Coinbase Wallet", trust: "Trust Wallet",
        walletconnect: "WalletConnect", okx: "OKX Wallet"
    };
    const name = walletNames[walletType] || walletType;

    // Show connecting state
    if (optionsGrid) optionsGrid.style.display = "none";
    if (connectingState) connectingState.style.display = "flex";
    if (connectingText) connectingText.textContent = `Connecting to ${name}...`;

    try {
        let address = null;

        if (walletType === "metamask" || walletType === "coinbase") {
            // Try injected ethereum provider (MetaMask / Coinbase)
            if (window.ethereum) {
                const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
                address = accounts[0];
            } else {
                // Not installed — open install page
                window.open(
                    walletType === "metamask"
                        ? "https://metamask.io/download/"
                        : "https://www.coinbase.com/wallet/downloads",
                    "_blank"
                );
                resetModalToGrid(optionsGrid, connectingState);
                return;
            }
        } else if (walletType === "phantom") {
            // Phantom EVM or Solana
            const provider = window.phantom?.ethereum || window.phantom?.solana;
            if (provider) {
                if (window.phantom?.ethereum) {
                    const accounts = await window.phantom.ethereum.request({ method: "eth_requestAccounts" });
                    address = accounts[0];
                } else {
                    const resp = await window.phantom.solana.connect();
                    address = resp.publicKey.toString();
                }
            } else {
                window.open("https://phantom.app/download", "_blank");
                resetModalToGrid(optionsGrid, connectingState);
                return;
            }
        } else if (walletType === "okx") {
            if (window.okxwallet) {
                const accounts = await window.okxwallet.request({ method: "eth_requestAccounts" });
                address = accounts[0];
            } else {
                window.open("https://www.okx.com/web3", "_blank");
                resetModalToGrid(optionsGrid, connectingState);
                return;
            }
        } else {
            // trust / walletconnect — no injected provider available in browser
            // Show friendly message
            if (connectingText) connectingText.textContent = `${name} — open your ${name} app and scan QR code`;
            setTimeout(() => {
                resetModalToGrid(optionsGrid, connectingState);
            }, 2500);
            return;
        }

        // Success
        if (address) {
            onWalletConnected(address, name, connectBtn, networkStatus);
            closeWalletModal();
        }

    } catch (err) {
        // User rejected or error
        if (connectingText) connectingText.textContent = `Connection rejected. Try again.`;
        setTimeout(() => {
            resetModalToGrid(optionsGrid, connectingState);
        }, 2000);
    }
}

function resetModalToGrid(optionsGrid, connectingState) {
    if (optionsGrid) optionsGrid.style.display = "grid";
    if (connectingState) connectingState.style.display = "none";
}

function onWalletConnected(address, walletName, connectBtn, networkStatus) {
    _walletConnected = true;
    _connectedAddress = address;
    _connectedWalletName = walletName;

    const short = address.slice(0, 6) + "..." + address.slice(-4);

    if (connectBtn) {
        connectBtn.classList.add("connected");
        connectBtn.innerHTML = `<span class="btn-glow"></span><span class="btn-text">[ ${short} ]</span>`;
    }
    if (networkStatus) {
        networkStatus.innerHTML = `<span class="green-dot" style="background-color:#00FF66;box-shadow:0 0 8px #00FF66;"></span> CONNECTED: ${short}`;
    }

    addSystemTerminalMessage("Wallet", `${walletName.toUpperCase()} CONNECTED. ADDRESS: ${address}. AUTONOMOUS ONCHAIN WORKFLOW ENGINE ACTIVE.`);
}

function disconnectWallet(connectBtn, networkStatus) {
    _walletConnected = false;
    _connectedAddress = null;
    _connectedWalletName = null;

    if (connectBtn) {
        connectBtn.classList.remove("connected");
        connectBtn.innerHTML = '<span class="btn-glow"></span><span class="btn-text">[ CONNECT WALLET ]</span>';
    }
    if (networkStatus) {
        networkStatus.innerHTML = '<span class="green-dot" style="background-color:#9CA3AF;box-shadow:none;"></span> CONNECTED NETWORK';
    }
    addSystemTerminalMessage("Wallet", "WALLET DISCONNECTED. ONCHAIN EXECUTION ENGINES STANDBY.");
}

/* ==========================================================================
   3. BIOMETRICS TELEMETRY SIMULATION
   ========================================================================== */
function initTelemetrySimulation() {
    // 9-Box card click handlers
    const cards = document.querySelectorAll(".grid-box-card");
    const livePreviewHud = document.querySelector(".live-preview-hud");

    // Dynamic metrics references
    const hrvVal = document.querySelector('[data-metric="hrv"] .box-value');
    const stepsVal = document.querySelector('[data-metric="steps"] .box-value');
    const glucoseVal = document.querySelector('[data-metric="glucose"] .box-value');
    const energyVal = document.querySelector('[data-metric="energy"] .box-value');
    
    // Heart pulse speed
    const pulseWave = document.querySelector(".pulse-wave path");
    const pulseRateText = document.querySelector(".pulse-rate");

    // Set initial values
    let glucose = 98;
    let hrv = 89;
    let steps = 8432;
    let energy = 84;

    // Simulate metrics shifting
    setInterval(() => {
        // Shift glucose slightly
        const glcDelta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        glucose = Math.max(75, Math.min(135, glucose + glcDelta));
        if (glucoseVal) glucoseVal.innerHTML = `${glucose} <span class="box-detail">mg/dL</span>`;

        // Shift HRV
        const hrvDelta = Math.floor(Math.random() * 7) - 3;
        hrv = Math.max(60, Math.min(110, hrv + hrvDelta));
        if (hrvVal) hrvVal.innerHTML = `72 bpm <span class="box-detail">/ ${hrv}ms HRV</span>`;
        if (pulseRateText) pulseRateText.innerText = `HRV: ${hrv}ms`;

        // Increment steps
        steps += Math.floor(Math.random() * 8);
        if (stepsVal) stepsVal.innerHTML = `${steps.toLocaleString()} <span class="box-detail">/ 10k target</span>`;

        // Shift energy based on metrics
        const nrgDelta = Math.floor(Math.random() * 3) - 1;
        energy = Math.max(50, Math.min(100, energy + nrgDelta));
        if (energyVal) energyVal.innerHTML = `${energy} <span class="box-detail">/ 100</span>`;

        // Animate glucose tracker SVG point
        updateGlucoseSvgPath(glucose);

    }, 3000);

    // Interactive card display details on click
    cards.forEach(card => {
        card.addEventListener("click", () => {
            const metric = card.getAttribute("data-metric") || card.querySelector(".box-title").innerText;
            cards.forEach(c => c.classList.remove("active-card"));
            card.classList.add("active-card");

            if (livePreviewHud) {
                updateTelemetryPreviewCard(metric);
            }
        });
    });
}

function updateGlucoseSvgPath(newGlucoseVal) {
    const path = document.getElementById("glucose-graph-path");
    const dot = document.getElementById("glucose-tracker-point");
    const ring = document.querySelector(".pulsating-ring");
    
    if (!path || !dot) return;

    // Scale glucose (70 - 180) to Y coordinates (160 - 40)
    // 70 mg/dL -> Y=160, 180 mg/dL -> Y=40
    // formula: Y = 160 - ((val - 70) / (180 - 70)) * 120
    const calcY = (val) => {
        const pct = (val - 70) / (180 - 70);
        return 160 - (pct * 120);
    };

    const targetY = calcY(newGlucoseVal);

    // Shift previous points of path slightly left, append new point
    // M 0 110 Q 50 140 100 80 T 200 130 T 300 70 T 400 100 T 500 95
    // Let's generate a dynamic path to look smooth
    const p1 = calcY(95);
    const p2 = calcY(110);
    const p3 = calcY(newGlucoseVal - 12);
    const p4 = calcY(newGlucoseVal + 8);
    const p5 = calcY(newGlucoseVal - 5);

    const d = `M 0 ${p1} C 100 ${p2}, 200 ${p3}, 300 ${p4}, 400 ${p5}, 500 ${targetY}`;
    path.setAttribute("d", d);
    
    dot.setAttribute("cy", targetY);
    if (ring) {
        ring.setAttribute("cy", targetY);
    }
}

function updateTelemetryPreviewCard(metricType) {
    const titleEl = document.querySelector(".telemetry-hud-header .header-tag");
    const scoreEl = document.querySelector(".telemetry-hud-header .header-score");
    const barEl = document.querySelector(".telemetry-bar-range .bar-fill");
    const barLabelEl = document.querySelector(".telemetry-bar-range .bar-label");
    const insightsContainer = document.querySelector(".telemetry-insights");
    const resultBadgeValue = document.querySelector(".telemetry-result-badge .badge-value");

    if (metricType.includes("Glucose") || metricType === "glucose") {
        titleEl.innerText = "GLUCOSE TELEMETRY";
        scoreEl.innerHTML = '86 / 100 <span class="sub-tag">GOOD CONTROL</span>';
        barEl.style.width = "84%";
        barLabelEl.innerText = "84% Time in Range";
        insightsContainer.innerHTML = `
            <div class="insight-item">
                <span class="insight-icon">💡</span>
                <p class="insight-text">Try eggs before the rice tomorrow. Protein first flattens your morning rise.</p>
            </div>
            <div class="insight-item">
                <span class="insight-icon">🚶</span>
                <p class="insight-text">A 10-minute walk at 1 PM. It cuts your afternoon dip in half.</p>
            </div>
        `;
        resultBadgeValue.innerHTML = '104 mg/dL <span class="badge-status">[In Range]</span>';
    } 
    else if (metricType.includes("Heart") || metricType === "hrv") {
        titleEl.innerText = "HEART RATE VARIABILITY";
        scoreEl.innerHTML = '74 / 100 <span class="sub-tag">REST STATE</span>';
        barEl.style.width = "72%";
        barLabelEl.innerText = "72ms Baseline Average";
        insightsContainer.innerHTML = `
            <div class="insight-item">
                <span class="insight-icon">❤️</span>
                <p class="insight-text">HRV index shows minor stress spikes during high-volatility trading sessions.</p>
            </div>
            <div class="insight-item">
                <span class="insight-icon">🧘</span>
                <p class="insight-text">Perform a 4-7-8 breathing sequence during market pullbacks to lower core cortisol.</p>
            </div>
        `;
        resultBadgeValue.innerHTML = '85ms HRV <span class="badge-status">[Stable]</span>';
    }
    else if (metricType.includes("Sleep") || metricType === "sleep") {
        titleEl.innerText = "CIRCADIAN EFFICIENCY";
        scoreEl.innerHTML = '92 / 100 <span class="sub-tag">RECOVERED</span>';
        barEl.style.width = "88%";
        barLabelEl.innerText = "88% Sleep Efficiency";
        insightsContainer.innerHTML = `
            <div class="insight-item">
                <span class="insight-icon">🌙</span>
                <p class="insight-text">Deep sleep target met. Circumstance shows 1h 45m of vital restorative phase.</p>
            </div>
            <div class="insight-item">
                <span class="insight-icon">👓</span>
                <p class="insight-text">Minimize blue-light exposure post-midnight to avoid delaying melatonin surge.</p>
            </div>
        `;
        resultBadgeValue.innerHTML = '7h 42m <span class="badge-status">[Optimal]</span>';
    }
    else if (metricType.includes("Energy") || metricType === "energy") {
        titleEl.innerText = "BIO-ENERGY RATIO";
        scoreEl.innerHTML = '84 / 100 <span class="sub-tag">OPTIMAL</span>';
        barEl.style.width = "84%";
        barLabelEl.innerText = "84% Efficiency Index";
        insightsContainer.innerHTML = `
            <div class="insight-item">
                <span class="insight-icon">⚡</span>
                <p class="insight-text">Mitochondrial loading factor: excellent. Morning glucose steady state detected.</p>
            </div>
            <div class="insight-item">
                <span class="insight-icon">🔋</span>
                <p class="insight-text">Keep hydration protocols high. Drink 500ml water mixed with electrolytes.</p>
            </div>
        `;
        resultBadgeValue.innerHTML = 'Level: Peak <span class="badge-status">[Active]</span>';
    }
    else {
        // Fallback default
        titleEl.innerText = "BIOMARKER ANALYSIS";
        scoreEl.innerHTML = '80 / 100 <span class="sub-tag">STANDARD</span>';
        barEl.style.width = "80%";
        barLabelEl.innerText = "Biomarker System Normal";
        insightsContainer.innerHTML = `
            <div class="insight-item">
                <span class="insight-icon">🟢</span>
                <p class="insight-text">Valeria Biomarker Core link established. Monitoring peripheral metrics continuously.</p>
            </div>
        `;
        resultBadgeValue.innerHTML = 'NOMINAL <span class="badge-status">[Active]</span>';
    }
}

/* ==========================================================================
   4. COMMAND CENTER (OPERATING CONSOLE)
   ========================================================================== */
function initCommandCenter() {
    const sidebarTabs = document.querySelectorAll(".sidebar-tab");
    const workspace = document.getElementById("console-workspace");
    const displayTitle = document.getElementById("workspace-title-display");
    
    // Quick action buttons
    const actionChips = document.querySelectorAll(".quick-action-chip");
    const inputField = document.getElementById("terminal-input-field");
    const sendBtn = document.getElementById("terminal-send-btn");
    const screenDisplay = document.getElementById("terminal-screen-display");
    const newChatBtn = document.getElementById("new-chat-btn");
    const sessionCount = document.getElementById("session-count");

    let chatSessions = 1;

    // Sidebar tab views rendering (dynamic panels inside workspace)
    sidebarTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            sidebarTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const tabId = tab.getAttribute("data-tab");
            
            // Remove previous custom views if any
            const customView = workspace.querySelector(".custom-console-view");
            if (customView) customView.remove();

            // Reset workspace main contents display states
            const screen = document.getElementById("terminal-screen-display");
            const quickActions = document.getElementById("quick-action-grid");
            const inputContainer = document.querySelector(".terminal-input-container");
            const inputFooter = document.querySelector(".terminal-input-footer-note");
            const sessionControl = document.querySelector(".session-control-bar");
            const activeSessionBox = document.querySelector(".active-session-box");

            if (tabId === "valeria") {
                // Show chat view
                screen.style.display = "flex";
                quickActions.style.display = "grid";
                inputContainer.style.display = "flex";
                inputFooter.style.display = "block";
                sessionControl.style.display = "flex";
                activeSessionBox.style.display = "flex";
                
                displayTitle.innerText = "01 VALERIA INTELLIGENCE";
            } else {
                // Hide chat elements
                screen.style.display = "none";
                quickActions.style.display = "none";
                inputContainer.style.display = "none";
                inputFooter.style.display = "none";
                sessionControl.style.display = "none";
                activeSessionBox.style.display = "none";

                // Render custom view
                renderCustomConsoleView(tabId);
            }
        });
    });

    // Custom view builders
    function renderCustomConsoleView(tabId) {
        const viewDiv = document.createElement("div");
        viewDiv.className = "custom-console-view custom-view-tab";
        viewDiv.style.padding = "2rem";
        viewDiv.style.flexGrow = "1";
        viewDiv.style.overflowY = "auto";
        viewDiv.style.maxHeight = "480px";
        viewDiv.style.display = "flex";
        viewDiv.style.flexDirection = "column";
        viewDiv.style.gap = "1.5rem";
        viewDiv.style.fontFamily = "var(--font-mono)";

        if (tabId === "markets") {
            displayTitle.innerText = "02 STONKS.FI MARKETS MONITOR";
            viewDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; border-bottom: 1px solid var(--border-color); padding-bottom:0.5rem;">
                    <span class="text-green">MARKET STATUS // DEXSCREENER LIVE FEED</span>
                    <span class="text-purple">CHAIN: ROBINHOOD // LIVE</span>
                </div>
                <div id="markets-top-pair-cards" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:1rem;">
                    <div style="border:1px solid var(--border-color); padding:1rem; background:rgba(0,0,0,0.2);">
                        <div style="font-size:0.75rem; color:var(--text-muted);">TOP PAIR BY VOLUME</div>
                        <div style="font-size:0.85rem; color:var(--accent-green); margin-top:0.5rem; text-align:center; padding:1rem;">Loading live data...</div>
                    </div>
                    <div style="border:1px solid var(--border-color); padding:1rem; background:rgba(0,0,0,0.2);">
                        <div style="font-size:0.75rem; color:var(--text-muted);">MARKET OVERVIEW</div>
                        <div style="font-size:0.85rem; color:var(--accent-green); margin-top:0.5rem; text-align:center; padding:1rem;">Loading live data...</div>
                    </div>
                </div>
                <div style="border:1px solid var(--border-color); padding:1rem;">
                    <div style="font-size:0.8rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem; margin-bottom:0.5rem; color:var(--accent-green);">TRENDING TOKENS ON ROBINHOOD CHAIN (DEXSCREENER LIVE)</div>
                    <div id="markets-trending-table" style="font-size:0.8rem;">
                        <div style="text-align:center; padding:1rem; color:var(--accent-green);">⟳ Fetching live data from DexScreener...</div>
                    </div>
                </div>
            `;
            // Fetch and populate real-time data
            loadMarketsTabData();
        } 
        else if (tabId === "investigate") {
            displayTitle.innerText = "03 BIOMETRIC & WALLET INVESTIGATOR";
            viewDiv.innerHTML = `
                <div style="border-bottom: 1px solid var(--border-color); padding-bottom:0.5rem; margin-bottom:1rem;">
                    <span class="text-green">WALLET SEARCH INTERFACE // GROUNDED CORE</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">
                    Enter any public EVM wallet address to investigate transaction history, token holdings, and onchain activity patterns.
                </p>
                <div style="display:flex; gap:0.5rem; margin-bottom:1.5rem;">
                    <span style="color:var(--accent-green); align-self:center;">&gt;</span>
                    <input type="text" id="wallet-search-input" placeholder="Enter EVM wallet address (0x...)" style="background:var(--bg-dark); border:1px solid var(--border-color); color:var(--text-primary); font-family:var(--font-mono); font-size:0.85rem; padding:0.6rem; flex-grow:1; outline:none;" autocomplete="off" spellcheck="false">
                    <button id="wallet-analyze-btn" class="cta-btn primary-cta" style="padding:0.6rem 1.2rem; font-size:0.8rem; font-family:var(--font-mono);">ANALYZE</button>
                </div>
                <div id="wallet-result-box" style="border:1px solid var(--border-color); padding:1.25rem; background:rgba(0,0,0,0.1); border-radius:3px; min-height:80px;">
                    <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:0.5rem; letter-spacing:0.08em;">INVESTIGATOR RESULT PREVIEW</span>
                    <div style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:1.5rem 0;">
                        No address searched. Enter a target wallet address to initialize correlation protocols.
                    </div>
                </div>
            `;

            // Wire up analyze button + enter key
            const analyzeBtn   = viewDiv.querySelector("#wallet-analyze-btn");
            const searchInput  = viewDiv.querySelector("#wallet-search-input");
            const runAnalysis  = () => runWalletAnalysis(searchInput.value.trim());

            analyzeBtn.addEventListener("click", runAnalysis);
            searchInput.addEventListener("keydown", e => { if (e.key === "Enter") runAnalysis(); });

            // Auto-fill connected wallet if available
            if (_connectedAddress) searchInput.value = _connectedAddress;
        } 
        else if (tabId === "monitors") {
            displayTitle.innerText = "04 MULTI-TELEMETRY BIOMETRIC GAUGES";
            viewDiv.innerHTML = `
                <div style="border-bottom: 1px solid var(--border-color); padding-bottom:0.5rem; margin-bottom:1rem;">
                    <span class="text-green">VALERIA MULTI-GAUGE MONITOR // LIVE</span>
                </div>
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1rem;">
                    <div style="border:1px solid var(--border-color); padding:1rem; text-align:center; background:rgba(0,0,0,0.1);">
                        <div style="font-size:0.75rem; color:var(--text-muted);">GLUCOSE RATE</div>
                        <div style="font-size:2rem; font-weight:bold; color:var(--accent-green); margin:0.5rem 0;">98 <span style="font-size:0.8rem;">mg/dL</span></div>
                        <span style="font-size:0.7rem; border:1px solid rgba(0, 255, 102, 0.2); padding:0.1rem 0.4rem; color:var(--accent-green);">STABLE BASE</span>
                    </div>
                    <div style="border:1px solid var(--border-color); padding:1rem; text-align:center; background:rgba(0,0,0,0.1);">
                        <div style="font-size:0.75rem; color:var(--text-muted);">CIRCADIAN EFFICIENCY</div>
                        <div style="font-size:2rem; font-weight:bold; color:var(--accent-purple); margin:0.5rem 0;">88%</div>
                        <span style="font-size:0.7rem; border:1px solid rgba(139, 92, 246, 0.2); padding:0.1rem 0.4rem; color:var(--accent-purple);">EFFICIENT</span>
                    </div>
                    <div style="border:1px solid var(--border-color); padding:1rem; text-align:center; background:rgba(0,0,0,0.1);">
                        <div style="font-size:0.75rem; color:var(--text-muted);">COGNITIVE cortisol</div>
                        <div style="font-size:2rem; font-weight:bold; color:var(--accent-green); margin:0.5rem 0;">0.12 <span style="font-size:0.8rem;">μg/dL</span></div>
                        <span style="font-size:0.7rem; border:1px solid rgba(0, 255, 102, 0.2); padding:0.1rem 0.4rem; color:var(--accent-green);">NORMAL</span>
                    </div>
                </div>
                <div style="border:1px solid var(--border-color); padding:1rem;">
                    <div style="font-size:0.8rem; color:var(--accent-green); border-bottom:1px solid var(--border-color); padding-bottom:0.5rem; margin-bottom:0.5rem;">TELEMETRY DIAGNOSTIC CORE</div>
                    <div style="font-size:0.85rem; line-height:1.6;">
                        <span class="text-purple">&gt; CIRCADIAN CLOCK:</span> Balanced. High melatonin suppression expected to start at 23:00 local.<br>
                        <span class="text-purple">&gt; NUTRITIONAL BALANCE:</span> Stable baseline. Low glycemic impact detected over last 6 hours.<br>
                        <span class="text-purple">&gt; STRESS COEFFICIENT:</span> 0.18. Core telemetry indicates healthy autonomic state.
                    </div>
                </div>
            `;
        }

        workspace.insertBefore(viewDiv, workspace.querySelector(".terminal-input-container"));
    }

    // New Chat button functionality
    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            chatSessions++;
            sessionCount.innerText = chatSessions;
            
            // Clear current screen and print initial greeting
            screenDisplay.innerHTML = "";
            const greetingMsg = document.createElement("div");
            greetingMsg.className = "terminal-message valeria-message";
            greetingMsg.innerHTML = `
                <div class="message-sender-header">
                    <div class="sender-avatar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00FF66" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M9 17v-5h6v5"/>
                            <circle cx="12" cy="8" r="1"/>
                        </svg>
                    </div>
                    <span class="sender-name">VALERIA</span>
                    <span class="message-timestamp">${getCurrentTimeFormatted()}</span>
                </div>
                <div class="message-body text-green font-mono">
                    "Session initialized. I'm Valeria. Enter a new objective or objective trigger."
                </div>
            `;
            screenDisplay.appendChild(greetingMsg);

            // Reset Active Session Box
            document.getElementById("active-session-name").innerText = "New conversation";
            document.getElementById("active-session-desc").innerText = "Ready for a new objective";

            // Print system notifier
            addSystemTerminalMessage("System", `NEW SECURE CHAT SESSION #${chatSessions} ROOTED ON ROBINHOOD CHAIN.`);
        });
    }

    // Handle Quick Action Clicks
    actionChips.forEach(chip => {
        chip.addEventListener("click", () => {
            const command = chip.getAttribute("data-command");
            executeCommand(command);
        });
    });

    // Handle Send Button & Enter key
    if (sendBtn && inputField) {
        sendBtn.addEventListener("click", () => {
            const val = inputField.value.trim();
            if (val) {
                executeCommand(val);
                inputField.value = "";
            }
        });

        inputField.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const val = inputField.value.trim();
                if (val) {
                    executeCommand(val);
                    inputField.value = "";
                }
            }
        });
    }

    // Main command dispatcher
    function executeCommand(commandText) {
        // 1. Print User message
        addUserTerminalMessage(commandText);
        scrollTerminalToBottom();

        // 2. Show thinking loader
        const loadingMsg = addLoadingTerminalMessage();
        scrollTerminalToBottom();

        // 3. Process mock responses
        setTimeout(() => {
            // Remove loading message
            loadingMsg.remove();

            let responseText = "";
            let categoryName = "Objective Completed";

            if (commandText === "Find trending agent tokens") {
                categoryName = "Market Intelligence";
                // Fetch real-time data from DexScreener
                loadingMsg.remove();
                addValeriaTerminalMessage(`** DexScreener Live Scan — Robinhood Chain **\n\nConnecting to DexScreener API... Fetching trending tokens on Robinhood Chain (sorted by 24h volume)...`);
                scrollTerminalToBottom();

                fetchRobinhoodTrending(10).then(tokens => {
                    if (!tokens || tokens.length === 0) {
                        addValeriaTerminalMessage(`** DexScreener Live Scan — FAILED **\n\nNo data returned from DexScreener API. The Robinhood Chain might be experiencing low activity, or the API may be rate-limited. Try again shortly.`);
                        scrollTerminalToBottom();
                        return;
                    }

                    let result = `** DexScreener Live Scan — Robinhood Chain **\n\nFound **${tokens.length}** trending tokens ranked by trending score:\n\n`;

                    tokens.forEach((pair, i) => {
                        const ch5m = pair.priceChange?.m5;
                        const ch1h = pair.priceChange?.h1;
                        const ch6h = pair.priceChange?.h6;
                        const ch24h = pair.priceChange?.h24;
                        const totalTxns = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
                        const vol = pair.volume?.h24 || 0;
                        const liq = pair.liquidity?.usd || 0;
                        const mcap = pair.marketCap || pair.fdv || 0;
                        const age = formatAge(pair.pairCreatedAt);

                        result += `${i + 1}. **$${pair.baseToken.symbol}** (${pair.baseToken.name})\n`;
                        result += `   * MCAP: ${formatUsd(mcap)} | Price: ${formatPrice(pair.priceUsd)} | Age: ${age}\n`;
                        result += `   * Vol 24h: ${formatUsd(vol)} | Liquidity: ${formatUsd(liq)} | Txns: ${formatNumber(totalTxns)}\n`;
                        result += `   * 5m: **${formatPriceChange(ch5m)}** | 1h: **${formatPriceChange(ch1h)}** | 6h: **${formatPriceChange(ch6h)}** | 24h: **${formatPriceChange(ch24h)}**\n`;
                        result += `   * DEX: ${pair.dexId} | [View on DexScreener](${pair.url})\n\n`;
                    });

                    result += `*Data sourced live from DexScreener API • Chain: Robinhood • Updated: ${getCurrentTimeFormatted()}*`;

                    addValeriaTerminalMessage(result);
                    document.getElementById("active-session-name").innerText = "Market Intelligence";
                    document.getElementById("active-session-desc").innerText = "Objective executed successfully";
                    scrollTerminalToBottom();
                }).catch(err => {
                    addValeriaTerminalMessage(`** DexScreener Scan Error **\n\nFailed to fetch data: ${err.message}. Check console for details.`);
                    scrollTerminalToBottom();
                });
                return; // exit early — async handling
            } 
            else if (commandText === "Analyze my connected wallet") {
                categoryName = "Wallet Investigation";
                responseText = `** Biometric Wallet Investigator Diagnostic **
                
                Connected Address: **0x46634cde71b12b591b7be1d10200ff6639ffa0ff**
                
                * Wallet Analysis Summary:*
                * Gas Usage (24h): 0.042 ETH
                * Transaction Intervals: Concentrated between 13:00 - 19:00 (Circadian healthy)
                * Dormant Assets: None detected
                
                * Volatility & Bio Correlation:*
                * Burnout Radar Index: 28% (Healthy rest periods detected)
                * Concentration Risk: Moderate (Stonk.fi token weights standard)
                
                *Diagnosis:* Wallet health status: **OPTIMAL**. No intervention required. Circadian alignment maintained.`;
            } 
            else if (commandText === "Check my continuous glucose & HRV score") {
                categoryName = "Biometric Checkup";
                responseText = `** Real-Time Biometric Diagnostics **
                
                * Biometric Metrics:*
                * Heart Rate Variability (HRV): **89ms** (Excellent vagal tone)
                * Continuous Glucose (CGM): **98 mg/dL** (Stable baseline glycemic control)
                * Current Bio-Energy Score: **84 / 100**
                
                * Valeria AI Circadian Insight:*
                Your current blood sugar level indicates high cellular energy storage. No spikes or reactive crashes detected over the past 4 hours. 
                
                *Action Trigger:* Continue with current activities. A protein-rich snack is recommended in 2 hours to avoid circadian energy dips.`;
            } 
            else if (commandText === "Explain Robinhood Chain") {
                categoryName = "Network Specs";
                responseText = `** Robinhood Chain Protocol Documentation **
                
                * Technical Details:*
                * Native EVM Chain ID: **4663**
                * Core Gas Token: **ETH**
                * Primary DEX Infrastructure: **Stonk.fi**
                * RPC Connection: \`robinhood-rpc.publicnode.com\`
                
                * Agartha Nexus Core integration:*
                Robinhood Chain provides the high-performance transaction layer for the **$VALERIA** token. All bio-telemetry smart triggers and autonomous medical workflows run securely on this EVM network with user-explicit wallet signatures.`;
            } 
            else {
                // Generic response
                responseText = `Objective: "${commandText}" received.
                
                I'm researching the metrics on Robinhood Chain and correlating it with your biological telemetry data.
                
                Valeria core registers this custom prompt. I recommend using one of the Quick Action Triggers for verified diagnostics.`;
            }

            // Print Valeria response
            addValeriaTerminalMessage(responseText);
            
            // Update Active Session Box
            document.getElementById("active-session-name").innerText = categoryName;
            document.getElementById("active-session-desc").innerText = "Objective executed successfully";

            scrollTerminalToBottom();
        }, 1200);
    }

    // Helper functions to create messages
    function addUserTerminalMessage(text) {
        const msg = document.createElement("div");
        msg.className = "terminal-message user-message";
        msg.innerHTML = `
            <div class="message-sender-header">
                <div class="sender-avatar" style="border-color: var(--text-primary);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </div>
                <span class="sender-name">USER</span>
                <span class="message-timestamp">${getCurrentTimeFormatted()}</span>
            </div>
            <div class="message-body font-mono text-white">
                &gt; ${escapeHtml(text)}
            </div>
        `;
        screenDisplay.appendChild(msg);
    }

    function addValeriaTerminalMessage(text) {
        const msg = document.createElement("div");
        msg.className = "terminal-message valeria-message";
        
        // Parse simple markdown to HTML (mainly bold text and bullet points)
        let formattedText = escapeHtml(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-green font-mono">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="text-purple">$1</em>')
            .replace(/^\s*\*\s+(.*?)$/gm, '<li style="margin-left: 1.5rem; list-style-type: square; color: var(--text-muted);">$1</li>')
            .replace(/\n/g, '<br>');

        msg.innerHTML = `
            <div class="message-sender-header">
                <div class="sender-avatar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00FF66" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <path d="M9 17v-5h6v5"/>
                        <circle cx="12" cy="8" r="1"/>
                    </svg>
                </div>
                <span class="sender-name">VALERIA</span>
                <span class="message-timestamp">${getCurrentTimeFormatted()}</span>
            </div>
            <div class="message-body text-green font-mono">
                ${formattedText}
            </div>
        `;
        screenDisplay.appendChild(msg);
    }

    function addLoadingTerminalMessage() {
        const msg = document.createElement("div");
        msg.className = "terminal-message valeria-message loading-indicator";
        msg.innerHTML = `
            <div class="message-sender-header">
                <div class="sender-avatar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00FF66" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <path d="M9 17v-5h6v5"/>
                        <circle cx="12" cy="8" r="1"/>
                    </svg>
                </div>
                <span class="sender-name">VALERIA</span>
                <span class="message-timestamp">${getCurrentTimeFormatted()}</span>
            </div>
            <div class="message-body text-green font-mono loading-dots">
                Thinking<span>.</span><span>.</span><span>.</span>
            </div>
        `;
        screenDisplay.appendChild(msg);
        return msg;
    }

    function addSystemTerminalMessage(source, text) {
        const msg = document.createElement("div");
        msg.className = "terminal-message system-message";
        msg.innerHTML = `
            <div class="message-sender-header">
                <span class="sender-name text-purple font-mono" style="font-size:0.7rem; font-weight:bold;">[ SYSTEM ALERT ]</span>
                <span class="message-timestamp">${getCurrentTimeFormatted()}</span>
            </div>
            <div class="message-body text-purple font-mono" style="font-size:0.8rem; border-left:1px solid var(--accent-purple); padding-left:0.5rem; margin-left:1.85rem;">
                ${escapeHtml(text)}
            </div>
        `;
        screenDisplay.appendChild(msg);
        scrollTerminalToBottom();
    }

    function scrollTerminalToBottom() {
        screenDisplay.scrollTop = screenDisplay.scrollHeight;
    }
}

/* ==========================================================================
   5. LORE DOSSIER CHAPTERS SWITCHING
   ========================================================================== */
function initLoreDossier() {
    const tabs = document.querySelectorAll(".lore-tab");
    const chapters = document.querySelectorAll(".lore-chapter-content");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const chapterId = tab.getAttribute("data-chapter");

            chapters.forEach(chapter => {
                chapter.classList.remove("active");
                if (chapter.getAttribute("id") === chapterId) {
                    chapter.classList.add("active");
                }
            });
        });
    });
}

/* ==========================================================================
   WALLET INVESTIGATOR — Real onchain data via Ethplorer free API
   ========================================================================== */
async function runWalletAnalysis(address) {
    const resultBox = document.getElementById("wallet-result-box");
    if (!resultBox) return;

    // Validate EVM address format
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
        resultBox.innerHTML = `
            <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:0.5rem; letter-spacing:0.08em;">INVESTIGATOR RESULT PREVIEW</span>
            <div style="color:orange; font-family:var(--font-mono); font-size:0.82rem; padding:0.5rem 0;">
                ⚠ Invalid address format. Enter a valid EVM address starting with 0x (40 hex chars).
            </div>`;
        return;
    }

    // Show loading
    resultBox.innerHTML = `
        <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:0.75rem; letter-spacing:0.08em;">INVESTIGATOR RESULT PREVIEW</span>
        <div style="display:flex; align-items:center; gap:0.75rem; color:var(--accent-green); font-family:var(--font-mono); font-size:0.8rem; padding:0.5rem 0;">
            <span style="animation:spin 1s linear infinite; display:inline-block;">⟳</span>
            Fetching onchain data for ${address.slice(0,6)}...${address.slice(-4)}
        </div>`;

    try {
        // Ethplorer free API — no key needed beyond "freekey"
        const url = `https://api.ethplorer.io/getAddressInfo/${address}?apiKey=freekey`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.error) {
            resultBox.innerHTML = renderWalletError(data.error.message || "Address not found on Ethereum mainnet.");
            return;
        }

        const eth = data.address?.ETH || {};
        const ethBalance = eth.balance ? parseFloat(eth.balance).toFixed(4) : "0.0000";
        const ethUsd = eth.price?.rate ? `$${(parseFloat(eth.balance || 0) * eth.price.rate).toFixed(2)}` : "—";
        const txCount = data.countTxs || data.address?.transactions || 0;
        const tokenCount = data.tokens?.length || 0;
        const isContract = data.address?.isContract ? "YES — Smart Contract" : "NO — EOA";

        // Build token list (top 5)
        let tokenRows = "";
        if (data.tokens && data.tokens.length > 0) {
            data.tokens.slice(0, 5).forEach(t => {
                const bal = t.balance ? (parseFloat(t.balance) / Math.pow(10, t.tokenInfo?.decimals || 18)).toFixed(4) : "—";
                const usd = t.tokenInfo?.price?.rate
                    ? `$${(parseFloat(bal) * t.tokenInfo.price.rate).toFixed(2)}`
                    : "—";
                tokenRows += `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                        <td style="padding:0.3rem 0.4rem; color:var(--accent-green);">$${t.tokenInfo?.symbol || "?"}</td>
                        <td style="padding:0.3rem 0.4rem;">${t.tokenInfo?.name?.slice(0,18) || "—"}</td>
                        <td style="padding:0.3rem 0.4rem;">${parseFloat(bal).toLocaleString()}</td>
                        <td style="padding:0.3rem 0.4rem; color:var(--accent-green);">${usd}</td>
                    </tr>`;
            });
        } else {
            tokenRows = `<tr><td colspan="4" style="padding:0.5rem; color:var(--text-muted); text-align:center;">No ERC-20 token holdings found</td></tr>`;
        }

        // Activity analysis
        const activityLevel = txCount > 500 ? "HEAVY TRADER" : txCount > 100 ? "ACTIVE" : txCount > 20 ? "MODERATE" : "LIGHT";
        const riskScore = Math.min(100, Math.round((txCount / 10) + (tokenCount * 2)));
        const biometricNote = txCount > 200
            ? "High onchain activity detected. Elevated cortisol risk during volatile sessions."
            : txCount > 50
            ? "Moderate onchain activity. Healthy transaction intervals observed."
            : "Low transaction frequency. Minimal stress-pattern correlation detected.";

        resultBox.innerHTML = `
            <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:1rem; letter-spacing:0.08em; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">
                INVESTIGATOR RESULT PREVIEW — <span style="color:var(--accent-green);">${address.slice(0,8)}...${address.slice(-6)}</span>
            </span>

            <!-- Summary row -->
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:0.75rem; margin-bottom:1.25rem;">
                <div style="border:1px solid rgba(0,255,102,0.15); padding:0.75rem; background:rgba(0,255,102,0.03);">
                    <div style="font-size:0.6rem; color:var(--text-muted); margin-bottom:0.3rem;">ETH BALANCE</div>
                    <div style="font-size:1rem; font-weight:700; color:var(--accent-green); font-family:var(--font-mono);">${ethBalance}</div>
                    <div style="font-size:0.65rem; color:var(--text-muted);">${ethUsd}</div>
                </div>
                <div style="border:1px solid rgba(255,255,255,0.08); padding:0.75rem; background:rgba(0,0,0,0.1);">
                    <div style="font-size:0.6rem; color:var(--text-muted); margin-bottom:0.3rem;">TOTAL TXNs</div>
                    <div style="font-size:1rem; font-weight:700; font-family:var(--font-mono);">${txCount.toLocaleString()}</div>
                    <div style="font-size:0.65rem; color:var(--accent-green);">${activityLevel}</div>
                </div>
                <div style="border:1px solid rgba(139,92,246,0.15); padding:0.75rem; background:rgba(139,92,246,0.03);">
                    <div style="font-size:0.6rem; color:var(--text-muted); margin-bottom:0.3rem;">TOKENS HELD</div>
                    <div style="font-size:1rem; font-weight:700; color:#8B5CF6; font-family:var(--font-mono);">${tokenCount}</div>
                    <div style="font-size:0.65rem; color:var(--text-muted);">ERC-20</div>
                </div>
                <div style="border:1px solid rgba(255,255,255,0.08); padding:0.75rem; background:rgba(0,0,0,0.1);">
                    <div style="font-size:0.6rem; color:var(--text-muted); margin-bottom:0.3rem;">CONTRACT</div>
                    <div style="font-size:0.75rem; font-weight:700; font-family:var(--font-mono); color:${data.address?.isContract ? '#F59E0B' : 'var(--accent-green)'};">${isContract}</div>
                </div>
            </div>

            <!-- Token holdings -->
            <div style="margin-bottom:1rem;">
                <div style="font-size:0.7rem; color:var(--accent-green); margin-bottom:0.5rem; font-family:var(--font-mono);">TOP TOKEN HOLDINGS</div>
                <div style="overflow-x:auto;">
                    <table style="width:100%; font-size:0.75rem; border-collapse:collapse; font-family:var(--font-mono);">
                        <thead>
                            <tr style="color:var(--text-muted); border-bottom:1px solid var(--border-color);">
                                <th style="padding:0.3rem 0.4rem; text-align:left;">SYMBOL</th>
                                <th style="padding:0.3rem 0.4rem; text-align:left;">NAME</th>
                                <th style="padding:0.3rem 0.4rem; text-align:left;">BALANCE</th>
                                <th style="padding:0.3rem 0.4rem; text-align:left;">USD VALUE</th>
                            </tr>
                        </thead>
                        <tbody>${tokenRows}</tbody>
                    </table>
                </div>
            </div>

            <!-- Biometric correlation -->
            <div style="border:1px solid rgba(139,92,246,0.2); padding:0.75rem; background:rgba(139,92,246,0.04);">
                <div style="font-size:0.65rem; color:#8B5CF6; margin-bottom:0.4rem; font-family:var(--font-mono);">⬡ VALERIA BIO-CORRELATION INDEX</div>
                <div style="font-size:0.78rem; color:var(--text-muted); line-height:1.6;">${biometricNote}</div>
                <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.6rem;">
                    <div style="font-size:0.65rem; color:var(--text-muted); font-family:var(--font-mono);">ACTIVITY RISK SCORE:</div>
                    <div style="flex:1; height:4px; background:rgba(255,255,255,0.06); border-radius:2px;">
                        <div style="height:100%; width:${Math.min(100, riskScore)}%; background:${riskScore > 70 ? '#EF4444' : riskScore > 40 ? '#F59E0B' : '#00FF66'}; border-radius:2px;"></div>
                    </div>
                    <div style="font-size:0.65rem; color:var(--accent-green); font-family:var(--font-mono);">${riskScore}/100</div>
                </div>
            </div>

            <div style="font-size:0.6rem; color:var(--text-muted); margin-top:0.75rem; font-family:var(--font-mono);">
                ⟳ Data via Ethplorer API • Ethereum Mainnet • Updated: ${new Date().toTimeString().split(" ")[0]}
            </div>`;

    } catch (err) {
        resultBox.innerHTML = renderWalletError(`Network error: ${err.message}`);
    }
}

function renderWalletError(msg) {
    return `
        <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:0.5rem; letter-spacing:0.08em;">INVESTIGATOR RESULT PREVIEW</span>
        <div style="color:#EF4444; font-family:var(--font-mono); font-size:0.82rem; padding:0.5rem 0;">
            ✕ ${escapeHtml(msg)}
        </div>`;
}

/* ==========================================================================
   UTILITY HELPER FUNCTIONS
   ========================================================================== */
function getCurrentTimeFormatted() {
    const d = new Date();
    return d.toTimeString().split(" ")[0];
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

/* ==========================================================================
   DEXSCREENER REAL-TIME DATA FETCHER
   Fetches trending tokens on Robinhood Chain matching DexScreener trending page.
   Uses: token-profiles API + token-pairs batch lookup + expanded search.
   ========================================================================== */
const DEXSCREENER_API = "https://api.dexscreener.com";
const ROBINHOOD_CHAIN_ID = "robinhood";

// Cache to avoid hammering the API
let _dexCache = { data: null, timestamp: 0 };
const DEX_CACHE_TTL = 30000; // 30 seconds

async function fetchRobinhoodTrending(limit = 20) {
    const now = Date.now();
    if (_dexCache.data && (now - _dexCache.timestamp) < DEX_CACHE_TTL) {
        return _dexCache.data.slice(0, limit);
    }

    try {
        const allPairs = [];
        const seenPairs = new Set();

        // Strategy 1: Get token profiles (recently active/boosted tokens)
        try {
            const profilesResp = await fetch(`${DEXSCREENER_API}/token-profiles/latest/v1`);
            if (profilesResp.ok) {
                const profiles = await profilesResp.json();
                const rhTokenAddrs = profiles
                    .filter(p => p.chainId === ROBINHOOD_CHAIN_ID)
                    .map(p => p.tokenAddress);

                // Batch lookup pairs for these tokens (max 30 addresses per call)
                if (rhTokenAddrs.length > 0) {
                    const batchSize = 30;
                    for (let i = 0; i < rhTokenAddrs.length; i += batchSize) {
                        const batch = rhTokenAddrs.slice(i, i + batchSize).join(",");
                        try {
                            const pairsResp = await fetch(`${DEXSCREENER_API}/token-pairs/v1/${ROBINHOOD_CHAIN_ID}/${batch}`);
                            if (pairsResp.ok) {
                                const pairs = await pairsResp.json();
                                if (Array.isArray(pairs)) {
                                    for (const pair of pairs) {
                                        if (pair.chainId === ROBINHOOD_CHAIN_ID && !seenPairs.has(pair.pairAddress)) {
                                            seenPairs.add(pair.pairAddress);
                                            allPairs.push(pair);
                                        }
                                    }
                                }
                            }
                        } catch (_) {}
                    }
                }
            }
        } catch (_) {}

        // Strategy 2: Get boosted/promoted tokens
        try {
            const boostResp = await fetch(`${DEXSCREENER_API}/token-boosts/top/v1`);
            if (boostResp.ok) {
                const boosts = await boostResp.json();
                const rhBoosted = (Array.isArray(boosts) ? boosts : [])
                    .filter(b => b.chainId === ROBINHOOD_CHAIN_ID)
                    .map(b => b.tokenAddress);

                if (rhBoosted.length > 0) {
                    const batch = rhBoosted.slice(0, 30).join(",");
                    try {
                        const pairsResp = await fetch(`${DEXSCREENER_API}/token-pairs/v1/${ROBINHOOD_CHAIN_ID}/${batch}`);
                        if (pairsResp.ok) {
                            const pairs = await pairsResp.json();
                            if (Array.isArray(pairs)) {
                                for (const pair of pairs) {
                                    if (pair.chainId === ROBINHOOD_CHAIN_ID && !seenPairs.has(pair.pairAddress)) {
                                        seenPairs.add(pair.pairAddress);
                                        allPairs.push(pair);
                                    }
                                }
                            }
                        }
                    } catch (_) {}
                }
            }
        } catch (_) {}

        // Strategy 3: Broad search queries to catch more tokens
        const searchQueries = [
            "F", "FOX", "HELIA", "NUMI", "LEMON", "NINEHOOD", "WOOD", "BOYZ",
            "IF", "TA", "PONS", "HFUND", "BRODIE", "GRAILS", "CASHCAT", "PCAT",
            "robinhood", "meme", "hood", "stonk", "future", "sherwood", "trump",
            "lemon", "cat", "dog", "pons"
        ];

        for (const q of searchQueries) {
            try {
                const resp = await fetch(`${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(q)}`);
                if (!resp.ok) continue;
                const json = await resp.json();
                if (json.pairs) {
                    for (const pair of json.pairs) {
                        if (pair.chainId === ROBINHOOD_CHAIN_ID && !seenPairs.has(pair.pairAddress)) {
                            seenPairs.add(pair.pairAddress);
                            allPairs.push(pair);
                        }
                    }
                }
            } catch (_) {}
        }

        // De-duplicate by baseToken address (keep pair with highest volume)
        const tokenMap = new Map();
        for (const pair of allPairs) {
            const addr = pair.baseToken.address.toLowerCase();
            const existing = tokenMap.get(addr);
            if (!existing || (pair.volume?.h24 || 0) > (existing.volume?.h24 || 0)) {
                tokenMap.set(addr, pair);
            }
        }

        // Compute trending score (similar to DexScreener's algorithm)
        // Weight: volume (40%), txns (30%), recency (20%), liquidity (10%)
        const withScore = Array.from(tokenMap.values())
            .filter(p => (p.volume?.h24 || 0) > 0 || ((p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0)) > 0)
            .map(p => {
                const vol = p.volume?.h24 || 0;
                const txns = (p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0);
                const liq = p.liquidity?.usd || 0;
                const ageMs = Date.now() - (p.pairCreatedAt || 0);
                const ageDays = ageMs / (1000 * 60 * 60 * 24);
                // Newer pairs get higher recency score
                const recencyScore = Math.max(0, 100 - ageDays * 2);

                const trendingScore = (vol * 0.4) + (txns * 50 * 0.3) + (recencyScore * 100 * 0.2) + (liq * 0.1);
                return { ...p, _trendingScore: trendingScore };
            })
            .sort((a, b) => b._trendingScore - a._trendingScore);

        _dexCache = { data: withScore, timestamp: now };
        return withScore.slice(0, limit);
    } catch (err) {
        console.error("DexScreener fetch error:", err);
        return [];
    }
}

/* ==========================================================================
   FORMATTING UTILITY FUNCTIONS
   ========================================================================== */
function formatUsd(val) {
    if (val === undefined || val === null || isNaN(val)) return "-";
    if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    return `$${val.toFixed(2)}`;
}

function formatPrice(priceStr) {
    const p = parseFloat(priceStr);
    if (isNaN(p)) return "-";
    if (p >= 1) return `$${p.toFixed(2)}`;
    if (p >= 0.01) return `$${p.toFixed(4)}`;
    if (p >= 0.00001) return `$${p.toFixed(6)}`;
    // For very small prices, show significant digits
    const str = p.toFixed(20);
    const match = str.match(/^0\.(0+)(\d{4})/);
    if (match) {
        const zeros = match[1].length;
        return `$0.0{${zeros}}${match[2]}`;
    }
    return `$${p.toExponential(2)}`;
}

function formatAge(createdAt) {
    if (!createdAt) return "-";
    const diffMs = Date.now() - createdAt;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo`;
}

function getPriceChangeColor(change) {
    if (change === undefined || change === null) return "var(--text-muted)";
    if (change > 0) return "var(--accent-green)";
    if (change < 0) return "red";
    return "var(--text-muted)";
}

function formatPriceChange(change) {
    if (change === undefined || change === null) return "-";
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
}

function formatNumber(val) {
    if (val === undefined || val === null || isNaN(val)) return "-";
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return val.toLocaleString();
}

/* ==========================================================================
   MARKETS TAB LIVE DATA LOADER
   Populates the Markets tab matching DexScreener trending page format.
   Columns: TOKEN, DEX, MCAP, PRICE, AGE, TXNS, VOLUME, 5m, 1h, 6h, 24h, LIQUIDITY
   ========================================================================== */
async function loadMarketsTabData() {
    try {
        const tokens = await fetchRobinhoodTrending(20);

        // Populate top summary cards
        const cardsContainer = document.getElementById("markets-top-pair-cards");
        if (cardsContainer && tokens.length > 0) {
            const totalVol = tokens.reduce((sum, t) => sum + (t.volume?.h24 || 0), 0);
            const totalLiq = tokens.reduce((sum, t) => sum + (t.liquidity?.usd || 0), 0);
            const totalTxns = tokens.reduce((sum, t) => sum + (t.txns?.h24?.buys || 0) + (t.txns?.h24?.sells || 0), 0);

            cardsContainer.innerHTML = `
                <div style="border:1px solid var(--border-color); padding:1rem; background:rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">
                        <div>
                            <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">24H VOLUME</div>
                            <div style="font-size:1.2rem; font-weight:bold; color:var(--accent-green); margin-top:0.15rem;">${formatUsd(totalVol)}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">24H TXNS</div>
                            <div style="font-size:1.2rem; font-weight:bold; margin-top:0.15rem;">${formatNumber(totalTxns)}</div>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; padding-top:0.5rem; border-top:1px solid var(--border-color);">
                        <span style="color:var(--text-muted);">TOTAL LIQUIDITY:</span>
                        <span class="text-green">${formatUsd(totalLiq)}</span>
                    </div>
                </div>
                <div style="border:1px solid var(--border-color); padding:1rem; background:rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">
                        <div>
                            <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">TRENDING TOKENS</div>
                            <div style="font-size:1.2rem; font-weight:bold; color:var(--accent-green); margin-top:0.15rem;">${tokens.length}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">RANKED BY</div>
                            <div style="font-size:0.85rem; font-weight:bold; color:var(--accent-purple); margin-top:0.15rem;">↓ TRENDING 24H</div>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; padding-top:0.5rem; border-top:1px solid var(--border-color);">
                        <span style="color:var(--text-muted);">SOURCE:</span>
                        <span class="text-purple">DEXSCREENER API</span>
                    </div>
                </div>
            `;
        }

        // Populate trending table — matching DexScreener columns exactly
        const tableContainer = document.getElementById("markets-trending-table");
        if (tableContainer) {
            if (tokens.length === 0) {
                tableContainer.innerHTML = `<div style="text-align:center; padding:1rem; color:orange;">No trending data available. DexScreener may be rate-limited. Try again shortly.</div>`;
                return;
            }

            let tableHtml = `
                <div style="overflow-x:auto;">
                <table style="width:100%; font-size:0.75rem; border-collapse:collapse; text-align:left; white-space:nowrap;">
                    <thead>
                        <tr style="color:var(--text-muted); border-bottom:1px solid var(--border-color);">
                            <th style="padding:0.35rem 0.3rem;"></th>
                            <th style="padding:0.35rem 0.3rem;">TOKEN</th>
                            <th style="padding:0.35rem 0.3rem;">MCAP</th>
                            <th style="padding:0.35rem 0.3rem;">PRICE</th>
                            <th style="padding:0.35rem 0.3rem;">AGE</th>
                            <th style="padding:0.35rem 0.3rem;">TXNS</th>
                            <th style="padding:0.35rem 0.3rem;">VOLUME</th>
                            <th style="padding:0.35rem 0.3rem;">5M</th>
                            <th style="padding:0.35rem 0.3rem;">1H</th>
                            <th style="padding:0.35rem 0.3rem;">6H</th>
                            <th style="padding:0.35rem 0.3rem;">24H</th>
                            <th style="padding:0.35rem 0.3rem;">LIQUIDITY</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            tokens.forEach((pair, i) => {
                const ch5m = pair.priceChange?.m5;
                const ch1h = pair.priceChange?.h1;
                const ch6h = pair.priceChange?.h6;
                const ch24h = pair.priceChange?.h24;
                const totalTxns = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
                const vol = pair.volume?.h24 || 0;
                const liq = pair.liquidity?.usd || 0;
                const mcap = pair.marketCap || pair.fdv || 0;
                const age = formatAge(pair.pairCreatedAt);
                const dexLabel = pair.dexId || "uniswap";

                tableHtml += `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04); cursor:pointer; transition:background 0.15s;" 
                        onmouseover="this.style.background='rgba(0,255,102,0.04)'" 
                        onmouseout="this.style.background=''" 
                        onclick="window.open('${pair.url}', '_blank')" 
                        title="$${pair.baseToken.symbol} — ${pair.baseToken.name} • Click to open on DexScreener">
                        <td style="padding:0.35rem 0.3rem; color:var(--text-muted); font-size:0.65rem;">${i + 1}</td>
                        <td style="padding:0.35rem 0.3rem;">
                            <div style="display:flex; flex-direction:column; gap:0.1rem;">
                                <span style="font-weight:bold; color:${i < 3 ? 'var(--accent-green)' : 'var(--text-primary)'};">$${pair.baseToken.symbol}</span>
                                <span style="font-size:0.6rem; color:var(--text-muted);">${pair.baseToken.name.length > 18 ? pair.baseToken.name.substring(0, 18) + '…' : pair.baseToken.name}</span>
                            </div>
                        </td>
                        <td style="padding:0.35rem 0.3rem;">${formatUsd(mcap)}</td>
                        <td style="padding:0.35rem 0.3rem;">${formatPrice(pair.priceUsd)}</td>
                        <td style="padding:0.35rem 0.3rem; color:var(--text-muted);">${age}</td>
                        <td style="padding:0.35rem 0.3rem;">${formatNumber(totalTxns)}</td>
                        <td style="padding:0.35rem 0.3rem; color:var(--accent-green);">${formatUsd(vol)}</td>
                        <td style="padding:0.35rem 0.3rem; color:${getPriceChangeColor(ch5m)};">${formatPriceChange(ch5m)}</td>
                        <td style="padding:0.35rem 0.3rem; color:${getPriceChangeColor(ch1h)};">${formatPriceChange(ch1h)}</td>
                        <td style="padding:0.35rem 0.3rem; color:${getPriceChangeColor(ch6h)};">${formatPriceChange(ch6h)}</td>
                        <td style="padding:0.35rem 0.3rem; color:${getPriceChangeColor(ch24h)};">${formatPriceChange(ch24h)}</td>
                        <td style="padding:0.35rem 0.3rem;">${formatUsd(liq)}</td>
                    </tr>
                `;
            });

            tableHtml += `
                    </tbody>
                </table>
                </div>
                <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.75rem; display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                    <span>⟳ Live data from DexScreener API • Chain: Robinhood • Rank by: ↓ Trending 24h</span>
                    <span>Updated: ${getCurrentTimeFormatted()} • Click any row → DexScreener</span>
                </div>
            `;

            tableContainer.innerHTML = tableHtml;
        }
    } catch (err) {
        console.error("Markets tab data load error:", err);
        const tableContainer = document.getElementById("markets-trending-table");
        if (tableContainer) {
            tableContainer.innerHTML = `<div style="text-align:center; padding:1rem; color:red;">Error loading DexScreener data: ${err.message}</div>`;
        }
    }
}
