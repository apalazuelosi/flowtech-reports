// Splits an uploaded PDF into page batches and sends each to the serverless
// /analyze function, which calls Claude and returns extracted samples. The
// prompt lives server-side (analyze.js); the client only orchestrates batching.

const NETLIFY_FN = '/.netlify/functions/analyze';
const BATCH_SIZE = 4;

// Reads a File, returns an array of extracted sample objects.
// onProgress(doneBatches, totalBatches, pageStart, pageEnd, totalPages) is
// called as work proceeds.
export async function extractSamples(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const srcPdf = await PDFLib.PDFDocument.load(arrayBuffer);
  const totalPages = srcPdf.getPageCount();
  const totalBatches = Math.ceil(totalPages / BATCH_SIZE);

  onProgress?.(0, totalBatches);
  const allSamples = [];

  for (let b = 0; b < totalBatches; b++) {
    const start = b * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, totalPages);

    const subPdf = await PDFLib.PDFDocument.create();
    const indices = [];
    for (let i = start; i < end; i++) indices.push(i);
    const copied = await subPdf.copyPages(srcPdf, indices);
    copied.forEach(p => subPdf.addPage(p));
    const subBytes = await subPdf.save();

    const b64 = bytesToBase64(new Uint8Array(subBytes));

    onProgress?.(b, totalBatches, start + 1, end, totalPages);
    const samples = await callAnalyze(b64);
    allSamples.push(...(Array.isArray(samples) ? samples : [samples]));
    onProgress?.(b + 1, totalBatches, start + 1, end, totalPages);
  }

  return allSamples;
}

// Chunked base64 encode that won't blow the call stack on large buffers.
function bytesToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function callAnalyze(b64) {
  const resp = await fetch(NETLIFY_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64: b64 }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`API ${resp.status}: ${t}`);
  }
  return JSON.parse(await resp.text());
}

export const _internal = { BATCH_SIZE };
