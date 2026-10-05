import express from "express";
import path from "path";
import { createServer as createHttpServer } from "node:http";
import app from "./artifacts/api-server/src/app";

const PORT = 3000;

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  const trackerRoot = path.resolve(process.cwd(), "artifacts/tracker");
  const httpServer = createHttpServer(app);

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      configFile: path.resolve(trackerRoot, "vite.config.ts"),
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: "spa",
      root: trackerRoot,
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(trackerRoot, "dist/public");
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        res.sendFile(path.join(distPath, "index.html"));
      } else {
        next();
      }
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Tesla Tracker server running at http://0.0.0.0:${PORT}`);
  });
}

if (process.env.VERCEL) {
  module.exports = app;
} else {
  startServer().catch((err) => {
    console.error("Failed to start Tesla Tracker server:", err);
    process.exit(1);
  });
}
