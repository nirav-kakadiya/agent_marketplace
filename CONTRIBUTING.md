# Contributing to Agent Marketplace

## Architecture Rules

1. **Every new agent = just a folder.** No changes to existing code.
2. **Every new integration = just a JSON file.** Plug and play.
3. **Every new campaign strategy = just a TypeScript file.** Register and go.
4. **Config controls everything.** No hardcoded values. Use `config.json` or env vars.
5. **Message bus is the backbone.** Agents don't talk directly — they send messages through the bus.

## Code Style

- TypeScript only
- Bun runtime
- No unnecessary dependencies
- Every agent must extend `BaseAgent`
- Every agent must implement `handle(message): Promise<Message>`
- Use `createMessage()` for all message creation
- Output valid JSON from LLM calls (use `match(/\{[\s\S]*\}/)` to extract)

## Adding an Agent

```bash
mkdir -p agents/my-agent/tools
```

1. Create `agents/my-agent/index.ts` extending `BaseAgent`
2. Add tools in `agents/my-agent/tools/` if needed
3. Register in `index.ts` and `server.ts`
4. Add feature flag in `config.json` if it should be toggleable
5. Update `AGENT_CATALOG.md`

## Adding an Integration

1. Create `integrations/platform-name.json`
2. Follow the schema: `{ name, description, code, requirements }`
3. Publisher auto-loads it — no code changes needed

## Adding a Campaign Strategy

1. Create `agents/campaign-manager/strategies/my-strategy.ts`
2. Export a `CampaignTemplate` object
3. Register in `agents/campaign-manager/strategies/index.ts`

## Commits

Use conventional commits:
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `refactor:` — code restructure
- `chore:` — maintenance

## Testing

```bash
# CLI test
bun run index.ts "your test request"

# Server test
bun run server.ts
curl http://localhost:3000/api/v1/health
```
