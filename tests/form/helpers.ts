import { expect, Page, Route } from '@playwright/test';

export const accepted = (body:any) => ({ok:true,accepted:true,delivery_scheduled:true,submission_id:body.submission_id,tracking_receipt:'mock-accepted-receipt'});
export const dryReceipt = {ok:true,dry_run:true,skipped_webhook:true,skipped_persistence:true,skipped_meta:true,skipped_lookup:true};
export const acceptRoute = (route:Route) => route.fulfill({json:accepted(route.request().postDataJSON())});

export async function prepare(page:Page, lookup:any = {ok:true,ticket:'signed-server-ticket'}, path = '/', events:any[] = []) {
  await page.routeWebSocket('**/*',ws=>ws.close());
  page.on('popup',popup=>popup.close());
  await page.route('**/*', async route => {
    const url=new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (url.pathname === '/api/cnpj') return route.fulfill({json:lookup});
    if (url.pathname === '/api/dry-run-status') return route.fulfill({json:{ok:true,enabled:true}});
    if (url.pathname === '/api/meta/conversions') {events.push(route.request().postDataJSON());return route.fulfill({json:{success:true}});}
    if (url.pathname.startsWith('/api/')) return route.abort();
    if (route.request().method() !== 'GET') return route.abort();
    return route.continue();
  });
  await page.goto(path);
  await expect(page).toHaveTitle('Republic Paradise — B2B Moda Resort');
}
export async function fillForm(page:Page,storeName = 'Teste Mais Lojistas - Republic') {
  await page.getByPlaceholder('Seu nome completo').fill('TESTE Republic');
  await page.getByPlaceholder('Ex: Boutique Paradise').fill(storeName);
  await page.getByPlaceholder('(00) 00000-0000').fill('(11) 90000-0000');
  await page.getByPlaceholder('contato@sualoja.com.br').fill('teste@example.invalid');
  await page.getByPlaceholder('00.000.000/0000-00').fill('60887522000189');
  await page.getByPlaceholder('@sualoja',{exact:true}).fill('@teste');
  await page.locator('select').nth(0).selectOption('Boutique');
  await page.locator('select').nth(1).selectOption('Sim');
  await page.getByPlaceholder('Ex: Farm, Animale, Osklen, marcas autorais locais...').fill('Marca fictícia');
}
