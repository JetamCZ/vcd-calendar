const { TIMEZONE, CALENDAR_NAME, SCENE_ADDRESSES } = require('./config');

const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const formatDateTime = (d) => `${formatDate(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const formatClock = (d) => `${d.getHours()}:${pad(d.getMinutes())}`;

// RFC 5545 §3.3.11 TEXT escaping.
function escapeText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * @param {object} options
 * @param {boolean} [options.allDay]   all-day events, start time is prepended to the summary
 * @param {string}  [options.prefix]   text prepended to every summary
 * @param {boolean} [options.noAuthor] drop the author part ("Author / TITLE") from the title
 */
function buildCalendar(events, options = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//vcd-cal//CZ',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${CALENDAR_NAME}`,
    `X-WR-TIMEZONE:${TIMEZONE}`,
    ...events.flatMap((event) => buildEvent(event, options)),
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

function buildEvent(event, { allDay = false, prefix = '', noAuthor = false }) {
  return [
    'BEGIN:VEVENT',
    `UID:${event.id}@vcd.cz`,
    `DTSTAMP:${formatDateTime(new Date())}`,
    ...buildTimes(event, allDay),
    `SUMMARY:${escapeText(buildSummary(event, { allDay, prefix, noAuthor }))}`,
    `LOCATION:${escapeText(buildLocation(event.scene))}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `URL:${event.url}`,
    'END:VEVENT',
  ];
}

function buildTimes(event, allDay) {
  if (allDay) {
    const nextDay = new Date(event.start.getTime() + DAY_MS);
    return [`DTSTART;VALUE=DATE:${formatDate(event.start)}`, `DTEND;VALUE=DATE:${formatDate(nextDay)}`];
  }
  return [
    `DTSTART;TZID=${TIMEZONE}:${formatDateTime(event.start)}`,
    `DTEND;TZID=${TIMEZONE}:${formatDateTime(event.end)}`,
  ];
}

function buildSummary(event, { allDay, prefix, noAuthor }) {
  const title = noAuthor ? event.title.split('/').pop().trim() : event.title;
  const parts = [
    allDay && formatClock(event.start),
    title,
    event.groups.length > 0 && `(${event.groups.join(', ')})`,
  ];
  return prefix + parts.filter(Boolean).join(' ');
}

function buildLocation(scene) {
  const address = SCENE_ADDRESSES[scene];
  return address ? `${scene}, ${address}` : scene;
}

module.exports = { buildCalendar };
