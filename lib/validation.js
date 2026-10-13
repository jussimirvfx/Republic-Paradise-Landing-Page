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

export const validPhone = value => /^\d{10,11}$/.test(digits(value));
export function formatPhone(value) {
  const phone = digits(value);
  if (!validPhone(phone)) return '';
  return `(${phone.slice(0,2)}) ${phone.slice(2,-4)}-${phone.slice(-4)}`;
}

export const storeTypes = ['Loja física multimarcas', 'Loja em shopping', 'Boutique própria de rua', 'Loja somente online', 'Revendedor autônomo', 'Outro'];
export const isTestLead = name => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase().startsWith('teste mais lojistas');
