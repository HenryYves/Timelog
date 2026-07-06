const TAURI = typeof window !== 'undefined' && window.__TAURI__

export function isTauri() { return !!TAURI }

export async function tRead(name) {
  if (!TAURI) return null
  try {
    const data = await TAURI.fs.readTextFile(name, { baseDir: TAURI.fs.BaseDirectory.AppData })
    return data
  } catch { return null }
}

export async function tWrite(name, text) {
  if (!TAURI) return
  try {
    await TAURI.fs.writeTextFile(name, text, { baseDir: TAURI.fs.BaseDirectory.AppData })
  } catch (e) { console.error('tWrite failed:', e) }
}

export async function tReadDir(dir) {
  if (!TAURI) return []
  try {
    const entries = await TAURI.fs.readDir(dir || '', { baseDir: TAURI.fs.BaseDirectory.AppData })
    return entries.filter(e => e.name).map(e => e.name)
  } catch { return [] }
}

export async function tRemove(name) {
  if (!TAURI) return
  try {
    await TAURI.fs.remove(name, { baseDir: TAURI.fs.BaseDirectory.AppData })
  } catch (e) { console.error('tRemove failed:', e) }
}
