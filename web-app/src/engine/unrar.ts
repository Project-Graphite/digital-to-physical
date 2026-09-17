import { createExtractorFromData } from 'node-unrar-js';
import wasmUrl from 'node-unrar-js/esm/js/unrar.wasm?url';

let cachedWasmBinary: ArrayBuffer | null = null;

async function getWasmBinary(): Promise<ArrayBuffer> {
  if (cachedWasmBinary) return cachedWasmBinary;
  const res = await fetch(wasmUrl);
  if (!res.ok) {
    throw new Error(`Failed to load unrar WebAssembly binary (${res.statusText})`);
  }
  cachedWasmBinary = await res.arrayBuffer();
  return cachedWasmBinary;
}

export async function extractRarArchive(
  arrayBuffer: ArrayBuffer
): Promise<Record<string, Uint8Array>> {
  const wasmBinary = await getWasmBinary();
  const extractor = await createExtractorFromData({
    data: arrayBuffer,
    wasmBinary,
  });

  const extracted = extractor.extract();
  const result: Record<string, Uint8Array> = {};

  for (const file of extracted.files) {
    if (file.fileHeader.flags.directory) continue;
    if (file.extraction) {
      result[file.fileHeader.name] = file.extraction;
    }
  }

  return result;
}
