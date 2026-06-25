import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { findItemByName, loadRegistry, type RegistryItem } from "../registry.js";

const NOT_FOUND = "__NOT_FOUND__";

function formatTailwindInstructions(item: RegistryItem): string {
  if (!item.tailwind || Object.keys(item.tailwind).length === 0) {
    return "No tailwind.config changes are required for this component.";
  }
  const serialized = JSON.stringify(item.tailwind, null, 2);
  return [
    "Merge the following block into your tailwind.config.{js,ts,cjs,mjs} under the matching keys.",
    "Do not paraphrase or reformat any value — copy it byte-for-byte.",
    "```json",
    serialized,
    "```",
  ].join("\n");
}

export function registerInstallTool(server: McpServer): void {
  server.registerTool(
    "install_registry_component",
    {
      title: "Install component from internal registry",
      description:
        "Writes the file contents of a registry item (already housed in internal_registry.json) to disk. " +
        "Never synthesizes code. If the component is not present in the mirror, returns " +
        "{\"status\":\"error\",\"message\":\"__NOT_FOUND__\"} and writes nothing.",
      inputSchema: {
        componentName: z
          .string()
          .min(1)
          .describe("Exact registry item name (e.g. 'shiny-gradient-button')."),
        targetDirectory: z
          .string()
          .default("./components")
          .describe("Base directory to write component files into. Defaults to './components'."),
      },
    },
    async ({ componentName, targetDirectory }) => {
      const registry = await loadRegistry();
      const item = findItemByName(registry, componentName);

      if (!item) {
        const payload = { status: "error", message: NOT_FOUND };
        return {
          content: [{ type: "text", text: JSON.stringify(payload) }],
        };
      }

      const baseDir = resolve(process.cwd(), targetDirectory);
      const writtenFiles: string[] = [];

      for (const file of item.files) {
        const destination = join(baseDir, file.path);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, file.content, "utf8");
        writtenFiles.push(destination);
      }

      const dependenciesLog = `__INSTALL_DEPENDENCIES__: ${JSON.stringify(item.dependencies)}`;
      const devDependenciesLog =
        item.devDependencies.length > 0
          ? `__INSTALL_DEV_DEPENDENCIES__: ${JSON.stringify(item.devDependencies)}`
          : null;
      const registryDepsNote =
        item.registryDependencies.length > 0
          ? `Registry dependencies (re-invoke install_registry_component for each): ${item.registryDependencies.join(", ")}`
          : "No internal registry dependencies for this component.";

      const tailwindBlock = formatTailwindInstructions(item);

      const lines: string[] = [
        `Installed component '${item.name}' (author: ${item.author}).`,
        `Wrote ${writtenFiles.length} file(s):`,
        ...writtenFiles.map((p) => `  - ${p}`),
        "",
        dependenciesLog,
      ];
      if (devDependenciesLog) lines.push(devDependenciesLog);
      lines.push("", registryDepsNote, "", tailwindBlock);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}
