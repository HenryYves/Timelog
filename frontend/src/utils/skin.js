/**
 * @fileoverview 皮肤 & CSS 片段注入工具
 *
 * 职责：
 * - 首次启动安装内置皮肤模板（night.css + 图标）
 * - 皮肤 link 注入/移除/刷新
 * - CSS 片段 link 注入/移除/同步
 *
 * 非职责：皮肤路径解析（依赖 settings store，由调用方传入）
 */

import { invoke, convertFileSrc } from '@tauri-apps/api/core'

function isTauri() {
  return !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke)
}

/** 把皮肤目录路径转为可加载的 URL */
function assetUrl(dir, name) {
  if (isTauri()) return convertFileSrc(dir + '\\' + name + '.css')
  // 浏览器 dev 模式：public/skins/ 由 Vite 静态服务
  return '/skins/' + name + '.css'
}

/** 把片段目录路径转为可加载的 URL */
function snippetUrl(dir, name) {
  if (isTauri()) return convertFileSrc(dir + '\\' + name + '.css')
  return '/snippets/' + name + '.css'
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
 * @param {string} skinDir — 用户皮肤目录（绝对路径，如 C:\...\AppData\...\skins）
 */
export async function installSkinTemplates(skinDir) {
  if (!isTauri() || localStorage.getItem(INSTALLED_KEY)) return
  try {
    await invoke('scan_css_files', { path: skinDir }) // 确保目录存在
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

export function injectSkinLink(skinDir, skinName) {
  removeSkinLink()
  if (!skinName) return
  const link = document.createElement('link')
  link.id = 'skin-link'
  link.rel = 'stylesheet'
  link.href = assetUrl(skinDir, skinName)
  document.head.appendChild(link)
}

export function removeSkinLink() {
  const link = document.getElementById('skin-link')
  if (link) link.remove()
}

export function reloadSkinLink(skinDir, skinName) {
  const link = document.getElementById('skin-link')
  if (!skinName) {
    if (link) link.remove()
    return
  }
  const href = assetUrl(skinDir, skinName) + '?v=' + Date.now()
  if (!link) {
    const l = document.createElement('link')
    l.id = 'skin-link'
    l.rel = 'stylesheet'
    l.href = href
    document.head.appendChild(l)
  } else {
    link.href = href
  }
}

// ── CSS 片段 ──

export function injectSnippetLink(snippetDir, name) {
  removeSnippetLink(name)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.dataset.snippet = name
  link.href = snippetUrl(snippetDir, name)
  document.head.appendChild(link)
}

export function removeSnippetLink(name) {
  const link = document.querySelector(`link[data-snippet="${CSS.escape(name)}"]`)
  if (link) link.remove()
}

export function syncAllSnippetLinks(snippetDir, enabledNames) {
  document.querySelectorAll('link[data-snippet]').forEach(l => l.remove())
  for (const name of enabledNames) {
    injectSnippetLink(snippetDir, name)
  }
}
