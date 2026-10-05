process.env.TZ = 'Europe/Prague';
const http = require('http');
const fs = require('fs');

const BASE = 'https://www.vcd.cz/';
const CACHE_TTL = 60 * 60 * 1000;
const cache = new Map();
const ADDRESS = {
  'Městské divadlo': 'U Divadla 50, 530 02 Pardubice I - Zelené Předměstí, Česko',
  'Malá scéna ve dvoře': 'U Divadla 2703, 53002 Pardubice I - Zelené Předměstí, Česko',
};

const decode = (s) => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
  .replace(/\s+/g, ' ').trim();

function parse(html, year, month) {
  const events = [];
  for (const section of html.split(/<h2>/).slice(1)) {
    const scene = decode(section.slice(0, section.indexOf('</h2>'))).split('–').pop().trim();
    const blocks = section.split(/<!-- (\d+) -->/);
    for (let i = 1; i < blocks.length; i += 2) {
      const id = blocks[i], b = blocks[i + 1];
      const day = b.match(/class="td two">\s*<span>\s*(\d+)\./)?.[1];
      const time = b.match(/class="td three">[\s\S]*?(\d{1,2}):(\d{2})/);
      const title = b.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1];
      if (!day || !time || !title) continue;
      const group = decode(b.match(/class="bigger">([\s\S]*?)<\/span>/)?.[1] ?? '');
      const groups = [group, /slevu pro studenty/i.test(b) && 'STUDENT'].filter(Boolean);
      const end = b.match(/konec v&nbsp;(\d{1,2}):(\d{2})/);
      const slug = b.match(/href\s*=\s*"(inscenace\/[^"]+)"/)?.[1];
      const start = new Date(year, month - 1, +day, +time[1], +time[2]);
      events.push({
        id, scene, groups, start,
        end: end ? new Date(year, month - 1, +day, +end[1], +end[2]) : new Date(start.getTime() + 2 * 3600e3),
        title: decode(title),
        description: decode(b.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? ''),
        url: slug ? BASE + slug : BASE + 'program/',
      });
    }
  }
  return events;
}

async function fetchMonth(year, month) {
  const key = `${year}-${month}`;
  const hit = cache.get(key);
  if (hit && hit.at > Date.now() - CACHE_TTL) return hit.events;
  const res = await fetch(`${BASE}program/?month=${month}&year=${year}&scene=0&performance=0`);
  if (!res.ok) throw new Error(`vcd.cz ${res.status}`);
  const events = parse(await res.text(), year, month);
  cache.set(key, { at: Date.now(), events });
  return events;
}

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const fmt = (d) => `${fmtDate(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const hm = (d) => `${d.getHours()}:${pad(d.getMinutes())}`;
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

function ical(events, { allDay = false, prefix = '', noAuthor = false } = {}) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//vcd-cal//CZ', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:VČD Pardubice', 'X-WR-TIMEZONE:Europe/Prague',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@vcd.cz`,
      `DTSTAMP:${fmt(new Date())}`,
      ...(allDay
        ? [`DTSTART;VALUE=DATE:${fmtDate(e.start)}`, `DTEND;VALUE=DATE:${fmtDate(new Date(e.start.getTime() + 864e5))}`]
        : [`DTSTART;TZID=Europe/Prague:${fmt(e.start)}`, `DTEND;TZID=Europe/Prague:${fmt(e.end)}`]),
      `SUMMARY:${esc(prefix + [allDay && hm(e.start), noAuthor ? e.title.split('/').pop().trim() : e.title, e.groups.length && `(${e.groups.join(', ')})`].filter(Boolean).join(' '))}`,
      `LOCATION:${esc(ADDRESS[e.scene] ? `${e.scene}, ${ADDRESS[e.scene]}` : e.scene)}`,
      `DESCRIPTION:${esc(e.description)}`,
      `URL:${e.url}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(__dirname + '/index.html'));
  }
  if (url.pathname === '/logo.png') {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
    return res.end(fs.readFileSync(__dirname + '/logo.png'));
  }
  const json = url.pathname === '/vcd-json';
  if (!json && url.pathname !== '/vcd-ical') return res.writeHead(404).end();
  const cats = (url.searchParams.get('cat') ?? '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
  const flag = (name) => ['1', 'true'].includes(url.searchParams.get(name));
  const allDay = flag('allday');
  const noAuthor = flag('noauthor');
  const prefix = url.searchParams.get('prefix') ?? '';
  const months = Math.min(Math.max(+(url.searchParams.get('months') ?? 6) || 6, 1), 24);
  const now = new Date();
  try {
    const all = await Promise.all(Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return fetchMonth(d.getFullYear(), d.getMonth() + 1);
    }));
    const events = all.flat().filter((e) => !cats.length || e.groups.some((g) => cats.includes(g.toUpperCase())));
    if (json) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(events, null, 2));
    }
    res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    res.end(ical(events, { allDay, prefix, noAuthor }));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'text/plain' }).end(String(err));
  }
}

if (require.main === module) {
  const port = +(process.env.PORT ?? 3000);
  http.createServer(handler).listen(port, () => {
    console.log(`http://localhost:${port}/vcd-ical?cat=K,K1,P&months=6`)
    console.log(`http://localhost:${port}/vcd-json?cat=K,K1,P&months=6`)
    console.log(`http://localhost:${port}/vcd-json?cat=student&months=6`)
  })
}

module.exports = { parse, ical };
