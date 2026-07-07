import { logger } from './log.js'
import { DATA_DIR } from '../constants.js'

const TAURI = typeof window !== 'undefined' && window.__TAURI__

export function isTauri() { return !!TAURI }

/**
 * Get custom backup path from localStorage.
 * When set, file operations use absolute paths instead of AppData baseDir.
 */
function getCustomPath() {
  try {
    return localStorage.getItem('timelog:bkCustomPath') || ''
  } catch { return '' }
}

/**
 * Resolve file path and options for Tauri fs operations.
 * If bkCustomPath is set, use absolute path without baseDir.
 * Otherwise use relative path with AppData baseDir.
 */
function resolvePath(name) {
  const bk = getCustomPath()
  if (bk) {
    const base = bk.replace(/\\/g, '/')
    const file = name.replace(/\\/g, '/')
    return { path: base + '/' + file, options: {} }
  }
  return { path: name, options: { baseDir: TAURI.fs.BaseDirectory.AppData } }
}

export async function tRead(name) {
  if (!TAURI) return null
  try {
    const { path, options } = resolvePath(name)
    const data = await TAURI.fs.readTextFile(path, options)
    return data
  } catch (e) { logger.error('tauri', 'tRead failed', e); return null }
}

export async function tEnsureDir() {
  if (!TAURI) return
  try {
    const { path, options } = resolvePath(DATA_DIR)
    const exists = await TAURI.fs.exists(path, options)
    if (!exists) {
      await TAURI.fs.mkdir(path, { ...options, recursive: true })
    }
  } catch (e) { logger.error('tauri', 'tEnsureDir failed', e) }
}

export async function tWrite(name, text) {
  if (!TAURI) return
  try {
    await tEnsureDir()
    const { path, options } = resolvePath(name)
    await TAURI.fs.writeTextFile(path, text, options)
  } catch (e) { logger.error('tauri', 'tWrite failed', e) }
}

export async function tReadDir(dir) {
  if (!TAURI) return []
  try {
    const { path, options } = resolvePath(dir || '')
    const entries = await TAURI.fs.readDir(path, options)
    return entries.filter(e => e.name).map(e => e.name)
  } catch (e) { logger.error('tauri', 'tReadDir failed', e); return [] }
}

export async function tExport(name, text) {
  if (!TAURI) return false
  try {
    await TAURI.fs.writeTextFile(name, text, { baseDir: TAURI.fs.BaseDirectory.Download })
    return true
  } catch (e) { logger.error('tauri', 'tExport failed', e); return false }
}

export async function tRemove(name) {
  if (!TAURI) return
  try {
    const { path, options } = resolvePath(name)
    await TAURI.fs.remove(path, options)
  } catch (e) { logger.error('tauri', 'tRemove failed', e) }
}
