# Republic Paradise — cadastro de lojistas

O formulário entrega os nove campos para `/api/leads`. O backend registra a tentativa antes da validação de CNPJ, valida os campos, registra a captura nos logs e agenda o envio ao n8n com `waitUntil`. O aceite confirma recebimento para processamento e agendamento; a gravação na planilha continua sendo um resultado separado.

Padrão adotado: [VFX](https://github.com/jussimirvfx/vfx-padraoqualidade-lps/tree/0ddb91fe51dec26b705929e8143a79fd635d4d00), SHA `0ddb91fe51dec26b705929e8143a79fd635d4d00`, revisto em 20/10/2026. O contrato v2 está em `quality/form-outcomes.json`; cobertura técnica não substitui os recibos dos destinos em produção.

O CNPJ recebe máscara e validação dos dígitos no navegador e no backend. Uma consulta silenciosa a `/api/cnpj` começa quando os 14 dígitos ficam válidos; o blur reutiliza essa consulta. O backend consulta a API central VFX com o token OIDC runtime. Os resultados concluídos retornam um ticket assinado, vinculado ao CNPJ e válido por dez minutos, que é verificado no envio. Sem ticket válido, o processamento em segundo plano faz a consulta autoritativa. Falha da consulta automática continua sem repetir a consulta no mesmo envio. Enriquecimento indisponível permanece opcional; CNPJ inválido bloqueia o cadastro.

## Contrato da planilha

`Data` registra o recebimento no n8n em America/Sao_Paulo. Os primeiros cinco campos são Nome completo proprietário, Nome da loja, WhatsApp, E-mail e CNPJ. `Status` e `Obs` ficam nas colunas 7 e 8: Aguardando Atendimento e vazio, respectivamente, aplicados no Edit Fields. Depois vêm Instagram da loja, Tipo de loja, Possui loja física? e Principais marcas vendidas na sua loja.

Os campos de enriquecimento são Razão Social, Nome Fantasia, Situação Cadastral, Data de abertura, Tempo de CNPJ, Porte, CNAE, Descrição do CNAE, Endereço, Rua, Bairro e Número. Campos ausentes na fonte ficam vazios. `lib/lead-score.js` calcula a nota a partir do tipo de loja, loja física, estado e tempo de CNPJ. Dados básicos não pontuam. O log `lead_score_calculated` contém as parcelas, nota, status e motivos de desqualificação; o navegador também mostra esse detalhamento após o aceite.

O marcador existente, `teste mais lojistas` no começo do Nome da loja, ignora caixa, acentos e espaços excedentes. No workflow `6OBAnnId0mkMCL2p`, ele segue somente para a aba Leads - LP. Cadastros comuns seguem para a mesma planilha e para a notificação Evolution já autorizada. As 26 colunas, Score, URL e o helper interno whatsapp_e164 permanecem mapeados no workflow. Esta rota comercial de teste ainda grava dados: não é ambiente isolado para auditoria.

Marcadores não geram Lead/LeadQualificado no formulário, no helper de tracking ou na CAPI. A API assina um recibo com submission_id e classificação de teste derivada do Nome da loja; a CAPI confere a assinatura e a correlação antes de aceitar uma conversão. Uma flag pública is_test não altera essa classificação.

## Configuração e verificações

Secrets server-side em Production e Preview: `N8N_REPUBLIC_PARADISE_WEBHOOK_URL` e `CNPJ_PREFETCH_SIGNING_SECRET`. A chave de assinatura também assina recibos de aceite em um domínio criptográfico distinto do ticket CNPJ. A consulta central usa OIDC da equipe agencia-vfx; credenciais dos provedores permanecem na API central.

`npm ci`, `npm test`, `npm run lint` e `npm run build` verificam handlers, contratos e build. `npm run test:form` usa Chromium em desktop/mobile com todas as saídas de negócio interceptadas antes do carregamento. Inclui os 80 casos de telefone por viewport, teclas/clipboard reais, foco, edição, autofill, dupla submissão, recibos negativos, marcadores e dry-run. Nunca liberar as APIs reais para testar. Instalar o browser com `npx playwright install chromium` somente quando necessário.

Backup consiste somente nos logs correlacionados por submission_id: landing_form_attempt_backup, lead_delivery_backup, lead_enriched_payload e resultados de entrega. Não há banco, fila ou planilha adicional de backup. A recuperação depende da retenção da Vercel/drain/Axiom, cujo prazo e entrega precisam ser confirmados pelo responsável operacional antes de usar os logs para recuperar um envio. O processamento não oferece retry automático. Não reenviar um lead sem reconciliar efeitos já concluídos no n8n/planilha/WhatsApp.

O navegador mantém o mesmo submission_id em uma tentativa inconclusiva ou retry. Só confirma o cadastro quando recebe ok, accepted, delivery_scheduled, ID correspondente e recibo de tracking. Erro anterior ao aceite preserva os campos; erro posterior do webhook é registrado sem alterar a confirmação. O recibo não significa entrega final.

## WhatsApp e datas

Formulário e API compartilham os 67 DDDs brasileiros, números nacionais e +55/país sem máscara, com preservação do DDD 55. A máscara não corta colagens longas; digitação excedente após celular válido é ignorada, e edição inválida mantém o valor anterior com orientação. Fixo tem 10 dígitos nacionais e prefixo 2–5; celular tem 11 e começa por 9 após o DDD. Não há teste de existência/posse de conta WhatsApp.

Datas DD/MM/YYYY e YYYY-MM-DD usam o mesmo parser de calendário e aniversário no enriquecimento e no score. Data ausente, futura ou inválida não recebe idade padrão. Enriquecimento cadastral continua opcional, sem criar nova recusa por situação da empresa.

## Tipo de loja

O formulário e a API aceitam, nesta ordem: Boutique, Multimarcas, Loja de shopping, Loja física e online e Loja online. A opção Loja física e online recebe 40 pontos e não desqualifica pelo tipo, conforme decisão de Juliean em 15/10/2026. As demais condições de qualificação permanecem aplicáveis. Loja de bairro/tradicional, Revendedor(a) autônomo(a) e Magazine não são opções válidas para novos cadastros.

## Meta Pixel e Conversion API

`src/metaTracking.tsx` e `lib/meta-client.js` carregam o SDK oficial da Meta após o primeiro paint da hero. Não há SDK de Node dentro do bundle. PageView inicializa uma vez; Scroll 25/50/75/100 é registrado uma vez por limiar. O carregamento depois do visual pode deixar de registrar sessões extremamente curtas, sem remover os eventos.

Após aceite válido de `/api/leads`, o formulário confirma e reutiliza a consulta de CNPJ para o tracking. LeadQualificado mantém qualified:true e nota >=50; não há novo filtro de origem/UTM. Value e lead_score usam a mesma nota, inclusive zero no transporte. Os IDs são submission_id:Lead e submission_id:LeadQualificado, compartilhados entre Pixel e CAPI e deduplicados no cliente. Identificadores são preparados com SHA-256; o Pixel mantém Advanced Matching. Cadastro marcado não chama essas fronteiras.

`VITE_META_PIXEL_ID` é público; META_PIXEL_ID e META_API_ACCESS_TOKEN são usados no servidor. Nunca use prefixo VITE_ para token. META_TEST_EVENT_CODE é ignorado em Production. Arquivos reais de ambiente ficam fora do Git. A CAPI de Lead exige o recibo assinado da API; PageView/Scroll preservam o contrato anônimo de navegação.

`/api/meta/conversions` é servido pela Vercel em produção e pelo middleware do Vite no desenvolvimento. A rota registra `conversion_api_event_backup` antes da Meta, com ID, nome, dados preparados e presença dos identificadores. Falhas retornam 202 e geram `conversion_api_event_error` com os payloads recuperáveis, excluindo tokens. Um HTTP 202 confirma apenas o aceite da tentativa, sem comprovar recebimento pela Meta.

## Dry-run compartilhado

LP_DRY_RUN_ENABLED=1 habilita o modo no servidor para o ambiente correspondente; o padrão é desabilitado. GET /api/dry-run-status declara a capacidade do mesmo deployment. `?dry_run=1` exibe aviso marrom antes dos campos e só libera o teste após confirmar essa capacidade. Parâmetro inválido ou servidor indisponível não cai no cadastro normal.

A API confirma dry_run, skipped_webhook, skipped_persistence, skipped_lookup e skipped_meta antes de sucesso de teste. Sem consulta, log de payload, agendamento ou entrega. O payload completo fica somente no console do navegador após esse recibo, com qualificação not_evaluated. Pixel normal de PageView/Scroll permanece ativo; conversões de lead e CAPI ficam bloqueadas. A mensagem de teste não promete contato comercial.

Na CAPI, header X-VFX-Dry-Run:1 e aliases dry_run/dryRun/vfx_dry_run/skip_webhook aceitam true/1. Flag inválida falha fechada. Dry-run e marcador retornam antes de preparar/logar conversão normal. Logs de teste contêm apenas metadados.

## Assets e validação de publicação

As imagens originais permanecem em public. Hero usa WebP desktop e uma extração mobile que preserva object-position:30%; galeria usa WebP e lazy loading. Montserrat variável é servida localmente, com font-display:swap e licença OFL em public/fonts. Não há variação de conteúdo por PageSpeed/user-agent.

A primeira seção é pré-renderizada no build a partir de src/Hero.tsx. O navegador recebe o título, imagem e CTA no HTML e ativa o clique do CTA; o formulário continua usando seu fluxo atual. Fundos abaixo da dobra carregam sob demanda. O HTML é igual para todos os visitantes, sem detecção de auditor.

Após cada publicação, confirmar SHA/deployment/aliases, rotas, assets, Pixel PageView e PageSpeed no domínio final. A entrega real a n8n, Sheets, Evolution, Meta e Axiom só é declarada com recibos próprios e teste autorizado/isolado; build READY e mocks não comprovam esses destinos.
