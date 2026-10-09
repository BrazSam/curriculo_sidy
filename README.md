# Gerador de Currículo SIDY

Aplicação para alunos da SIDY Escola de Profissões preencherem, revisarem e gerarem um currículo de operador de máquinas pesadas.

[Acessar o site](https://curriculosidy.vercel.app/)

![Tela inicial](img/bannerinicial.png)

## Onde fica cada parte

```text
curriculo_sidy/
├── index.html                       Estrutura das quatro telas e do currículo
├── styles.css                       Aparência, responsividade e impressão
├── app.js                           Dados, validação, navegação e geração do PDF
├── vendor/
│   └── html2canvas-1.4.1.min.js       Biblioteca externa; preservar a licença
├── img/                             Logo, banner e imagens das máquinas
└── README.md                        Este guia
```

O projeto continua sendo um site estático: não exige instalação de dependências, compilação, cadastro ou servidor de aplicação. Para visualizar no VS Code, abra a pasta e use o Live Server no `index.html`. Ao publicar, envie todos os arquivos e pastas dessa estrutura.

## Como o código funciona

1. `goToStep()` alterna entre início, formulário, revisão e currículo.
2. `validateAndGoToReview()` valida o formulário e copia os valores para `state`.
3. `renderReview()` mostra os dados para conferência.
4. `generateResumeAndShow()` preenche o currículo A4.
5. `printOrSavePDF()` abre a impressão do navegador; `shareOnWhatsApp()` gera o PDF para compartilhar.

`state` é o objeto que concentra os dados do aluno. Ele fica apenas na memória da página; não existe salvamento de rascunho. Recarregar a página pode perder o preenchimento.

O `app.js` está dividido em seções numeradas. Procure pelos comentários de navegação, foto, validação, experiências, revisão, renderização segura e compartilhamento.

## Onde editar

| Alteração desejada | Arquivo e região |
| --- | --- |
| Textos e campos da tela | `index.html`, comentários `TELA 1` até `TELA 4` |
| Conteúdo fixo do currículo | `index.html`, elemento `resume-paper` |
| Cores e tamanhos | `styles.css`, variáveis `:root` e estilos dos componentes |
| Layout no celular | `styles.css`, regras `@media` |
| Impressão | `styles.css`, regras `@media print` e `@page` |
| Dados obrigatórios e erros | `app.js`, `validateField()` e `validateExperienceBlock()` |
| PDF e compartilhamento | `app.js`, seção 12 |

Os IDs do HTML conectam a interface às funções JavaScript. Se renomear um ID, atualize suas referências no `app.js` e no `styles.css`.

## Validações atuais

- Foto, nome, cidade, estado, telefone e e-mail são obrigatórios.
- Telefone: 10 ou 11 dígitos, incluindo o DDD. A verificação não confirma que o número existe.
- E-mail: formato validado pelo navegador; não verifica se a caixa existe.
- Experiência: empresa, cargo, início e atividades são obrigatórios quando a opção de experiência está ativa.
- A saída é obrigatória, exceto em emprego atual, e não pode ser anterior à entrada. O mesmo mês é permitido.
- É possível cadastrar até duas experiências. Remover a segunda limpa seus dados e erros.

Os textos preenchidos são inseridos com `textContent`, por meio de `textElement()` ou de propriedades de elementos. Preserve esse padrão para não interpretar os dados como HTML. Os usos restantes de `innerHTML` na aplicação contêm apenas textos fixos do próprio código.

## Compartilhamento e `share-fallback`

O botão de compartilhar tenta entregar o PDF à janela de compartilhamento do dispositivo. Nela, o usuário escolhe o aplicativo, como o WhatsApp. A disponibilidade depende do navegador e do dispositivo.

Se o envio direto não estiver disponível ou falhar, `showShareFallback()` mostra um painel alternativo:

1. **Baixar PDF** salva o arquivo gerado.
2. **Abrir WhatsApp** abre uma mensagem de texto; o usuário deve anexar o PDF baixado como documento.

Um link `wa.me` não consegue anexar automaticamente um arquivo local. Por isso o painel explica a etapa manual. Cancelar a janela de compartilhamento não abre o painel alternativo. O botão é restaurado em `finally`, tanto no sucesso quanto no cancelamento ou erro.

Os atributos do painel têm estas funções:

- `id="share-fallback"`: identifica o painel para o JavaScript.
- `class="no-print form-card"`: aplica a aparência de cartão e oculta o painel na impressão.
- `role="status"`: identifica uma mensagem de estado para tecnologias assistivas.
- `tabindex="-1"`: permite que o JavaScript leve o foco ao painel sem incluí-lo na sequência normal da tecla Tab.
- `hidden`: mantém o painel oculto até ser necessário.
- `target="_blank"`: abre o link do WhatsApp em outra aba ou janela.
- `rel="noopener noreferrer"`: impede acesso à janela de origem e omite a referência de origem na navegação.

Os links começam sem `href`: `showShareFallback()` preenche o endereço temporário do PDF, o nome do download e o endereço da mensagem. `clearShareFallback()` limpa os links e libera o endereço temporário ao gerar uma nova versão.

## Dependências e limites

- Basecoat CSS e Google Fonts são carregados externamente.
- html2canvas 1.4.1 fica em `vendor/`, separado para facilitar a leitura do código da aplicação. Seu conteúdo e licença foram preservados.
- jsPDF é carregado pelo CDN indicado no HTML.
- O PDF de compartilhamento contém uma imagem do currículo; seu texto não é selecionável. A impressão do navegador usa outro caminho.
- Persistência de rascunho, PDF com texto selecionável e melhorias adicionais de acessibilidade permanecem como possíveis evoluções.
