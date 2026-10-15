/* GERADOR DE CURRÍCULO SIDY
 * Fluxo: formulário → validateAndGoToReview() → renderReview()
 *        → generateResumeAndShow() → PDF pronto para baixar ou compartilhar.
 * state concentra os dados. Os IDs do HTML são usados para localizar os campos.
 * Este arquivo é carregado ao final do HTML, quando os elementos já existem.
 */

// 1. DADOS DO CURRÍCULO — ficam na memória enquanto a página está aberta
const state = {
  photoDataUrl: null,
  nome: '',
  nascimento: '',
  cidade: '',
  uf: 'SP',
  bairro: '',
  telefone: '',
  email: '',
  cnh: 'B',
  cursoInicio: '',
  cursoFim: '',
  maquinas: [
    'Escavadeira Hidráulica',
    'Retroescavadeira',
    'Pá Carregadeira',
    'Mini Pá Carregadeira (Bobcat)',
  ],
  isPremium: true,
  hasExperience: true,
  experiencias: [
    {
      empresa: '',
      cargo: '',
      inicio: '',
      fim: '',
      atual: false,
      atividades: '',
    },
  ],
  adicionais: [
    'Disponibilidade para estágio prático',
    'Início imediato',
    'Disponibilidade para viagens',
    'Disponibilidade para mudança de cidade',
    'Disponibilidade de horário (turnos/escalas)',
  ],
  outrasInfo: '',
  outrasFormacoes: [],
};

const MACHINE_ICONS = {
  'Escavadeira Hidráulica': 'img/escavadeira.png',
  Retroescavadeira: 'img/retro escavadeira.png',
  'Pá Carregadeira': 'img/pá carregadeira.png',
  'Mini Pá Carregadeira (Bobcat)': 'img/mini pá.png',
};

// 2. INICIALIZAÇÃO — atualiza o ano do rodapé e a conclusão do curso
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('foot-year').textContent = new Date().getFullYear();
  // Pré-preenche a conclusão do curso com o mês atual.
  const now = new Date();
  const fim = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  document.getElementById('f-curso-fim').value = fmt(fim); // mês atual
});

// 3. NAVEGAÇÃO — alterna as quatro telas e atualiza o indicador
function goToStep(stepNum) {
  const screens = ['screen-home', 'screen-form', 'screen-review', 'screen-share'];
  screens.forEach((id, idx) => {
    const el = document.getElementById(id);
    const ind = document.getElementById(`step-ind-${idx + 1}`);
    if (idx + 1 === stepNum) {
      el.classList.add('active');
      ind.className = 'stepper-step active';
    } else {
      el.classList.remove('active');
      if (idx + 1 < stepNum) {
        ind.className = 'stepper-step completed';
      } else {
        ind.className = 'stepper-step';
      }
    }
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 4. FOTO — leitura do arquivo, prévia e iniciais
function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    state.photoDataUrl = evt.target.result;
    updatePhotoPreview();
  };
  reader.readAsDataURL(file);
}

function removePhoto() {
  state.photoDataUrl = null;
  document.getElementById('input-photo').value = '';
  updatePhotoPreview();
}

function updatePhotoPreview() {
  const imgEl = document.getElementById('photo-img-tag');
  const initialsEl = document.getElementById('photo-initials');
  const removeBtn = document.getElementById('btn-remove-photo');

  if (state.photoDataUrl) {
    imgEl.src = state.photoDataUrl;
    imgEl.style.display = 'block';
    initialsEl.style.display = 'none';
    removeBtn.style.display = 'inline-flex';
  } else {
    imgEl.src = '';
    imgEl.style.display = 'none';
    initialsEl.style.display = 'block';
    removeBtn.style.display = 'none';
    updateInitials();
  }
}

function updateInitials() {
  const nomeInput = document.getElementById('f-nome').value.trim();
  const initialsEl = document.getElementById('photo-initials');
  if (!state.photoDataUrl) {
    if (nomeInput) {
      const parts = nomeInput.split(' ').filter((p) => p.length > 0);
      let initials = parts[0][0];
      if (parts.length > 1) {
        initials += parts[parts.length - 1][0];
      }
      initialsEl.textContent = initials.toUpperCase();
    } else {
      initialsEl.textContent = '?';
    }
  }
}

// 5. FORMULÁRIO — máscara brasileira, validação e mensagens de erro
function maskPhone(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length > 10) {
    input.value = `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
  } else if (v.length > 6) {
    input.value = `(${v.substring(0, 2)}) ${v.substring(2, 6)}-${v.substring(6)}`;
  } else if (v.length > 2) {
    input.value = `(${v.substring(0, 2)}) ${v.substring(2)}`;
  } else {
    input.value = v;
  }
}

// Mostra o erro junto ao campo e o associa para leitores de tela.
function setFieldError(input, message) {
  input.classList.toggle('is-invalid', Boolean(message));
  input.setAttribute('aria-invalid', String(Boolean(message)));
  let feedback = input.nextElementSibling;
  if (!feedback || !feedback.classList.contains('invalid-feedback')) {
    if (!message) return;
    feedback = document.createElement('span');
    feedback.className = 'invalid-feedback';
    input.after(feedback);
  }
  if (!feedback.id) {
    const index = Array.from(
      document.querySelectorAll('#cv-form input, #cv-form select, #cv-form textarea'),
    ).indexOf(input);
    feedback.id = `field-error-${index}`;
  }
  const descriptions = new Set(
    (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean),
  );
  descriptions.add(feedback.id);
  input.setAttribute('aria-describedby', [...descriptions].join(' '));
  feedback.textContent = message;
}

function validateField(input, required = input.required) {
  let message = '';
  const value = input.value.trim();
  if (!input.disabled) {
    if (required && !value) {
      message = 'Preencha este campo.';
    } else if (input.maxLength > 0 && input.value.length > input.maxLength) {
      message = `Use no máximo ${input.maxLength} caracteres.`;
    } else if (input.id === 'f-telefone' && !/^\d{10,11}$/.test(value.replace(/\D/g, ''))) {
      message = 'Informe o telefone com DDD: 10 ou 11 dígitos.';
    } else if (!input.validity.valid) {
      message =
        input.type === 'email'
          ? 'Informe um e-mail válido, como nome@exemplo.com.'
          : 'Informe um valor válido.';
    }
  }
  setFieldError(input, message);
  return !message;
}

// 6. OPÇÕES — aparência das seleções, máquinas e certificação
function togglePillActive(checkbox) {
  const label = checkbox.closest('.custom-check-pill');
  if (checkbox.checked) {
    label.classList.add('checked');
  } else {
    label.classList.remove('checked');
  }
}

function toggleAllMachines() {
  const checkboxes = document.querySelectorAll('input[name="maquinas"]');
  const allChecked = Array.from(checkboxes).every((c) => c.checked);
  checkboxes.forEach((c) => {
    c.checked = !allChecked;
    togglePillActive(c);
  });
}

function handlePremiumToggle(isSim) {
  state.isPremium = isSim;
  const infoBox = document.getElementById('premium-badge-info');
  const labels = document.querySelectorAll('input[name="premium_sidy"]');
  labels.forEach((r) => {
    r.closest('.custom-check-pill').classList.toggle(
      'checked',
      r.value === (isSim ? 'sim' : 'nao'),
    );
  });
  if (isSim) {
    infoBox.style.display = 'block';
  } else {
    infoBox.style.display = 'none';
  }
}

// 7. EXPERIÊNCIAS — mostrar, adicionar, remover e validar os períodos
function handleExpToggle() {
  const simRadio = document.querySelector('input[name="has_experience"][value="sim"]');
  const naoRadio = document.querySelector('input[name="has_experience"][value="nao"]');

  const temExp = !!(simRadio && simRadio.checked);

  // Aplica a classe visual na pill certa
  if (simRadio)
    simRadio.closest('.custom-check-pill').classList.toggle('checked', simRadio.checked);
  if (naoRadio)
    naoRadio.closest('.custom-check-pill').classList.toggle('checked', naoRadio.checked);

  state.hasExperience = temExp;

  const container = document.getElementById('experience-container');
  if (container) {
    container.style.display = temExp ? 'block' : 'none';
  }
  if (!temExp) {
    state.experiencias = [];
  }
}

function toggleCurrentJob(index, isChecked) {
  const fimInput = document.getElementById(`exp-fim-${index}`);
  if (fimInput) {
    fimInput.disabled = isChecked;
    if (isChecked) {
      fimInput.dataset.previous = fimInput.value;
      fimInput.value = '';
    } else if (fimInput.dataset.previous) {
      fimInput.value = fimInput.dataset.previous;
    }
    const block = fimInput.closest('.exp-block');
    if (block.querySelector('.is-invalid')) validateExperienceBlock(block);
  }
}

function addExp2() {
  document.getElementById('exp-block-1').style.display = 'block';
  document.getElementById('btn-add-exp').style.display = 'none';
}

function removeExp2() {
  document.getElementById('exp-block-1').style.display = 'none';
  document.getElementById('btn-add-exp').style.display = 'inline-flex';
  // Limpa a segunda experiência, inclusive erros e datas guardadas
  const block2 = document.getElementById('exp-block-1');
  block2.querySelectorAll('input, textarea').forEach((el) => {
    if (el.type === 'checkbox') el.checked = false;
    else el.value = '';
    el.disabled = false;
    delete el.dataset.previous;
    setFieldError(el, '');
    updateCharacterCount(el);
  });
}

function validateExperienceBlock(block) {
  const fields = ['.exp-empresa', '.exp-cargo', '.exp-inicio', '.exp-fim', '.exp-atividades'].map(
    (selector) => block.querySelector(selector),
  );
  fields.forEach((field) => validateField(field, true));
  const inicio = block.querySelector('.exp-inicio');
  const fim = block.querySelector('.exp-fim');
  // O mesmo mês é permitido; emprego atual dispensa a data de saída.
  if (!fim.disabled && inicio.value && fim.value && fim.valueAsNumber < inicio.valueAsNumber) {
    setFieldError(fim, 'A data de saída não pode ser anterior à data de início.');
  }
  return fields.filter((field) => field.classList.contains('is-invalid'));
}

function validateExperience() {
  if (!state.hasExperience) return true;
  const invalid = [];
  document.querySelectorAll('.exp-block').forEach((block) => {
    if (block.style.display !== 'none') invalid.push(...validateExperienceBlock(block));
  });
  if (invalid.length) {
    invalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    invalid[0].focus();
  }
  return invalid.length === 0;
}

// Após a primeira validação, atualiza os avisos enquanto o aluno corrige os dados.
document.querySelectorAll('.exp-block').forEach((block) => {
  block.addEventListener('input', () => {
    if (block.querySelector('.is-invalid')) validateExperienceBlock(block);
  });
});

// 8. REVISÃO — valida o formulário e copia os valores para state
function validateAndGoToReview() {
  if (!state.photoDataUrl) {
    alert('Por favor, adicione uma foto de perfil.');
    goToStep(2);
    setTimeout(() => {
      document.getElementById('sec-foto').scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return;
  }
  const nomeEl = document.getElementById('f-nome');
  const cidadeEl = document.getElementById('f-cidade');
  const ufEl = document.getElementById('f-uf');
  const telEl = document.getElementById('f-telefone');
  const emailEl = document.getElementById('f-email');

  let isValid = true;
  if (!validateField(nomeEl)) isValid = false;
  if (!validateField(cidadeEl)) isValid = false;
  if (!validateField(ufEl)) isValid = false;
  if (!validateField(telEl)) isValid = false;
  if (!validateField(emailEl)) isValid = false;

  if (!isValid) {
    // Leva o foco ao primeiro campo inválido
    const firstInvalid = document.querySelector('.form-control.is-invalid');
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalid.focus();
    }
    return;
  }

  if (state.hasExperience && !validateExperience()) {
    alert('Confira os campos destacados da experiência profissional para continuar.');
    return;
  }

  // Copia os dados preenchidos para o estado do currículo
  state.nome = nomeEl.value.trim();
  state.nascimento = document.getElementById('f-nasc').value;
  state.cidade = cidadeEl.value.trim();
  state.uf = ufEl.value;
  state.bairro = document.getElementById('f-bairro').value.trim();
  state.telefone = telEl.value.trim();
  state.email = document.getElementById('f-email').value.trim();
  state.cnh = document.getElementById('f-cnh').value;

  state.cursoFim = document.getElementById('f-curso-fim').value;

  // Máquinas
  const mEls = document.querySelectorAll('input[name="maquinas"]:checked');
  state.maquinas = Array.from(mEls).map((el) => el.value);

  // Experiências
  state.experiencias = [];
  if (state.hasExperience) {
    // Primeira experiência
    const b0 = document.getElementById('exp-block-0');
    const emp0 = b0.querySelector('.exp-empresa').value.trim();
    const crg0 = b0.querySelector('.exp-cargo').value.trim();
    if (emp0 || crg0) {
      state.experiencias.push({
        empresa: emp0 || 'Empresa confidencial',
        cargo: crg0 || 'Operador',
        inicio: b0.querySelector('.exp-inicio').value,
        fim: b0.querySelector('.exp-fim').value,
        atual: b0.querySelector('input[type="checkbox"]').checked,
        atividades: b0.querySelector('.exp-atividades').value.trim(),
      });
    }

    // Segunda experiência
    const b1 = document.getElementById('exp-block-1');
    if (b1.style.display !== 'none') {
      const emp1 = b1.querySelector('.exp-empresa').value.trim();
      const crg1 = b1.querySelector('.exp-cargo').value.trim();
      if (emp1 || crg1) {
        state.experiencias.push({
          empresa: emp1 || 'Empresa confidencial',
          cargo: crg1 || 'Operador',
          inicio: b1.querySelector('.exp-inicio').value,
          fim: b1.querySelector('.exp-fim').value,
          atual: b1.querySelector('input[type="checkbox"]').checked,
          atividades: b1.querySelector('.exp-atividades').value.trim(),
        });
      }
    }
  }

  // Adicionais
  const adEls = document.querySelectorAll('input[name="adicionais"]:checked');
  state.adicionais = Array.from(adEls).map((el) => el.value);
  state.outrasInfo = document.getElementById('f-outras-info').value.trim();

  // Outras Formações
  const formacaoBlocks = document.querySelectorAll('.formacao-block');
  state.outrasFormacoes = [];
  formacaoBlocks.forEach((block) => {
    const curso = block.querySelector('.formacao-curso').value.trim();
    if (!curso) return;
    state.outrasFormacoes.push({
      curso: curso,
      instituicao: block.querySelector('.formacao-instituicao').value.trim(),
      ano: block.querySelector('.formacao-ano').value.trim(),
    });
  });

  renderReview();
  goToStep(3);
}

function editSection(sectionId) {
  goToStep(2);
  setTimeout(() => {
    const sec = document.getElementById(sectionId);
    if (sec) {
      sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sec.style.transition = 'box-shadow 0.3s';
      sec.style.boxShadow = '0 0 0 4px rgba(27, 110, 194, 0.4)';
      setTimeout(() => {
        sec.style.boxShadow = '';
      }, 1500);
    }
  }, 100);
}

function formatMonthYear(val) {
  if (!val) return '';
  const [yr, mo] = val.split('-');
  const months = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const moName = months[parseInt(mo, 10) - 1] || mo;
  return `${moName}/${yr}`;
}

// 9. RENDERIZAÇÃO SEGURA — criação de elementos com textContent
// Dados preenchidos são texto: nunca devem ser interpretados como HTML.
function textElement(tag, text, className = '', styles = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  if (styles) element.style.cssText = styles;
  return element;
}

function renderContacts(id, includeBirth = false) {
  const contacts = [
    `📍 ${state.cidade}/${state.uf}${state.bairro ? ' (' + state.bairro + ')' : ''}`,
    `📱 ${state.telefone}`,
  ];
  if (state.email) contacts.push(`✉ ${state.email}`);
  if (state.cnh && state.cnh !== 'Não possuo') contacts.push(`🪪 CNH Categoria ${state.cnh}`);
  if (includeBirth && state.nascimento) {
    const [y, m, d] = state.nascimento.split('-');
    contacts.push(`🎂 Nasc: ${d}/${m}/${y}`);
  }
  const container = document.getElementById(id);
  container.replaceChildren();
  contacts.forEach((contact, index) => {
    if (includeBirth && index > 0) container.append(' · ');
    container.append(textElement('span', contact));
  });
}

function machineChip(machine) {
  const chip = textElement('span', '', 'res-mach-chip');
  const icon = MACHINE_ICONS[machine];
  if (icon) {
    const img = document.createElement('img');
    img.src = icon;
    img.alt = '';
    img.className = 'res-mach-icon';
    chip.append(img);
  }
  chip.append(' ' + machine);
  return chip;
}

// 10. TELA DE REVISÃO — mostra os dados antes da geração
function renderReview() {
  // Foto ou iniciais do nome
  const photoContainer = document.getElementById('rev-photo-container');
  if (state.photoDataUrl) {
    const photo = document.createElement('img');
    photo.src = state.photoDataUrl;
    photo.alt = 'Foto';
    photo.style.cssText = 'width:100%; height:100%; object-fit:cover;';
    photoContainer.replaceChildren(photo);
  } else {
    const parts = state.nome.split(' ').filter((p) => p.length > 0);
    let inits = parts[0] ? parts[0][0] : '?';
    if (parts.length > 1) inits += parts[parts.length - 1][0];
    photoContainer.textContent = inits.toUpperCase();
  }

  document.getElementById('rev-nome').textContent = state.nome;

  renderContacts('rev-contatos');

  // Periodo curso
  let pCurso = 'Carga horária de 66 horas certificadas';
  if (state.cursoInicio || state.cursoFim) {
    pCurso = `Período: ${formatMonthYear(state.cursoInicio) || 'Início'} até ${formatMonthYear(state.cursoFim) || 'Conclusão'}`;
  }
  document.getElementById('rev-curso-periodo').textContent = pCurso;

  // Maquinas
  const maqContainer = document.getElementById('rev-maquinas-chips');
  if (state.maquinas.length > 0) {
    maqContainer.replaceChildren(...state.maquinas.map(machineChip));
  } else {
    maqContainer.innerHTML =
      '<span style="color:#64748b; font-size:0.85rem;">Nenhuma máquina selecionada.</span>';
  }

  // NRs
  const nrContainer = document.getElementById('rev-nrs-container');
  if (state.isPremium) {
    nrContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-weight: 700; color:#065f46;">
          ★ Certificação Premium SIDY Ativa
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px;">
          <span class="tag-chip nr">NR-06 (EPIs)</span>
          <span class="tag-chip nr">NR-11 (Movimentação e Cargas)</span>
          <span class="tag-chip nr">NR-12 (Máquinas e Equipamentos)</span>
          <span class="tag-chip nr">NR-17 (Ergonomia)</span>
          <span class="tag-chip nr">NR-18 (Construção Civil)</span>
          <span class="tag-chip nr">NR-26 (Sinalização)</span>
        </div>
      `;
  } else {
    nrContainer.innerHTML =
      '<span style="color:#64748b; font-size:0.85rem;">Certificação regular do curso (sem pacote Premium de NRs expandidas).</span>';
  }

  // Exp
  const expContainer = document.getElementById('rev-exp-container');
  if (state.hasExperience && state.experiencias.length > 0) {
    expContainer.replaceChildren(
      ...state.experiencias.map((exp) => {
        const item = textElement(
          'div',
          '',
          '',
          'margin-bottom:12px; border-left:3px solid var(--sidy-blue); padding-left:10px;',
        );
        const title = textElement('div', exp.cargo + ' · ', '', 'font-weight:700; color:#0f172a;');
        title.append(
          textElement('span', exp.empresa, '', 'font-weight:600; color:var(--sidy-blue);'),
        );
        item.append(
          title,
          textElement(
            'div',
            `${formatMonthYear(exp.inicio)} até ${exp.atual ? 'Trabalho Atual' : formatMonthYear(exp.fim) || 'Saída'}`,
            '',
            'font-size:0.8rem; color:#64748b;',
          ),
        );
        if (exp.atividades)
          item.append(
            textElement(
              'div',
              exp.atividades,
              '',
              'font-size:0.85rem; color:#334155; margin-top:3px;',
            ),
          );
        return item;
      }),
    );
  } else {
    expContainer.innerHTML =
      '<span style="color:#64748b; font-size:0.85rem;">Sem histórico profissional anterior informado (perfil focado em qualificação técnica imediata).</span>';
  }

  // Adicionais
  const adContainer = document.getElementById('rev-adicionais-container');
  const chips = [];

  const revForm = document.getElementById('review-card-formacoes');
  const revFormList = document.getElementById('rev-formacoes-container');
  if (state.outrasFormacoes.length > 0) {
    revForm.style.display = 'block';
    revFormList.replaceChildren(
      ...state.outrasFormacoes.map((f) => {
        const item = textElement('div', `${f.curso} · ${f.instituicao || '—'}`, 'review-item');
        item.append(
          document.createElement('br'),
          textElement('small', f.ano || '', '', 'color:#64748b;'),
        );
        return item;
      }),
    );
  } else {
    revForm.style.display = 'none';
  }

  state.adicionais.forEach((a) => chips.push(textElement('span', '✓ ' + a, 'tag-chip')));
  if (state.outrasInfo)
    chips.push(textElement('span', '✓ ' + state.outrasInfo, 'tag-chip', 'max-width:100%;'));

  if (chips.length > 0) {
    const list = textElement('div', '', '', 'display:flex; flex-wrap:wrap; gap:6px;');
    list.append(...chips);
    adContainer.replaceChildren(list);
  } else {
    adContainer.replaceChildren(
      textElement(
        'span',
        'Nenhuma informação complementar informada.',
        '',
        'color:#64748b; font-size:0.85rem;',
      ),
    );
  }
}

// 11. MODELO DO CURRÍCULO — o servidor usa este HTML para montar o PDF
function generateResumeAndShow() {
  clearShareFallback();
  // Nome do candidato
  document.getElementById('res-name').textContent = state.nome.toUpperCase();

  // Foto ou iniciais, quando não há imagem
  const photoImg = document.getElementById('res-photo-img');
  const photoPlace = document.getElementById('res-photo-placeholder');
  if (state.photoDataUrl) {
    photoImg.src = state.photoDataUrl;
    photoImg.style.display = 'block';
    photoPlace.style.display = 'none';
  } else {
    photoImg.style.display = 'none';
    photoPlace.style.display = 'flex';
    const parts = state.nome.split(' ').filter((p) => p.length > 0);
    let inits = parts[0] ? parts[0][0] : 'S';
    if (parts.length > 1) inits += parts[parts.length - 1][0];
    photoPlace.textContent = inits.toUpperCase();
  }

  // Contatos do candidato
  renderContacts('res-contacts-row', true);

  // Período do curso
  let dCourse = 'Carga Horária de 66 Horas Certificadas';
  if (state.cursoInicio || state.cursoFim) {
    dCourse = `${formatMonthYear(state.cursoInicio) || 'Início'} – ${formatMonthYear(state.cursoFim) || 'Conclusão'}`;
  }
  document.getElementById('res-dates-course').textContent = dCourse;

  // Máquinas
  const mList = document.getElementById('res-machines-list');
  if (state.maquinas.length > 0) {
    mList.replaceChildren(...state.maquinas.map(machineChip));
  } else {
    mList.innerHTML = '<span class="resume-pill">Operador de Máquinas Pesadas em Geral</span>';
  }

  const outras = state.outrasFormacoes.filter((f) => f.curso);
  const secForm = document.getElementById('res-sec-formacoes');
  if (outras.length > 0) {
    secForm.style.display = 'block';
    document.getElementById('res-formacoes-list').replaceChildren(
      ...outras.map((f) => {
        const linha = [f.curso, f.instituicao, f.ano].filter(Boolean).join(' · ');
        return textElement('div', linha, 'resume-item-sub', 'margin-bottom:2px;');
      }),
    );
  } else {
    secForm.style.display = 'none';
  }

  // Certificação Premium e NRs
  const nrsSec = document.getElementById('res-sec-nrs');
  const nrsList = document.getElementById('res-nrs-list');
  const premText = document.getElementById('res-premium-text');

  if (state.isPremium) {
    nrsSec.style.display = 'block';
    nrsList.innerHTML = `
        <span class="resume-pill nr-pill">NR-06 (Equipamentos de Proteção Individual)</span>
        <span class="resume-pill nr-pill">NR-11 (Movimentação, Transporte e Armazenagem de Materiais)</span>
        <span class="resume-pill nr-pill">NR-12 (Segurança no Trabalho em Máquinas e Equipamentos)</span>
        <span class="resume-pill nr-pill">NR-17 (Ergonomia no Trabalho)</span>
        <span class="resume-pill nr-pill">NR-18 (Segurança e Saúde no Trabalho na Indústria da Construção)</span>
        <span class="resume-pill nr-pill">NR-26 (Sinalização de Segurança e Prevenção)</span>
      `;
    premText.style.display = 'block';
    premText.innerHTML =
      '★ <strong>Certificação Premium SIDY:</strong> Qualificação técnica abrangente em conformidade com as Normas Regulamentadoras vigentes do Ministério do Trabalho e Emprego (MTE).';
  } else {
    nrsSec.style.display = 'none';
  }

  // Experiência profissional
  const expSec = document.getElementById('res-sec-exp');
  const expList = document.getElementById('res-exp-list');
  if (state.hasExperience && state.experiencias.length > 0) {
    expSec.style.display = 'block';
    expList.replaceChildren(
      ...state.experiencias.map((exp) => {
        const item = textElement('div', '', 'resume-item');
        const header = textElement('div', '', 'resume-item-header');
        header.append(
          textElement('span', exp.cargo, 'resume-item-title'),
          textElement(
            'span',
            `${formatMonthYear(exp.inicio)} até ${exp.atual ? 'Momento Atual' : formatMonthYear(exp.fim) || 'Término'}`,
            'resume-item-date',
          ),
        );
        item.append(header, textElement('div', exp.empresa, 'resume-item-sub'));
        if (exp.atividades) item.append(textElement('p', exp.atividades, 'resume-desc-text'));
        return item;
      }),
    );
  } else {
    expSec.style.display = 'none';
  }

  // Informações Adicionais
  const adSec = document.getElementById('res-sec-adicionais');
  const adChips = document.getElementById('res-additional-chips');
  const exNotes = document.getElementById('res-extra-notes');

  // Reconstrói a lista inteira a cada geração, inclusive quando ela fica vazia.
  const additional = [...state.adicionais];
  if (state.outrasInfo) additional.push(state.outrasInfo);
  adChips.replaceChildren(...additional.map((a) => textElement('span', '✓ ' + a, 'resume-pill')));
  adChips.style.display = additional.length ? 'grid' : 'none';
  adSec.style.display = additional.length ? 'block' : 'none';
  exNotes.textContent = '';
  exNotes.style.display = 'none';

  goToStep(4);
  fitResumeToPage();
  prepareResumeLayout();
  if (!window.__PDF_SERVER__) prepareResumePDF();
}

// 12. UM ÚNICO PDF PARA PRÉVIA, DOWNLOAD E COMPARTILHAMENTO
let resumeFile = null;
let resumeUrl = null;
let resumeRequest = null;
// Se gerar de novo, uma resposta antiga não pode substituir o currículo novo.
let resumeVersion = 0;

async function compressResumePhoto(source) {
  if (!source) return null;
  const image = new Image();
  image.src = source;
  await image.decode();
  // Recorta o centro da foto sem esticar e deixa o envio mais leve.
  const edge = Math.min(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(600, edge);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, (image.naturalWidth - edge) / 2, (image.naturalHeight - edge) / 2,
    edge, edge, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

function clearShareFallback() {
  document.getElementById('share-fallback').hidden = true;
  document.getElementById('share-download').removeAttribute('href');
  document.getElementById('share-whatsapp-link').removeAttribute('href');
}

async function prepareResumePDF() {
  // Cancela o pedido anterior e limpa o arquivo que estava na tela.
  const version = ++resumeVersion;
  resumeRequest?.abort();
  const controller = new AbortController();
  resumeRequest = controller;
  const timeout = setTimeout(() => controller.abort(), 65000);
  resumeFile = null;
  if (resumeUrl) URL.revokeObjectURL(resumeUrl);
  resumeUrl = null;
  clearShareFallback();
  const status = document.getElementById('pdf-status');
  const preview = document.getElementById('pdf-preview');
  const open = document.getElementById('pdf-open');
  const retry = document.getElementById('btn-retry-pdf');
  const buttons = [document.getElementById('btn-download-pdf'), document.getElementById('btn-share-whatsapp')];
  buttons.forEach(button => { button.disabled = true; });
  open.hidden = true;
  open.removeAttribute('href');
  retry.hidden = true;
  preview.hidden = true;
  preview.replaceChildren();
  document.querySelector('#screen-share .resume-wrapper').hidden = true;
  status.textContent = 'Preparando seu PDF...';
  try {
    const payload = JSON.parse(JSON.stringify(state));
    payload.photoDataUrl = await compressResumePhoto(payload.photoDataUrl);
    if (version !== resumeVersion) return;
    const response = await fetch('/api/resume', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    if (!response.ok) {
      const message = await response.json().catch(() => ({}));
      throw new Error(message.error || 'Não foi possível gerar o PDF. Tente novamente.');
    }
    if (!response.headers.get('content-type')?.includes('application/pdf')) {
      throw new Error('O serviço de PDF não está disponível. Use o servidor do projeto ou a versão publicada.');
    }
    // Este mesmo arquivo vai para a prévia, o download e o WhatsApp.
    const blob = await response.blob();
    if (version !== resumeVersion) return;
    const filename = 'Curriculo_SIDY_' + (payload.nome.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'Aluno') + '.pdf';
    resumeFile = new File([blob], filename, { type: 'application/pdf' });
    resumeUrl = URL.createObjectURL(resumeFile);
    open.href = resumeUrl;
    open.hidden = false;
    buttons.forEach(button => { button.disabled = false; });
    status.textContent = '✓ PDF pronto para baixar e compartilhar!';
    clearTimeout(timeout);
    try {
      const { renderPDFPreview } = await import('./pdf-preview.js');
      const pages = await renderPDFPreview(await blob.arrayBuffer());
      if (version !== resumeVersion) return;
      preview.replaceChildren(...pages);
      preview.hidden = false;
    } catch {
      if (version === resumeVersion) status.textContent = 'PDF pronto! Use “Abrir PDF” para visualizar o arquivo.';
    }
  } catch (error) {
    if (version !== resumeVersion) return;
    status.textContent = error.name === 'AbortError' ? 'A geração demorou mais que o esperado. Tente novamente.' : error.message;
    retry.hidden = false;
  } finally { clearTimeout(timeout); }
}

function downloadResumePDF() {
  if (!resumeFile || !resumeUrl) return;
  const link = document.createElement('a');
  link.href = resumeUrl;
  link.download = resumeFile.name;
  document.body.append(link);
  link.click();
  link.remove();
}

function showShareFallback() {
  if (!resumeFile) return;
  const download = document.getElementById('share-download');
  download.href = resumeUrl;
  download.download = resumeFile.name;
  document.getElementById('share-whatsapp-link').href = 'https://api.whatsapp.com/send';
  const panel = document.getElementById('share-fallback');
  panel.hidden = false;
  panel.focus();
}

async function shareOnWhatsApp(button) {
  if (!resumeFile || button.disabled) return;
  clearShareFallback();
  button.disabled = true;
  const file = resumeFile;
  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      // O arquivo já está pronto. Assim o celular abre o compartilhamento no clique.
      await navigator.share({ files: [file] });
    } else showShareFallback();
  } catch (error) {
    if (error.name !== 'AbortError' && file === resumeFile) showShareFallback();
  } finally { button.disabled = !resumeFile; }
}

// Ajuda persistente e contadores dos campos com limite de texto.
function updateCharacterCount(field) {
  const counter = document.getElementById(field.id + '-count');
  if (!counter) return;
  const used = field.value.length;
  const max = field.maxLength;
  counter.textContent = used + ' de ' + max + ' caracteres' + (used >= max ? ' — limite atingido' : '');
  counter.classList.toggle('at-limit', used >= max);
}
document.querySelectorAll('.exp-empresa, .exp-cargo, .exp-atividades, #f-outras-info, .formacao-curso, .formacao-instituicao').forEach((field) => {
  field.addEventListener('input', () => updateCharacterCount(field));
  updateCharacterCount(field);
});
window.addEventListener('pageshow', () => {
  document.querySelectorAll('.exp-empresa, .exp-cargo, .exp-atividades, #f-outras-info, .formacao-curso, .formacao-instituicao').forEach(updateCharacterCount);
});

// Mede em largura A4 antes de reduzir; celular e computador usam o mesmo documento.
function fitResumeToPage() {
  const paper = document.getElementById('resume-paper');
  const content = paper.querySelector('.resume-content');
  if (!paper.offsetWidth) return;
  const scale = Math.min(1, paper.clientWidth / content.offsetWidth, (paper.clientHeight - 2) / content.scrollHeight);
  paper.style.setProperty('--resume-fit', scale);
  paper.style.setProperty('--resume-left', ((paper.clientWidth - content.offsetWidth * scale) / 2) + 'px');
  const wrapper = paper.closest('.resume-wrapper');
  const style = getComputedStyle(wrapper);
  const available = wrapper.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const previewScale = Math.min(1, available / paper.offsetWidth);
  const preview = paper.closest('.resume-preview');
  preview.style.setProperty('--preview-width', paper.offsetWidth * previewScale + 'px');
  preview.style.setProperty('--preview-height', paper.offsetHeight * previewScale + 'px');
  paper.style.setProperty('--preview-scale', previewScale);
}
async function prepareResumeLayout() {
  await document.fonts.ready;
  await Promise.all(Array.from(document.querySelectorAll('#resume-paper img')).map(img =>
    img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
  fitResumeToPage();
}
window.addEventListener('beforeprint', fitResumeToPage);
window.addEventListener('afterprint', fitResumeToPage);
window.addEventListener('resize', fitResumeToPage);
