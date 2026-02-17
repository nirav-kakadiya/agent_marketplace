# Contributing to ARISE

## Before You Start

1. **Read `CLAUDE.md`** — the system constitution. Every rule matters.
2. **Read `README.md`** — understand the architecture.
3. **Run `bun run index.ts --agents`** — see what already exists.

## Quick Reference

### Adding an Agent
```bash
mkdir agents/my-agent
# Write agents/my-agent/index.ts extending BaseAgent
# Register in index.ts
# Done.
```

### Adding an Integration
```bash
bun run index.ts --build service-name
# Or manually create integrations/service-name.json
```

### Adding an LLM Provider
Edit `core/llm.ts` — add provider method, update router. Never change interfaces.

### Naming Conventions
- Agent folders: `kebab-case` (e.g. `skill-builder`)
- Agent class: `PascalCase` (e.g. `SkillBuilderAgent`)
- Agent name property: matches folder name
- Integration files: `kebab-case.json`
- Message types: lowercase (task, result, error)

### Testing
```bash
bun run index.ts --agents          # List agents
bun run index.ts --integrations    # List integrations
bun run index.ts --memory          # Check memory
bun run index.ts "your request"    # Full pipeline test
```

## Golden Rules

1. **Never modify core/ unless absolutely necessary**
2. **Never import between agent folders**
3. **Always use the message bus for communication**
4. **Always follow the BaseAgent interface**
5. **Always use createMessage() for messages**

## PR Checklist

- [ ] Read CLAUDE.md
- [ ] Agent extends BaseAgent
- [ ] Agent communicates only via Message Bus
- [ ] No cross-agent imports
- [ ] No hardcoded secrets
- [ ] Agent registered in index.ts
- [ ] README updated if needed
