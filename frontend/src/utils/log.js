const MAX_LOGS = 200
const LOG_KEY = 'timelog:logs'

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }

function getLogs() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY)) || [] }
  catch { return [] }
}

function saveLogs(logs) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-MAX_LOGS))) }
  catch {}
}

function log(level, source, message, extra = null) {
  const entry = {
    t: new Date().toISOString(),
    l: level,
    s: source,
    m: message,
  }
  if (extra) entry.x = extra

  // Console output
  const prefix = `[${entry.t.slice(11, 19)}] [${level.toUpperCase()}] [${source}]`
  if (level === 'error') console.error(prefix, message, extra || '')
  else if (level === 'warn') console.warn(prefix, message, extra || '')
  else if (import.meta.env.DEV) console.log(prefix, message, extra || '')

  // localStorage buffer
  const logs = getLogs()
  logs.push(entry)
  saveLogs(logs)
}

export const logger = {
  debug: (s, m, x) => log('debug', s, m, x),
  info: (s, m, x) => log('info', s, m, x),
  warn: (s, m, x) => log('warn', s, m, x),
  error: (s, m, x) => log('error', s, m, x),
}

export function exportLogs() {
  const logs = getLogs()
  const text = logs.map(e => `[${e.t}] [${e.l.toUpperCase()}] [${e.s}] ${e.m}` + (e.x ? ' ' + JSON.stringify(e.x) : '')).join('\n')
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'timelog-debug-' + new Date().toISOString().slice(0, 10) + '.log'
  a.click(); URL.revokeObjectURL(url)
}
