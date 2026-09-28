// api/claude.js — Función serverless de Vercel
// Hace de intermediario seguro entre la app y la API de Anthropic.
// La API key vive solo acá (variable de entorno ANTHROPIC_API_KEY), nunca en el navegador.

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta ANTHROPIC_API_KEY en las variables de entorno de Vercel" });
  }

  try {
    const { system, prompt, max_tokens } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Falta el prompt" });
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: max_tokens || 2000,
        system: system || "",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(anthropicRes.status).json({ error: `Error de Anthropic: ${errText}` });
    }

    const data = await anthropicRes.json();
    const text = (data.content || []).map((b) => b.text || "").join("");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: `Error del servidor: ${e.message}` });
  }
}
