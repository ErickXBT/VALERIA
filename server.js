/*
  VALERIA OS — Express Backend
  Serves static files + AI chat API endpoints (streaming SSE)
*/

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Status endpoint ───────────────────────────────────────────────────────
app.get("/api/status", (req, res) => {
  res.json({ status: "online", aiEnabled: !!process.env.OPENAI_API_KEY });
});

// ─── Main Valeria chat (SSE streaming) ─────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "AI not configured — OPENAI_API_KEY missing" });
  }

  const OpenAI = require("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 800,
      temperature: 0.7,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Chat API error:", err.message);
    const errMsg = err.status === 429
      ? "OpenAI quota exceeded. Please add billing at platform.openai.com/settings/billing"
      : `AI error: ${err.message}`;
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// ─── Health-specific chat (SSE streaming) ──────────────────────────────────
app.post("/api/health-chat", async (req, res) => {
  const { messages, metrics, jsonMode } = req.body;

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "AI not configured" });
  }

  const OpenAI = require("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
- Use ** for bold key terms, - for bullet points

${jsonMode ? `IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "actionPlan": ["action 1", "action 2", "action 3"],
  "overallAssessment": "one sentence summary",
  "riskFlags": ["flag 1"] 
}` : ""}`;

  if (jsonMode) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...(messages || [{ role: "user", content: "Analyze my current biometrics and provide insights." }])],
        response_format: { type: "json_object" },
        max_tokens: 600,
        temperature: 0.5,
      });
      return res.json(JSON.parse(completion.choices[0].message.content));
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
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 700,
      temperature: 0.6,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Health chat stream error:", err.message);
    const errMsg = err.status === 429
      ? "OpenAI quota exceeded — add billing at platform.openai.com/settings/billing"
      : `AI error: ${err.message}`;
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ValeriaOS server running on port ${PORT}`);
  console.log(`AI enabled: ${!!process.env.OPENAI_API_KEY}`);
});
