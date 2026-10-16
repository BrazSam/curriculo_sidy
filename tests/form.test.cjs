const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../api/resume');

test('server rejects future course and employment dates', () => {
  const payload = {
    nome: 'Candidato de Teste', cursoFim: '2020-01', maquinas: [], adicionais: [],
    experiencias: [], outrasFormacoes: [],
  };
  assert.equal(validate(payload).cursoFim, '2020-01');
  assert.throws(() => validate({ ...payload, cursoFim: '2099-01' }), /conclusão/);
  assert.throws(() => validate({ ...payload, cursoFim: '' }), /conclusão/);
  assert.equal(validate({ ...payload, includeMachineCourse: false, cursoFim: '' }).includeMachineCourse, false);
  assert.throws(() => validate({ ...payload, experiencias: [{ inicio: '2099-01', atual: true }] }), /experiência/);
  assert.throws(() => validate({ ...payload, experiencias: [{ inicio: '2020-02', fim: '2020-01' }] }), /experiência/);
  assert.throws(() => validate({ ...payload, experiencias: [{ inicio: '2020-01', fim: '2099-01' }] }), /experiência/);
  assert.equal(validate({ ...payload, experiencias: [{ inicio: '2020-01', fim: '2020-01' }] }).experiencias.length, 1);
  assert.equal(validate({ ...payload, adicionais: ['a'.repeat(50)] }).adicionais[0].length, 50);
  assert.throws(() => validate({ ...payload, adicionais: ['a'.repeat(51)] }));
});

test('additional information enforces two custom choices and rejects equivalent duplicates', () => {
  const payload = { nome: 'Teste', includeMachineCourse: false, maquinas: [], experiencias: [], outrasFormacoes: [] };
  const fixed = ['Disponibilidade para estágio prático', 'Início imediato',
    'Disponibilidade para mudança de cidade', 'Disponibilidade de horário (turnos/escalas)'];
  assert.equal(validate({ ...payload, adicionais: [...fixed, 'Trabalho em equipe', 'Pontualidade'] }).adicionais.length, 6);
  assert.throws(() => validate({ ...payload, adicionais: ['Um', 'Dois', 'Três'] }), /máximo 2/);
  assert.throws(() => validate({ ...payload, adicionais: [...fixed, 'Um', 'Dois', 'Três'] }), /máximo 2/);
  assert.throws(() => validate({ ...payload, adicionais: ['Um', 'Dois'], outrasInfo: 'Três' }), /máximo 2/);
  assert.throws(() => validate({ ...payload, adicionais: ['   '] }), /válida/);
  for (const pair of [
    ['Trabalho em equipe', ' TRABALHO  em\n equipe '],
    ['Disponibilidade para mudança de cidade', 'Disponibilidade para mudança'],
    ['Disponibilidade de horário (turnos/escalas)', 'Disponibilidade total de horário'],
  ]) assert.throws(() => validate({ ...payload, adicionais: pair }), /repetidas/);
  assert.deepEqual(validate({ ...payload, adicionais: ['  Trabalho  em\n equipe  '] }).adicionais, ['Trabalho em equipe']);
});

test('form delays errors, preserves selected defaults and respects course and machine choices', { timeout: 60000 }, async () => {
  const server = require('../scripts/dev.cjs');
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
    });
    const { default: puppeteer } = await import('puppeteer-core');
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load' });
    await page.evaluate(() => goToStep(2));
    const defaults = await page.evaluate(() => ({
      cnh: document.getElementById('f-cnh').value,
      uf: document.getElementById('f-uf').value,
      premium: document.querySelector('input[name="premium_sidy"][value="sim"]').checked,
      machines: document.querySelectorAll('input[name="maquinas"]:checked').length,
      availability: document.querySelectorAll('input[name="adicionais"]:checked').length,
      highlighted: [...document.querySelectorAll('.custom-check-pill input')].every(field => field.checked === field.closest('label').classList.contains('checked')),
      experience: document.querySelector('input[name="has_experience"]:checked'),
      experienceHidden: getComputedStyle(document.getElementById('experience-container')).display === 'none',
      date: document.getElementById('f-curso-fim').value,
      hasStatusField: Boolean(document.getElementById('f-curso-status')),
    }));
    assert.deepEqual(defaults, { cnh: 'B', uf: '', premium: false, machines: 4, availability: 4,
      highlighted: true, experience: null, experienceHidden: true, date: '', hasStatusField: false });
    assert.equal(await page.$eval('#premium-badge-info', panel => getComputedStyle(panel).display), 'none');
    assert.equal(await page.$$eval('input[name="premium_sidy"]:checked', fields => fields.length), 0);
    await page.click('input[name="premium_sidy"][value="sim"]');
    assert.equal(await page.$eval('#premium-badge-info', panel => getComputedStyle(panel).display), 'block');
    await page.click('input[name="premium_sidy"][value="nao"]');
    assert.equal(await page.$eval('#premium-badge-info', panel => getComputedStyle(panel).display), 'none');

    for (const [selector, partial, complete] of [
      ['#f-email', 'j', 'teste@example.com'], ['#f-telefone', '1', '11999991234'], ['#f-nasc', '31/02', '12031995'],
    ]) {
      await page.click(selector);
      await page.type(selector, partial);
      assert.equal(await page.$eval(selector, field => field.classList.contains('is-invalid')), false);
      await page.keyboard.press('Tab');
      assert.equal(await page.$eval(selector, field => field.classList.contains('is-invalid')), true);
      await page.focus(selector);
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.type(selector, complete);
      assert.equal(await page.$eval(selector, field => field.classList.contains('is-invalid')), false);
      await page.focus(selector);
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      assert.equal(await page.$eval(selector, field => field.classList.contains('is-invalid')), selector !== '#f-nasc');
    }

    const courseChecks = await page.evaluate(() => {
      const end = document.getElementById('f-curso-fim');
      end.value = '2099-01';
      const futureCompleted = validateField(end);
      end.value = '2020-01';
      const pastCompleted = validateField(end);
      const corrected = !end.classList.contains('is-invalid');
      toggleMachineCourse(false);
      const disabledValid = validateField(end);
      toggleMachineCourse(true);
      return { futureCompleted, pastCompleted, corrected, disabledValid };
    });
    assert.deepEqual(courseChecks, { futureCompleted: false, pastCompleted: true, corrected: true, disabledValid: true });

    await page.click('#btn-toggle-machines');
    assert.equal(await page.$eval('#btn-toggle-machines', button => button.textContent), 'Selecionar todas');
    assert.equal(await page.$$eval('input[name="maquinas"]:checked', fields => fields.length), 0);
    const rendered = await page.evaluate(() => {
      window.__PDF_SERVER__ = true;
      Object.assign(state, { nome: 'Teste', maquinas: [], cursoFim: '2020-01' });
      renderReview();
      generateResumeAndShow();
      return {
        hiddenMachines: document.getElementById('res-sec-maquinas').hidden,
        inventedSkill: document.getElementById('res-machines-list').textContent.includes('em Geral'),
        review: document.getElementById('rev-curso-periodo').textContent,
        pdf: document.getElementById('res-dates-course').textContent,
      };
    });
    assert.deepEqual(rendered, { hiddenMachines: true, inventedSkill: false,
      review: 'Conclusão: Jan/2020', pdf: 'Jan/2020' });

    await page.evaluate(() => goToStep(2));
    for (const duplicate of ['Disponibilidade   total de horário', 'disponibilidade PARA MUDANÇA', 'INÍCIO   imediato']) {
      await page.$eval('#f-outras-info', (field, value) => { field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); }, duplicate);
      await page.click('#btn-add-info');
      assert.equal(await page.$$eval('.custom-additional', items => items.length), 0);
      assert.equal(await page.$eval('#f-outras-info', field => field.classList.contains('is-invalid')), true);
    }
    await page.$eval('#f-outras-info', field => { field.value = 'Trabalho em equipe'; });
    await page.click('#btn-add-info');
    await page.type('#f-outras-info', 'TRABALHO  em equipe');
    await page.click('#btn-add-info');
    assert.equal(await page.$$eval('.custom-additional', items => items.length), 1);
    await page.click('.custom-additional button');
    await page.waitForFunction(() => !document.querySelector('.additional-leaving'));
    await page.$eval('#f-outras-info', field => { field.value = ''; field.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.type('#f-outras-info', 'a'.repeat(60));
    assert.equal(await page.$eval('#f-outras-info', field => field.value.length), 50);
    await page.click('#btn-add-info');
    assert.equal(await page.$eval('#f-outras-info', field => field.value), '');
    await page.type('#f-outras-info', 'a'.repeat(50));
    await page.click('#btn-add-info');
    assert.equal(await page.$$eval('.custom-additional', items => items.length), 1);
    await page.focus('#f-outras-info');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('#f-outras-info', '<b>Trabalho em equipe</b>');
    await page.click('#btn-add-info');
    assert.equal(await page.$$eval('.custom-additional', items => items.length), 2);
    assert.equal(await page.$eval('#btn-add-info', button => button.disabled), true);
    assert.equal(await page.$$eval('.custom-additional b', items => items.length), 0);
    await page.click('.custom-additional input');
    const choiceRequired = await page.evaluate(() => {
      state.photoDataUrl = 'data:image/png;base64,teste';
      for (const [id, value] of Object.entries({ 'f-nome': 'Candidato de Teste', 'f-cidade': 'Campinas',
        'f-uf': 'SP', 'f-email': 'teste@example.com', 'f-telefone': '(11) 99999-1234' })) {
        document.getElementById(id).value = value;
      }
      validateAndGoToReview();
      return !document.getElementById('experience-choice-error').hidden &&
        document.getElementById('screen-form').classList.contains('active');
    });
    assert.equal(choiceRequired, true);
    await page.click('input[name="has_experience"][value="nao"]');
    await page.evaluate(() => validateAndGoToReview());
    assert.equal(await page.$eval('#screen-review', screen => screen.classList.contains('active')), true);
    const selectedAdditional = await page.evaluate(() => {
      generateResumeAndShow();
      return { selected: state.adicionais,
        review: document.getElementById('rev-adicionais-container').textContent,
        pdf: document.getElementById('res-additional-chips').textContent };
    });
    assert.equal(selectedAdditional.selected.includes('a'.repeat(50)), false);
    assert.equal(selectedAdditional.selected.includes('<b>Trabalho em equipe</b>'), true);
    assert.ok(selectedAdditional.review.includes('<b>Trabalho em equipe</b>'));
    assert.ok(selectedAdditional.pdf.includes('<b>Trabalho em equipe</b>'));
    await page.evaluate(() => goToStep(2));
    await page.click('.custom-additional button');
    await page.waitForFunction(() => !document.querySelector('.additional-leaving'));
    assert.equal(await page.$eval('#btn-add-info', button => button.disabled), false);
    await page.type('#f-outras-info', 'Facilidade para aprender');
    // Revisar também aproveita o texto digitado sem perder um rascunho.
    await page.evaluate(() => validateAndGoToReview());
    assert.equal(await page.$$eval('.custom-additional', items => items.length), 2);
    assert.equal(await page.evaluate(() => state.adicionais.includes('Facilidade para aprender')), true);
    await page.evaluate(() => goToStep(2));
    await page.click('input[name="has_experience"][value="sim"]');
    const employment = await page.evaluate(() => {
      const start = document.getElementById('exp-inicio-0');
      const end = document.getElementById('exp-fim-0');
      start.value = '2099-01';
      const future = validateField(start);
      start.value = '2020-02'; end.value = '2020-01';
      validateExperienceField(end);
      const reversed = end.classList.contains('is-invalid');
      start.value = '2020-01';
      start.dispatchEvent(new Event('input', { bubbles: true }));
      return { future, reversed, corrected: !end.classList.contains('is-invalid') };
    });
    assert.deepEqual(employment, { future: false, reversed: true, corrected: true });

    // Enter abre o seletor de foto a partir de um botão real, sem depender do mouse.
    await page.$eval('#btn-add-photo', button => button.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await page.focus('#btn-add-photo');
    const chooser = page.waitForFileChooser();
    await page.keyboard.press('Enter');
    await (await chooser).cancel();
    await page.click('.custom-additional button');
    await page.waitForFunction(() => !document.querySelector('.additional-leaving'));
    await page.type('#f-outras-info', 'Trabalho em equipe');
    await page.click('#btn-add-info');
    for (const width of [320, 390, 768, 1366]) {
      await page.setViewport({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const layout = await page.evaluate(() => {
        const options = document.getElementById('additional-options');
        const labels = [...options.querySelectorAll('.custom-check-pill')];
        const heights = labels.map(label => label.getBoundingClientRect());
        return {
          removeHeight: Math.min(...[...options.querySelectorAll('button')].map(button => button.offsetHeight)),
          sameRowHeights: heights.every(rect => heights.every(other => Math.abs(rect.top - other.top) > 1 || Math.abs(rect.height - other.height) <= 1)),
        };
      });
      assert.ok(layout.removeHeight >= 44);
      assert.equal(layout.sameRowHeights, true);
      await page.screenshot({ path: `tmp/pdfs/updated-form-${width}.png`, fullPage: true });
      await (await page.$('#sec-adicionais')).screenshot({ path: `tmp/pdfs/additional-info-${width}.png` });
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
});
