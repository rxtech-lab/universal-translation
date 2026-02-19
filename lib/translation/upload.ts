import type { OperationResult, UploadPayload, VirtualFileTree } from "./types";

// ============================================================
// Upload processor -- handles decompression and payload creation
// ============================================================

/**
 * Responsible for turning a raw user upload (File from the browser)
 * into an UploadPayload suitable for detection and client loading.
 */
export interface UploadProcessor {
  /**
   * Process a raw File upload.
   *
   * - If the file is a zip archive, decompress it into a VirtualFileTree
   *   and return an "archive" payload.
   * - Otherwise, return a "single-file" payload.
   *
   * The implementation should detect zip files by magic bytes (PK header),
   * not just by file extension.
   */
  process(file: File): Promise<OperationResult<UploadPayload>>;
}

/**
 * Decompress a zip file into a virtual file tree.
 * Implementations will use a library like fflate or JSZip.
 */
export interface ZipDecompressor {
  decompress(file: File): Promise<OperationResult<VirtualFileTree>>;
}
