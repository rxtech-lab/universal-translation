---
title: Universal Translation Guide
author: RxLab
date: 2026-01-15
---

# Universal Translation Guide

Welcome to the **Universal Translation** platform. This guide will help you get started with translating your documents.

## Getting Started

To begin, upload your file in one of the supported formats:

- Xcode Localization Catalog (`.xcloc`)
- SubRip Subtitles (`.srt`)
- Plain Text (`.txt`)
- Markdown (`.md`)
- Word Document (`.docx`)

## Translation Process

The translation process consists of three main steps:

1. Upload your document
2. Select source and target languages
3. Click **Translate** to start the AI translation

## Code Example

Here is an example configuration:

```json
{
  "sourceLanguage": "en",
  "targetLanguage": "zh-Hans",
  "model": "google/gemini-3-flash"
}
```

## Tips and Best Practices

Always review your translations before exporting. The *terminology management* feature ensures consistent translation of key terms across your entire document.

### Terminology

You can define custom terms that should be translated consistently. For example, brand names like **Universal Translation** should remain unchanged or follow a specific translation rule.

### Export

Once you are satisfied with the translations, click the **Export** button to download the translated file in its original format.
