import { KEY_PREFIX } from '../constants.js'

/**
 * Read tag delimiters from settings or use sensible defaults.
 */
export function getDelimiters() {
  const raw = localStorage.getItem(KEY_PREFIX + 'tagDelimiters')
  const chars = raw ? [...raw] : [',', '，', '.', '。', '、']
  return new Set([...chars, '\n', ' '])
}

/**
 * Given text and cursor offset, return the word to the left of cursor.
 * Stops at any delimiter character. Returns empty string if at start.
 */
export function getWordBeforeCursor(text, offset, delimiters) {
  if (!text || offset <= 0) return ''
  const d = delimiters || getDelimiters()
  let start = offset
  while (start > 0) {
    const ch = text[start - 1]
    if (d.has(ch)) break
    start--
  }
  return text.slice(start, offset)
}

/**
 * Given a word, tags array, and frequency map,
 * return the completion suffix for the best matching tag,
 * or null if no match or exact match.
 */
export function getTagHint(word, tags, tagFreq = {}) {
  if (!word) return null
  const matches = tags.filter(t => t.startsWith(word) && t !== word)
  if (!matches.length) return null
  matches.sort((a, b) => (tagFreq[b] || 0) - (tagFreq[a] || 0))
  return matches[0].slice(word.length)
}

/**
 * Get all completion candidates for a word, sorted by frequency descending.
 */
export function getAllCandidates(word, tags, tagFreq = {}) {
  if (!word) return []
  const matches = tags.filter(t => t.startsWith(word) && t !== word)
  matches.sort((a, b) => (tagFreq[b] || 0) - (tagFreq[a] || 0))
  return matches
}

/**
 * Increment frequency for a tag word.
 */
export function confirmTagInFreq(word, tagFreq) {
  tagFreq[word] = (tagFreq[word] || 0) + 1
}

/**
 * Load frequency map from localStorage.
 */
export function loadFreqFromStorage() {
  try {
    return JSON.parse(localStorage.getItem('timelog:tagFrequency') || '{}')
  } catch {
    return {}
  }
}

/**
 * Save frequency map to localStorage.
 */
export function saveFreqToStorage(tagFreq) {
  localStorage.setItem('timelog:tagFrequency', JSON.stringify(tagFreq))
}
