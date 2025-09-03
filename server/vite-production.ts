import type { Express } from "express";
import express from "express";
import { log as logger } from "./logger";

// Stub functions for production - actual vite setup not needed

export async function setupVite(app: Express, server: any) {
  // No-op for production
  logger.info("Vite setup skipped in production");
}

export function serveStatic(app: Express) {
  // Serve static files from dist/public in production
  app.use(express.static("dist/public"));
  
  // Catch-all handler for client-side routing
  app.get("*", (req, res) => {
    res.sendFile("index.html", { root: "dist/public" });
  });
  
  logger.info("Static file serving configured for production");
}