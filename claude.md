# SYSTEM INSTRUCTION & MASTER TASK
You are an expert engineer specializing in the Model Context Protocol (MCP), Node.js/TypeScript, and modern UI Component Design Systems. 
Your objective is to build a production-ready, local/internal MCP Server designed to plug directly into GitHub Copilot Agent Mode. This server will act as an internal component registry mirror, housing pre-scraped components from 21st.dev, Aceternity UI, HeroUI, and custom internal libraries.

The architecture follows a "Centralized Mirror" data pattern. The components are stored locally in an `internal_registry.json` database that adheres STRICTLY to the official shadcn/ui custom registry specification format.

---

## 🛑 ABSOLUTE GUARDRAILS (ZERO HALLUCINATION & ZERO GENERATION)
1. NO LLM CREATIVE LIBERTY: Under no circumstances may the MCP server or the AI client utilizing it generate code out of thin air, modify existing components layout styles, or synthesize a component if it is missing.
2. HONEST FAILURE MODE: If a requested component style, layout, or library component is not found via keyword/semantic matching within the `internal_registry.json`, the tool must explicitly return a standardized string: "__NOT_FOUND__".
3. NO IN-PLACE SYNTHESIS: The MCP tools must strictly provide code already housed in the mirror database. If the user asks for a component variant that doesn't exist, the system must state that it cannot satisfy the request, rather than attempting to guess a Tailwind combination.

---

## 🛠️ PART 1: THE SHADCN REGISTRY SPECIFICATION (`internal_registry.json`)
Generate a template for `internal_registry.json` conforming to the official shadcn/ui custom components registry schema. The structure must look like this:

{
  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
  "items": [
    {
      "name": "shiny-gradient-button",
      "type": "registry:ui",
      "author": "aceternity",
      "dependencies": ["framer-motion", "clsx", "tailwind-merge"],
      "devDependencies": [],
      "registryDependencies": ["button"],
      "files": [
        {
          "path": "ui/shiny-gradient-button.tsx",
          "content": "/* Raw TSX code pre-scraped here */",
          "type": "registry:ui"
        }
      ],
      "tailwind": {
        "config": {
          "theme": {
            "extend": {
              "animation": {
                "shiny-gradient": "shiny-gradient 5s linear infinite"
              },
              "keyframes": {
                "shiny-gradient": {
                  "0%, 100%": { "background-position": "0% 50%" },
                  "50%": { "background-position": "100% 50%" }
                }
              }
            }
          }
        }
      }
    }
  ]
}

Ensure the mock data file includes 3 diversified placeholder entries:
1. One from `21stdev`
2. One from `aceternity`
3. One from `heroui`

---

## 💻 PART 2: THE MCP SERVER IMPLEMENTATION (TypeScript)
Initialize a complete TypeScript project using `@modelcontextprotocol/sdk`. The server must run over a `stdio` transport layer so it natively registers within GitHub Copilot's `mcp.json`.

Expose two discrete MCP Tools:

### Tool 1: `search_registry_components`
- Description: Queries the internal database (`internal_registry.json`) using keyword or phrase matching based on what the user asked Copilot.
- Input Parameters:
  - `query` (string, required): The descriptive search phrase (e.g., "shiny gradient button", "animated card").
  - `libraryFilter` (string, optional): One of '21stdev' | 'aceternity' | 'heroui'.
- Internal Logic: Must rank results based on string inclusion across `name`, `author`, and code `content`. 
- Anti-Hallucination Guardrail: If no item matches a minimal match threshold, return `{"status": "error", "message": "__NOT_FOUND__"}`.

### Tool 2: `install_registry_component`
- Description: Installs a specific matching component using the shadcn style schema directly into the user's workspace.
- Input Parameters:
  - `componentName` (string, required): The target schema item name (e.g., "shiny-gradient-button").
  - `targetDirectory` (string, optional): Base directory path. Defaults to "./components".
- Internal Logic:
  1. Locates the component entry in `internal_registry.json`. If missing, abort and return `__NOT_FOUND__`.
  2. Creates the target directory dynamically if missing.
  3. Writes out the files specified inside the `files` array matching their respective paths.
  4. Automatically parses the `dependencies` array. Output a log array string `__INSTALL_DEPENDENCIES__: [list]` to instruct Copilot's environment to run `npm i` for those dependencies.
  5. Returns a structured text response containing instructions on what exact values need to be merged into `tailwind.config.js` using the data extracted from the `tailwind.config` JSON object.

---

## ⚙️ PART 3: REVERSE INGESTION PIPELINE BLUEPRINT
Write a lightweight, parallel node scraping utility script (`ingest.ts`). 
- It must outline how to fetch directly from public repositories (like reading raw content strings from GitHub using the endpoint `https://raw.githubusercontent.com/...`) instead of parsing HTML DOM blocks.
- Detail parsing individual file trees into our strict `internal_registry.json` schema layout.

---

## 🤖 PART 4: COPILOT INSTRUCTIONS FILE (`.github/copilot-instructions.md`)
Generate a robust system instructions markdown file that will hook into Copilot's workspace profile context. It must strictly bind Copilot to these operational limits:
- "When the user asks for a specific visual UI component layout, you MUST search the internal layout engine using `search_registry_components`. If the server returns `__NOT_FOUND__`, you must say: 'I cannot find that component inside your internal organization library mirror.' You are EXPLICITLY FORBIDDEN from inventing custom React components or looking up generic components on the public internet."
- "Upon finding a match, you must invoke `install_registry_component` to write the component block cleanly to disk, and then immediately inform the user to merge the associated Tailwind configurations returned by the tool."

Provide all configuration files (`package.json`, `tsconfig.json`, `mcp.json`) along with completely fleshed-out code files. Do not truncate code files or leave placeholders like `// implementation here`. Write out every line cleanly.