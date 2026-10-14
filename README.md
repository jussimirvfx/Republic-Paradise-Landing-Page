# Republic Paradise — cadastro de lojistas

O formulário entrega os nove campos para `/api/leads`. O backend valida os campos, CNPJ e telefone, registra o payload nos logs e agenda o envio ao n8n com `waitUntil`. O aceite da API confirma o recebimento e agendamento; a gravação na planilha deve ser verificada na execução n8n.

O CNPJ recebe máscara e validação dos dígitos no navegador e no backend. Uma consulta silenciosa a `/api/cnpj` começa quando os 14 dígitos ficam válidos; o blur reutiliza essa consulta. O backend consulta a API central VFX com o token OIDC runtime. Os resultados concluídos retornam um ticket assinado, vinculado ao CNPJ e válido por dez minutos, que é verificado no envio. Sem ticket válido, o processamento em segundo plano faz a consulta autoritativa. Falha da consulta automática continua sem repetir a consulta no mesmo envio. Enriquecimento indisponível permanece opcional; CNPJ inválido bloqueia o cadastro.

## Contrato da planilha

`Data` registra o recebimento no n8n em America/Sao_Paulo. Os primeiros cinco campos são Nome completo proprietário, Nome da loja, WhatsApp, E-mail e CNPJ. `Status` e `Obs` ficam nas colunas 7 e 8, com valor vazio aplicado no Edit Fields. Depois vêm Instagram da loja, Tipo de loja, Possui loja física? e Principais marcas vendidas na sua loja.

Os campos de enriquecimento são Razão Social, Nome Fantasia, Situação Cadastral, Data de abertura, Tempo de CNPJ, Porte, CNAE, Descrição do CNAE, Endereço, Rua, Bairro e Número. Campos ausentes na fonte ficam vazios. `lib/lead-score.js` calcula a nota a partir do tipo de loja, loja física, estado e tempo de CNPJ. Dados básicos não pontuam. O log `lead_score_calculated` contém as parcelas, nota, status e motivos de desqualificação; o navegador também mostra esse detalhamento após o aceite.

O marcador existente, `teste mais lojistas` no começo do Nome da loja, ignora caixa, acentos e espaços excedentes e encaminha somente para a aba TESTES - LP. Cadastros comuns vão para Leads - LP. As notificações estão desabilitadas e desconectadas, sem destinatário. Não habilitá-las sem aprovação do número.

## Configuração e verificações

Secrets server-side em Production e Preview: `N8N_REPUBLIC_PARADISE_WEBHOOK_URL` e `CNPJ_PREFETCH_SIGNING_SECRET`. A consulta central usa OIDC da equipe agencia-vfx; credenciais dos provedores permanecem na API central.

`npm ci`, `npm test`, `npm run lint` e `npm run build` verificam o backend e o build. `npx playwright install chromium` e `npm run test:form` verificam o formulário com as APIs simuladas. `?dry_run=1` impede consulta cadastral, logs de payload e envio no backend.

Backup consiste somente nos logs correlacionados por submission_id. Não há banco, fila ou planilha adicional de backup. A aba de testes é um destino isolado para verificação. O envio em segundo plano não oferece retry automático.

## Meta Pixel e Conversion API

`scoretrack@1.0.0` vem do registry público npmjs. A configuração manual fica em `src/metaTracking.tsx`. O provider envia um PageView por carregamento e o hook do pacote acompanha Scroll 25/50/75/100. Não montamos `MetaPixel`, pois ele enviaria outro PageView além do provider.

Após o aceite de `/api/leads`, o formulário confirma o cadastro imediatamente e reutiliza a consulta de CNPJ para pontuar e enviar `Lead`. `LeadQualificado` exige `qualified: true`, nota >= 50 e cadastro completo. Opções desqualificadoras e dados cadastrais pendentes impedem esse segundo evento. `value` e `lead_score` usam a mesma nota. O pacote gera o mesmo event_id para o Pixel e a CAPI e prepara os identificadores com SHA-256. O Pixel também recebe os dados de Advanced Matching.

Configuração em `.env.local` e nas variáveis da Vercel: `VITE_META_PIXEL_ID` é público; `META_PIXEL_ID` e `META_API_ACCESS_TOKEN` são usados no servidor. Nunca use prefixo VITE_ para o token. O marcador `server-side-only` atende à validação do pacote no navegador e não é uma credencial. `META_TEST_EVENT_CODE` é usado localmente e em Preview, e ignorado em Production. O arquivo `.env.local` está fora do Git; as variáveis da Vercel precisam ser configuradas antes da publicação.

`/api/meta/conversions` é servido pela Vercel em produção e pelo middleware do Vite no desenvolvimento. A rota registra `conversion_api_event_backup` antes da Meta, com ID, nome, dados preparados e presença dos identificadores. Falhas retornam 202 e geram `conversion_api_event_error` com os payloads recuperáveis, excluindo tokens. Um HTTP 202 confirma apenas o aceite da tentativa, sem comprovar recebimento pela Meta.

Dry-run da rota: header `X-VFX-Dry-Run: 1` ou body `dry_run`, `dryRun`, `vfx_dry_run` ou `skip_webhook` com true/1. Responde 200 com `dry_run: true` e `skipped_meta: true`. Na página com `?dry_run=1`, o Pixel não é inicializado e nenhum evento Meta é disparado. Os testes do navegador simulam a Meta e a consulta do CNPJ; o teste HTTP local de dry-run exercita a rota real.

O pacote 1.0.0 inclui o SDK Meta no arquivo de navegador, aumenta o bundle e traz quatro apontamentos altos no npm audit na cadeia `http-proxy-middleware → micromatch → braces`, sem correção publicada no momento da instalação. A aplicação não utiliza o proxy desse pacote.
