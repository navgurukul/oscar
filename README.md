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
