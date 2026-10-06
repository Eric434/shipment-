import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import path from "path";
import { createServer as createHttpServer } from "node:http";
// The deployment bundle is CommonJS, while the API server source uses ESM syntax.
// esbuild resolves this import during bundling; the directive keeps the project typecheck
// from rejecting the intentional CJS-to-ESM boundary.
// @ts-expect-error The bundled server is the CommonJS entrypoint for the ESM API app.
import app from "./artifacts/api-server/src/app";

const PORT = 3000;

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  const trackerRoot = path.resolve(process.cwd(), "artifacts/tracker");
  const typedApp = app as unknown as {
    use: (...middleware: unknown[]) => unknown;
  };
  const httpServer = createHttpServer(app as unknown as import("node:http").RequestListener);

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
    typedApp.use(vite.middlewares);
  } else {
    const distPath = path.resolve(trackerRoot, "dist/public");
    typedApp.use(express.static(distPath));
    const serveSpaFallback: RequestHandler = (req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        res.sendFile(path.join(distPath, "index.html"));
      } else {
        next();
      }
    };
    typedApp.use(serveSpaFallback);
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
