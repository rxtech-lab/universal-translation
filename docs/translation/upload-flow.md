# Upload Flow

## Overview

The upload pipeline transforms a raw user upload into a loaded, stateful `TranslationClient` ready for the UI. It has five stages.

## Pipeline

```
User drops file
       │
       v
  UploadProcessor.process(file)
       │
       ├── is zip? ──> ZipDecompressor.decompress()
       │                       │
       │                       v
       │                 VirtualFileTree
       │                       │
       │                       v
       │              UploadPayload { kind: "archive" }
       │
       ├── not zip? ─> UploadPayload { kind: "single-file" }
       │
       v
  TranslationClientRegistry.detect(payload)
       │
       v
  [ DetectionMatch, DetectionMatch, ... ] sorted by confidence
       │
       v
  TranslationClientRegistry.resolve(payload)
       │
       v
  descriptor.createClient() ──> client.load(payload)
       │
       v
  TranslationClient (loaded, stateful, ready for UI)
```

## Stage 1: Raw Upload

The user drops a file onto the upload zone. The browser produces a `File` object. This could be:
- A single translation file (`.srt`, `.json`, `.strings`, etc.)
- A zip archive containing a translation bundle or multiple files

## Stage 2: Decompression

`UploadProcessor.process(file)` inspects the first bytes of the file for the PK zip magic number (`0x50 0x4B 0x03 0x04`).

**If it's a zip:**
1. Delegates to `ZipDecompressor.decompress(file)`
2. Extracts all files into a `VirtualFileTree` — a flat array of `VirtualFile` objects, each with a relative `path` and `content: Uint8Array`
3. Returns `UploadPayload { kind: "archive", tree, originalFileName }`

**If it's not a zip:**
1. Returns `UploadPayload { kind: "single-file", file }`

## Stage 3: Detection

`TranslationClientRegistry.detect(payload)` iterates over every registered `TranslationFormatDescriptor` and calls `descriptor.detect(payload)` on each.

Each descriptor returns a `DetectionConfidence` with:
- **`score`** — 0 to 1 confidence. `1.0` = certain match, `0` = no match.
- **`reason`** — Human-readable explanation (e.g., "File extension matches .xcstrings")

Detection strategies vary by format:

| Format Type | Detection Strategy |
|---|---|
| Single-file | Check file extension, optionally peek at content (e.g., JSON structure) |
| Bundle | Inspect directory structure (e.g., presence of `*.lproj` directories, manifest files) |

Results are collected and sorted by score descending. Only matches with `score > 0` are returned.

## Stage 4: Resolution

`TranslationClientRegistry.resolve(payload, minConfidence?)` picks the highest-confidence match above the threshold (default `0.5`):

1. Calls `detect(payload)` to get sorted matches
2. Takes the first match with `score >= minConfidence`
3. Calls `descriptor.createClient()` to instantiate a new client
4. Calls `client.load(payload)` to parse the uploaded content
5. Returns `{ client, match }` or `undefined` if nothing matched

## Stage 5: Interaction

The loaded `TranslationClient` is handed to the UI layer:

1. **Read** — `client.getProject()` returns the normalized `TranslationProject` with all resources and entries
2. **Render** — `client.render()` produces a React component for the format-specific translation editor
3. **Edit** — `client.updateEntry()` / `client.updateEntries()` apply manual or AI translations
4. **Export** — `client.exportFile()` produces the translated file in its original format
5. **Persist** — `client.save()` stores state to the database; `client.open(projectId)` restores it

## Error Handling

Every stage returns `OperationResult<T>`. Callers must check `hasError` before proceeding:

```typescript
const result = await processor.process(file);
if (result.hasError) {
  // Show result.errorMessage to the user
  return;
}
const payload = result.data;
```

If no format matches during resolution, the system shows an "unsupported format" error with the list of supported formats.
