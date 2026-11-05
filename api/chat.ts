type ChatMessage = { text: string; sender: "user" | "bot" };
type Place = { name: string; description: string };

type ChatRequest = {
  question?: unknown;
  points?: unknown;
  history?: unknown;
};

export async function answerChat(body: ChatRequest, apiKey: string) {
  if (!apiKey) {
    return { status: 503, body: { error: "configuration" } };
  }

  const question =
    typeof body.question === "string"
      ? body.question.trim().slice(0, 2000)
      : "";

  if (!question) {
    return { status: 400, body: { error: "invalid_request" } };
  }

  const points = Array.isArray(body.points)
    ? (body.points as Place[])
        .slice(0, 50)
        .filter((place) => place && typeof place.name === "string")
    : [];

  const history = Array.isArray(body.history)
    ? (body.history as ChatMessage[])
        .slice(-8)
        .filter(
          (message) =>
            message &&
            (message.sender === "user" || message.sender === "bot") &&
            typeof message.text === "string",
        )
    : [];

  const placesText = points
    .map((place) => `${place.name}: ${place.description || ""}`)
    .join("\n");

  const contents = [
    ...history.map((message) => ({
      role: message.sender === "user" ? "user" : "model",
      parts: [{ text: message.text.slice(0, 1000) }],
    })),
    { role: "user", parts: [{ text: question }] },
  ];

  const models = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];

  for (const [index, model] of models.entries()) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: `Eres el guía virtual de Explora Kennedy, una página sobre lugares emblemáticos de Kennedy, Bogotá. Responde en español, de forma cálida y breve. Basa la información sobre los lugares en esta lista y no inventes datos históricos. Si no sabes algo, dilo con claridad.

Lugares disponibles:
${placesText || "No hay lugares cargados."}`,
                },
              ],
            },
            contents,
            generationConfig: { maxOutputTokens: 500 },
          }),
          signal: AbortSignal.timeout(12000),
        },
      );

      const result = (await response.json().catch(() => ({}))) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string };
      };

      if (!response.ok) {
        const canRetryWithFallback =
          index === 0 && (response.status === 429 || response.status >= 500);

        if (canRetryWithFallback) {
          console.warn(
            `Gemini ${model} devolvió ${response.status}; se probará el modelo alternativo.`,
          );
          continue;
        }

        console.error(
          `Error de Gemini ${model}:`,
          response.status,
          result.error?.message || "Error desconocido",
        );
        return { status: 502, body: { error: "upstream" } };
      }

      const text = result.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

      if (text) {
        return { status: 200, body: { text } };
      }

      if (index === 0) continue;

      return { status: 502, body: { error: "empty_response" } };
    } catch (error) {
      if (index === 0) {
        console.warn(
          `Falló Gemini ${model}; se probará el modelo alternativo.`,
          error,
        );
        continue;
      }

      console.error(`Falló la solicitud a Gemini ${model}:`, error);
    }
  }

  return { status: 502, body: { error: "upstream" } };
}

export default async function handler(
  req: { method?: string; body?: ChatRequest },
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const result = await answerChat(
    req.body || {},
    process.env.GEMINI_API_KEY || "",
  );

  return res.status(result.status).json(result.body);
}
