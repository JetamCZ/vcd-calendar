const path = require('path');

const TIMEZONE = 'Europe/Prague';

// All Date math (parsing the program, formatting iCal times) uses local time,
// so the process must run in the theatre's timezone regardless of the host.
process.env.TZ = TIMEZONE;

const HOUR_MS = 60 * 60 * 1000;

module.exports = {
  TIMEZONE,
  PORT: Number(process.env.PORT ?? 3000),
  PUBLIC_DIR: path.join(__dirname, '..', 'public'),

  VCD_BASE_URL: 'https://www.vcd.cz/',
  CACHE_TTL_MS: HOUR_MS,

  CALENDAR_NAME: 'VČD Pardubice',
  DEFAULT_EVENT_DURATION_MS: 2 * HOUR_MS,

  MONTHS: { default: 6, min: 1, max: 24 },

  // Unofficial group assigned to performances offering a student discount.
  STUDENT_GROUP: 'STUDENT',

  SCENE_ADDRESSES: {
    'Městské divadlo': 'U Divadla 50, 530 02 Pardubice I - Zelené Předměstí, Česko',
    'Malá scéna ve dvoře': 'U Divadla 2703, 53002 Pardubice I - Zelené Předměstí, Česko',
  },
};
