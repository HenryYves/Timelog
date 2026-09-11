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
import zh from './locales/zh.json'

export const DEFAULT_LANG = 'zh'

// 已注册的语言包（P3 文件注入时用 registerPack 追加）
const PACKS = { zh }

// 语言显示名（供设置下拉）
const LANG_LABELS = { zh: '中文', en: 'English' }

/** 当前语言码 */
export const lang = ref(DEFAULT_LANG)

/** 取当前语言码 */
export function getLang() { return lang.value }

/** 可用语言列表 [{ code, label }] */
export function availableLangs() {
  return Object.keys(PACKS).map(code => ({ code, label: LANG_LABELS[code] || code }))
}

/** 注册/覆盖语言包（P3 文件注入入口） */
export function registerPack(code, pack, label) {
  PACKS[code] = pack
  if (label) LANG_LABELS[code] = label
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

function applyLang(code) {
  const pack = PACKS[code] || PACKS[DEFAULT_LANG]
  for (const k of Object.keys(STR)) delete STR[k]
  Object.assign(STR, pack)
}

/** 手动切换语言（无效码回退默认） */
export function setLang(code) {
  lang.value = PACKS[code] ? code : DEFAULT_LANG
}

/**
 * 初始化 i18n。
 * @param {Object} [settings] settings store（含 `language` ref）
 * 传入后会跟随 `settings.language` 变化 —— 这样导入设置（reloadSettings 改语言）也能即时生效。
 */
export function initI18n(settings) {
  if (settings?.language && PACKS[settings.language]) lang.value = settings.language
  watch(() => lang.value, applyLang, { immediate: true })
  if (settings) {
    watch(() => settings.language, v => { if (v && PACKS[v]) lang.value = v })
  }
  return STR
}

// 模块加载即用默认语言填充 STR，保证模板首次渲染前就有值
applyLang(DEFAULT_LANG)
