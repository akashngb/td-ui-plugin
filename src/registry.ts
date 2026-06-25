import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface RegistryFile {
  path: string;
  content: string;
  type: string;
}

export interface RegistryItem {
  name: string;
  type: string;
  author: string;
  description?: string;
  dependencies: string[];
  devDependencies: string[];
  registryDependencies: string[];
  files: RegistryFile[];
  tailwind?: Record<string, unknown>;
  cssVars?: Record<string, unknown>;
}

export interface Registry {
  $schema: string;
  items: RegistryItem[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cached: Registry | null = null;

export async function loadRegistry(): Promise<Registry> {
  if (cached) return cached;

  const envPath = process.env.TD_UI_REGISTRY_PATH;
  const candidates = [
    envPath,
    resolve(__dirname, "../internal_registry.json"),
    resolve(__dirname, "../../internal_registry.json"),
    resolve(process.cwd(), "internal_registry.json"),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  let lastError: unknown;
  for (const path of candidates) {
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as Registry;
      if (!Array.isArray(parsed.items)) {
        throw new Error("internal_registry.json is missing an 'items' array.");
      }
      cached = parsed;
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError ?? "unknown");
  throw new Error(
    `Unable to load internal_registry.json. Tried: ${candidates.join(", ")}. Last error: ${message}`,
  );
}

export function findItemByName(registry: Registry, name: string): RegistryItem | undefined {
  const target = name.trim().toLowerCase();
  return registry.items.find((item) => item.name.toLowerCase() === target);
}
