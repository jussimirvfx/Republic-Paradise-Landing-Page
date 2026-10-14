const priorityStates = new Set(['SP','RJ','MG','RS','PR','SC','GO','DF','BA','PE','CE','ES','MT','MS','PB','RN','AL','SE','PI','MA','TO','PA','AM','RO','AC','RR','AP']);

const storeScores = {
  'Boutique': {points:40, label:'Boutique'},
  'Multimarcas': {points:40, label:'Multimarcas'},
  'Loja de shopping': {points:5, label:'Loja de shopping'},
  'Loja online': {points:5, label:'Loja online', disqualifies:true},
  'Revendedor(a) autônomo(a)': {points:1, label:'Revendedor(a) autônomo(a)', disqualifies:true},
  'Magazine': {points:5, label:'Magazine', disqualifies:true},
};

export function calculateLeadScore(form, company, now = new Date()) {
  const breakdown = [];
  const disqualificationReasons = [];
  const store = storeScores[form.tipoLoja];
  breakdown.push({criterion:'Tipo de loja', answer:store.label, points:store.points});
  if (store.disqualifies) disqualificationReasons.push(`Tipo de loja: ${store.label}`);

  const physical = form.possuiLojaFisica === 'Sim';
  breakdown.push({criterion:'Possui loja física', answer:form.possuiLojaFisica, points:physical ? 34 : 5});
  if (!physical) disqualificationReasons.push('Não possui loja física');

  const state = String(company?.endereco?.estado || '').trim().toUpperCase();
  breakdown.push({criterion:'Estado do CNPJ', answer:state || 'Não disponível', points:priorityStates.has(state) ? 1 : 0});

  const opening = company?.data_abertura;
  const isoDate = /^\d{2}\/\d{2}\/\d{4}$/.test(opening || '')
    ? opening.split('/').reverse().join('-') : opening;
  const opened = isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? new Date(`${isoDate}T00:00:00Z`) : null;
  if (opened && Number.isFinite(opened.getTime()) && opened <= now) {
    const years = now.getUTCFullYear() - opened.getUTCFullYear()
      - (now.getUTCMonth() < opened.getUTCMonth() || (now.getUTCMonth() === opened.getUTCMonth() && now.getUTCDate() < opened.getUTCDate()) ? 1 : 0);
    const age = years < 1 ? {answer:'Menos de 1 ano', points:10, disqualifies:true}
      : years < 3 ? {answer:'De 1 a 2 anos', points:15}
      : years < 5 ? {answer:'De 3 a 4 anos', points:20}
      : {answer:'5 anos ou mais', points:25};
    breakdown.push({criterion:'Tempo de CNPJ', ...age});
    if (age.disqualifies) disqualificationReasons.push('CNPJ com menos de 1 ano');
  } else {
    breakdown.push({criterion:'Tempo de CNPJ', answer:'Não disponível', points:0});
  }

  const leadScore = Math.min(100, breakdown.reduce((sum, item) => sum + item.points, 0));
  const pending = !state || !opened;
  return {
    lead_score:leadScore, value:leadScore, score_breakdown:breakdown,
    qualification_status:disqualificationReasons.length ? 'desqualificado' : pending ? 'pendente_dados_cnpj' : 'qualificado',
    disqualification_reasons:disqualificationReasons,
    qualified:disqualificationReasons.length === 0 && !pending,
  };
}
