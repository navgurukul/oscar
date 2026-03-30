# Oscar - AI Note Taking App

Monorepo for Oscar, an AI-powered voice note-taking application.

## Packages

- **packages/web** - Next.js web application
- **packages/desktop** - Tauri desktop application  
- **packages/shared** - Shared types, constants, and utilities

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
- Users can configure their own open-source AI models (via Ollama, llama.cpp, etc.)
- Use local GPU for processing - completely free
- Works offline once models are downloaded

### Paid Tier
- Hosted AI processing on our servers
- No local setup required
- Priority support

This makes the app accessible to everyone while monetizing hosting for users who want convenience.
