import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  KEY_PREFIX, DEFAULT_DURATION, DEFAULT_OPACITY, DEFAULT_KEEP_DAYS,
  DEFAULT_AUTO_SCROLL, DEFAULT_EXPORT_TIMESTAMP, DEFAULT_EXPORT_DIALOG,
  DEFAULT_BORDERLESS, DEFAULT_BACKUP_ON, DEFAULT_AUTO_UPDATE, DEFAULT_TAG_DELIMITERS,
  DEFAULT_ZOOM, DEFAULT_FONT_FAMILY,
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

  return {
    defaultDuration, autoScroll, exportTimestamp, exportDialog,
    blockOpacity, bkCustomPath, borderless, keepDays, backupOn, autoUpdate, tagDelimiters,
    zoom, fontFamily,
    setDuration, setAutoScroll, setExportTimestamp, setExportDialog,
    setBlockOpacity, setBkCustomPath, setBorderless, setKeepDays, setBackupOn, setAutoUpdate, setTagDelimiters,
    setZoom, setFontFamily,
  }
})
