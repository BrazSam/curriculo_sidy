import { getDocument, GlobalWorkerOptions } from './vendor/pdfjs/pdf.mjs';
GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.mjs';

export async function renderPDFPreview(data) {
  const task = getDocument({ data, cMapUrl: '/vendor/pdfjs/cmaps/', cMapPacked: true,
    standardFontDataUrl: '/vendor/pdfjs/standard_fonts/', wasmUrl: '/vendor/pdfjs/wasm/' });
  const pdf = await task.promise;
  const pages = [];
  try {
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Página ${index} do currículo em PDF`);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      pages.push(canvas);
    }
    return pages;
  } finally { await task.destroy(); }
}
