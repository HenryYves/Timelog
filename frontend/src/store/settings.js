import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  KEY_PREFIX, DEFAULT_DURATION, DEFAULT_OPACITY, DEFAULT_KEEP_DAYS,
  DEFAULT_AUTO_SCROLL, DEFAULT_EXPORT_TIMESTAMP, DEFAULT_EXPORT_DIALOG,
  DEFAULT_BORDERLESS, DEFAULT_BACKUP_ON, DEFAULT_AUTO_UPDATE, DEFAULT_TAG_DELIMITERS,
  DEFAULT_ZOOM, DEFAULT_FONT_FAMILY, DEFAULT_CHECK_BEFORE_CREATE, DEFAULT_COPY_AFTER_CREATE,
  DEFAULT_MARKDOWN_PREVIEW, DEFAULT_BATCH_MARKDOWN_PREVIEW, DEFAULT_TAB_TO_INDENT, DEFAULT_BATCH_TAB_TO_INDENT, DEFAULT_EDITOR_FONT_SIZE, DEFAULT_CUSTOM_CSS,
  DEFAULT_SHOW_BLOCK_TITLE, DEFAULT_SHOW_BLOCK_TIME, DEFAULT_SHOW_BLOCK_TAGS, DEFAULT_SHOW_BLOCK_NOTE, DEFAULT_SHOW_BLOCK_COLOR_BAR,
} from '../constants.js'

function loadNum(k, d) {
  const v = localStorage.getItem(KEY_PREFIX + k)
  return v != null ? parseInt(v) : d
}

function loadBool(k, d) {
  const v = localStorage.getItem(KEY_PREFIX + k)
  return v != null ? (v === '1') : d
}

export const useSettingsStore = defineStore('settings', () => {
  const defaultDuration = ref(loadNum('defaultDuration', DEFAULT_DURATION))
  const autoScroll = ref(loadBool('autoScroll', DEFAULT_AUTO_SCROLL))
  const exportTimestamp = ref(loadBool('exportTimestamp', DEFAULT_EXPORT_TIMESTAMP))
  const exportDialog = ref(loadBool('exportDialog', DEFAULT_EXPORT_DIALOG))
  const blockOpacity = ref(loadNum('blockOpacity', DEFAULT_OPACITY))
  const bkCustomPath = ref(localStorage.getItem(KEY_PREFIX + 'bkCustomPath') || '')
  const borderless = ref(loadBool('borderless', DEFAULT_BORDERLESS))
  const keepDays = ref(loadNum('keepDays', DEFAULT_KEEP_DAYS))
  const backupOn = ref(loadBool('backupOn', DEFAULT_BACKUP_ON))
  const autoUpdate = ref(loadBool('autoUpdate', DEFAULT_AUTO_UPDATE))
  const tagDelimiters = ref(localStorage.getItem(KEY_PREFIX + 'tagDelimiters') || DEFAULT_TAG_DELIMITERS)
  const zoom = ref(loadNum('zoom', DEFAULT_ZOOM))
  const fontFamily = ref(localStorage.getItem(KEY_PREFIX + 'fontFamily') || DEFAULT_FONT_FAMILY)
  const checkBeforeCreate = ref(loadBool('checkBeforeCreate', DEFAULT_CHECK_BEFORE_CREATE))
  const copyAfterCreate = ref(loadBool('copyAfterCreate', DEFAULT_COPY_AFTER_CREATE))
  const markdownPreview = ref(loadBool('markdownPreview', DEFAULT_MARKDOWN_PREVIEW))
  const batchMarkdownPreview = ref(loadBool('batchMarkdownPreview', DEFAULT_BATCH_MARKDOWN_PREVIEW))
  const tabToIndent = ref(loadBool('tabToIndent', DEFAULT_TAB_TO_INDENT))
  const batchTabToIndent = ref(loadBool('batchTabToIndent', DEFAULT_BATCH_TAB_TO_INDENT))
  const editorFontSize = ref(loadNum('editorFontSize', DEFAULT_EDITOR_FONT_SIZE))
  const customCss = ref(localStorage.getItem(KEY_PREFIX + 'customCss') || DEFAULT_CUSTOM_CSS)
  const showBlockTitle = ref(loadBool('showBlockTitle', DEFAULT_SHOW_BLOCK_TITLE))
  const showBlockTime = ref(loadBool('showBlockTime', DEFAULT_SHOW_BLOCK_TIME))
  const showBlockTags = ref(loadBool('showBlockTags', DEFAULT_SHOW_BLOCK_TAGS))
  const showBlockNote = ref(loadBool('showBlockNote', DEFAULT_SHOW_BLOCK_NOTE))
  const showBlockColorBar = ref(loadBool('showBlockColorBar', DEFAULT_SHOW_BLOCK_COLOR_BAR))

  function saveNum(k, v) { localStorage.setItem(KEY_PREFIX + k, String(v)) }
  function saveBool(k, v) { localStorage.setItem(KEY_PREFIX + k, v ? '1' : '0') }

  function setDuration(v) {
    defaultDuration.value = Math.max(1, parseInt(v) || DEFAULT_DURATION)
    saveNum('defaultDuration', defaultDuration.value)
  }

  function setAutoScroll(v) {
    autoScroll.value = v
    saveBool('autoScroll', v)
  }

  function setExportTimestamp(v) {
    exportTimestamp.value = v
    saveBool('exportTimestamp', v)
  }

  function setExportDialog(v) {
    exportDialog.value = v
    saveBool('exportDialog', v)
  }

  function setBlockOpacity(v) {
    blockOpacity.value = parseInt(v)
    saveNum('blockOpacity', v)
    return blockOpacity.value
  }

  function setBkCustomPath(v) {
    bkCustomPath.value = v || ''
    if (v) {
      localStorage.setItem(KEY_PREFIX + 'bkCustomPath', v)
    } else {
      localStorage.removeItem(KEY_PREFIX + 'bkCustomPath')
    }
  }

  function setBorderless(v) {
    borderless.value = v
    saveBool('borderless', v)
  }

  function setKeepDays(v) {
    keepDays.value = Math.max(0, parseInt(v) || 0)
    saveNum('keepDays', keepDays.value)
  }

  function setBackupOn(v) {
    backupOn.value = v
    saveBool('backupOn', v)
  }

  function setAutoUpdate(v) {
    autoUpdate.value = v
    saveBool('autoUpdate', v)
  }

  function setTagDelimiters(v) {
    tagDelimiters.value = v || DEFAULT_TAG_DELIMITERS
    localStorage.setItem(KEY_PREFIX + 'tagDelimiters', tagDelimiters.value)
  }

  function setZoom(v) {
    zoom.value = Math.max(25, Math.min(400, parseInt(v) || DEFAULT_ZOOM))
    saveNum('zoom', zoom.value)
  }

  function setFontFamily(v) {
    fontFamily.value = (v || '').trim()
    if (fontFamily.value) {
      localStorage.setItem(KEY_PREFIX + 'fontFamily', fontFamily.value)
    } else {
      localStorage.removeItem(KEY_PREFIX + 'fontFamily')
    }
  }

  function setCheckBeforeCreate(v) {
    checkBeforeCreate.value = v
    saveBool('checkBeforeCreate', v)
  }

  function setCopyAfterCreate(v) {
    copyAfterCreate.value = v
    saveBool('copyAfterCreate', v)
  }

  function setMarkdownPreview(v) { markdownPreview.value = v; saveBool('markdownPreview', v) }
  function setBatchMarkdownPreview(v) { batchMarkdownPreview.value = v; saveBool('batchMarkdownPreview', v) }
  function setTabToIndent(v) { tabToIndent.value = v; saveBool('tabToIndent', v) }
  function setBatchTabToIndent(v) { batchTabToIndent.value = v; saveBool('batchTabToIndent', v) }
  function setEditorFontSize(v) {
    editorFontSize.value = Math.max(10, Math.min(28, parseInt(v) || DEFAULT_EDITOR_FONT_SIZE))
    saveNum('editorFontSize', editorFontSize.value)
  }
  function setCustomCss(v) {
    customCss.value = (v || '').trim()
    if (customCss.value) { localStorage.setItem(KEY_PREFIX + 'customCss', customCss.value) }
    else { localStorage.removeItem(KEY_PREFIX + 'customCss') }
  }
  function setShowBlockTitle(v) { showBlockTitle.value = v; saveBool('showBlockTitle', v) }
  function setShowBlockTime(v) { showBlockTime.value = v; saveBool('showBlockTime', v) }
  function setShowBlockTags(v) { showBlockTags.value = v; saveBool('showBlockTags', v) }
  function setShowBlockNote(v) { showBlockNote.value = v; saveBool('showBlockNote', v) }
  function setShowBlockColorBar(v) { showBlockColorBar.value = v; saveBool('showBlockColorBar', v) }

  function reloadSettings() {
    defaultDuration.value = loadNum('defaultDuration', DEFAULT_DURATION)
    autoScroll.value = loadBool('autoScroll', DEFAULT_AUTO_SCROLL)
    exportTimestamp.value = loadBool('exportTimestamp', DEFAULT_EXPORT_TIMESTAMP)
    exportDialog.value = loadBool('exportDialog', DEFAULT_EXPORT_DIALOG)
    blockOpacity.value = loadNum('blockOpacity', DEFAULT_OPACITY)
    bkCustomPath.value = (localStorage.getItem(KEY_PREFIX + 'bkCustomPath') || '')
    borderless.value = loadBool('borderless', DEFAULT_BORDERLESS)
    keepDays.value = loadNum('keepDays', DEFAULT_KEEP_DAYS)
    backupOn.value = loadBool('backupOn', DEFAULT_BACKUP_ON)
    autoUpdate.value = loadBool('autoUpdate', DEFAULT_AUTO_UPDATE)
    tagDelimiters.value = localStorage.getItem(KEY_PREFIX + 'tagDelimiters') || DEFAULT_TAG_DELIMITERS
    zoom.value = loadNum('zoom', DEFAULT_ZOOM)
    fontFamily.value = (localStorage.getItem(KEY_PREFIX + 'fontFamily') || '')
    checkBeforeCreate.value = loadBool('checkBeforeCreate', DEFAULT_CHECK_BEFORE_CREATE)
    copyAfterCreate.value = loadBool('copyAfterCreate', DEFAULT_COPY_AFTER_CREATE)
    markdownPreview.value = loadBool('markdownPreview', DEFAULT_MARKDOWN_PREVIEW)
    batchMarkdownPreview.value = loadBool('batchMarkdownPreview', DEFAULT_BATCH_MARKDOWN_PREVIEW)
    tabToIndent.value = loadBool('tabToIndent', DEFAULT_TAB_TO_INDENT)
    batchTabToIndent.value = loadBool('batchTabToIndent', DEFAULT_BATCH_TAB_TO_INDENT)
    editorFontSize.value = loadNum('editorFontSize', DEFAULT_EDITOR_FONT_SIZE)
    customCss.value = (localStorage.getItem(KEY_PREFIX + 'customCss') || '')
    showBlockTitle.value = loadBool('showBlockTitle', DEFAULT_SHOW_BLOCK_TITLE)
    showBlockTime.value = loadBool('showBlockTime', DEFAULT_SHOW_BLOCK_TIME)
    showBlockTags.value = loadBool('showBlockTags', DEFAULT_SHOW_BLOCK_TAGS)
    showBlockNote.value = loadBool('showBlockNote', DEFAULT_SHOW_BLOCK_NOTE)
    showBlockColorBar.value = loadBool('showBlockColorBar', DEFAULT_SHOW_BLOCK_COLOR_BAR)
  }

  return {
    defaultDuration, autoScroll, exportTimestamp, exportDialog,
    blockOpacity, bkCustomPath, borderless, keepDays, backupOn, autoUpdate, tagDelimiters,
    zoom, fontFamily, checkBeforeCreate, copyAfterCreate,
    markdownPreview, batchMarkdownPreview, tabToIndent, batchTabToIndent, editorFontSize, customCss,
    setDuration, setAutoScroll, setExportTimestamp, setExportDialog,
    setBlockOpacity, setBkCustomPath, setBorderless, setKeepDays, setBackupOn, setAutoUpdate, setTagDelimiters,
    setZoom, setFontFamily, setCheckBeforeCreate, setCopyAfterCreate,
    showBlockTitle, showBlockTime, showBlockTags, showBlockNote, showBlockColorBar,
    setShowBlockTitle, setShowBlockTime, setShowBlockTags, setShowBlockNote, setShowBlockColorBar,
    setMarkdownPreview, setBatchMarkdownPreview, setTabToIndent, setBatchTabToIndent, setEditorFontSize, setCustomCss,
    reloadSettings,
  }
})
