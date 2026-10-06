const express = require('express');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 3000);
const rateApi = process.env.RATES_API_URL || 'https://open.er-api.com/v6/latest/USD';
const cacheTtlMs = Number(process.env.RATES_CACHE_TTL_MS || 60 * 60 * 1000);

let cache = { data: null, fetchedAt: 0 };

const fallbackRates = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.1, JPY: 149.8, AUD: 1.53,
  CAD: 1.36, CHF: 0.88, CNY: 7.2, SGD: 1.34, AED: 3.67, BRL: 4.97
};

async function fetchUsdRates() {
  if (cache.data && Date.now() - cache.fetchedAt < cacheTtlMs) return cache.data;
  try {
    const response = await fetch(rateApi, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Rate provider returned ${response.status}`);
    const payload = await response.json();
    if (!payload.rates || typeof payload.rates !== 'object') throw new Error('Rate provider sent invalid data');
    cache = { data: { rates: payload.rates, updatedAt: payload.time_last_update_utc || new Date().toISOString(), source: 'live' }, fetchedAt: Date.now() };
    return cache.data;
  } catch (error) {
    console.warn(`Using fallback rates: ${error.message}`);
    if (cache.data) return { ...cache.data, source: 'cached' };
    return { rates: fallbackRates, updatedAt: new Date().toISOString(), source: 'fallback' };
  }
}

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.get('/api/currencies', async (_req, res, next) => {
  try {
    const data = await fetchUsdRates();
    res.json({ currencies: Object.keys(data.rates).sort(), updatedAt: data.updatedAt, source: data.source });
  } catch (error) { next(error); }
});

app.get('/api/convert', async (req, res, next) => {
  try {
    const amount = Number(req.query.amount);
    const from = String(req.query.from || '').toUpperCase();
    const to = String(req.query.to || '').toUpperCase();
    if (!Number.isFinite(amount) || amount < 0 || !from || !to) return res.status(400).json({ error: 'Provide a non-negative amount plus valid from and to currency codes.' });
    const data = await fetchUsdRates();
    if (!data.rates[from] || !data.rates[to]) return res.status(400).json({ error: 'One or both currency codes are not supported.' });
    const rate = data.rates[to] / data.rates[from];
    res.json({ amount, from, to, rate, result: amount * rate, updatedAt: data.updatedAt, source: data.source });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Unable to complete the request. Please try again.' });
});

app.listen(port, '0.0.0.0', () => console.log(`Currency Converter listening on port ${port}`));
