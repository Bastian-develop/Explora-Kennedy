import type { PointOfInterest } from "../../types";

export interface ChatReply {
  text: string;
  error?: "configuration" | "connection";
}

export const askGemini = async (
  question: string,
  points: PointOfInterest[],
  history: { text: string; sender: "user" | "bot" }[] = [],
): Promise<ChatReply> => {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        points: points.map(({ name, description }) => ({ name, description })),
        history: history.slice(-8),
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (result.error === "configuration") {
        return {
          error: "configuration",
          text: "El asistente no está disponible porque falta configurar su conexión. Contacta al equipo que administra la página.",
        };
      }

      return {
        error: "connection",
        text: "No pudimos conectar con el asistente. Revisa tu conexión e inténtalo de nuevo más tarde.",
      };
    }

    return typeof result.text === "string" && result.text.trim()
      ? { text: result.text }
      : {
          error: "connection",
          text: "El asistente no pudo generar una respuesta. Inténtalo de nuevo más tarde.",
        };
  } catch (error) {
    console.error("Error al consultar el asistente:", error);

    return {
      error: "connection",
      text: "No pudimos conectar con el asistente. Revisa tu conexión e inténtalo de nuevo más tarde.",
    };
  }
};
