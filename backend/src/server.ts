import cors from "cors";
import http from "http";
import dotenv from "dotenv";
import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { setupWebSocket } from "./websocket/wsHandler.js";
import type { APIResponse, ErrorResponse } from "./types/index.js";

//* Load environment variables
dotenv.config();

//* Initialize express app
const app: Express = express();
const PORT = process.env.PORT || 3001;

//* Create HTTP server for websocket support
const server = http.createServer(app);

//* Initialize websocket server
const wss = new WebSocketServer({ server, path: "/ws/test-stream" });

//* ============================================
//* MIDDLEWARE
//* ============================================

//* CORS Configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

//* Body parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

//* Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${
        res.statusCode
      } (${duration}ms)`
    );
  });

  next();
});

//* Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  const response: APIResponse<{
    status: string;
    timeStamp: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    environment: string;
  }> = {
    success: true,
    data: {
      status: "healthy",
      timeStamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || "development",
    },
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

//* ============================================
//* API ROUTES
//* ============================================

//* Mount API routes
// app.use("/api", apiRouter);

//* Root endpoint
app.get("/", (req: Request, res: Response) => {
  const response: APIResponse<{
    message: string;
    version: string;
    endpoints: {
      health: string;
      api: string;
      websocket: string;
    };
    sponsors: string[];
  }> = {
    success: true,
    data: {
      message: "🚀 AI API Testing Suite - Backend",
      version: "1.0.0",
      endpoints: {
        health: "/health",
        api: "/api",
        websocket: "ws://localhost:3001/ws/test-stream",
      },
      sponsors: ["Cerebras ⚡", "Meta Llama 🦙", "Docker 🐳"],
    },
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

//* ============================================
//* WEBSOCKET SETUP
//* ============================================

setupWebSocket(wss);

//* ============================================
//* ERROR HANDLING
//* ============================================

//* 404 Handler
app.use((req: Request, res: Response) => {
  const errorResponse: ErrorResponse = {
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  };
  res.status(404).json(errorResponse);
});

//* Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Error", err);

  const statusCode = (err as any).statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message;

  const errorResponse: ErrorResponse = {
    error: err.name,
    message: message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  res.status(statusCode).json(errorResponse);
});

//* ============================================
//* GRACEFUL SHUTDOWN
//* ============================================

const gracefulShutdown = async () => {
  console.log("\n🛑 Received shutdown signal, closing server gracefully...");

  //* Close WebSocket connections
  wss.clients.forEach((client: WebSocket) => {
    client.close(1000, "Server shutting down");
  });

  //* Close HTTP server
  server.close(() => {
    console.log("✅ Server closed successfully");
    process.exit(0);
  });

  //* Force close after 10 seconds
  setTimeout(() => {
    console.error("⚠️ Forcing shutdown after timeout");
    process.exit(1);
  }, 10000);
};

//* Handle shutdown signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

//* Handle uncaught errors
process.on("uncaughtException", (error: Error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

//* ============================================
//* START SERVER
//* ============================================

server.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 AI API Testing Suite - Backend Server");
  console.log("=".repeat(50));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(
    `🔌 WebSocket available at: ws://localhost:${PORT}/ws/test-stream`
  );
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `⚡ Cerebras: ${
      process.env.CEREBRAS_API_KEY ? "✅ Configured" : "❌ Missing"
    }`
  );
  console.log(
    `🐳 Docker: ${process.env.DOCKER_HOST || "unix:///var/run/docker.sock"}`
  );
  console.log("=".repeat(50) + "\n");

  //* Verify environment variables
  if (!process.env.CEREBRAS_API_KEY) {
    console.warn("⚠️  WARNING: CEREBRAS_API_KEY not set!");
  }
});
