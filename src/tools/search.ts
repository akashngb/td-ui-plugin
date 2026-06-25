import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadRegistry, type RegistryItem } from "../registry.js";

const NOT_FOUND = "__NOT_FOUND__";
const MIN_SCORE = 1;
const MAX_RESULTS = 5;

const LibraryFilter = z.enum(["21stdev", "aceternity", "heroui"]);

interface ScoredItem {
  item: RegistryItem;
  score: number;
  matchedFields: string[];
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((tok) => tok.length > 1);
}

function scoreItem(item: RegistryItem, tokens: string[], rawQuery: string): ScoredItem {
  const matched: string[] = [];
  let score = 0;

  const name = item.name.toLowerCase();
  const author = item.author.toLowerCase();
  const description = (item.description ?? "").toLowerCase();
  const content = item.files.map((f) => f.content).join("\n").toLowerCase();
  const registryDeps = item.registryDependencies.join(" ").toLowerCase();
  const lowerQuery = rawQuery.trim().toLowerCase();

  if (lowerQuery.length > 0 && name.includes(lowerQuery)) {
    score += 10;
    matched.push("name(exact-phrase)");
  }

  for (const tok of tokens) {
    if (name.includes(tok)) {
      score += 5;
      matched.push(`name(${tok})`);
    }
    if (author.includes(tok)) {
      score += 3;
      matched.push(`author(${tok})`);
    }
    if (description.includes(tok)) {
      score += 2;
      matched.push(`description(${tok})`);
    }
    if (registryDeps.includes(tok)) {
      score += 1;
      matched.push(`registryDependencies(${tok})`);
    }
    if (content.includes(tok)) {
      score += 1;
      matched.push(`content(${tok})`);
    }
  }

  return { item, score, matchedFields: matched };
}

export function registerSearchTool(server: McpServer): void {
  server.registerTool(
    "search_registry_components",
    {
      title: "Search internal component registry",
      description:
        "Searches the internal_registry.json mirror by keyword across name, author, description, and source content. " +
        "Returns ranked matches from the centralized mirror only. " +
        "Returns {\"status\":\"error\",\"message\":\"__NOT_FOUND__\"} when nothing passes the minimum match threshold. " +
        "Callers MUST NOT invent components when __NOT_FOUND__ is returned.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Descriptive search phrase (e.g. 'shiny gradient button', 'animated card')."),
        libraryFilter: LibraryFilter.optional().describe(
          "Restrict matches to one author/source: '21stdev' | 'aceternity' | 'heroui'.",
        ),
      },
    },
    async ({ query, libraryFilter }) => {
      const registry = await loadRegistry();

      const pool = libraryFilter
        ? registry.items.filter(
            (it) => it.author.toLowerCase() === libraryFilter.toLowerCase(),
          )
        : registry.items;

      const tokens = tokenize(query);
      const scored = pool
        .map((item) => scoreItem(item, tokens, query))
        .filter((entry) => entry.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS);

      if (scored.length === 0) {
        const payload = { status: "error", message: NOT_FOUND };
        return {
          content: [{ type: "text", text: JSON.stringify(payload) }],
        };
      }

      const matches = scored.map((entry) => ({
        name: entry.item.name,
        author: entry.item.author,
        type: entry.item.type,
        description: entry.item.description ?? null,
        score: entry.score,
        matchedFields: Array.from(new Set(entry.matchedFields)),
        dependencies: entry.item.dependencies,
        registryDependencies: entry.item.registryDependencies,
        files: entry.item.files.map((f) => ({ path: f.path, type: f.type })),
        hasTailwindConfig: Boolean(entry.item.tailwind),
      }));

      const payload = { status: "ok", matches };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      };
    },
  );
}
