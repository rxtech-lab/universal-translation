# Interface Reference

All public types are exported from `@/lib/translation`.

```typescript
import type {
  TranslationClient,
  TranslationFormatDescriptor,
  TranslationClientRegistry,
  UploadProcessor,
  // ... etc
} from "@/lib/translation";
```

---

## Core Types (`types.ts`)

### `OperationResult<T = void>`

Discriminated union for operation results.

```typescript
type OperationResult<T = void> =
  | { hasError: false; data: T }
  | { hasError: true; errorMessage: string };
```

| Variant | Fields | Description |
|---|---|---|
| Success | `hasError: false`, `data: T` | Operation succeeded, `data` contains the result |
| Error | `hasError: true`, `errorMessage: string` | Operation failed with a message |

---

### `VirtualFile`

A single file extracted from a zip archive.

| Field | Type | Description |
|---|---|---|
| `path` | `string` | Relative path using "/" separators (e.g., `"en.lproj/Localizable.strings"`) |
| `content` | `Uint8Array` | Raw file content as bytes |
| `mimeType` | `string?` | MIME type if determinable |

---

### `VirtualFileTree`

Flat list of extracted files.

| Field | Type | Description |
|---|---|---|
| `files` | `VirtualFile[]` | All files with relative paths |

---

### `UploadPayload`

Discriminated union representing what the system passes to detection and clients.

```typescript
type UploadPayload =
  | { kind: "single-file"; file: File }
  | { kind: "archive"; tree: VirtualFileTree; originalFileName: string };
```

| Variant | Fields | Description |
|---|---|---|
| `single-file` | `file: File` | A single file (not a zip) |
| `archive` | `tree: VirtualFileTree`, `originalFileName: string` | Decompressed zip contents |

---

### `TranslationEntry`

A single translatable unit — the universal common format across all file types.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier (key string, cue id, or index) |
| `sourceText` | `string` | Source-language text to translate |
| `targetText` | `string` | Translated text (empty string if untranslated) |
| `comment` | `string?` | Developer/translator note |
| `context` | `string?` | Where the string appears in the UI |
| `maxLength` | `number?` | Character length constraint |
| `pluralForm` | `"zero" \| "one" \| "two" \| "few" \| "many" \| "other"?` | Plural category |
| `metadata` | `Record<string, unknown>?` | Format-specific data for lossless round-tripping |

---

### `TranslationResource`

A group of entries from one file or logical resource.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Resource identifier (often the file path) |
| `label` | `string` | Human-readable display label |
| `entries` | `TranslationEntry[]` | Translatable entries |
| `sourceLanguage` | `string?` | BCP-47 source language tag |
| `targetLanguage` | `string?` | BCP-47 target language tag |

---

### `TranslationProject`

Top-level container for all translation data.

| Field | Type | Description |
|---|---|---|
| `resources` | `TranslationResource[]` | All resources (single-file: 1, bundle: many) |
| `sourceLanguage` | `string?` | Project-wide source language |
| `targetLanguages` | `string[]?` | Project-wide target languages |
| `metadata` | `Record<string, unknown>?` | Format-specific project metadata |

---

### `LanguageInfo`

Language metadata.

| Field | Type | Description |
|---|---|---|
| `code` | `string` | BCP-47 tag (e.g., `"en"`, `"zh-Hans"`) |
| `name` | `string` | Human-readable name in English |

---

## Client Interface (`client.ts`)

### `TranslationClient`

The core stateful interface each format implements.

#### `load(payload: UploadPayload): Promise<OperationResult>`

Parse uploaded content and populate internal state. Called exactly once after construction.

#### `getProject(): TranslationProject`

Return the full parsed project data.

#### `getResource(resourceId: string): TranslationResource | undefined`

Return a single resource by its `id`.

#### `getSourceLanguage(): string | undefined`

Return the detected source language BCP-47 tag.

#### `getTargetLanguages(): string[]`

Return the detected or configured target language tags.

#### `updateEntry(resourceId, entryId, update): OperationResult`

Update a single translation entry's `targetText` and/or `comment`.

**Parameters:**
- `resourceId: string` — The resource containing the entry
- `entryId: string` — The entry to update
- `update: Partial<Pick<TranslationEntry, "targetText" | "comment">>` — Fields to update

#### `updateEntries(updates): OperationResult`

Bulk-update multiple entries (e.g., after AI batch translation).

**Parameters:**
- `updates: Array<{ resourceId, entryId, update }>` — Array of individual updates

#### `render(): React.ReactNode`

Render the format-specific translation editor UI.

#### `exportFile(): Promise<OperationResult<{ downloadUrl?, blob?, fileName }>>`

Export translated content back to the original format.

**Returns:** `downloadUrl` (if server-generated) or `blob` (if client-side), plus the `fileName`.

#### `save(): Promise<OperationResult<{ projectId: string }>>`

Persist current state to the database. Returns a `projectId` for later retrieval.

#### `open(projectId: string): Promise<OperationResult>`

Restore state from a previously saved project.

---

## Detection (`detection.ts`)

### `DetectionConfidence`

Result of a format detection check.

| Field | Type | Description |
|---|---|---|
| `score` | `number` | 0–1 confidence. `>0.5` = viable candidate. `1.0` = certain. |
| `reason` | `string` | Human-readable explanation |

### `TranslationFormatDescriptor`

Static metadata and detection logic for a format. Registered with the `TranslationClientRegistry`.

| Field | Type | Description |
|---|---|---|
| `formatId` | `string` | Unique format identifier (e.g., `"srt"`, `"xcstrings"`) |
| `displayName` | `string` | Human-readable name (e.g., `"SubRip Subtitles"`) |
| `description` | `string` | Short description |
| `fileExtensions` | `string[]` | Handled extensions with leading dot (e.g., `[".srt"]`) |
| `mode` | `"single-file" \| "bundle"` | Whether single-file or folder-based |

#### `detect(payload: UploadPayload): Promise<DetectionConfidence>`

Inspect the upload and return a confidence score.

#### `createClient(): TranslationClient`

Factory: create a new, unloaded client instance. Caller must call `client.load()` after.

---

## Registry (`registry.ts`)

### `DetectionMatch`

A descriptor paired with its detection confidence.

| Field | Type | Description |
|---|---|---|
| `descriptor` | `TranslationFormatDescriptor` | The matched format descriptor |
| `confidence` | `DetectionConfidence` | The detection result |

### `TranslationClientRegistry`

Central registry for format descriptors.

#### `register(descriptor: TranslationFormatDescriptor): void`

Register a descriptor. Throws if `formatId` is already registered.

#### `unregister(formatId: string): void`

Remove a descriptor.

#### `getDescriptors(): TranslationFormatDescriptor[]`

Return all registered descriptors.

#### `getDescriptor(formatId: string): TranslationFormatDescriptor | undefined`

Look up a descriptor by `formatId`.

#### `detect(payload: UploadPayload): Promise<DetectionMatch[]>`

Run detection across all formats. Returns matches with `score > 0`, sorted by confidence descending.

#### `resolve(payload, minConfidence?): Promise<{ client, match } | undefined>`

Detect the best match, create a client, and load the payload. Returns `undefined` if no match meets `minConfidence` (default `0.5`).

---

## Upload Processing (`upload.ts`)

### `UploadProcessor`

Turns a raw `File` into an `UploadPayload`.

#### `process(file: File): Promise<OperationResult<UploadPayload>>`

Detect zip by magic bytes. Decompress if zip, wrap as single-file otherwise.

### `ZipDecompressor`

Low-level zip extraction.

#### `decompress(file: File): Promise<OperationResult<VirtualFileTree>>`

Extract all files from a zip archive into a `VirtualFileTree`.
