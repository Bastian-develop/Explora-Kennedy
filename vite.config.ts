import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { answerChat } from "./api/chat";

function localChatApi(apiKey: string): Plugin {
  return {
    name: "explora-kennedy-local-chat-api",

    configureServer(server) {
      server.middlewares.use("/api/chat", async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "method_not_allowed" }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          let size = 0;

          for await (const chunk of req) {
            const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += data.length;

            if (size > 300_000) {
              res.statusCode = 413;
              res.end(JSON.stringify({ error: "request_too_large" }));
              return;
            }

            chunks.push(data);
          }

          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const result = await answerChat(body, apiKey);

          res.statusCode = result.status;
          res.end(JSON.stringify(result.body));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "invalid_request" }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      localChatApi(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""),
    ],
    publicDir: "public",
  };
});
