# Translation System Architecture

## Overview

The translation system is designed to support any file format — single-file formats like `.srt`, `.json`, `.po`, and bundle/folder-based formats like Xcode `.xcloc` exports. Users upload a zip file, and the system automatically detects and routes to the correct translation client.

## Layers

The system is organized into four layers, each building on the one below:

```
┌─────────────────────────────────┐
│       Upload Processor          │  Decompresses zips, creates UploadPayload
├─────────────────────────────────┤
│    Registry & Detection         │  Routes payloads to the right client
├─────────────────────────────────┤
│     TranslationClient           │  Format-specific parsing, editing, export
├─────────────────────────────────┤
│        Core Types               │  Shared data model (entries, resources, projects)
└─────────────────────────────────┘
```

### Layer 1: Core Types (`lib/translation/types.ts`)

Defines the universal data model that all format clients normalize into:

- **`TranslationEntry`** — A single translatable unit with `id`, `sourceText`, `targetText`, plus optional `comment`, `context`, `pluralForm`, and `metadata`.
- **`TranslationResource`** — A group of entries from one file or logical resource.
- **`TranslationProject`** — Top-level container holding all resources, source/target languages, and metadata.
- **`UploadPayload`** — Discriminated union representing either a single file or an extracted archive.
- **`OperationResult<T>`** — Standard result envelope for all operations (success with data or error with message).

### Layer 2: TranslationClient (`lib/translation/client.ts`)

The core interface that every format implements. Clients are **stateful** — they parse uploaded content into internal state and expose methods to read, update, render, and export.

Key methods:
- `load()` — Parse an upload payload into internal state
- `getProject()` / `getResource()` — Read the normalized translation data
- `updateEntry()` / `updateEntries()` — Modify translations (manual or AI batch)
- `render()` — Produce a React view of the translation editor
- `exportFile()` — Convert back to the original format
- `save()` / `open()` — Persist and restore from database

### Layer 3: Registry & Detection (`lib/translation/detection.ts`, `lib/translation/registry.ts`)

**TranslationFormatDescriptor** — A lightweight, stateless object that describes a format and can detect whether an upload matches it. Each format registers one descriptor with:
- Static metadata (`formatId`, `displayName`, `fileExtensions`, `mode`)
- A `detect()` method that returns a confidence score
- A `createClient()` factory method

**TranslationClientRegistry** — Manages all registered descriptors and provides:
- `detect(payload)` — Run all descriptors and return matches sorted by confidence
- `resolve(payload)` — Pick the best match, create a client, and load the payload

### Layer 4: Upload Processor (`lib/translation/upload.ts`)

Handles raw `File` objects from the browser:
- Detects zip files by magic bytes (PK header)
- Decompresses archives into a `VirtualFileTree`
- Wraps everything in an `UploadPayload` for the registry

## Design Decisions

### Stateful clients

Translation editing is inherently stateful — users load a file, make incremental changes, and save/export. The client owns its parsed state internally. The UI interacts through the `TranslationClient` interface without needing to manage format-specific data structures.

### Separate descriptor from client

Detection must happen before a client instance exists. The `TranslationFormatDescriptor` is a lightweight object that can inspect payloads and manufacture clients. This keeps the registry simple — it holds descriptors, not client instances.

### Flat VirtualFileTree

Extracted archives are represented as a flat list of files with relative paths, not a nested tree. This is simpler to iterate, filter, and search. Path-based filtering like `file.path.startsWith("en.lproj/")` is straightforward.

### Metadata escape hatch

Different formats have data that doesn't map to common `TranslationEntry` fields — SRT has timestamps, XLIFF has state attributes, `.xcstrings` has device variations. The `metadata: Record<string, unknown>` field on entries, resources, and projects allows lossless round-tripping without polluting the universal interface.

### OperationResult discriminated union

Rather than throwing exceptions, all operations return `OperationResult<T>`. The discriminated union makes it impossible to access `data` without first checking `hasError`, providing type-safe error handling throughout the pipeline.

## File Structure

```
lib/translation/
  index.ts              # Barrel exports
  types.ts              # Core types
  client.ts             # TranslationClient interface
  detection.ts          # TranslationFormatDescriptor, DetectionConfidence
  registry.ts           # TranslationClientRegistry, DetectionMatch
  upload.ts             # UploadProcessor, ZipDecompressor
  xcstring/             # Xcode String Catalog format
    client.ts           # XCStringClient implements TranslationClient
    descriptor.ts       # Format descriptor for .xcstrings
    agent.ts            # AI translation agent
    frontend/           # Format-specific React components
  srt/                  # Future: SubRip subtitles
  json-i18n/            # Future: JSON locale files
  po/                   # Future: PO/POT gettext
```
