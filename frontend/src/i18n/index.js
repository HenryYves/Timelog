/**
 * @fileoverview i18n 核心：语言包注册/加载 + 响应式 STR facade + 带参文案 t() 插值。
 *
 * 导出：
 * - `STR`  纯文本文案的响应式对象（`reactive`）。模板里 `STR.group.key` 直接读，切语言自动重渲染。
 * - `t(key, params)`  带参文案取值。key 为**组限定全路径**（如 `'toast.copied'`），params 做 `{placeholder}` 插值。
 * - `lang` / `setLang` / `getLang` / `availableLangs` / `registerPack` / `initI18n`
 *
 * 语言包为**纯数据**（`i18n/locales/*.json`）。新增语言 = 加一个 JSON + 注册（P3 支持运行时文件注入）。
 *
 * 为什么 `STR` 用 Vue `reactive()` 而不是手写顶层 Proxy：需要同时覆盖**嵌套读取**
 * （`STR.stats.untagged`）与**整组对象外传**（StatsPanel 把整个 `STR.stats` 传给 computeCardsData），
 * 只有 `reactive()` 的深代理能让嵌套/子树读取都登记依赖。
 */
import { reactive, ref, watch } from 'vue'
import { KEY_PREFIX } from '../constants.js'
import zh from './locales/zh.json'
import en from './locales/en.json'

export const DEFAULT_LANG = 'zh'

// 模块加载即读取持久化语言 —— 保证首屏与"默认标签种子"用对语言，不依赖 initI18n 的调用时机
function readPersistedLang() {
  try { return localStorage.getItem(KEY_PREFIX + 'language') || DEFAULT_LANG } catch { return DEFAULT_LANG }
}

// 已注册的语言包（P3 文件注入时用 registerPack 追加）
const PACKS = { zh, en }

// 语言显示名（供设置下拉）
const LANG_LABELS = { zh: '中文', en: 'English' }

/** 当前语言码（初始值来自持久化设置） */
export const lang = ref(readPersistedLang())

/** 取当前语言码 */
export function getLang() { return lang.value }

// 语言包注册版本号：让 availableLangs() 具备响应式依赖（用户包注入后下拉能刷新）
const _packsRev = ref(0)

/** 可用语言列表 [{ code, label }]（响应式：读取 _packsRev 建立依赖） */
export function availableLangs() {
  _packsRev.value // eslint-disable-line no-unused-expressions
  return Object.keys(PACKS).map(code => ({ code, label: LANG_LABELS[code] || code }))
}

/** 注册/覆盖语言包（文件注入入口） */
export function registerPack(code, pack, label) {
  PACKS[code] = pack
  if (label) LANG_LABELS[code] = label
  _packsRev.value++
}

function isTauri() {
  return !!(typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke)
}

/** 用户语言文件夹默认路径（AppData 下 languages） */
export async function languagesDir() {
  const { invoke } = await import('@tauri-apps/api/core')
  const base = await invoke('get_default_asset_dir')
  return base + '\\languages'
}

/**
 * 从用户目录加载语言包（*.json），运行时注入 —— 用户不重编即可添加语言。
 * 文件名即语言码（如 ja.json → 'ja'）；可选 `_meta: { code, label }` 覆盖码与显示名。
 * 单个文件解析失败不影响其它；缺 key 时自动回退默认语言。
 * @param {string} [dir] 语言文件夹路径，缺省用 AppData\languages
 * @returns {Promise<string[]>} 成功注册的语言码
 */
export async function loadUserLangs(dir) {
  if (!isTauri()) return []
  const { invoke } = await import('@tauri-apps/api/core')
  const d = dir || await languagesDir()
  const added = []
  let names = []
  try { names = await invoke('scan_json_files', { path: d }) } catch { return [] }
  for (const name of names) {
    try {
      const raw = await invoke('read_file_text', { path: d + '\\' + name + '.json' })
      const pack = JSON.parse(raw)
      if (!pack || typeof pack !== 'object' || Array.isArray(pack)) continue
      const meta = pack._meta || {}
      delete pack._meta
      const code = meta.code || name
      registerPack(code, pack, meta.label || code)
      added.push(code)
    } catch { /* 跳过坏文件 */ }
  }
  return added
}

/** 按点分路径从语言包取值 */
function lookup(pack, key) {
  if (!pack) return undefined
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), pack)
}

/**
 * 带参文案取值：`t('toast.copied', { n: 3 })` → `"已复制 3 个"`
 * 缺失 key 时：dev 告警 → 回退默认语言 → 仍缺则返回 key 本身（便于发现）。
 */
export function t(key, params) {
  const raw = lookup(PACKS[lang.value], key) ?? lookup(PACKS[DEFAULT_LANG], key)
  if (raw == null) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`)
    return key
  }
  if (typeof raw !== 'string' || !params) return raw
  return raw.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m))
}

// ── 响应式 STR：纯文本读取用 ──
export const STR = reactive({})

// 深合并：over 覆盖 base；over 缺失的键回退 base（用户包可以是部分翻译）
function deepMerge(base, over) {
  if (Array.isArray(over)) return over
  if (over && typeof over === 'object' && base && typeof base === 'object' && !Array.isArray(base)) {
    const out = { ...base }
    for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k])
    return out
  }
  return over === undefined ? base : over
}

function applyLang(code) {
  const pack = PACKS[code] || PACKS[DEFAULT_LANG]
  // 以默认语言为底、当前语言覆盖 —— 保证部分翻译的包不会让 STR.x.y 变 undefined
  const merged = pack === PACKS[DEFAULT_LANG] ? pack : deepMerge(PACKS[DEFAULT_LANG], pack)
  for (const k of Object.keys(STR)) delete STR[k]
  Object.assign(STR, merged)
}

/** 手动切换语言（无效码回退默认） */
export function setLang(code) {
  lang.value = PACKS[code] ? code : DEFAULT_LANG
}

// 模块级同步监听：任何 lang 变更都立即应用，不依赖 initI18n 是否被调用
watch(() => lang.value, applyLang, { flush: 'sync' })

/**
 * 初始化 i18n。
 * @param {Object} [settings] settings store（含 `language` ref）
 * 传入后会跟随 `settings.language` 变化 —— 这样导入设置（reloadSettings 改语言）也能即时生效。
 */
export function initI18n(settings) {
  if (settings?.language && PACKS[settings.language]) lang.value = settings.language
  if (settings) {
    watch(() => settings.language, v => { if (v && PACKS[v]) lang.value = v })
  }
  return STR
}

// 模块加载即用当前语言填充 STR，保证模板首次渲染前就有值
applyLang(lang.value)
