const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fields = ['nome', 'nascimento', 'cidade', 'uf', 'bairro', 'telefone', 'email', 'cnh', 'cursoInicio', 'cursoFim', 'outrasInfo'];

// Confere os dados antes de abrir o navegador para gerar o arquivo.
function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Dados inválidos.');
  const text = (value, max = 600) => {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > max) throw new Error('Revise o tamanho dos campos do currículo.');
    return value;
  };
  const list = (value, convert) => {
    if (!Array.isArray(value) || value.length > 20) throw new Error('Lista de informações inválida.');
    return value.map(convert);
  };
  const limits = { nome: 100, nascimento: 10, cidade: 80, uf: 2, bairro: 80, telefone: 16, email: 254, cnh: 10, cursoInicio: 7, cursoFim: 7, outrasInfo: 60 };
  const data = Object.fromEntries(fields.map(key => [key, text(input[key], limits[key])]));
  if (data.nascimento) {
    const date = new Date(data.nascimento + 'T12:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.nascimento) || Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== data.nascimento || data.nascimento > new Date().toISOString().slice(0, 10)) {
      throw new Error('Informe uma data de nascimento válida, que não esteja no futuro.');
    }
  }
  if (!data.nome.trim()) throw new Error('Informe o nome do candidato.');
  data.photoDataUrl = input.photoDataUrl || null;
  if (data.photoDataUrl && (typeof data.photoDataUrl !== 'string' || data.photoDataUrl.length > 1800000 ||
      !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(data.photoDataUrl))) {
    throw new Error('Envie uma foto válida em JPG, PNG ou WebP.');
  }
  data.isPremium = input.isPremium === true;
  data.includeMachineCourse = input.includeMachineCourse !== false;
  data.hasExperience = input.hasExperience === true;
  data.maquinas = list(input.maquinas, value => text(value, 120));
  data.adicionais = list(input.adicionais, value => text(value, 250));
  data.experiencias = list(input.experiencias, item => {
    if (!item || typeof item !== 'object') throw new Error('Experiência inválida.');
    const limits = { empresa: 40, cargo: 30, inicio: 7, fim: 7, atividades: 80 };
    return { ...Object.fromEntries(Object.keys(limits).map(key => [key, text(item[key], limits[key])])), atual: item.atual === true };
  });
  data.outrasFormacoes = list(input.outrasFormacoes, item => {
    if (!item || typeof item !== 'object') throw new Error('Formação inválida.');
    const formation = Object.fromEntries(['curso', 'instituicao', 'ano'].map(key => [key, text(item[key], key === 'ano' ? 4 : 40)]));
    if (!formation.curso.trim() || !formation.instituicao.trim() || !/^[1-9]\d{3}$/.test(formation.ano) || Number(formation.ano) > new Date().getFullYear()) throw new Error('Preencha curso, instituição e um ano de conclusão válido.');
    return formation;
  });
  return data;
}

async function renderPDF(data) {
  const { default: puppeteer } = await import('puppeteer-core');
  const { default: chromium } = await import('@sparticuz/chromium');
  // No PC usamos o Chrome instalado. Na Vercel usamos o Chromium do projeto.
  const localExecutable = process.env.CHROME_EXECUTABLE_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : null);
  const browser = await puppeteer.launch({
    executablePath: localExecutable || await chromium.executablePath(),
    args: localExecutable ? [] : chromium.args,
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1400, deviceScaleFactor: 1 });
    page.setDefaultTimeout(25000);
    // Só carrega imagens do projeto. Nenhum endereço externo entra no currículo.
    await page.setRequestInterception(true);
    page.on('request', async request => {
      try {
        const url = new URL(request.url());
        if (url.protocol === 'data:') return request.continue();
        const filename = decodeURIComponent(url.pathname).slice(1);
        if (url.origin !== 'https://resume.local' || !/^img\/[^/\\]+\.png$/i.test(filename)) return request.abort();
        await request.respond({ contentType: 'image/png', body: await fs.readFile(path.join(root, filename)) });
      } catch { if (!request.isInterceptResolutionHandled()) await request.abort(); }
    });
    // Reaproveita o modelo do site, sem carregar scripts e fontes da internet.
    let html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, '');
    html = html.replace('<head>', '<head><base href="https://resume.local/">');
    await page.setContent(html, { waitUntil: 'load' });
    await page.addStyleTag({ content: await fs.readFile(path.join(root, 'styles.css'), 'utf8') });
    // As fontes vão junto no arquivo para manter a aparência em qualquer aparelho.
    let fonts = '';
    for (const [family, weights] of [['inter', [400, 500, 600, 700]], ['poppins', [600, 700, 800]]]) {
      for (const weight of weights) {
        const buffer = await fs.readFile(path.join(root, `node_modules/@fontsource/${family}/files/${family}-latin-${weight}-normal.woff2`));
        fonts += `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${buffer.toString('base64')}) format('woff2');}`;
      }
    }
    await page.addStyleTag({ content: fonts + `
      html,body { margin:0!important; padding:0!important; width:210mm!important; background:white; font-family:Inter,sans-serif; }
      body > :not(#screen-share), #screen-share > :not(.resume-wrapper) { display:none!important; }
      #screen-share { display:block!important; width:210mm!important; max-width:none!important; padding:0!important; margin:0!important; animation:none!important; }
      .resume-wrapper { display:block!important; width:210mm!important; padding:0!important; margin:0!important; background:white; border-radius:0; }
      .resume-preview { width:210mm!important; height:297mm!important; margin:0!important; }
      #resume-paper { width:210mm!important; min-width:210mm!important; height:297mm!important; min-height:297mm!important; transform:none!important; box-shadow:none; overflow:hidden; }
      .resume-content { font-family:Inter,sans-serif; }
      .resume-candidate-name { overflow-wrap:anywhere; }
      * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
      @page { size:A4; margin:0; }
    ` });
    await page.evaluate(() => { window.__PDF_SERVER__ = true; });
    await page.addScriptTag({ content: await fs.readFile(path.join(root, 'app.js'), 'utf8') });
    await page.evaluate(async payload => {
      Object.assign(state, payload);
      generateResumeAndShow();
      // Preserva os SVGs vetoriais criados por renderContacts no cabeçalho.
      await document.fonts.ready;
      await Promise.all(Array.from(document.querySelectorAll('#resume-paper img')).filter(img => img.getAttribute('src')).map(img => img.decode()));
      if (!fitResumeToPage()) throw new Error('RESUME_TOO_LONG');
    }, data);
    // O PDF tem seu próprio A4 fixo, sem os ajustes da impressão direta do site.
    await page.emulateMediaType('screen');
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, bottom: 0, left: 0, right: 0 }, timeout: 25000 }));
  } finally {
    // Fecha o navegador mesmo se a geração falhar.
    await browser.close();
  }
}

// Recebe o pedido da tela 4 e devolve o PDF, sem salvar os dados do candidato.
async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  let data;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!raw || Buffer.byteLength(raw) > 2000000) return res.status(413).json({ error: 'A foto é muito grande. Escolha outra imagem.' });
    data = validate(JSON.parse(raw));
  } catch (error) { return res.status(400).json({ error: error instanceof SyntaxError ? 'Dados inválidos.' : error.message }); }
  try {
    const pdf = await renderPDF(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Curriculo_SIDY.pdf"');
    return res.status(200).send(pdf);
  } catch (error) {
    if (error.message.includes('RESUME_TOO_LONG')) return res.status(422).json({ error: 'Resuma as experiências e informações adicionais para manter o currículo legível em uma página.' });
    console.error('PDF generation failed:', error.name);
    return res.status(500).json({ error: 'Não foi possível preparar o PDF agora. Tente novamente.' });
  }
}
module.exports = handler;
module.exports.validate = validate;
module.exports.renderPDF = renderPDF;
