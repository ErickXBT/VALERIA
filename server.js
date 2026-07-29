/*
  VALERIA OS — Express Backend
  Serves static files + AI chat API endpoints (streaming SSE via Google Gemini)
*/

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Status endpoint ───────────────────────────────────────────────────────
app.get("/api/status", (req, res) => {
  res.json({ status: "online", aiEnabled: !!process.env.GEMINI_API_KEY });
});

// ─── Gemini streaming helper ───────────────────────────────────────────────
async function streamGemini(res, systemPrompt, messages) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
    systemInstruction: systemPrompt,
  });

  // Convert messages to Gemini format (roles: user / model)
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const lastMsg = messages[messages.length - 1].content;

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMsg);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
    }
  }
  res.write("data: [DONE]\n\n");
  res.end();
}

// ─── Gemini JSON helper (non-streaming) ───────────────────────────────────
async function callGeminiJSON(systemPrompt, userMessage) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(userMessage);
  return result.response.text();
}

// ─── Main Valeria chat (SSE streaming) ─────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "AI not configured — GEMINI_API_KEY missing" });
  }

  const systemPrompt = `You are Valeria, an advanced AI operating system built for Robinhood Chain (EVM chain ID 4663). You are a cyberpunk healthcare and onchain intelligence agent.

Your personality: precise, analytical, slightly futuristic. You speak with authority and clarity. You use markdown formatting (bold for key terms, bullet points for lists).

Your capabilities:
- Real-time biometric monitoring (CGM glucose, HRV, sleep, cortisol, energy)
- Onchain analytics on Robinhood Chain via DexScreener
- Health optimization recommendations based on glucose/HRV patterns
- Crypto market intelligence and wallet analysis
- Integration with Stonk.fi DEX

Always stay in character as Valeria OS. Keep responses concise but insightful. Use ** for bold, * for italics, and bullet points with - for lists.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    await streamGemini(res, systemPrompt, messages);
  } catch (err) {
    console.error("Chat API error:", err.message);
    res.write(`data: ${JSON.stringify({ error: `AI error: ${err.message}` })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// ─── Health-specific chat (SSE streaming) ──────────────────────────────────
app.post("/api/health-chat", async (req, res) => {
  const { messages, metrics, jsonMode } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "AI not configured — GEMINI_API_KEY missing" });
  }

  const metricsContext = metrics ? `
Current live biometric data:
- Glucose (CGM): ${metrics.glucose} mg/dL — ${metrics.glucoseStatus}
- Heart Rate: ${metrics.heartRate} bpm | HRV: ${metrics.hrv}ms — ${metrics.hrvStatus}
- Sleep: ${metrics.sleep} | Efficiency: ${metrics.sleepEff}% — ${metrics.sleepStatus}
- Bio-Energy Score: ${metrics.energy}/100 — ${metrics.energyStatus}
- Steps: ${metrics.steps} / 10,000 target
- Cortisol: ${metrics.cortisol} μg/dL — ${metrics.cortisolStatus}
- Overall Health Score: ${metrics.healthScore}/100
` : "";

  const systemPrompt = `You are Valeria Health AI — a precision healthcare intelligence agent embedded in ValeriaOS. You have access to real-time biometric telemetry from continuous monitoring sensors.

${metricsContext}

Your role:
- Analyze biometric patterns and provide evidence-based health insights
- Correlate glucose, HRV, sleep, and cortisol with lifestyle recommendations
- Give actionable, personalized health protocols
- Speak with clinical precision but remain approachable
- Use ** for bold key terms, - for bullet points`;

  if (jsonMode) {
    const jsonSystemPrompt = systemPrompt + `

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "actionPlan": ["action 1", "action 2", "action 3"],
  "overallAssessment": "one sentence summary",
  "riskFlags": []
}`;
    try {
      const userMsg = (messages && messages.length)
        ? messages[messages.length - 1].content
        : "Analyze my current biometrics and provide insights.";
      const raw = await callGeminiJSON(jsonSystemPrompt, userMsg);
      return res.json(JSON.parse(raw));
    } catch (err) {
      console.error("Health chat JSON error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // Streaming mode
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    await streamGemini(res, systemPrompt, messages && messages.length ? messages : [{ role: "user", content: "Hello" }]);
  } catch (err) {
    console.error("Health chat stream error:", err.message);
    res.write(`data: ${JSON.stringify({ error: `AI error: ${err.message}` })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ValeriaOS server running on port ${PORT}`);
  console.log(`AI enabled: ${!!process.env.GEMINI_API_KEY}`);
});
