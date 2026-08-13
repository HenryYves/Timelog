/**
 * @fileoverview 皮肤 & CSS 片段注入工具
 *
 * 职责：
 * - 首次启动安装内置皮肤模板（night.css + 图标）
 * - 皮肤 <style> 注入/移除/刷新（读文件 + URL 重写）
 * - CSS 片段 <style> 注入/移除/同步
 *
 * 非职责：皮肤路径解析（依赖 settings store，由调用方传入）
 */

import { invoke } from '@tauri-apps/api/core'

function isTauri() {
  return !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke)
}

/** 将 CSS 中相对 url() 替换为内嵌 data URI（读文件 base64 编码） */
async function resolveUrls(css, dir) {
  const urls = [], re = /url\(["']?([^"')]+)["']?\)/g
  let m
  while ((m = re.exec(css))) {
    const p = m[1].trim()
    if (!/^(data:|https?:|\/|[A-Za-z]:)/.test(p)) urls.push(p)
  }
  if (!urls.length) return css
  const results = await Promise.all(urls.map(async p => {
    try {
      const svg = await invoke('read_file_text', { path: dir + '\\' + p })
      return [p, `url(data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))})`]
    } catch { return null }
  }))
  let out = css
  for (const r of results) {
    if (!r) continue
    out = out.split(`url(${r[0]})`).join(r[1]).split(`url("${r[0]}")`).join(r[1]).split(`url('${r[0]}')`).join(r[1])
  }
  return out
}

const INSTALLED_KEY = 'timelog:skinInstalled'

const TEMPLATE_FILES = [
  'night.css',
  'night/icon/paw_night.svg',
  'night/icon/win-min_night.svg',
  'night/icon/win-close_night.svg',
  'night/icon/win-max_night.svg',
  'night/icon/win-restore_night.svg',
]

/**
 * 首次启动时将皮肤模板从 /skin-template/ 复制到用户数据目录的 skins/ 下。
 */
export async function installSkinTemplates(skinDir) {
  if (!isTauri() || localStorage.getItem(INSTALLED_KEY)) return
  try {
    await invoke('scan_css_files', { path: skinDir })
    for (const file of TEMPLATE_FILES) {
      const resp = await fetch('/skin-template/' + file)
      if (resp.ok) {
        const content = await resp.text()
        await invoke('write_file_text', { path: skinDir + '\\' + file, content })
      }
    }
    localStorage.setItem(INSTALLED_KEY, '1')
  } catch { /* 首次安装失败不阻塞启动 */ }
}

// ── 皮肤 ──

export async function injectSkinStyle(skinDir, skinName) {
  removeSkinStyle()
  if (!skinName || !isTauri()) return
  try {
    const path = skinDir + '\\' + skinName + '.css'
    let css = await invoke('read_file_text', { path })
    css = await resolveUrls(css, skinDir)
    const style = document.createElement('style')
    style.id = 'skin-style'
    style.textContent = css
    // 皮肤样式插到片段样式之前，保持「皮肤 < 片段」的覆盖优先级
    const firstSnippet = document.querySelector('style[data-snippet]')
    if (firstSnippet) {
      document.head.insertBefore(style, firstSnippet)
    } else {
      document.head.appendChild(style)
    }
  } catch { /* 文件读取失败，跳过 */ }
}

export function removeSkinStyle() {
  const s = document.getElementById('skin-style')
  if (s) s.remove()
}

export async function reloadSkinStyle(skinDir, skinName) {
  removeSkinStyle()
  if (!skinName || !isTauri()) return
  await injectSkinStyle(skinDir, skinName)
}

// ── CSS 片段 ──

export async function injectSnippetStyle(snippetDir, name) {
  removeSnippetStyle(name)
  if (!isTauri()) return
  try {
    const path = snippetDir + '\\' + name + '.css'
    let css = await invoke('read_file_text', { path })
    css = await resolveUrls(css, snippetDir)
    const style = document.createElement('style')
    style.dataset.snippet = name
    style.textContent = css
    document.head.appendChild(style)
  } catch { /* 文件读取失败，跳过 */ }
}

export function removeSnippetStyle(name) {
  const s = document.querySelector(`style[data-snippet="${CSS.escape(name)}"]`)
  if (s) s.remove()
}

export function syncAllSnippetStyles(snippetDir, enabledNames) {
  document.querySelectorAll('style[data-snippet]').forEach(s => s.remove())
  for (const name of enabledNames) {
    injectSnippetStyle(snippetDir, name)
  }
}
