const { VCD_BASE_URL, DEFAULT_EVENT_DURATION_MS, STUDENT_GROUP } = require('./config');

// Everything that depends on vcd.cz markup lives here; update these when the site changes.
const PATTERNS = {
  // The page also has a "VČD DOPORUČUJE" sidebar (#mainr) with other performances; it must not
  // leak into the last event's block.
  programList: /<section id="mainl">([\s\S]*?)<\/section>/,
  eventSeparator: /<!-- (\d+) -->/,
  day: /class="td two">\s*<span>\s*(\d+)\./,
  startTime: /class="td three">[\s\S]*?(\d{1,2}):(\d{2})/,
  endTime: /konec v&nbsp;(\d{1,2}):(\d{2})/,
  title: /<h3[^>]*>([\s\S]*?)<\/h3>/,
  group: /class="bigger">([\s\S]*?)<\/span>/,
  description: /<p>([\s\S]*?)<\/p>/,
  slug: /href\s*=\s*"(inscenace\/[^"]+)"/,
  studentDiscount: /slevu pro studenty/i,
};

function htmlToText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function matchText(block, pattern) {
  const html = block.match(pattern)?.[1];
  return html === undefined ? undefined : htmlToText(html);
}

function matchTime(block, pattern) {
  const match = block.match(pattern);
  return match && { hours: Number(match[1]), minutes: Number(match[2]) };
}

/** Parses one month of the vcd.cz program page into a list of events. */
function parseProgram(html, year, month) {
  const programList = html.match(PATTERNS.programList)?.[1];
  if (programList === undefined) throw new Error('vcd.cz program list not found, markup changed?');

  return programList
    .split('<h2>')
    .slice(1)
    .flatMap((section) => parseSceneSection(section, year, month));
}

function parseSceneSection(section, year, month) {
  // Heading looks like "Říjen 2026 – Městské divadlo".
  const scene = htmlToText(section.slice(0, section.indexOf('</h2>'))).split('–').pop().trim();

  // split() with a capture group yields [before, id, block, id, block, ...].
  const parts = section.split(PATTERNS.eventSeparator);
  const events = [];
  for (let i = 1; i < parts.length; i += 2) {
    const event = parseEvent(parts[i], parts[i + 1], { scene, year, month });
    if (event) events.push(event);
  }
  return events;
}

function parseEvent(id, block, { scene, year, month }) {
  const day = block.match(PATTERNS.day)?.[1];
  const startTime = matchTime(block, PATTERNS.startTime);
  const title = matchText(block, PATTERNS.title);
  if (!day || !startTime || !title) return null;

  const dateAt = ({ hours, minutes }) => new Date(year, month - 1, Number(day), hours, minutes);
  const start = dateAt(startTime);
  const endTime = matchTime(block, PATTERNS.endTime);

  return {
    id,
    scene,
    groups: parseGroups(block),
    start,
    end: endTime ? dateAt(endTime) : new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS),
    title,
    description: matchText(block, PATTERNS.description) ?? '',
    url: VCD_BASE_URL + (block.match(PATTERNS.slug)?.[1] ?? 'program/'),
  };
}

function parseGroups(block) {
  const groups = [];
  const group = matchText(block, PATTERNS.group);
  if (group) groups.push(group);
  if (PATTERNS.studentDiscount.test(block)) groups.push(STUDENT_GROUP);
  return groups;
}

module.exports = { parseProgram };
