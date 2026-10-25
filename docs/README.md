# SG2 | Validador Inteligente — versão web gratuita

Site público estático hospedado no GitHub Pages a partir da pasta `docs/`.

## Como validar
1. Abra o painel e envie um relatório `.docx`.
2. Para confronto documental, adicione PDFs com texto selecionável, DOCX, ZIP da pasta do caso ou arquivos TXT/MD/CSV/JSON. O link do Drive é somente referência e não dá acesso automático a pastas privadas.
3. Se quiser revisão jurídica por IA, ative **Validação jurídica com IA** e confirme o consentimento específico. Um login na Puter poderá ser solicitado. Sem ativar, o programa aplica apenas regras locais.
4. Selecione Word com alterações ou lista de sugestões. Ambas são geradas após a análise.

## Custos e confidencialidade
A hospedagem GitHub Pages é gratuita. A IA externa é integrada via Puter.js, sem chave ou servidor próprio; **cada usuário recebe uma franquia gratuita mensal**, e o provedor poderá exigir pagamento caso essa franquia se esgote. Não é uso gratuito ilimitado. Não é necessário contratar mensalidade para usar o modo local.

**Atenção:** a análise por IA envia o texto do documento e dos anexos extraídos para a plataforma Puter e os respectivos provedores de modelos. Nunca use com documentação confidencial de clientes sem autorização institucional e avaliação de privacidade. O modo local não faz esse envio, mas carrega bibliotecas externas de JavaScript.

## Funcionalidades
- Modo local: substituições literais de redação definidas na Biblioteca SG2.
- Modo IA externo (consentimento): revisão jurídica, fundamentação, coerência e confronto com os textos dos anexos efetivamente extraídos.
- Fontes: DOCX, PDF textuais, TXT, MD, CSV, JSON e arquivos ZIP contendo esses formatos. PDFs digitalizados sem texto ficam fora da análise; **não há OCR**.
- Biblioteca de substituições exportável/importável em JSON, armazenada neste navegador (não sincronizada).
- Word com controle de alterações real quando o trecho literal for localizável e seguro de modificar. O aplicativo preserva o documento original; alguns trechos complexos ou sem correspondência exata ficam somente na lista.
- Lista de sugestões em TXT, com transcrições para comparação.

## Limitações
- A biblioteca do projeto Coordenação ainda **não foi importada**; logo, a IA não possui acesso às conversas, aos modelos ou aos livros construídos ali.
- Sem conexão direta com Gmail, CPJ ou Google Drive. A análise documental se limita aos arquivos enviados no navegador.
- A IA pode errar ou gerar sugestões inadequadas. Todas precisam de conferência humana por responsável técnico, especialmente fatos, valores, cláusulas e jurisprudência.
- O GitHub Pages é público. Nunca armazene documentos privados nem tokens no repositório.
- O modo com IA depende de terceiros, rede e saldo da conta; o modo local continua disponível independentemente dessa opção.
