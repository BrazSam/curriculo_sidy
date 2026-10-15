const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { validate, renderPDF } = require('../api/resume');
const example = {
  nome: 'João da Silva Santos', cidade: 'São Paulo', uf: 'SP', telefone: '(11) 99999-1234',
  email: 'joao@example.com', nascimento: '1995-03-12', cnh: 'B', cursoFim: '2026-10',
  isPremium: true, hasExperience: true,
  maquinas: ['Escavadeira Hidráulica', 'Retroescavadeira', 'Pá Carregadeira', 'Mini Pá Carregadeira (Bobcat)'],
  experiencias: [{ empresa: 'Construtora Exemplo', cargo: 'Operador de máquinas', inicio: '2023-01', atual: true, atividades: 'Operação de máquinas, inspeção diária e apoio à equipe de obras.' }],
  adicionais: ['Disponibilidade para viagens', 'Início imediato'], outrasFormacoes: [],
};

test('rejects remote photos, oversized fields and malformed lists', () => {
  assert.throws(() => validate({ ...example, photoDataUrl: 'http://localhost/private' }));
  assert.throws(() => validate({ ...example, nome: 'a'.repeat(601) }));
  assert.throws(() => validate({ ...example, experiencias: {} }));
  assert.equal(validate(example).nome, example.nome);
});

test('real PDF and responsive client share exactly the prepared file', { timeout: 120000 }, async () => {
  const server = require('../scripts/dev.cjs');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  await fs.mkdir('tmp/pdfs', { recursive: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded' });
    // Os nomes das etapas precisam caber também nos celulares mais estreitos.
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 390, 768, 1366]) {
      await page.setViewport({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    const birthChecks = await page.evaluate(() => {
      const input = document.getElementById('f-nasc');
      input.value = '2099-01-01';
      const future = validateField(input);
      const message = input.nextElementSibling.textContent;
      input.value = input.max;
      const today = validateField(input);
      input.value = '1995-03-12';
      const past = validateField(input);
      input.value = '';
      const empty = validateField(input);
      return { future, message, today, past, empty };
    });
    assert.equal(birthChecks.future, false);
    assert.match(birthChecks.message, /não pode ser no futuro/);
    assert.equal(birthChecks.today, true);
    assert.equal(birthChecks.past, true);
    assert.equal(birthChecks.empty, true);
    // Portrait test image: a circle must remain circular after the square crop.
    const photo = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 800;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#cbd5e1'; ctx.fillRect(0, 0, 400, 800);
      ctx.fillStyle = '#1b6ec2'; ctx.beginPath(); ctx.arc(200, 400, 140, 0, 2 * Math.PI); ctx.fill();
      return canvas.toDataURL('image/png');
    });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/resume`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...example, photoDataUrl: photo }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    await fs.writeFile('tmp/pdfs/resume.pdf', pdf);
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true });
    const doc = await task.promise;
    assert.equal(doc.numPages, 1);
    const pdfPage = await doc.getPage(1);
    const viewport = pdfPage.getViewport({ scale: 1 });
    assert.ok(Math.abs(viewport.width - 595.28) < 1);
    assert.ok(Math.abs(viewport.height - 841.89) < 1);
    const text = (await pdfPage.getTextContent()).items.map(item => item.str).join(' ');
    assert.match(text, /JOÃO DA SILVA SANTOS/);
    assert.match(text, /Construtora Exemplo/);
    await task.destroy();
    let requests = 0;
    let failRequest = false;
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().endsWith('/api/resume')) {
        requests++;
        return request.respond(failRequest ? { status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Falha de teste. Tente novamente.' }) } : { status: 200, contentType: 'application/pdf', body: pdf });
      }
      return request.continue();
    });
    for (const width of [390, 1366]) {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      await page.evaluate(payload => { Object.assign(state, payload); generateResumeAndShow(); }, { ...example, photoDataUrl: photo });
      await page.waitForFunction(() => !!document.querySelector('#pdf-preview canvas') && !document.getElementById('pdf-preview').hidden);
      const result = await page.evaluate(async () => {
        const module = await import('/vendor/pdfjs/pdf.mjs');
        const task = module.getDocument({ data: await resumeFile.arrayBuffer() });
        const doc = await task.promise;
        const page = await doc.getPage(1);
        const view = page.getViewport({ scale: 1 });
        await task.destroy();
        return { width: view.width, height: view.height, overflow: document.documentElement.scrollWidth > innerWidth,
          download: document.getElementById('btn-download-pdf').disabled, share: document.getElementById('btn-share-whatsapp').disabled };
      });
      assert.equal(result.overflow, false);
      assert.equal(result.download, false);
      assert.equal(result.share, false);
      assert.equal(result.width, viewport.width);
      assert.equal(result.height, viewport.height);
      await page.screenshot({ path: `tmp/pdfs/preview-${width}.png`, fullPage: true });
    }
    const beforeShare = requests;
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }) => { window.sharedSameFile = files[0] === resumeFile; } });
    });
    await page.click('#btn-share-whatsapp');
    assert.equal(await page.evaluate(() => window.sharedSameFile), true);
    assert.equal(requests, beforeShare);
    await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Canceled', 'AbortError'); } }));
    await page.click('#btn-share-whatsapp');
    assert.equal(await page.$eval('#share-fallback', el => el.hidden), true);
    await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
    await page.click('#btn-share-whatsapp');
    assert.equal(await page.$eval('#share-fallback', el => el.hidden), false);
    assert.equal(await page.evaluate(() => document.getElementById('share-download').href === resumeUrl), true);
    failRequest = true;
    await page.evaluate(() => prepareResumePDF());
    assert.equal(await page.$eval('#btn-retry-pdf', el => el.hidden), false);
    assert.equal(await page.$eval('#btn-download-pdf', el => el.disabled), true);
    assert.equal(await page.$eval('#btn-share-whatsapp', el => el.disabled), true);
    assert.equal(await page.evaluate(() => resumeFile), null);
    failRequest = false;
    await page.click('#btn-retry-pdf');
    await page.waitForFunction(() => !document.getElementById('btn-share-whatsapp').disabled);
    assert.deepEqual(errors, []);
    await assert.rejects(renderPDF(validate({ ...example,
      experiencias: Array.from({ length: 20 }, () => ({ empresa: 'Empresa', cargo: 'Operador', atividades: 'Atividade detalhada. '.repeat(25) })),
    })), /RESUME_TOO_LONG/);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
