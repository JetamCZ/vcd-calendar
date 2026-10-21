const { VCD_BASE_URL, CACHE_TTL_MS } = require('./config');
const { parseProgram } = require('./parser');

const cache = new Map();

async function fetchMonth(year, month) {
  const key = `${year}-${month}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.events;

  const url = `${VCD_BASE_URL}program/?month=${month}&year=${year}&scene=0&performance=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`vcd.cz ${res.status}`);

  const events = parseProgram(await res.text(), year, month);
  cache.set(key, { fetchedAt: Date.now(), events });
  return events;
}

/** Events for `count` months starting with the current one. */
async function fetchUpcomingEvents(count) {
  const now = new Date();
  const months = Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return fetchMonth(date.getFullYear(), date.getMonth() + 1);
  });
  return (await Promise.all(months)).flat();
}

module.exports = { fetchUpcomingEvents };
