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

export const validPhone = value => {
  const phone = digits(value);
  const ddds = new Set([11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,49,51,53,54,55,61,62,63,64,65,67,68,69,71,73,74,75,77,79,81,82,83,84,85,87,88,89,91,92,93,94,95,96,97,98,99]);
  return ddds.has(Number(phone.slice(0,2))) && (phone.length === 10 || (phone.length === 11 && phone[2] === '9'))
    && /^\(?\d{2}\)? ?\d{4,5}-?\d{4}$/.test(value);
};
export function maskPhone(value) {
  const phone = digits(value).slice(0, 11);
  if (phone.length <= 2) return phone ? `(${phone}` : '';
  const local = phone.slice(2);
  const split = phone.length > 10 ? 5 : 4;
  return `(${phone.slice(0,2)}) ${local.slice(0,split)}${local.length > split ? `-${local.slice(split)}` : ''}`;
}
export function formatPhone(value) {
  const phone = digits(value);
  if (!validPhone(phone)) return '';
  return `(${phone.slice(0,2)}) ${phone.slice(2,-4)}-${phone.slice(-4)}`;
}

export const storeTypes = ['Boutique', 'Multimarcas', 'Loja de shopping', 'Loja online', 'Revendedor(a) autônomo(a)', 'Magazine'];
export const isTestLead = name => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase().startsWith('teste mais lojistas');
