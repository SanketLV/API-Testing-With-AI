import { WebSocketServer, WebSocket } from "ws";
import { MCPGateway } from "../docker/mcpGateway.js";
import { TestExecutor } from "../services/testExecutor.js";
import type {
  WSMessage,
  TestCase,
  TestResult,
  TestSuiteResult,
  APISpecification,
  WSMessageType,
  TestProgressMessage,
} from "../types/index.js";

interface Client {
  ws: WebSocket;
  id: string;
  isAlive: boolean;
}

const clients: Map<string, Client> = new Map();
const testExecutor = new TestExecutor();
const mcpGateway = new MCPGateway();

//* Setup WebSocket server for real-time test execution updates
export function setupWebSocket(wss: WebSocketServer) {
  console.log("🔌 WebSocket server initialized");

  //* Heartbeat to detect broken connection
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const client = Array.from(clients.values()).find((c) => c.ws === ws);

      if (client) {
        if (client.isAlive === false) {
          console.log(`💔 Client ${client.id} connection lost, terminating`);
          clients.delete(client.id);
          return ws.terminate();
        }

        client.isAlive = false;
        ws.ping();
      }
    });
  }, 30000); //* 30 seconds

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  wss.on("connection", (ws: WebSocket, req) => {
    const clientId = generateClientId();
    const clientIp = req.socket.remoteAddress;

    console.log(
      `✅ New WebSocket client connected: ${clientId} from ${clientIp}`
    );

    //* Add to clients map
    clients.set(clientId, {
      ws,
      id: clientId,
      isAlive: true,
    });

    //* Send welcome message
    send(ws, {
      type: "connected",
      clientId,
      message: "Connected to AI API Testing Suite",
      timestamp: new Date().toISOString(),
    });

    //* Handle pong responses
    ws.on("pong", () => {
      const client = clients.get(clientId);
      if (client) {
        client.isAlive = true;
      }
    });

    //* Handle incoming messages
    ws.on("message", async (message: Buffer) => {
      try {
        const data: WSMessage = JSON.parse(message.toString());

        console.log(`📨 Received from ${clientId}:`, data.type);

        await handleMessage(ws, clientId, data);
      } catch (error) {
        console.error(`❌ Error processing message from ${clientId}:`, error);
        send(ws, {
          type: "error",
          message: "Invalid message format",
          error: (error as Error).message,
        });
      }
    });

    //* Handle client disconnection
    ws.on("close", (code, reason) => {
      console.log(
        `👋 Client ${clientId} disconnected (code: ${code}, reason: ${reason})`
      );
      clients.delete(clientId);
    });

    //* Handle errors
    ws.on("error", (error) => {
      console.error(`❌ WebSocket error for client ${clientId}:`, error);
      clients.delete(clientId);
    });
  });
}

//* Handle incoming websocket messages
async function handleMessage(
  ws: WebSocket,
  clientId: string,
  message: WSMessage
) {
  switch (message.type) {
    case "start_tests":
      await handleStartTests(ws, clientId, message.data);
      break;

    case "stop_tests":
      handleStopTests(ws, clientId);
      break;

    case "ping":
      send(ws, { type: "pong", timestamp: new Date().toISOString() });
      break;

    default:
      send(ws, {
        type: "error",
        message: `Unknown message type: ${message.type}`,
      });
  }
}

//* Handle test execution with real-time streaming
async function handleStartTests(
  ws: WebSocket,
  clientId: string,
  data?: { apiSpecs?: APISpecification; tests?: TestCase[] }
) {
  const { apiSpecs, tests } = data || {};

  if (!apiSpecs) {
    return send(ws, {
      type: "error",
      message: "API specifications are required",
    });
  }

  if (!tests || !Array.isArray(tests) || tests.length === 0) {
    return send(ws, {
      type: "error",
      message: "Invalid tests array",
    });
  }

  try {
    //* Notify test suite started
    send(ws, {
      type: "test_suite_started",
      totalTests: tests.length,
      timestamp: new Date().toISOString(),
    });

    //* Create Docker container
    const containerId = await mcpGateway.createTestEnvironment(apiSpecs);

    send(ws, {
      type: "container_created",
      containerId,
      message: "Docker container ready",
    });

    //* Execute tests with real-time updates
    let completedCount = 0;
    const results: TestResult[] = [];

    for (const test of tests) {
      //* Notify test starting
      send(ws, {
        type: "test_start",
        test: {
          id: test.id,
          name: test.name,
          description: test.description,
          endpoint: test.path,
        },
        progress: {
          current: completedCount + 1,
          total: tests.length,
          percentage: Math.round(((completedCount + 1) / tests.length) * 100),
        },
      });

      //* Run test
      const result = await testExecutor.runTest(test, containerId);
      results.push(result);
      completedCount++;

      //* Notify test completed
      send(ws, {
        type: "test_completed",
        result: {
          testId: result.testId,
          testName: test.name,
          passed: result.passed,
          status: result.status,
          duration: result.duration,
          error: result.error || null,
          endpoint: test.path,
        },
        progress: {
          current: completedCount,
          total: tests.length,
          percentage: Math.round((completedCount / tests.length) * 100),
        },
        summary: {
          passed: results.filter((r) => r.passed).length,
          failed: results.filter((r) => !r.passed).length,
        },
      });

      //* Small delay for better UX (can remove in production)
      await sleep(50);
    }

    //* Calculate final results
    const finalResults: TestSuiteResult = {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      avgDuration:
        results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      results,
    };

    //* Cleanup Docker container
    await mcpGateway.cleanup(containerId);

    //* Notify all tests completed
    send(ws, {
      type: "all_complete",
      results: finalResults,
      summary: {
        total: finalResults.total,
        passed: finalResults.passed,
        failed: finalResults.failed,
        successRate: ((finalResults.passed / finalResults.total) * 100).toFixed(
          2
        ),
        avgDuration: Math.round(finalResults.avgDuration),
        containerId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Test execution error:", error);
    send(ws, {
      type: "error",
      message: "Test execution failed",
      error: (error as Error).message,
    });
  }
}

//* Handle stopping test execution
function handleStopTests(ws: WebSocket, clientId: string) {
  console.log(`⏹️ Stopping tests for client ${clientId}`);

  //* In production, implement test cancellation logic
  send(ws, {
    type: "tests_stopped",
    message: "Test execution stopped",
    timestamp: new Date().toISOString(),
  });
}

//* WebSocket message types for better type safety
interface WSResponse {
  type: WSMessageType;
  [key: string]: any;
}

//* Send message to WebSocket client
function send(ws: WebSocket, data: WSResponse): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

//* Broadcast message to all connected clients
export function broadcast(data: WSResponse): void {
  clients.forEach((client) => {
    send(client.ws, data);
  });
}

//* Generate unique client ID
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

//* Utility sleep function
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

//* Get connected clients count
export function getConnectedClientsCount(): number {
  return clients.size;
}

//* Get all connected client IDs
export function getConnectedClientIds(): string[] {
  return Array.from(clients.keys());
}
