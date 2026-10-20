export const digits = (value = '') => String(value).replace(/\D/g, '');

export function isValidCnpj(value) {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (base, weights) => {
    const remainder = [...base].reduce((sum, n, i) => sum + Number(n) * weights[i], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return Number(cnpj[12]) === digit(cnpj.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2])
    && Number(cnpj[13]) === digit(cnpj.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
}

export function maskCnpj(value) {
  return digits(value).slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function cnpjMessage(value) {
  const cnpj = digits(value);
  if (!cnpj) return '';
  if (cnpj.length !== 14) return 'Informe os 14 números do CNPJ.';
  return isValidCnpj(cnpj) ? '' : 'CNPJ inválido. Confira os números informados.';
}

export const brazilianDdds = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99]);
export function nationalPhone(value) {
  if (typeof value !== 'string' || !/^[+\d\s().-]*$/.test(value)) return '';
  const text = value.trim();
  const phone = digits(text);
  if (text.includes('+') && !/^\+55[\d\s().-]*$/.test(text)) return '';
  if (text.startsWith('+')) return phone.slice(2);
  if (!text.startsWith('(') && /^55\d{10,11}$/.test(phone)) return phone.slice(2);
  return phone;
}
export const validPhone = value => {
  const phone = nationalPhone(value);
  return brazilianDdds.has(Number(phone.slice(0,2))) && !/^(\d)\1+$/.test(phone)
    && ((phone.length === 10 && /^[2-5]/.test(phone.slice(2))) || (phone.length === 11 && phone[2] === '9'));
};
export function maskPhone(value) {
  if (typeof value !== 'string') return '';
  if (/^\+5?$/.test(value.trim())) return value.trim();
  const international = value.trim().startsWith('+');
  const phone = nationalPhone(value);
  const prefix = international ? '+55 ' : '';
  if (international && !phone) return '+55';
  if (phone.length > 11) return value;
  if (phone.length <= 2) return phone ? `${prefix}(${phone}` : '';
  const local = phone.slice(2);
  const split = phone.length > 10 ? 5 : 4;
  return `${prefix}(${phone.slice(0,2)}) ${local.slice(0,split)}${local.length > split ? `-${local.slice(split)}` : ''}`;
}
export function editPhone(value, previous = '', inputType = '') {
  const prefix = /^\+5?$/.test(value.trim());
  if (!prefix && (!/^[+\d\s().-]*$/.test(value) || (value.includes('+') && !value.trim().startsWith('+55')))) return {value:previous, error:'Use um telefone brasileiro com DDD ou +55.'};
  if (nationalPhone(value).length > 11) {
    if (inputType === 'insertText' && validPhone(previous) && digits(value).length === digits(previous).length + 1) return {value:previous, error:''};
    return {value:previous, error:'O telefone deve ter 10 ou 11 números nacionais, incluindo o DDD.'};
  }
  return {value:maskPhone(value), error:''};
}
export function formatPhone(value) {
  const phone = nationalPhone(value);
  if (!validPhone(value)) return '';
  return `(${phone.slice(0,2)}) ${phone.slice(2,-4)}-${phone.slice(-4)}`;
}
export const phoneE164 = value => validPhone(value) ? `+55${nationalPhone(value)}` : '';

export const storeTypes = ['Boutique', 'Multimarcas', 'Loja de shopping', 'Loja física e online', 'Loja online'];
export const isTestLead = name => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase().startsWith('teste mais lojistas');
