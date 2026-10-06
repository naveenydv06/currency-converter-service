const amount = document.querySelector('#amount');
const from = document.querySelector('#from');
const to = document.querySelector('#to');
const result = document.querySelector('#result');
const status = document.querySelector('#status');
const form = document.querySelector('#converter');

const locale = navigator.language || 'en-US';
function populate(currencies) {
  for (const code of currencies) {
    const option = new Option(code, code);
    from.add(option.cloneNode(true)); to.add(option);
  }
  from.value = 'USD'; to.value = 'INR';
}
function money(value, currency) { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
async function convert(event) {
  event?.preventDefault();
  result.innerHTML = '<span>Converting…</span>';
  try {
    const response = await fetch(`/api/convert?amount=${encodeURIComponent(amount.value)}&from=${from.value}&to=${to.value}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    result.innerHTML = `<strong>${money(data.result, data.to)}</strong><small>${money(1, data.from)} = ${money(data.rate, data.to)}</small>`;
    status.textContent = `${data.source === 'live' ? 'Live' : data.source === 'cached' ? 'Cached' : 'Fallback'} rates · Updated ${new Date(data.updatedAt).toLocaleString()}`;
  } catch (error) { result.innerHTML = `<span class="error">${error.message}</span>`; }
}
document.querySelector('#swap').addEventListener('click', () => { [from.value, to.value] = [to.value, from.value]; convert(); });
form.addEventListener('submit', convert);
(async () => {
  try {
    const response = await fetch('/api/currencies'); const data = await response.json();
    if (!response.ok) throw new Error(); populate(data.currencies); status.textContent = 'Ready to convert'; convert();
  } catch { status.textContent = 'Could not load currencies. Please refresh.'; }
})();
