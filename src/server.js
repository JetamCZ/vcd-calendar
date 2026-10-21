const http = require('http');
const fs = require('fs');
const path = require('path');
const { PORT, PUBLIC_DIR, MONTHS } = require('./config');
const { fetchUpcomingEvents } = require('./vcd');
const { buildCalendar } = require('./ical');

const routes = {
  '/': staticFile('index.html', { 'Content-Type': 'text/html; charset=utf-8' }),
  '/logo.png': staticFile('logo.png', { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }),
  '/vcd-ical': calendarFeed,
  '/vcd-json': jsonFeed,
  '/json': jsonProgram,
};

function staticFile(name, headers) {
  return (req, res) => {
    res.writeHead(200, headers);
    res.end(fs.readFileSync(path.join(PUBLIC_DIR, name)));
  };
}

async function calendarFeed(req, res, query) {
  const events = await fetchFilteredEvents(query);
  res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
  res.end(buildCalendar(events, query));
}

async function jsonFeed(req, res, query) {
  const events = await fetchFilteredEvents(query);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(events, null, 2));
}

async function jsonProgram(req, res, query) {
  const events = await fetchUpcomingEvents(query.months);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(events, null, 2));
}

async function fetchFilteredEvents({ months, categories }) {
  const events = await fetchUpcomingEvents(months);
  if (categories.length === 0) return events;
  return events.filter((event) => event.groups.some((group) => categories.includes(group.toUpperCase())));
}

function parseQuery(params) {
  const flag = (name) => ['1', 'true'].includes(params.get(name));
  return {
    categories: (params.get('cat') ?? '')
      .split(',')
      .map((cat) => cat.trim().toUpperCase())
      .filter(Boolean),
    months: clamp(Number(params.get('months')) || MONTHS.default, MONTHS.min, MONTHS.max),
    allDay: flag('allday'),
    noAuthor: flag('noauthor'),
    prefix: params.get('prefix') ?? '',
  };
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = routes[url.pathname];
  if (!route) return res.writeHead(404).end();

  try {
    await route(req, res, parseQuery(url.searchParams));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'text/plain' }).end(String(err));
  }
}

if (require.main === module) {
  http.createServer(handleRequest).listen(PORT, () => {
    const base = `http://localhost:${PORT}`;
    console.log(`${base}/vcd-ical?cat=K,K1,P&months=6`);
    console.log(`${base}/vcd-json?cat=K,K1,P&months=6`);
    console.log(`${base}/vcd-json?cat=student&months=6`);
  });
}

module.exports = { handleRequest, parseQuery };
