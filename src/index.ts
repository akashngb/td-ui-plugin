#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerInstallTool } from "./tools/install.js";
import { registerSearchTool } from "./tools/search.js";

const server = new McpServer({
  name: "td-ui-plugin",
  version: "0.1.0",
});

registerSearchTool(server);
registerInstallTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
