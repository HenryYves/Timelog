<template>
  <div class="grid">
    <div
      class="gutter"
      ref="gutterRef"
      :style="{ width: GUTTER_WIDTH + 'px', height: DAY_MIN * PX_MIN + 'px' }"
    >
      <div
        v-for="h in 25"
        :key="'h'+h"
        class="hlabel"
        :style="{ top: ((h-1) * 60 * PX_MIN) + 'px' }"
      >
        {{ String(h-1).padStart(2,'0') }}:00
      </div>
    </div>
    <div
      class="day"
      ref="dayRef"
      :style="{ height: DAY_MIN * PX_MIN + 'px' }"
      @mousedown="onDayMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @click.self="onDayClick"
      @contextmenu.prevent
    >
      <!-- Selection rectangle -->
      <div
        v-if="selRect"
        class="selrect"
        :style="{
          top: Math.min(selRect.top, selRect.bottom) + 'px',
          height: Math.abs(selRect.bottom - selRect.top) + 'px',
        }"
      />
      <!-- Hour lines -->
      <div
        v-for="h in 25"
        :key="'hl'+h"
        class="hourline"
        :style="{ top: ((h-1) * 60 * PX_MIN) + 'px' }"
      />
      <!-- Half-hour lines -->
      <div
        v-for="h in 24"
        :key="'hfl'+h"
        class="halfline"
        :style="{ top: ((h-1) * 60 + 30) * PX_MIN + 'px' }"
      />
      <!-- Time blocks -->
      <div
        v-for="ev in layoutBlocks"
        :key="ev.id"
        class="block"
        :class="{ bsel: selectedBlocks.has(ev.id) }"
        :style="computeBlockStyle(ev)"
        :title="blockTitle(ev)"
        @mousemove="onBlockMouseMove($event, ev)"
        @mousedown.left="onBlockMouseDown($event, ev)"
        @click="onBlockClick($event, ev)"
        @contextmenu.prevent="onBlockContextMenu(ev)"
      >
        <div v-if="settingsStore.showBlockColorBar" class="cbar">
          <i
            v-for="(t, ti) in (ev.tags || [])"
            :key="ti"
            :style="{ background: colorOf(t).hex }"
          />
          <i v-if="!ev.tags || !ev.tags.length" style="background:#C4C3C0" />
        </div>
        <div v-if="settingsStore.showBlockTitle" class="bt">{{ ev.title || '(未命名)' }}</div>
        <div
          v-if="settingsStore.showBlockTime && (ev.end - ev.start) * PX_MIN >= 32"
          class="bs"
        >
          {{ fmt(ev.start) }}–{{ fmt(ev.end) }}
        </div>
        <div
          v-if="settingsStore.showBlockTags && (ev.end - ev.start) * PX_MIN >= 50 && ev.tags && ev.tags.length"
          class="btags"
        >
          <span v-for="t in ev.tags" :key="t">
            <span class="tdot" :style="{ background: colorOf(t).hex }" />{{ t }}
          </span>
        </div>
        <div
          v-if="settingsStore.showBlockNote && ev.note && (ev.end - ev.start) * PX_MIN >= (ev.tags?.length ? 66 : 48)"
          class="bnote"
          v-html="mdToHtml(ev.note)"
        />
      </div>
      <!-- Now line (today only) -->
      <div
        v-if="isToday"
        class="nowline"
        :style="{ top: nowMin * PX_MIN + 'px' }"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTimelogStore, fmt, dkey, toInput, fromInput } from '../store/timelog.js'
import { useSettingsStore } from '../store/settings.js'
import { mdToHtml } from '../utils/markdown.js'
import { PX_MIN, DAY_MIN, EDGE, GUTTER_WIDTH } from '../constants.js'
import { useToast } from '../composables/useToast.js'
import { useConfirm } from '../composables/useConfirm.js'
import { STR } from '../strings.js'

const props = defineProps({
  modalOpen: { type: Boolean, default: false },
})
const store = useTimelogStore()
const { selectedBlocks, colorOf } = store
const settingsStore = useSettingsStore()
const emit = defineEmits(['edit-block', 'create-block'])
const { toast } = useToast()
const { showConfirm } = useConfirm()

const dayRef = ref(null)
const gutterRef = ref(null)

// --- Drag state (pure DOM — matches old code for per-frame drag precision) ---
let adrag = null
let ghost = null
let dlabel = null
// { type: 'create', anchor, cur }
// { type: 'resize', id, edge, other, cur, el }
const suppressClick = ref(false)

// --- Right-drag selection ---
const selRect = ref(null) // { top, bottom } in container px
let selPending = null // { clientY } — wait for drag threshold
let selMoved = false // true once drag threshold passed — suppress block toggle

// --- Hover tracking (for paste) ---
const lastHoverMin = ref(0)
const overGrid = ref(false)

// --- Now line ---
const isToday = computed(() => dkey(new Date()) === store.dateKey)
const nowMin = ref(0)
let nowTimer = null

function updateNowMin() {
  if (dkey(new Date()) === store.dateKey) {
    const now = new Date()
    nowMin.value = now.getHours() * 60 + now.getMinutes()
  } else {
    nowMin.value = 0
  }
}

// --- Layout algorithm (copied from old code) ---
function layout(list) {
  const evs = list.slice().sort((a, b) => a.start - b.start || a.end - b.end)
  let i = 0
  while (i < evs.length) {
    let j = i
    let ge = evs[i].end
    while (j + 1 < evs.length && evs[j + 1].start < ge) {
      j++
      ge = Math.max(ge, evs[j].end)
    }
    const grp = evs.slice(i, j + 1)
    const cols = []
    grp.forEach(ev => {
      let placed = false
      for (let c = 0; c < cols.length; c++) {
        if (ev.start >= cols[c]) {
          cols[c] = ev.end
          ev._col = c
          placed = true
          break
        }
      }
      if (!placed) {
        ev._col = cols.length
        cols.push(ev.end)
      }
    })
    grp.forEach(ev => (ev._cols = cols.length))
    i = j + 1
  }
  return evs
}

const layoutBlocks = computed(() => layout(store.blocks))

function computeBlockStyle(ev) {
  const has = ev.tags && ev.tags.length
  const c0 = colorOf(has ? ev.tags[0] : null)
  const top = ev.start * PX_MIN
  const height = Math.max((ev.end - ev.start) * PX_MIN, 16)
  const w = 100 / (ev._cols || 1)
  const left = (ev._col || 0) * w
  return {
    top: top + 'px',
    height: height + 'px',
    left: `calc(${left}% + 2px)`,
    width: `calc(${w}% - 4px)`,
    background: c0.bg,
    color: '#2C2C2B',
  }
}

function blockTitle(ev) {
  let t = fmt(ev.start) + '–' + fmt(ev.end) + '  ' + (ev.title || '')
  if (ev.tags?.length) t += '  [' + ev.tags.join(',') + ']'
  if (ev.note) t += '\n' + ev.note
  return t
}


// --- Mouse helpers ---
function yToMin(y) {
  const r = dayRef.value.getBoundingClientRect()
  return Math.max(0, Math.min(DAY_MIN, Math.round((y - r.top) / (settingsStore.zoom / 100) / PX_MIN)))
}

function dragBounds() {
  if (!adrag) return null
  if (adrag.type === 'create') {
    return {
      s: Math.min(adrag.anchor, adrag.cur),
      en: Math.max(adrag.anchor, adrag.cur),
    }
  }
  if (adrag.edge === 'start') {
    let s = Math.min(adrag.cur, adrag.other - 1)
    if (s < 0) s = 0
    return { s, en: adrag.other }
  }
  let en = Math.max(adrag.cur, adrag.other + 1)
  if (en > DAY_MIN) en = DAY_MIN
  return { s: adrag.other, en }
}

function activeMin() {
  if (!adrag) return 0
  const b = dragBounds()
  if (adrag.type === 'create') return adrag.cur
  return adrag.edge === 'start' ? b.s : b.en
}

function showDLabel(min, text) {
  if (!dlabel) {
    dlabel = document.createElement('div')
    dlabel.className = 'dlabel'
    dayRef.value.appendChild(dlabel)
  }
  dlabel.style.top = min * PX_MIN + 'px'
  dlabel.textContent = text
}
function hideDLabel() {
  if (dlabel) { dlabel.remove(); dlabel = null }
}

function applyDrag() {
  if (!adrag) return
  const b = dragBounds()
  if (adrag.type === 'create') {
    if (!ghost) {
      ghost = document.createElement('div')
      ghost.className = 'ghost'
      dayRef.value.appendChild(ghost)
    }
    ghost.style.top = b.s * PX_MIN + 'px'
    ghost.style.height = Math.max((b.en - b.s) * PX_MIN, 2) + 'px'
    ghost.style.left = '2px'
    ghost.style.right = '2px'
    ghost.textContent = fmt(b.s) + ' – ' + fmt(b.en)
  } else if (adrag.el) {
    adrag.el.style.top = b.s * PX_MIN + 'px'
    adrag.el.style.height = Math.max((b.en - b.s) * PX_MIN, 2) + 'px'
    adrag.el.classList.add('resizing')
  }
  showDLabel(activeMin(), fmt(b.s) + ' – ' + fmt(b.en) + '（' + (b.en - b.s) + 'm，↑↓微调）')
}

function endDrag(commit) {
  if (!adrag) return
  const b = dragBounds()
  const { type, id, el } = adrag
  if (ghost) { ghost.remove(); ghost = null }
  hideDLabel()
  if (el) el.classList.remove('resizing')
  document.body.style.cursor = ''
  const drag = adrag
  adrag = null
  if (!commit) return
  if (type === 'create') {
    if (b.en - b.s < 3) return
    emit('create-block', b.s, b.en)
  } else {
    const rec = store.blocks.find(x => x.id === id)
    if (rec) {
      store.updateBlock({ ...rec, start: b.s, end: b.en })
    }
    setTimeout(() => { suppressClick.value = false }, 60)
  }
}

// --- Event handlers ---
function onDayClick() {
  if (suppressClick.value) return
  if (store.selectedBlocks.size > 0) store.selectedBlocks.clear()
}

function onDayMouseDown(e) {
  // Right-click: pending selection drag (starts on mousemove past threshold)
  if (e.button === 2) {
    e.preventDefault()
    selPending = { clientY: e.clientY }
    return
  }
  if (e.button !== 0 || adrag) return
  const s = yToMin(e.clientY)
  adrag = { type: 'create', anchor: s, cur: s }
  applyDrag()
}

function onBlockMouseMove(e, _ev) {
  if (adrag) return
  const r = e.currentTarget.getBoundingClientRect()
  const y = e.clientY - r.top
  const ez = Math.min(EDGE, r.height / 2)
  e.currentTarget.style.cursor = (y <= ez || y >= r.height - ez) ? 'ns-resize' : 'pointer'
}

function onBlockMouseDown(e, ev) {
  if (e.button !== 0) return
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const y = e.clientY - r.top
  const ez = Math.min(EDGE, r.height / 2)
  let edge = null
  if (y <= ez) edge = 'start'
  else if (y >= r.height - ez) edge = 'end'
  if (edge) {
    e.stopPropagation()
    e.preventDefault()
    suppressClick.value = true
    document.body.style.cursor = 'ns-resize'
    adrag = {
      type: 'resize',
      id: ev.id,
      edge,
      other: edge === 'start' ? ev.end : ev.start,
      cur: edge === 'start' ? ev.start : ev.end,
      el: e.currentTarget,
    }
    applyDrag()
  }
}

function onMouseMove(e) {
  if (adrag) {
    adrag.cur = yToMin(e.clientY)
    applyDrag()
  }
  if (selPending) {
    const dy = Math.abs(e.clientY - selPending.clientY)
    if (dy > 3) {
      const r = dayRef.value.getBoundingClientRect()
      const z = settingsStore.zoom / 100
      const top = (selPending.clientY - r.top) / z
      const bottom = (e.clientY - r.top) / z
      selRect.value = { top, bottom }
      selPending = null
      selMoved = true
    }
    return
  }
  if (selRect.value) {
    const r = dayRef.value.getBoundingClientRect()
    const z = settingsStore.zoom / 100
    selRect.value = { ...selRect.value, bottom: (e.clientY - r.top) / z }
  }
  lastHoverMin.value = yToMin(e.clientY)
  overGrid.value = true
}

function onMouseUp() {
  if (adrag) {
    endDrag(true)
  }
  selPending = null
  selMoved = false
  if (selRect.value) {
    const sr = selRect.value
    selRect.value = null
    const t = Math.min(sr.top, sr.bottom)
    const b = Math.max(sr.top, sr.bottom)
    // Convert container px to minutes
    const z = settingsStore.zoom / 100
    const r = dayRef.value.getBoundingClientRect()
    const smin = yToMin(r.top + t * z)
    const smax = yToMin(r.top + b * z)
    store.blocks.forEach(bl => {
      if (bl.end > smin && bl.start < smax) {
        store.selectedBlocks.add(bl.id)
      }
    })
    if (store.selectedBlocks.size > 0) {
      toast(STR.toast.contextSelected(store.selectedBlocks.size))
    }
  }
  overGrid.value = false
}

function onBlockClick(e, ev) {
  if (e.target.closest('a')) return
  e.stopPropagation()
  if (suppressClick.value) {
    suppressClick.value = false
    return
  }
  emit('edit-block', ev)
}

function onBlockContextMenu(ev) {
  if (selMoved) return // area selection drag — don't toggle
  if (store.selectedBlocks.has(ev.id)) {
    store.selectedBlocks.delete(ev.id)
    if (store.selectedBlocks.size === 0) {
      toast(STR.toast.unselected)
    }
  } else {
    store.selectedBlocks.add(ev.id)
    toast(STR.toast.contextSelected(store.selectedBlocks.size))
  }
}

// --- Keyboard ---
function onKeyDown(e) {
  // Don't handle keyboard when modal is open
  if (props.modalOpen) return

  // During drag: arrow keys fine-tune, Escape cancels
  if (adrag) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      adrag.cur = Math.max(0, Math.min(DAY_MIN,
        adrag.cur + (e.key === 'ArrowUp' ? -1 : 1)))
      applyDrag()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      endDrag(false)
      return
    }
    return
  }

  // Ctrl+C / Ctrl+V
  if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
    if (store.copySelected()) {
      e.preventDefault()
      toast(STR.toast.copied(store.clipboard.length))
    }
    return
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
    if (store.clipboard.length) {
      e.preventDefault()
      doPaste()
    }
    return
  }

  // Delete / Backspace — only when no overlay is visible
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.querySelector('.overlay')) return
    if (store.selectedBlocks.size) {
      e.preventDefault()
      onDeleteSelected()
    }
    return
  }

  // Escape clears selection
  if (e.key === 'Escape' && store.selectedBlocks.size) {
    store.selectedBlocks.clear()
    toast(STR.toast.unselected)
    return
  }
}

async function onDeleteSelected() {
  const n = store.selectedBlocks.size
  const ok = await showConfirm(STR.confirm.deleteSelected(n))
  if (!ok) return
  store.deleteSelectedBlocks()
  toast(STR.toast.deleted)
}

function doPaste() {
  if (!store.clipboard.length) return
  const minStart = Math.min(...store.clipboard.map(c => c.start))
  let offset = 0
  const anchored = overGrid.value
  if (anchored) {
    const anchor = Math.round(lastHoverMin.value / 5) * 5
    offset = anchor - minStart
  }
  const newBlocks = []
  store.clipboard.forEach(c => {
    const dur = c.end - c.start
    let s = c.start + offset
    let en = c.end + offset
    if (s < 0) { s = 0; en = dur }
    if (en > DAY_MIN) { en = DAY_MIN; s = Math.max(0, en - dur) }
    const nb = {
      id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      start: s,
      end: en,
      title: c.title,
      note: c.note,
      tags: (c.tags || []).slice(),
    }
    newBlocks.push(nb)
  })
  newBlocks.forEach(nb => store.addBlock(nb))
  store.selectedBlocks = new Set(newBlocks.map(n => n.id))
  toast(STR.toast.pasteResult(newBlocks.length, anchored))
}

// --- Scroll to now ---
function scrollToNow() {
  if (!settingsStore.autoScroll) return
  const now = new Date()
  const min = dkey(now) === store.dateKey
    ? (now.getHours() * 60 + now.getMinutes())
    : 8 * 60
  const main = document.querySelector('main')
  if (main) main.scrollTop = Math.max(0, min * PX_MIN - 160)
}

// --- Lifecycle ---
onMounted(() => {
  updateNowMin()
  nowTimer = setInterval(updateNowMin, 60000)
  scrollToNow()
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
  window.removeEventListener('keydown', onKeyDown)
})

// Window-level mouse events for drag (robust when mouse leaves .day)
function onWindowMouseMove(e) {
  if (!adrag) return
  adrag.cur = yToMin(e.clientY)
  applyDrag()
}

function onWindowMouseUp() {
  if (!adrag) return
  endDrag(true)
}

// Watch date changes — scroll if navigating to today
watch(() => store.dateKey, () => {
  updateNowMin()
  if (store.dateKey === dkey(new Date())) {
    scrollToNow()
  }
})
</script>

<style scoped>
.grid {
  position: relative;
  display: flex;
}
.gutter {
  flex: none;
  position: relative;
}
.gutter .hlabel {
  position: absolute;
  right: 8px;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--text2);
}
.day {
  position: relative;
  flex: 1;
  border-left: 1px solid var(--border);
  user-select: none;
  cursor: crosshair;
}
.hourline {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid var(--border);
}
.halfline {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed #F0EFED;
}
.selrect {
  position: absolute;
  left: 0; right: 0;
  background: var(--blue-soft);
  border: 1px solid var(--blue);
  opacity: .35;
  z-index: 2;
  pointer-events: none;
}
.block {
  position: absolute;
  border-radius: 6px;
  padding: 3px 8px 3px 11px;
  overflow: hidden;
  font-size: 12.5px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,.05);
}
.block.bsel {
  outline: 2.5px solid var(--blue);
  outline-offset: 1px;
  box-shadow: 0 0 0 3px var(--blue-soft);
}
.block.resizing {
  opacity: .92;
  z-index: 40;
  box-shadow: 0 3px 10px rgba(0,0,0,.22);
}
.block .cbar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.block .cbar i {
  flex: 1;
  display: block;
}
.block .bt {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.block .bs {
  opacity: .7;
  font-size: 11px;
}
.block .btags {
  margin-top: 2px;
  font-size: 10.5px;
  opacity: .9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.block .bnote {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.35;
  opacity: .9;
  overflow: hidden;
}
.nowline {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 2px solid #E56458;
  z-index: 5;
  pointer-events: none;
}
.nowline::before {
  content: '';
  position: absolute;
  left: -4px;
  top: -4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #E56458;
}
</style>
