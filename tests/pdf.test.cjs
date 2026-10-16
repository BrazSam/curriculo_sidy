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
  for (const [field, limit] of Object.entries({ nome: 100, cidade: 80, bairro: 80, email: 254, telefone: 16, outrasInfo: 60 })) {
    assert.throws(() => validate({ ...example, [field]: 'a'.repeat(limit + 1) }));
  }
  assert.throws(() => validate({ ...example, nascimento: '2023-02-29' }));
  assert.throws(() => validate({ ...example, experiencias: [{ empresa: 'a'.repeat(41) }] }));
  assert.throws(() => validate({ ...example, outrasFormacoes: [{ curso: 'a'.repeat(41), instituicao: 'Teste', ano: '2020' }] }));
});

test('real PDF and responsive client share exactly the prepared file', { timeout: 120000 }, async () => {
  const server = require('../scripts/dev.cjs');
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
    });
    const { default: puppeteer } = await import('puppeteer-core');
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    await fs.mkdir('tmp/pdfs', { recursive: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded' });
    const photoChecks = await page.evaluate(async () => {
      const input = document.getElementById('input-photo');
      const alerts = [];
      const originalAlert = window.alert;
      const upload = file => {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        return handlePhotoUpload({ target: input });
      };
      window.alert = message => alerts.push(message);
      try {
        const invalid = new File(['not an image'], 'foto.png', { type: 'image/png' });
        await upload(invalid);
        const rejected = state.photoDataUrl === null && input.value === '';
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 20;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const valid = new File([blob], 'valida.png', { type: 'image/png' });
        const reading = upload(valid);
        validateAndGoToReview();
        await reading;
        const accepted = state.photoDataUrl?.startsWith('data:image/png;base64,');
        const previous = state.photoDataUrl;
        await upload(invalid);
        const preserved = state.photoDataUrl === previous;
        const stale = upload(valid);
        removePhoto();
        await stale;
        return { rejected, accepted, preserved, removed: state.photoDataUrl === null, alerts };
      } finally { window.alert = originalAlert; }
    });
    assert.equal(photoChecks.rejected, true);
    assert.equal(photoChecks.accepted, true);
    assert.equal(photoChecks.preserved, true);
    assert.equal(photoChecks.removed, true);
    assert.equal(photoChecks.alerts.length, 3);
    assert.match(photoChecks.alerts[0], /Não foi possível abrir esta foto/);
    assert.match(photoChecks.alerts[1], /Aguarde a leitura da foto/);
    assert.match(photoChecks.alerts[2], /Não foi possível abrir esta foto/);
    const formations = await page.evaluate(() => {
      const visible = () => document.querySelectorAll('.formacao-block:not([hidden])').length;
      const initial = visible();
      addFormation();
      document.getElementById('formacao-curso-0').value = 'Informática';
      addFormation();
      const full = visible() === 2 && document.getElementById('btn-add-formacao').hidden;
      removeFormation(0);
      const cleared = document.getElementById('formacao-curso-0').value === '';
      addFormation();
      const reopened = visible();
      removeFormation(0);
      removeFormation(1);
      return { initial, full, cleared, reopened, final: visible() };
    });
    assert.deepEqual(formations, { initial: 0, full: true, cleared: true, reopened: 2, final: 0 });
    const validation = await page.evaluate(() => {
      const optional = validateFormations();
      addFormation();
      const block = document.getElementById('formacao-block-0');
      const empty = validateFormations();
      const missing = block.querySelectorAll('.is-invalid').length;
      const required = [...block.querySelectorAll('input')].every(field => field.required);
      block.querySelector('.formacao-curso').value = 'Informática';
      block.querySelector('.formacao-instituicao').value = 'SENAI';
      const year = block.querySelector('.formacao-ano');
      const invalidYears = ['abcd', '123', '0000', String(new Date().getFullYear() + 1)]
        .map(value => { year.value = value; return validateFormations(); });
      year.value = String(new Date().getFullYear());
      year.dispatchEvent(new Event('input', { bubbles: true }));
      const corrected = !block.querySelector('.is-invalid') && validateFormations();
      addFormation();
      const secondEmpty = validateFormations();
      removeFormation(1);
      const removed = validateFormations();
      removeFormation(0);
      const cleared = [...block.querySelectorAll('input')].every(field => !field.required && !field.value && !field.classList.contains('is-invalid'));
      return { optional, empty, missing, required, invalidYears, corrected, secondEmpty, removed, cleared };
    });
    assert.deepEqual(validation, { optional: true, empty: false, missing: 3, required: true,
      invalidYears: [false, false, false, false], corrected: true, secondEmpty: false, removed: true, cleared: true });
    // Os nomes das etapas precisam caber também nos celulares mais estreitos.
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 390, 768, 1366]) {
      await page.setViewport({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    const birthChecks = await page.evaluate(() => {
      const input = document.getElementById('f-nasc');
      input.value = '01/01/2099';
      const future = validateField(input);
      const message = input.nextElementSibling.textContent;
      input.value = input.max.split('-').reverse().join('/');
      const today = validateField(input);
      input.value = '12/03/1995';
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
    const dateChecks = await page.evaluate(() => {
      const input = document.getElementById('f-nasc');
      const invalid = ['31/04/2000', '29/02/2023', '00/01/2000', '01/13/2000', '01/01/00']
        .map(value => { input.value = value; return validateField(input); });
      input.value = '29022000';
      maskBirthDate(input);
      return { invalid, mask: input.value, leap: validateField(input), iso: birthDateISO(input.value) };
    });
    assert.deepEqual(dateChecks, { invalid: [false, false, false, false, false], mask: '29/02/2000', leap: true, iso: '2000-02-29' });
    const injection = await page.evaluate(payload => {
      const attack = '<img src=x onerror=window.injected=1>';
      Object.assign(state, payload, { nome: attack, cidade: attack, bairro: attack,
        experiencias: [{ empresa: attack, cargo: attack, atividades: attack }],
        outrasFormacoes: [{ curso: attack, instituicao: attack, ano: '2020' }] });
      renderReview();
      generateResumeAndShow();
      return { executed: Boolean(window.injected), elements: document.querySelectorAll('[onerror]').length,
        text: document.getElementById('resume-paper').textContent.includes(attack),
        reviewDate: document.getElementById('rev-curso-periodo').textContent,
        pdfDate: document.getElementById('res-dates-course').textContent };
    }, example);
    assert.deepEqual(injection, { executed: false, elements: 0, text: true, reviewDate: 'Conclusão: Out/2026', pdfDate: 'Out/2026' });
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
    const densePayload = { ...example,
      outrasFormacoes: [
        { curso: 'Curso de Informática', instituicao: 'SIDY Escola', ano: '2016' },
        { curso: 'Curso de Inglês', instituicao: 'SIDY Escola', ano: '2023' },
      ],
      experiencias: [0, 1].map(i => ({ empresa: 'Empresa de construção e serviços locais',
        cargo: 'Operador de máquinas pesadas', inicio: '2020-01', fim: '2025-12',
        atividades: 'Operação e manutenção de máquinas, inspeção de equipamentos e apoio às equipes.' })),
      adicionais: ['Disponibilidade para estágio prático', 'Início imediato', 'Disponibilidade para viagens',
        'Disponibilidade para mudança de cidade', 'Disponibilidade de horário (turnos/escalas)'],
      outrasInfo: 'Última informação: disponibilidade para entrevista.',
    };
    const densePDF = await renderPDF(validate(densePayload));
    await fs.writeFile('tmp/pdfs/dense.pdf', densePDF);
    const denseTask = getDocument({ data: new Uint8Array(densePDF), useSystemFonts: true });
    const denseDoc = await denseTask.promise;
    assert.equal(denseDoc.numPages, 1);
    const denseText = (await (await denseDoc.getPage(1)).getTextContent()).items.map(item => item.str).join(' ');
    assert.match(denseText, /Última informação: disponibilidade para entrevista/);
    assert.equal((denseText.match(/Empresa de construção e serviços locais/g) || []).length, 2);
    await denseTask.destroy();
    const densityCheck = await page.evaluate(payload => {
      window.__PDF_SERVER__ = true;
      document.querySelector('#screen-share .resume-wrapper').hidden = false;
      Object.assign(state, payload);
      generateResumeAndShow();
      fitResumeToPage();
      const paper = document.getElementById('resume-paper');
      const header = paper.querySelector('.resume-header');
      const wide = Math.abs(header.offsetWidth - paper.clientWidth) <= 1;
      const dense = paper.dataset.density;
      Object.assign(state, { experiencias: [], outrasFormacoes: [], adicionais: [], outrasInfo: '' });
      generateResumeAndShow();
      fitResumeToPage();
      window.__PDF_SERVER__ = false;
      return { wide, dense, reset: paper.dataset.density };
    }, densePayload);
    assert.equal(densityCheck.wide, true);
    assert.notEqual(densityCheck.dense, '0');
    assert.equal(densityCheck.reset, '0');
    const withoutCourse = await renderPDF(validate({ ...example, includeMachineCourse: false,
      outrasFormacoes: [{ curso: 'Informática', instituicao: 'SENAI', ano: '2020' }] }));
    const noCourseTask = getDocument({ data: new Uint8Array(withoutCourse), useSystemFonts: true });
    const noCourseDoc = await noCourseTask.promise;
    const noCourseText = (await (await noCourseDoc.getPage(1)).getTextContent()).items.map(item => item.str).join(' ');
    assert.doesNotMatch(noCourseText, /Curso de Operador de Máquinas Pesadas|66 Horas|Capacitação técnica operacional/);
    assert.match(noCourseText, /Informática/);
    await noCourseTask.destroy();
    const toggleChecks = await page.evaluate(payload => {
      Object.assign(state, payload);
      const defaultChecked = document.getElementById('include-machine-course').checked;
      toggleMachineCourse(false);
      renderReview();
      const hidden = document.getElementById('rev-machine-course').hidden && document.getElementById('machine-course-fields').hidden;
      toggleMachineCourse(true);
      renderReview();
      return { defaultChecked, hidden, restored: !document.getElementById('rev-machine-course').hidden,
        svgCount: document.querySelectorAll('#rev-contatos svg').length,
        emoji: /📍|📱|✉|🪪|🎂/.test(document.getElementById('rev-contatos').textContent) };
    }, example);
    assert.deepEqual(toggleChecks, { defaultChecked: true, hidden: true, restored: true, svgCount: 4, emoji: false });
    let requests = 0;
    let failRequest = false;
    let failDownload = false;
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().endsWith('/api/download') && failDownload) {
        return request.respond({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Falha no download de teste.' }) });
      }
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
    const downloadResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/download`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ pdf: pdf.toString('base64'), filename: 'Curriculo_Teste.pdf' }),
    });
    assert.equal(downloadResponse.status, 200);
    assert.match(downloadResponse.headers.get('content-disposition'), /^attachment;/);
    assert.equal(downloadResponse.headers.get('content-type'), 'application/octet-stream');
    assert.deepEqual(Buffer.from(await downloadResponse.arrayBuffer()), pdf);
    const originalUrl = page.url();
    const originalPages = (await browser.pages()).length;
    const downloadSession = await page.createCDPSession();
    const downloadDir = require('node:path').resolve('tmp/pdfs/downloads');
    await fs.mkdir(downloadDir, { recursive: true });
    await downloadSession.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });
    await page.evaluate(() => { window.showSaveFilePicker = undefined; });
    const downloaded = new Promise(resolve => {
      downloadSession.on('Browser.downloadProgress', event => { if (event.state === 'completed') resolve(); });
    });
    await page.click('#btn-download-pdf');
    await downloaded;
    const filename = await page.evaluate(() => resumeFile.name);
    assert.deepEqual(await fs.readFile(require('node:path').join(downloadDir, filename)), pdf);
    assert.equal(page.url(), originalUrl);
    assert.equal((await browser.pages()).length, originalPages);
    assert.equal(requests, beforeShare);
    const savedSameFile = await page.evaluate(async () => {
      let saved;
      window.showSaveFilePicker = async () => ({ createWritable: async () => ({
        write: async file => { saved = file; }, close: async () => {},
      }) });
      await downloadResumePDF();
      window.showSaveFilePicker = undefined;
      return saved === resumeFile;
    });
    assert.equal(savedSameFile, true);
    failDownload = true;
    await page.click('#btn-download-pdf');
    await page.waitForFunction(() => document.getElementById('pdf-status').textContent === 'Falha no download de teste.');
    assert.equal(page.url(), originalUrl);
    assert.equal(await page.evaluate(() => Boolean(resumeFile)), true);
    failDownload = false;
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
    assert.equal(await page.$eval('#pdf-status', el => el.textContent), 'Não foi possível gerar seu PDF agora. Tente novamente em instantes.');
    assert.equal(await page.$eval('#btn-retry-pdf', el => el.hidden), false);
    assert.equal(await page.$eval('#btn-download-pdf', el => el.disabled), true);
    assert.equal(await page.$eval('#btn-share-whatsapp', el => el.disabled), true);
    assert.equal(await page.evaluate(() => resumeFile), null);
    assert.equal(await page.evaluate(() => document.getElementById('resume-download-form').elements.namedItem('pdf').value), '');
    assert.equal(await page.evaluate(() => document.getElementById('resume-download-form').elements.namedItem('filename').value), '');
    await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }));
    await page.evaluate(() => prepareResumePDF());
    assert.match(await page.$eval('#pdf-status', el => el.textContent), /Você está sem conexão/);
    await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }));
    const connectionMessages = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      const messages = [];
      try {
        for (const error of [new TypeError('Failed to fetch'), new DOMException('Timeout', 'AbortError')]) {
          window.fetch = async () => { throw error; };
          await prepareResumePDF();
          messages.push(document.getElementById('pdf-status').textContent);
        }
      } finally { window.fetch = originalFetch; }
      return messages;
    });
    assert.match(connectionMessages[0], /Verifique sua internet/);
    assert.match(connectionMessages[1], /demorou mais que o esperado/);
    failRequest = false;
    await page.click('#btn-retry-pdf');
    await page.waitForFunction(() => !document.getElementById('btn-share-whatsapp').disabled);
    assert.deepEqual(errors, []);
    await assert.rejects(renderPDF({ ...example,
      experiencias: Array.from({ length: 20 }, () => ({ empresa: 'Empresa', cargo: 'Operador', atividades: 'Atividade detalhada. '.repeat(25) })),
    }), /RESUME_TOO_LONG/);
  } finally {
    try { await browser?.close(); }
    finally { if (server.listening) await new Promise(resolve => server.close(resolve)); }
  }
});
