# Republic Paradise — cadastro de lojistas

O formulário entrega os nove campos para `/api/leads`. O backend valida os campos, CNPJ e telefone, registra o payload nos logs e agenda o envio ao n8n com `waitUntil`. O aceite da API confirma o recebimento e agendamento; a gravação na planilha deve ser verificada na execução n8n.

O CNPJ recebe máscara e validação dos dígitos no navegador e no backend. Uma consulta silenciosa a `/api/cnpj` começa quando os 14 dígitos ficam válidos; o blur reutiliza essa consulta. O backend consulta a API central VFX com o token OIDC runtime. Os resultados concluídos retornam um ticket assinado, vinculado ao CNPJ e válido por dez minutos, que é verificado no envio. Sem ticket válido, o processamento em segundo plano faz a consulta autoritativa. Falha da consulta automática continua sem repetir a consulta no mesmo envio. Enriquecimento indisponível permanece opcional; CNPJ inválido bloqueia o cadastro.

## Contrato da planilha

`Data` registra o recebimento no n8n em America/Sao_Paulo. Os primeiros cinco campos são Nome completo proprietário, Nome da loja, WhatsApp, E-mail e CNPJ. `Status` e `Obs` ficam nas colunas 7 e 8, com valor vazio aplicado no Edit Fields. Depois vêm Instagram da loja, Tipo de loja, Possui loja física? e Principais marcas vendidas na sua loja.

Os campos de enriquecimento são Razão Social, Nome Fantasia, Situação Cadastral, Data de abertura, Tempo de CNPJ, Porte, CNAE, Descrição do CNAE, Endereço, Rua, Bairro e Número. Campos ausentes na fonte ficam vazios. Score e conversões serão configurados em etapa posterior.

O marcador existente, `teste mais lojistas` no começo do Nome da loja, ignora caixa, acentos e espaços excedentes e encaminha somente para a aba TESTES - LP. Cadastros comuns vão para Leads - LP. As notificações estão desabilitadas e desconectadas, sem destinatário. Não habilitá-las sem aprovação do número.

## Configuração e verificações

Secrets server-side em Production e Preview: `N8N_REPUBLIC_PARADISE_WEBHOOK_URL` e `CNPJ_PREFETCH_SIGNING_SECRET`. A consulta central usa OIDC da equipe agencia-vfx; credenciais dos provedores permanecem na API central.

`npm ci`, `npm test`, `npm run lint` e `npm run build` verificam o backend e o build. `npx playwright install chromium` e `npm run test:form` verificam o formulário com as APIs simuladas. `?dry_run=1` impede consulta cadastral, logs de payload e envio no backend.

Backup consiste somente nos logs correlacionados por submission_id. Não há banco, fila ou planilha adicional de backup. A aba de testes é um destino isolado para verificação. O envio em segundo plano não oferece retry automático.
