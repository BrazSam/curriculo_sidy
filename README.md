# Gerador de Currículo SIDY

Crie seu currículo de operador de máquinas pesadas com o modelo da **SIDY Escola de Profissões**. Fácil de usar pelo celular ou computador, sem cadastro e sem instalação.

## 👉 [Acesse o site e crie seu currículo](https://curriculosidy.vercel.app/)

[![Gerador de Currículo SIDY](img/bannerinicial.png)](https://curriculosidy.vercel.app/)

## Como usar

1. Preencha seus dados e adicione uma foto.
2. Confira as informações na revisão.
3. Salve seu currículo em PDF e compartilhe nas suas candidaturas.

**Seu próximo passo profissional começa aqui.**

## Desenvolvimento e PDF

### Onde mexer

- `index.html`: telas, campos e modelo do currículo.
- `styles.css`: cores, espaçamentos e ajustes para celular.
- `app.js`: formulário, revisão, pedido do PDF e compartilhamento.
- `api/resume.js`: geração do PDF com Chromium no servidor.
- `pdf-preview.js`: mostra o PDF pronto na tela 4.
- `scripts/`: preparação dos arquivos e servidor local.
- `tests/`: verificações do PDF e dos botões.

Edite os arquivos da raiz. A pasta `dist` é gerada automaticamente pelo build.

Requisitos: Node.js 22.17+ (ou 24+) e Google Chrome instalado para desenvolvimento.

```sh
npm ci
npm run build
npm run dev
```

Abra http://localhost:3000. No Windows, o servidor usa o Chrome instalado no caminho padrão.
Em outros sistemas ou instalações, configure `CHROME_EXECUTABLE_PATH` com o caminho do Chrome.
Live Server e abrir o HTML diretamente não executam a API de PDF.
Após editar os arquivos, execute `npm run build` novamente e recarregue a página.

### Publicação na Vercel

O `vercel.json` configura o build estático em `dist` e a função Node `/api/resume`.
Use o preset Other, a raiz deste repositório e Node 22.x; não configure `CHROME_EXECUTABLE_PATH` na Vercel.
O Chromium Linux vem na dependência `@sparticuz/chromium`; as fontes e imagens também são empacotadas.
A geração utiliza uma função com 2 GB de memória e limite de 60 segundos. Verifique disponibilidade e consumo no plano usado.
Depois da publicação, valide a geração na URL de preview da Vercel e o envio em Android/iOS reais.

### Como funciona

- O navegador envia somente os dados do formulário e a foto recortada proporcionalmente, limitada a 600 × 600 pixels.
- O servidor valida os dados e renderiza o modelo local em Chromium, com fontes locais e página A4 fixa (210 × 297 mm).
- URLs externas são bloqueadas durante a renderização. O serviço não salva o currículo nem registra os dados preenchidos; a resposta usa `Cache-Control: no-store`.
- A tela 4 mostra o PDF com PDF.js. Somente o tamanho da visualização muda conforme a tela.
- Download, visualização e compartilhamento reutilizam o mesmo `File`, sem gerar outra versão no clique.
- O botão WhatsApp abre o compartilhamento do sistema; o usuário escolhe o aplicativo e o contato. Sem suporte, oferece download e envio manual.
- Conteúdo que exigiria redução abaixo de 65% é recusado com orientação para resumir, evitando cortes silenciosos ou letras excessivamente pequenas.

### Verificação

```sh
npm run build
npm test
```

Os testes abrem Chrome headless e um servidor temporário: validam o PDF real A4 de uma página,
texto selecionável, foto de teste, telas de 390/1366 pixels, reutilização do arquivo no compartilhamento,
cancelamento, alternativa manual, falha com nova tentativa e excesso de conteúdo.
As capturas de conferência ficam em `tmp/pdfs` (fora do Git). O compartilhamento é simulado nos testes;
isso não substitui a verificação do menu nativo em um celular real.
