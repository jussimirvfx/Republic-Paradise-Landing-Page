import { digits, isValidCnpj } from './validation.js';

const CENTRAL_URL = 'https://validador-cnpj.vfxaceleradordevendas.com.br/api/v1/cnpj';
const text = (...values) => String(values.find(v => v !== null && v !== undefined && String(v).trim()) ?? '').trim();

export function normalizeCompany(value = {}) {
  const address = value.endereco && typeof value.endereco === 'object' ? value.endereco : {};
  const status = text(value.situacao_cadastral, value.situacaoCadastral, value.descricao_situacao_cadastral);
  const statusLabels = {'1':'Nula','2':'Ativo','3':'Suspensa','4':'Inapta','8':'Baixada','02':'Ativo','03':'Suspensa','04':'Inapta','08':'Baixada'};
  const opening = text(value.data_abertura, value.data_inicio_atividade, value.dataInicioAtividade);
  const date = new Date(opening);
  const age = Number.isFinite(date.getTime()) ? Math.max(0, Math.floor((Date.now() - date.getTime()) / (365.25 * 86400000))) : null;
  const rua = text(address.rua, address.logradouro, value.rua, value.logradouro);
  const numero = text(address.numero, value.numero);
  const bairro = text(address.bairro, value.bairro);
  const cidade = text(address.cidade, address.municipio, value.cidade, value.municipio);
  const estado = text(address.estado, address.uf, value.estado, value.uf);
  const cep = text(address.cep, value.cep);
  return {
    razao_social: text(value.razao_social, value.razaoSocial),
    nome_fantasia: text(value.nome_fantasia, value.nomeFantasia),
    situacao_cadastral: statusLabels[status] || status,
    data_abertura: opening,
    tempo_cnpj: text(value.tempo_cnpj, value.tempoCnpj, age === null ? '' : `${age} anos`),
    porte: text(value.porte),
    cnae_principal: text(value.cnae_principal, value.cnae_fiscal, value.cnaePrincipal),
    descricao_cnae_principal: text(value.descricao_cnae_principal, value.cnae_fiscal_descricao, value.cnaePrincipalDescricao, value.cnae_descricao),
    endereco: {rua, numero, bairro, cidade, estado, cep,
      completo: text(address.completo, value.endereco_completo, typeof value.endereco === 'string' ? value.endereco : '', [rua,numero,bairro,cidade,estado,cep].filter(Boolean).join(', '))},
  };
}

export async function lookupCnpj(req, value, {fetchImpl = fetch, environment = process.env, logger = console} = {}) {
  const cnpj = digits(value);
  const unavailable = {cnpj, cnpj_valido: isValidCnpj(cnpj), encontrado: false, fonte: '', motivo: 'Consulta cadastral indisponível.', fontes_consultadas: [], company: null, cnpj_validation_status: 'checksum_valid'};
  if (!isValidCnpj(cnpj)) return {...unavailable, motivo: 'CNPJ inválido.', cnpj_validation_status: 'invalid'};
  // Authorization from browser code is deliberately ignored.
  const token = req.headers?.['x-vercel-oidc-token'] || environment.VERCEL_OIDC_TOKEN;
  if (!token) return unavailable;
  try {
    const response = await fetchImpl(CENTRAL_URL, {
      method: 'POST', cache: 'no-store',
      headers: {'Content-Type':'application/json', Authorization:`Bearer ${token}`, 'X-VFX-Landing-ID':'republic-paradise-landing-page'},
      body: JSON.stringify({cnpj}), signal: AbortSignal.timeout(35000),
    });
    const central = await response.json();
    if (!response.ok || central.cnpj_valido !== true || central.encontrado !== true) return unavailable;
    const company = normalizeCompany(central.company ?? {});
    if (!company.razao_social && !company.nome_fantasia) return unavailable;
    return {...unavailable, encontrado: true, fonte: text(central.fonte), motivo: '',
      fontes_consultadas: central.fontes_consultadas ?? [], company, cnpj_validation_status:'cadastral_valid'};
  } catch (error) {
    logger.warn(JSON.stringify({event:'cnpj_lookup_failed', error_name:error.name}));
    return unavailable;
  }
}
