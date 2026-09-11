/**
 * @fileoverview 界面文案出口（barrel）。实现见 `i18n/index.js`。
 *
 * 保留此模块作为稳定的导入路径：历史代码用 `import { STR } from './strings.js'`。
 * 带参文案请用 `t('group.key', { params })`（同样从此处导入）。
 */
export {
  STR,
  t,
  lang,
  setLang,
  getLang,
  availableLangs,
  registerPack,
  loadUserLangs,
  languagesDir,
  initI18n,
  DEFAULT_LANG,
} from './i18n/index.js'
