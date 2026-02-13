#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { HarborService } from "./services/harbor.service.js";
import { TOOL_DEFINITIONS } from "./definitions/tool.definitions.js";
import { HarborAuth } from "./types/index.js";
import { config } from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import express from "express";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

// Load environment variables
config();

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .env("HARBOR")
  .options({
    url: {
      type: "string",
      description: "Harbor API URL",
      demandOption: true,
    },
    username: {
      type: "string",
      description: "Harbor username (or robot account name)",
      demandOption: true,
      default: "admin",
    },
    password: {
      type: "string",
      description: "Harbor password (mutually exclusive with --token)",
    },
    token: {
      type: "string",
      description:
        "Harbor token for service/robot account authentication (mutually exclusive with --password)",
    },
    debug: {
      type: "boolean",
      description: "Enable debug mode",
      default: false,
    },
    sse: {
      type: "boolean",
      description: "Enable SSE transport",
      default: false,
    },
    port: {
      type: "number",
      description: "Port for SSE transport",
      default: 3000,
    },
    insecure: {
      type: "boolean",
      description: "Disable TLS/SSL certificate validation",
      default: false,
    },
  })
  .check((args) => {
    if (!args.password && !args.token) {
      throw new Error("Either --password or --token must be provided");
    }
    if (args.password && args.token) {
      throw new Error("--password and --token are mutually exclusive");
    }
    return true;
  })
  .help()
  .parseSync();

// Disable TLS/SSL certificate validation if --insecure flag is set
if (argv.insecure) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// Build authentication config
const auth: HarborAuth = argv.token
  ? { type: "token", username: argv.username, token: argv.token }
  : { type: "password", username: argv.username, password: argv.password! };

// Initialize HarborService with command line arguments
const harborService = new HarborService(argv.url, auth);

const createServer: () => Promise<Server> = async (): Promise<Server> => {
  interface ToolDefinition {
    description: string;
    inputSchema: Record<string, unknown>;
  }

  interface Tool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }

  // Initialize the MCP server
  const server: Server = new Server(
    {
      name: "mcp-harbor",
      version: pkg.version,
    },
    {
      capabilities: {
        tools: TOOL_DEFINITIONS as Record<string, ToolDefinition>,
      },
    }
  );

  server.onerror = (error: Error): void => {
    console.error("[MCP Error]", error);
    console.error("[MCP Error Stack]", error.stack);

    if (error.cause) {
      console.error("[MCP Error Cause]", error.cause);
    }
  };

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (): Promise<{
      tools: Tool[];
    }> => ({
      tools: Object.entries(TOOL_DEFINITIONS).map(([name, def]) => ({
        name,
        description: def.description,
        inputSchema: def.inputSchema,
      })),
    })
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      try {
        const args: Record<string, unknown> = request.params.arguments || {};
        return await harborService.handleToolRequest(request.params.name, args);
      } catch (error: unknown) {
        if (error instanceof McpError) throw error;
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : "Unknown error occurred"
        );
      }
    }
  );

  return server;
};

const server = await createServer();

// Check if SSE transport is enabled
if (argv.sse) {
  console.info("[MCP Server] Using SSE transport");
  const app = express();

  const transports = new Map<string, SSEServerTransport>();

  app.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);
    console.log(`[MCP Server] SSE connection established (session: ${transport.sessionId})`);

    res.on("close", () => {
      transports.delete(transport.sessionId);
      console.log(`[MCP Server] SSE connection closed (session: ${transport.sessionId})`);
    });

    await server.connect(transport);
  });

  app.post("/messages", (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send("No SSE connection found for this session");
      return;
    }
    transport.handlePostMessage(req, res);
  });

  app.listen(argv.port, "0.0.0.0", () => {
    console.info(`[MCP Server] SSE server running on port ${argv.port}`);
  });
} else {
  await server.connect(new StdioServerTransport());
}
