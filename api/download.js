// Devolve o PDF já preparado como anexo, sem armazenar ou gerar outro arquivo.
const MAX_BODY_BYTES = 4000000;
const MAX_PDF_BYTES = 2500000;

function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    return res.status(403).json({ error: 'Solicite o download pelo site do currículo.' });
  }
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/x-www-form-urlencoded') {
    return res.status(415).json({ error: 'Formato de download inválido.' });
  }
  const raw = req.body;
  if ((typeof raw === 'string' || Buffer.isBuffer(raw)) && Buffer.byteLength(raw) > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'O PDF é muito grande para baixar. Reduza o conteúdo e tente novamente.' });
  }
  const data = typeof raw === 'string' || Buffer.isBuffer(raw)
    ? Object.fromEntries(new URLSearchParams(raw.toString())) : raw;
  if (!data || typeof data.pdf !== 'string' || !data.pdf.length || data.pdf.length > Math.ceil(MAX_PDF_BYTES / 3) * 4 ||
      data.pdf.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.pdf)) {
    return res.status(400).json({ error: 'PDF inválido. Gere o currículo novamente.' });
  }
  const pdf = Buffer.from(data.pdf, 'base64');
  if (pdf.length > MAX_PDF_BYTES || pdf.subarray(0, 5).toString() !== '%PDF-' || pdf.toString('base64') !== data.pdf) {
    return res.status(400).json({ error: 'PDF inválido. Gere o currículo novamente.' });
  }
  const name = typeof data.filename === 'string' ? data.filename : 'Curriculo_SIDY.pdf';
  const filename = (Array.from(name.replace(/\.pdf$/i, '').replace(/[^\p{L}\p{N}_-]/gu, '_')).slice(0, 120).join('') || 'Curriculo_SIDY') + '.pdf';
  const fallback = filename.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase());
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`);
  res.setHeader('Content-Length', String(pdf.length));
  return res.status(200).send(pdf);
}

module.exports = handler;
module.exports.MAX_BODY_BYTES = MAX_BODY_BYTES;
