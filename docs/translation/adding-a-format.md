# Adding a New Translation Format

This guide walks through adding support for a new translation file format. We'll use a hypothetical "SRT" (SubRip subtitle) format as the example.

## Step 1: Create the format directory

```
lib/translation/srt/
  descriptor.ts     # Format descriptor (detection + factory)
  client.ts         # TranslationClient implementation
  agent.ts          # AI translation agent (optional)
  frontend/         # Format-specific React components (optional)
```

## Step 2: Write the format descriptor

The descriptor is a lightweight object that handles detection and client creation. Create `lib/translation/srt/descriptor.ts`:

```typescript
import type {
  TranslationFormatDescriptor,
  DetectionConfidence,
} from "../detection";
import type { UploadPayload } from "../types";
import { SrtClient } from "./client";

export const srtDescriptor: TranslationFormatDescriptor = {
  formatId: "srt",
  displayName: "SubRip Subtitles",
  description: "SubRip .srt subtitle files with timestamps and text",
  fileExtensions: [".srt"],
  mode: "single-file",

  async detect(payload: UploadPayload): Promise<DetectionConfidence> {
    if (payload.kind === "single-file") {
      if (payload.file.name.endsWith(".srt")) {
        return { score: 1.0, reason: "File extension matches .srt" };
      }
    }

    if (payload.kind === "archive") {
      const hasSrt = payload.tree.files.some((f) =>
        f.path.endsWith(".srt"),
      );
      if (hasSrt) {
        return { score: 0.7, reason: "Archive contains .srt file(s)" };
      }
    }

    return { score: 0, reason: "No .srt files found" };
  },

  createClient() {
    return new SrtClient();
  },
};
```

### Detection tips

- Return `score: 1.0` for exact extension matches on single files
- Return lower scores (0.6–0.8) for archives containing matching files
- For ambiguous extensions (e.g., `.json` could be many formats), peek at the content structure to increase confidence
- For bundle formats, check for characteristic directory patterns (e.g., `*.lproj` directories)

## Step 3: Implement the TranslationClient

Create `lib/translation/srt/client.ts`:

```typescript
import React from "react";
import type { TranslationClient } from "../client";
import type {
  OperationResult,
  TranslationEntry,
  TranslationProject,
  TranslationResource,
  UploadPayload,
} from "../types";

export class SrtClient implements TranslationClient {
  private project: TranslationProject = { resources: [] };

  async load(payload: UploadPayload): Promise<OperationResult> {
    // Parse the .srt file content into TranslationEntry objects.
    // Store timestamps and cue numbers in entry.metadata for
    // lossless round-tripping.
    // ...
    return { hasError: false, data: undefined };
  }

  getProject(): TranslationProject {
    return this.project;
  }

  getResource(resourceId: string): TranslationResource | undefined {
    return this.project.resources.find((r) => r.id === resourceId);
  }

  getSourceLanguage(): string | undefined {
    return this.project.sourceLanguage;
  }

  getTargetLanguages(): string[] {
    return this.project.targetLanguages ?? [];
  }

  updateEntry(
    resourceId: string,
    entryId: string,
    update: Partial<Pick<TranslationEntry, "targetText" | "comment">>,
  ): OperationResult {
    // Find the entry and apply the update
    // ...
    return { hasError: false, data: undefined };
  }

  updateEntries(
    updates: Array<{
      resourceId: string;
      entryId: string;
      update: Partial<Pick<TranslationEntry, "targetText" | "comment">>;
    }>,
  ): OperationResult {
    // Apply all updates
    // ...
    return { hasError: false, data: undefined };
  }

  render(): React.ReactNode {
    // Return a React component for the SRT editor
    return null;
  }

  async exportFile(): Promise<
    OperationResult<{ downloadUrl?: string; blob?: Blob; fileName: string }>
  > {
    // Reconstruct the .srt file from entries + metadata (timestamps)
    // ...
    return {
      hasError: false,
      data: { fileName: "translated.srt" },
    };
  }

  async save(): Promise<OperationResult<{ projectId: string }>> {
    // Persist to database
    // ...
    return { hasError: false, data: { projectId: "" } };
  }

  async open(projectId: string): Promise<OperationResult> {
    // Restore from database
    // ...
    return { hasError: false, data: undefined };
  }
}
```

### Key implementation notes

- **Normalize to TranslationEntry**: Map your format's data into `TranslationEntry` objects. Use `id` for the key/identifier, `sourceText` for the original, `targetText` for the translation.
- **Preserve format-specific data in `metadata`**: SRT has timestamps, XLIFF has state attributes, PO has plural forms. Store anything needed for lossless export in `entry.metadata`.
- **Handle both payload kinds**: If your format is single-file, handle `kind: "single-file"` primarily. If it's a bundle, handle `kind: "archive"`. You may want to support both (e.g., a single `.srt` file or a zip containing multiple `.srt` files).

## Step 4: Register the descriptor

In your app initialization, register the descriptor with the registry:

```typescript
import { srtDescriptor } from "@/lib/translation/srt/descriptor";

registry.register(srtDescriptor);
```

## Step 5: Add format-specific UI (optional)

If your format needs a custom editor beyond the default translation grid, create React components in `frontend/`:

```
lib/translation/srt/frontend/
  SrtEditor.tsx        # Custom editor with timestamp display
  SrtPreview.tsx       # Subtitle preview player
```

Reference these from your client's `render()` method.

## Checklist

- [ ] Created `lib/translation/<format>/descriptor.ts` with `TranslationFormatDescriptor`
- [ ] Created `lib/translation/<format>/client.ts` implementing `TranslationClient`
- [ ] Detection returns appropriate confidence scores
- [ ] Entries use `metadata` for format-specific data (lossless round-trip)
- [ ] `exportFile()` reconstructs the original format faithfully
- [ ] Descriptor registered in the registry
- [ ] Build passes (`bun run build`)
