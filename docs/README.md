# SG2 | Validador Inteligente — versão gratuita

Aplicação estática disponível em `docs/`. Use GitHub Pages (Settings > Pages > Deploy from a branch > main > /docs).

## Recursos
- Upload DOCX e leitura em seu próprio navegador.
- Campo para link do Drive, com botão para abrir a pasta.
- Anexos .zip, .docx, .txt, .md, .csv e .json. A leitura atual de ZIP compreende DOCX e arquivos textuais; PDFs, imagens e planilhas não são interpretados.
- Biblioteca local de regras, com importação/exportação JSON. O conteúdo fica neste navegador via localStorage.
- Lista de sugestões exportável e Word com controle de alterações nativo nos casos em que uma substituição literal puder ser aplicada com segurança.
- Nenhum relatório é enviado ao GitHub pelo código da aplicação.

## Limitações importantes
- Esta versão não consulta automaticamente pastas privadas do Google Drive.
- Não há IA externa; não há validação jurídica aprofundada nem ingestão automática do conhecimento de conversas ChatGPT.
- O código carrega JSZip por CDN, exigindo internet para a biblioteca; o processamento dos arquivos continua local.
- Revisões de Word podem alterar a formatação no trecho substituído. Faça uma cópia do documento e confira os resultados no Word antes de utilizar.
- O GitHub Pages é um site público. Não insira credenciais nem materiais confidenciais no repositório.
- Regras armazenadas no navegador não têm sincronização entre usuários. Faça exportação periódica.
- Não há autenticação individual nem trilha de auditoria.
