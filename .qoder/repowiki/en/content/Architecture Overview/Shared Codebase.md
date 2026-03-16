# Shared Codebase

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [package.json](file://package.json)
- [pnpm-workspace.yaml](file://pnpm-workspace.yaml)
- [packages/shared/src/index.ts](file://packages/shared/src/index.ts)
- [packages/shared/src/constants.ts](file://packages/shared/src/constants.ts)
- [packages/shared/src/types/index.ts](file://packages/shared/src/types/index.ts)
- [packages/shared/src/types/note.types.ts](file://packages/shared/src/types/note.types.ts)
- [packages/shared/src/types/recording.types.ts](file://packages/shared/src/types/recording.types.ts)
- [packages/shared/package.json](file://packages/shared/package.json)
- [packages/web/package.json](file://packages/web/package.json)
- [packages/desktop/package.json](file://packages/desktop/package.json)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document describes the shared codebase that underpins the Oscar monorepo. The shared package centralizes cross-platform types, constants, and utilities used by both the web and desktop applications. It ensures consistency in behavior, configuration, and data modeling across platforms while enabling platform-specific implementations to coexist.

## Project Structure
The repository is organized as a monorepo with three top-level packages:
- packages/web: Next.js web application
- packages/desktop: Tauri desktop application
- packages/shared: Shared types, constants, and utilities

Development scripts at the root enable launching each app independently. The shared package is exported via TypeScript entry points and consumed by both web and desktop projects.

```mermaid
graph TB
root["Root Workspace<br/>package.json"]
ws["Workspace Config<br/>pnpm-workspace.yaml"]
shared["Shared Package<br/>packages/shared"]
web["Web App<br/>packages/web"]
desktop["Desktop App<br/>packages/desktop"]
root --> ws
ws --> shared
ws --> web
ws --> desktop
web --> shared
desktop --> shared
```

**Diagram sources**
- [package.json:1-11](file://package.json#L1-L11)
- [pnpm-workspace.yaml:1-3](file://pnpm-workspace.yaml#L1-L3)

**Section sources**
- [README.md:1-51](file://README.md#L1-L51)
- [package.json:1-11](file://package.json#L1-L11)
- [pnpm-workspace.yaml:1-3](file://pnpm-workspace.yaml#L1-L3)

## Core Components
The shared codebase consists of:
- Export surface: re-exports of types and constants for convenient imports
- Types: strongly typed interfaces and enums for notes and recording sessions
- Constants: centralized configuration for error messages, UI strings, API endpoints, processing steps, storage keys, routes, recording defaults, permissions, local formatting, subscriptions, pricing, currency, and rate limits

These components are designed to be imported by both the web and desktop applications to maintain parity in behavior and configuration.

**Section sources**
- [packages/shared/src/index.ts:1-6](file://packages/shared/src/index.ts#L1-L6)
- [packages/shared/src/types/index.ts:1-3](file://packages/shared/src/types/index.ts#L1-L3)
- [packages/shared/src/types/note.types.ts:1-83](file://packages/shared/src/types/note.types.ts#L1-L83)
- [packages/shared/src/types/recording.types.ts:1-39](file://packages/shared/src/types/recording.types.ts#L1-L39)
- [packages/shared/src/constants.ts:1-314](file://packages/shared/src/constants.ts#L1-L314)

## Architecture Overview
The shared package acts as a library consumed by the web and desktop applications. It exposes:
- A primary index that re-exports types and constants
- Named exports for types and constants to support selective imports

Both consuming applications depend on the shared package via workspace references, ensuring synchronized updates and consistent behavior across platforms.

```mermaid
graph TB
shared_index["Shared Index<br/>packages/shared/src/index.ts"]
shared_types_index["Types Index<br/>packages/shared/src/types/index.ts"]
shared_constants["Constants<br/>packages/shared/src/constants.ts"]
shared_types_note["Note Types<br/>packages/shared/src/types/note.types.ts"]
shared_types_recording["Recording Types<br/>packages/shared/src/types/recording.types.ts"]
shared_package_json["Shared Package Exports<br/>packages/shared/package.json"]
web_pkg["Web Dependencies<br/>packages/web/package.json"]
desktop_pkg["Desktop Dependencies<br/>packages/desktop/package.json"]
shared_index --> shared_types_index
shared_index --> shared_constants
shared_types_index --> shared_types_note
shared_types_index --> shared_types_recording
shared_package_json --> web_pkg
shared_package_json --> desktop_pkg
```

**Diagram sources**
- [packages/shared/src/index.ts:1-6](file://packages/shared/src/index.ts#L1-L6)
- [packages/shared/src/types/index.ts:1-3](file://packages/shared/src/types/index.ts#L1-L3)
- [packages/shared/src/types/note.types.ts:1-83](file://packages/shared/src/types/note.types.ts#L1-L83)
- [packages/shared/src/types/recording.types.ts:1-39](file://packages/shared/src/types/recording.types.ts#L1-L39)
- [packages/shared/src/constants.ts:1-314](file://packages/shared/src/constants.ts#L1-L314)
- [packages/shared/package.json:7-11](file://packages/shared/package.json#L7-L11)
- [packages/web/package.json:11-44](file://packages/web/package.json#L11-L44)
- [packages/desktop/package.json:12-29](file://packages/desktop/package.json#L12-L29)

## Detailed Component Analysis

### Shared Types
The shared types module defines:
- Note-related interfaces for formatted text, raw text, and database-backed notes
- Feedback submission structures and soft-delete metadata
- Recording state machine, transcript updates, recording configuration, and error structures
- Results for formatting and title generation

These types unify data contracts across the web and desktop apps, reducing duplication and improving maintainability.

```mermaid
classDiagram
class Note {
+string formattedText
+string rawText
+string title
}
class DBNote {
+string id
+string user_id
+string title
+string raw_text
+string original_formatted_text
+string edited_text
+string created_at
+string updated_at
+boolean feedback_helpful
+FeedbackReason[] feedback_reasons
+string feedback_timestamp
+string deleted_at
+boolean is_starred
}
class DBNoteInsert {
+string user_id
+string title
+string raw_text
+string original_formatted_text
+string edited_text
}
class DBNoteUpdate {
+string title
+string raw_text
+string original_formatted_text
+string edited_text
+string updated_at
+boolean feedback_helpful
+FeedbackReason[] feedback_reasons
+string feedback_timestamp
+string deleted_at
+boolean is_starred
}
class FormattingResult {
+boolean success
+string formattedText
+string error
+boolean fallback
}
class TitleGenerationResult {
+boolean success
+string title
+string error
}
class FeedbackSubmission {
+string noteId
+boolean helpful
+FeedbackReason[] reasons
}
class RecordingState {
<<enumeration>>
+IDLE
+INITIALIZING
+REQUESTING_PERMISSION
+READY
+RECORDING
+PROCESSING
+ERROR
+PERMISSION_DENIED
}
class TranscriptUpdate {
+string text
+boolean isFinal
+number timestamp
}
class RecordingConfig {
+number sessionDurationMs
+number interimSaveIntervalMs
+boolean preserveTranscriptOnStart
}
class RecordingError {
+string code
+string message
+string details
+boolean recoverable
}
class RecordingSession {
+string transcript
+number startTime
+number endTime
+number duration
}
Note --> DBNote : "maps to"
DBNoteInsert --> DBNote : "inserts"
DBNoteUpdate --> DBNote : "updates"
FormattingResult --> Note : "produces"
TitleGenerationResult --> Note : "produces"
TranscriptUpdate --> RecordingSession : "updates"
RecordingError --> RecordingState : "causes"
```

**Diagram sources**
- [packages/shared/src/types/note.types.ts:3-83](file://packages/shared/src/types/note.types.ts#L3-L83)
- [packages/shared/src/types/recording.types.ts:3-39](file://packages/shared/src/types/recording.types.ts#L3-L39)

**Section sources**
- [packages/shared/src/types/note.types.ts:1-83](file://packages/shared/src/types/note.types.ts#L1-L83)
- [packages/shared/src/types/recording.types.ts:1-39](file://packages/shared/src/types/recording.types.ts#L1-L39)

### Shared Constants
The shared constants module centralizes:
- Error messages and tips for browser/device issues, permissions, recording, processing, API failures, and storage errors
- API configuration including internal endpoints and external provider settings
- UI strings for branding, page titles, loading states, defaults, actions, sections, toasts, home page copy, recording instructions, and download filenames
- Processing steps for the UI
- Session storage keys
- Routes
- Recording configuration defaults
- Permission handling configuration
- Local formatter configuration for fallback text processing
- Subscription tier limits
- Pricing configuration (INR and USD)
- Rate limiting configuration for AI and payment endpoints

These constants ensure consistent messaging, behavior, and configuration across platforms.

```mermaid
flowchart TD
Start(["Import Shared Constants"]) --> Errors["Load Error Messages and Tips"]
Start --> API["Load API Configuration"]
Start --> UI["Load UI Strings"]
Start --> Steps["Load Processing Steps"]
Start --> Storage["Load Storage Keys"]
Start --> Routes["Load Routes"]
Start --> RecordingCfg["Load Recording Defaults"]
Start --> Permissions["Load Permission Config"]
Start --> LocalFmt["Load Local Formatter Config"]
Start --> Sub["Load Subscription Limits"]
Start --> Pricing["Load Pricing Config"]
Start --> RateLimits["Load Rate Limits"]
Errors --> End(["Export"])
API --> End
UI --> End
Steps --> End
Storage --> End
Routes --> End
RecordingCfg --> End
Permissions --> End
LocalFmt --> End
Sub --> End
Pricing --> End
RateLimits --> End
```

**Diagram sources**
- [packages/shared/src/constants.ts:6-314](file://packages/shared/src/constants.ts#L6-L314)

**Section sources**
- [packages/shared/src/constants.ts:1-314](file://packages/shared/src/constants.ts#L1-L314)

### Shared Package Exports
The shared package defines its export surface to support:
- Primary index re-exporting types and constants
- Named exports for types and constants to enable selective imports

Consumers (web and desktop) rely on these exports to import shared types and constants consistently.

**Section sources**
- [packages/shared/src/index.ts:1-6](file://packages/shared/src/index.ts#L1-L6)
- [packages/shared/src/types/index.ts:1-3](file://packages/shared/src/types/index.ts#L1-L3)
- [packages/shared/package.json:7-11](file://packages/shared/package.json#L7-L11)

## Dependency Analysis
The shared package is consumed by both the web and desktop applications. The root workspace configuration and package manifests define:
- Workspace scoping for all packages
- Shared package exports for types and constants
- Consumer dependencies on the shared package via workspace protocol

```mermaid
graph TB
shared_pkg["Shared Package Manifest<br/>packages/shared/package.json"]
web_pkg["Web Manifest<br/>packages/web/package.json"]
desktop_pkg["Desktop Manifest<br/>packages/desktop/package.json"]
shared_pkg --> web_pkg
shared_pkg --> desktop_pkg
```

**Diagram sources**
- [packages/shared/package.json:7-11](file://packages/shared/package.json#L7-L11)
- [packages/web/package.json:11-44](file://packages/web/package.json#L11-L44)
- [packages/desktop/package.json:12-29](file://packages/desktop/package.json#L12-L29)

**Section sources**
- [pnpm-workspace.yaml:1-3](file://pnpm-workspace.yaml#L1-L3)
- [packages/shared/package.json:1-19](file://packages/shared/package.json#L1-L19)
- [packages/web/package.json:1-58](file://packages/web/package.json#L1-L58)
- [packages/desktop/package.json:1-44](file://packages/desktop/package.json#L1-L44)

## Performance Considerations
- Centralized constants reduce duplication and minimize runtime branching by providing unified configuration for error handling, API endpoints, UI strings, and rate limits.
- Strongly typed interfaces improve developer productivity and reduce runtime errors, indirectly contributing to performance by catching issues earlier.
- Selective imports via named exports help keep bundle sizes lean in platform-specific apps.

## Troubleshooting Guide
Common areas to verify when encountering issues:
- Ensure the shared package is rebuilt after changes to types or constants.
- Confirm that consumers import from the shared package using the correct named or default exports.
- Validate that environment-specific configurations (e.g., API keys, endpoints) align with the shared constants where applicable.
- Check rate limit thresholds for AI and payment endpoints to avoid throttling.

**Section sources**
- [packages/shared/src/constants.ts:276-314](file://packages/shared/src/constants.ts#L276-L314)
- [packages/shared/package.json:7-11](file://packages/shared/package.json#L7-L11)

## Conclusion
The shared codebase provides a cohesive foundation for the Oscar monorepo by unifying types, constants, and utilities across the web and desktop applications. Its modular exports and centralized configuration promote consistency, maintainability, and scalability as the project evolves.