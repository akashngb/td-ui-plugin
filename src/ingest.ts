/**
 * ingest.ts — Reverse Ingestion Pipeline Blueprint
 *
 * Pulls raw component source from public GitHub repositories via
 * raw.githubusercontent.com and normalizes each file tree into the strict
 * internal_registry.json schema. This script does NOT modify, paraphrase,
 * or synthesize component code — it mirrors files byte-for-byte from the
 * upstream repository.
 *
 * Usage:
 *   1. Fill in the SPECS array below with concrete upstream coordinates.
 *   2. Run: `npm run ingest` (uses tsx).
 *   3. Inspect the diff before committing the updated internal_registry.json.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const REGISTRY_PATH = resolve(process.cwd(), "internal_registry.json");
const RAW_BASE = "https://raw.githubusercontent.com";
const CONCURRENCY = 4;
const REQUEST_DELAY_MS = 150;

interface SourceFileSpec {
  /** Path inside the upstream repo, e.g. "components/ui/button.tsx" */
  upstreamPath: string;
  /** Path written into the registry item, e.g. "ui/button.tsx" */
  registryPath: string;
  /** shadcn type for this file (e.g. "registry:ui", "registry:hook") */
  type: string;
}

interface UpstreamSpec {
  /** Slug stored as `name` inside the registry item */
  name: string;
  /** Used as the author field; one of '21stdev' | 'aceternity' | 'heroui' | internal slug */
  author: string;
  /** Optional human-readable description copied into the registry item */
  description?: string;
  /** GitHub owner */
  owner: string;
  /** GitHub repo */
  repo: string;
  /** Git ref to pin (commit SHA preferred; branch name accepted) */
  ref: string;
  /** Files that make up this component */
  files: SourceFileSpec[];
  /** Runtime npm dependencies the component imports */
  dependencies: string[];
  /** Dev dependencies (e.g. types) */
  devDependencies?: string[];
  /** shadcn-style sibling registry items this depends on */
  registryDependencies?: string[];
  /** Tailwind theme.extend overrides this component requires */
  tailwind?: Record<string, unknown>;
  /** Optional CSS variables the component expects */
  cssVars?: Record<string, unknown>;
}

interface RegistryItem {
  name: string;
  type: string;
  author: string;
  description?: string;
  dependencies: string[];
  devDependencies: string[];
  registryDependencies: string[];
  files: Array<{ path: string; content: string; type: string }>;
  tailwind?: Record<string, unknown>;
  cssVars?: Record<string, unknown>;
}

interface Registry {
  $schema: string;
  items: RegistryItem[];
}

async function fetchRaw(spec: UpstreamSpec, file: SourceFileSpec): Promise<string> {
  const url = `${RAW_BASE}/${spec.owner}/${spec.repo}/${spec.ref}/${file.upstreamPath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function ingestOne(spec: UpstreamSpec): Promise<RegistryItem> {
  const files: RegistryItem["files"] = [];
  for (const file of spec.files) {
    const content = await fetchRaw(spec, file);
    files.push({ path: file.registryPath, content, type: file.type });
    await delay(REQUEST_DELAY_MS);
  }

  const item: RegistryItem = {
    name: spec.name,
    type: "registry:ui",
    author: spec.author,
    dependencies: spec.dependencies,
    devDependencies: spec.devDependencies ?? [],
    registryDependencies: spec.registryDependencies ?? [],
    files,
  };
  if (spec.description !== undefined) item.description = spec.description;
  if (spec.tailwind !== undefined) item.tailwind = spec.tailwind;
  if (spec.cssVars !== undefined) item.cssVars = spec.cssVars;
  return item;
}

async function ingestAll(specs: UpstreamSpec[]): Promise<RegistryItem[]> {
  const queue = [...specs];
  const results: RegistryItem[] = [];
  const workerCount = Math.min(CONCURRENCY, queue.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      try {
        const item = await ingestOne(next);
        results.push(item);
        console.error(`[ingest] OK   ${next.author}/${next.name}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ingest] FAIL ${next.author}/${next.name} — ${message}`);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Replace these stubs with real upstream coordinates for each component you
 * want to mirror. The runtime fetches ONLY what is listed here — there is no
 * fallback to web scraping or LLM synthesis.
 *
 * Example shape (kept commented so the script aborts cleanly until edited):
 *
 *   {
 *     name: "shiny-gradient-button",
 *     author: "aceternity",
 *     description: "Animated shiny gradient button.",
 *     owner: "<github-owner>",
 *     repo: "<github-repo>",
 *     ref: "<commit-sha>",
 *     files: [
 *       {
 *         upstreamPath: "components/ui/shiny-gradient-button.tsx",
 *         registryPath: "ui/shiny-gradient-button.tsx",
 *         type: "registry:ui",
 *       },
 *     ],
 *     dependencies: ["clsx", "tailwind-merge"],
 *     registryDependencies: ["button"],
 *     tailwind: {
 *       config: {
 *         theme: {
 *           extend: {
 *             animation: { "shiny-gradient": "shiny-gradient 5s linear infinite" },
 *             keyframes: {
 *               "shiny-gradient": {
 *                 "0%, 100%": { "background-position": "0% 50%" },
 *                 "50%": { "background-position": "100% 50%" },
 *               },
 *             },
 *           },
 *         },
 *       },
 *     },
 *   }
 */
const SPECS: UpstreamSpec[] = [];

async function readExistingRegistry(): Promise<Registry> {
  try {
    const raw = await readFile(REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(raw) as Registry;
    if (!Array.isArray(parsed.items)) {
      return { $schema: parsed.$schema ?? "https://ui.shadcn.com/schema/registry-item.json", items: [] };
    }
    return parsed;
  } catch {
    return {
      $schema: "https://ui.shadcn.com/schema/registry-item.json",
      items: [],
    };
  }
}

async function main(): Promise<void> {
  if (SPECS.length === 0) {
    console.error(
      "[ingest] No upstream specs configured. Edit the SPECS array in src/ingest.ts before running.",
    );
    process.exitCode = 1;
    return;
  }

  console.error(`[ingest] Fetching ${SPECS.length} component(s) from upstream...`);
  const newItems = await ingestAll(SPECS);

  const existing = await readExistingRegistry();
  const byName = new Map<string, RegistryItem>();
  for (const item of existing.items) byName.set(item.name, item);
  for (const item of newItems) byName.set(item.name, item);

  const merged: Registry = {
    $schema: existing.$schema || "https://ui.shadcn.com/schema/registry-item.json",
    items: Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };

  await writeFile(REGISTRY_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.error(`[ingest] Wrote ${merged.items.length} item(s) to ${REGISTRY_PATH}`);
}

main().catch((err) => {
  console.error("[ingest] Fatal:", err);
  process.exitCode = 1;
});
