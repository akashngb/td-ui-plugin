# Internal UI Component Mirror — Operational Rules

This workspace is plugged into a private MCP server (`td-ui-plugin`) that mirrors UI components from 21st.dev, Aceternity UI, HeroUI, and curated internal libraries into a single source of truth: `internal_registry.json`. Two tools are exposed:

- `search_registry_components(query, libraryFilter?)`
- `install_registry_component(componentName, targetDirectory?)`

## Mandatory Workflow

1. **Search before suggesting.** When the user asks for a specific visual UI component layout, you MUST search the internal layout engine using `search_registry_components`. If the server returns `__NOT_FOUND__`, you must say: "I cannot find that component inside your internal organization library mirror." You are EXPLICITLY FORBIDDEN from inventing custom React components or looking up generic components on the public internet.
2. **Install before editing.** Upon finding a match, you must invoke `install_registry_component` to write the component block cleanly to disk, and then immediately inform the user to merge the associated Tailwind configurations returned by the tool.

## Zero-Hallucination Contract

- Do not generate, paraphrase, or "improve" component source. Use the exact file contents written to disk by `install_registry_component`.
- Do not infer Tailwind class combinations, keyframes, or animation timings that were not returned by the tool.
- Do not substitute a similar-looking component when an exact match is missing. Surface the `__NOT_FOUND__` message verbatim.
- If the user requests a variant that does not exist in the mirror, state plainly that it is unavailable. Do not synthesize a "close enough" version.
- Never reach out to external component documentation, web search, or training-memory recall to fill a missing component.

## Post-Install Reporting

After every successful `install_registry_component` call, you must:

- Report each file that was written, using the absolute paths returned by the tool.
- Echo the `__INSTALL_DEPENDENCIES__: [...]` line so the surrounding environment can run `npm install` for those packages. Echo `__INSTALL_DEV_DEPENDENCIES__: [...]` when present.
- Surface the Tailwind merge block exactly as returned. Do not edit the keys, values, or animation timings.
- Re-invoke `install_registry_component` for every entry listed under "Registry dependencies" until the chain is fully installed.

## Library Filter

When the user explicitly names a source ("from Aceternity", "the HeroUI version", "21st.dev"), pass `libraryFilter` to `search_registry_components` using exactly one of:

- `21stdev`
- `aceternity`
- `heroui`

Do not invent additional library filter values.

## Failure Mode

If either tool returns `{"status":"error","message":"__NOT_FOUND__"}`, stop. Report the failure to the user using the literal phrase: "I cannot find that component inside your internal organization library mirror." Do not propose a hand-written replacement.
