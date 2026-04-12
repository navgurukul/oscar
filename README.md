# Oscar - AI Note Taking App

Monorepo for Oscar, AI-powered voice note-taking app.

## Packages

- **packages/web** - Next.js web app
- **packages/desktop** - Tauri desktop app
- **packages/shared** - Shared types, constants, utilities

## Development

```bash
# Install dependencies
pnpm install

# Run web app
pnpm dev:web

# Run desktop app
pnpm dev:desktop
```

## Structure

```
oscar/
├── packages/
│   ├── web/          # Next.js app
│   ├── desktop/      # Tauri desktop app
│   └── shared/      # Shared code
├── package.json     # Root workspace config
└── README.md
```

---

## Pricing & Free Tier

### Free Tier
- Configure own open-source AI models (Ollama, llama.cpp, etc.)
- Use local GPU — fully free
- Works offline once models downloaded

### Paid Tier
- Hosted AI processing on our servers
- No local setup
- Priority support

App accessible to all; monetize hosting for convenience-seekers.