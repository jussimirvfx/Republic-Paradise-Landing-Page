import { test, expect, Page } from '@playwright/test';

async function prepare(page:Page, lookup:any = {ok:true,ticket:'signed-server-ticket'}) {
  await page.route('**/*', async route => {
    const url=new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (url.pathname === '/api/cnpj') return route.fulfill({json:lookup});
    return route.continue();
  });
  await page.goto('/');
  await expect(page).toHaveTitle('Republic Paradise — B2B Moda Resort');
}
async function fillForm(page:Page) {
  await page.getByPlaceholder('Seu nome completo').fill('TESTE Republic');
  await page.getByPlaceholder('Ex: Boutique Paradise').fill('Teste Mais Lojistas - Republic');
  await page.getByPlaceholder('(00) 00000-0000').fill('(11) 90000-0000');
  await page.getByPlaceholder('contato@sualoja.com.br').fill('teste@example.invalid');
  await page.getByPlaceholder('00.000.000/0000-00').fill('60887522000189');
  await page.getByPlaceholder('@sualoja',{exact:true}).fill('@teste');
  await page.locator('select').nth(0).selectOption('Boutique');
  await page.locator('select').nth(1).selectOption('Sim');
  await page.getByPlaceholder('Ex: Farm, Animale, Osklen, marcas autorais locais...').fill('Marca fictícia');
}

test('máscara, checksum imediato, incompleto no blur e CNPJ válido silencioso',async({page})=>{
  let posts=0;
  await prepare(page);
  await page.route('**/api/leads',route=>{posts++;return route.fulfill({json:{ok:true}});});
  const input=page.getByPlaceholder('00.000.000/0000-00');
  await input.fill('60887522000188');await expect(page.getByText('CNPJ inválido. Confira os números informados.')).toBeVisible();
  await input.fill('00000000000000');await expect(input).toHaveAttribute('aria-invalid','true');
  await input.fill('6088');await input.blur();await expect(page.getByText('Informe os 14 números do CNPJ.')).toBeVisible();
  await input.fill('');await input.pressSequentially('60887522000189');await expect(input).toHaveValue('60.887.522/0001-89');
  await expect(page.locator('#cnpj-error')).toHaveCount(0);await expect(input).toBeFocused();
  await page.waitForTimeout(100);await expect(page.locator('#cnpj-error')).toHaveCount(0);
  expect(posts).toBe(0);
});

test('CTA, lookup e validação não tiram o foco do campo escolhido',async({page})=>{
  await prepare(page);
  await expect(page.locator('#tipoLoja option')).toHaveText(['Selecione o formato da sua loja','Boutique','Multimarcas','Loja de shopping','Loja online','Revendedor(a) autônomo(a)','Magazine']);
  await page.getByRole('button',{name:'Quero receber o catálogo',exact:true}).first().click({force:true});
  const name=page.getByPlaceholder('Seu nome completo');
  await name.click();await name.fill('Texto preservado');await page.waitForTimeout(1000);await expect(name).toBeFocused();
  await fillForm(page);
  await page.getByPlaceholder('00.000.000/0000-00').fill('60887522000188');
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.locator('#cnpj')).toBeFocused();
  await name.click();await name.fill('Outro texto');await page.waitForTimeout(1000);await expect(name).toBeFocused();await expect(name).toHaveValue('Outro texto');
  await page.locator('#cnpj').fill('60887522000189');await name.click();await name.fill('Depois da consulta');
  await page.waitForTimeout(200);await expect(name).toBeFocused();await expect(name).toHaveValue('Depois da consulta');
});

test('confirmação somente após aceite da API, com todos os campos e ticket',async({page})=>{
  await prepare(page);await fillForm(page);
  let release:any;let captured:any;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/leads',async route=>{captured=route.request().postDataJSON();await pending;await route.fulfill({json:{ok:true,accepted:true}});});
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.getByText('Enviando cadastro...')).toBeVisible();
  await expect(page.getByText('Nossa equipe comercial entrará em contato pelo WhatsApp.',{exact:true})).toHaveCount(0);
  await expect.poll(()=>captured?.cnpj_ticket).toBe('signed-server-ticket');
  expect(Object.keys(captured)).toEqual(expect.arrayContaining(['nomeProprietario','nomeLoja','whatsapp','email','cnpj','instagramLoja','tipoLoja','possuiLojaFisica','principaisMarcas']));
  release();await expect(page.getByText('Nossa equipe comercial entrará em contato pelo WhatsApp.',{exact:true})).toBeVisible();
});

test('falhas da consulta são silenciosas; falha de envio preserva respostas para retry',async({page})=>{
  await prepare(page,{ok:true,encontrado:false,ticket:'signed-unavailable-ticket'});await fillForm(page);
  let count=0;
  await page.route('**/api/leads',route=>route.fulfill({status:++count===1?503:200,json:{ok:count>1}}));
  await expect(page.locator('#cnpj-error')).toHaveCount(0);
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.getByText('Não foi possível enviar seu cadastro. Seus dados foram mantidos; tente novamente.')).toBeVisible();
  await expect(page.getByPlaceholder('Seu nome completo')).toHaveValue('TESTE Republic');
  await expect(page.locator('#cnpj-error')).toHaveCount(0);
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.getByText('Nossa equipe comercial entrará em contato pelo WhatsApp.',{exact:true})).toBeVisible();
});

test('CNPJ inválido e telefone curto não chegam à API',async({page})=>{
  await prepare(page);await fillForm(page);let posts=0;
  await page.route('**/api/leads',route=>{posts++;return route.fulfill({json:{ok:true}});});
  await page.locator('#cnpj').fill('60887522000188');
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();expect(posts).toBe(0);
  await page.locator('#cnpj').fill('60887522000189');await page.locator('#whatsapp').fill('123');
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.getByText('Informe um DDD válido e 8 números, ou 9 números começando por 9.').first()).toBeVisible();expect(posts).toBe(0);
});

test('todos os campos exigidos mostram o erro e levam ao campo',async({page})=>{
  await prepare(page);
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.locator('#nomeProprietario')).toBeFocused();
  await expect(page.getByText('Nome completo proprietário: preenchimento obrigatório.')).toBeVisible();
  await fillForm(page);
  await page.locator('#principaisMarcas').fill('');
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.locator('#principaisMarcas')).toBeFocused();
  await expect(page.getByText('Principais marcas vendidas na sua loja: preenchimento obrigatório.')).toBeVisible();
});
