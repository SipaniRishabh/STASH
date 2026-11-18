// Read a PDF in the browser: plain text (what an ATS would extract), page count, and base64 for Claude.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function readPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = toBase64(bytes);
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join(""));
  }
  return { base64, rawText: pages.join("\n"), pages: doc.numPages };
}

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
