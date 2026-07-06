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
    >
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
        @mousedown.left="onBlockMouseDown($event, ev)"
        @click="onBlockClick($event, ev)"
        @contextmenu.prevent="onBlockContextMenu(ev)"
      >
        <div class="cbar">
          <i
            v-for="(t, ti) in (ev.tags || [])"
            :key="ti"
            :style="{ background: colorOf(t).hex }"
          />
          <i v-if="!ev.tags || !ev.tags.length" style="background:#C4C3C0" />
        </div>
        <div class="bt">{{ ev.title || '(未命名)' }}</div>
        <div
          v-if="(ev.end - ev.start) * PX_MIN >= 32"
          class="bs"
        >
          {{ fmt(ev.start) }}–{{ fmt(ev.end) }}
        </div>
        <div
          v-if="(ev.end - ev.start) * PX_MIN >= 50 && ev.tags && ev.tags.length"
          class="btags"
        >
          <span v-for="t in ev.tags" :key="t">
            <span class="tdot" :style="{ background: colorOf(t).hex }" />{{ t }}
          </span>
        </div>
        <div
          v-if="ev.note && (ev.end - ev.start) * PX_MIN >= (ev.tags?.length ? 66 : 48)"
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
      <!-- Drag ghost indicator -->
      <div
        v-if="adrag && adrag.type === 'create'"
        class="ghost"
        :style="ghostStyle"
      />
      <div
        v-if="dlabelTop !== null"
        class="dlabel"
        :style="{ top: dlabelTop + 'px' }"
      >
        {{ dlabelText }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTimelogStore, fmt, dkey, toInput, fromInput } from '../store/timelog.js'
import { mdToHtml } from '../utils/markdown.js'
import { PX_MIN, DAY_MIN, EDGE, GUTTER_WIDTH } from '../constants.js'

const props = defineProps({
  modalOpen: { type: Boolean, default: false },
})
const store = useTimelogStore()
const emit = defineEmits(['edit-block', 'create-block'])

const dayRef = ref(null)
const gutterRef = ref(null)

// --- Drag state ---
const adrag = ref(null)
// { type: 'create', anchor, cur }
// { type: 'resize', id, edge, other, cur }
const suppressClick = ref(false)
const ghostTop = ref(null)
const ghostHeight = ref(null)
const dlabelTop = ref(null)
const dlabelText = ref('')

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
  const c0 = store.colorOf(has ? ev.tags[0] : null)
  const top = ev.start * PX_MIN
  const height = Math.max((ev.end - ev.start) * PX_MIN, 16)
  const w = 100 / (ev._cols || 1)
  const left = (ev._col || 0) * w
  return {
    top: top + 'px',
    height: height + 'px',
    left: `calc(${left}% + 2px)`,
    width: `calc(${w}% - 4px)`,
    background: has ? c0.bg : '#F2F1EF',
    color: '#2C2C2B',
  }
}

// --- Ghost style (create-drag visual) ---
const ghostStyle = computed(() => {
  if (ghostTop.value === null) return { display: 'none' }
  return {
    top: ghostTop.value + 'px',
    height: ghostHeight.value + 'px',
  }
})

// --- Mouse helpers ---
function yToMin(y) {
  const r = dayRef.value.getBoundingClientRect()
  return Math.max(0, Math.min(DAY_MIN, Math.round((y - r.top) / PX_MIN)))
}

function dragBounds() {
  if (!adrag.value) return null
  if (adrag.value.type === 'create') {
    return {
      s: Math.min(adrag.value.anchor, adrag.value.cur),
      en: Math.max(adrag.value.anchor, adrag.value.cur),
    }
  }
  if (adrag.value.edge === 'start') {
    let s = Math.min(adrag.value.cur, adrag.value.other - 1)
    if (s < 0) s = 0
    return { s, en: adrag.value.other }
  }
  let en = Math.max(adrag.value.cur, adrag.value.other + 1)
  if (en > DAY_MIN) en = DAY_MIN
  return { s: adrag.value.other, en }
}

function activeMin() {
  if (!adrag.value) return 0
  const b = dragBounds()
  if (adrag.value.type === 'create') return adrag.value.cur
  return adrag.value.edge === 'start' ? b.s : b.en
}

function applyDrag() {
  if (!adrag.value) return
  const b = dragBounds()
  if (adrag.value.type === 'create') {
    ghostTop.value = b.s * PX_MIN
    ghostHeight.value = Math.max((b.en - b.s) * PX_MIN, 2)
  }
  dlabelTop.value = activeMin() * PX_MIN
  dlabelText.value = `${fmt(b.s)} – ${fmt(b.en)}（${b.en - b.s}m，↑↓微调）`
}

function endDrag(commit) {
  if (!adrag.value) return
  const b = dragBounds()
  const { type, id } = adrag.value
  ghostTop.value = null
  ghostHeight.value = null
  dlabelTop.value = null
  dlabelText.value = ''
  adrag.value = null
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
function onDayMouseDown(e) {
  if (e.button !== 0 || adrag.value) return
  const s = yToMin(e.clientY)
  adrag.value = { type: 'create', anchor: s, cur: s }
  applyDrag()
}

function onBlockMouseDown(e, ev) {
  if (e.button !== 0) return
  e.stopPropagation()
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const y = e.clientY - r.top
  const ez = Math.min(EDGE, r.height / 2)
  let edge = null
  if (y <= ez) edge = 'start'
  else if (y >= r.height - ez) edge = 'end'
  if (edge) {
    e.preventDefault()
    suppressClick.value = true
    adrag.value = {
      type: 'resize',
      id: ev.id,
      edge,
      other: edge === 'start' ? ev.end : ev.start,
      cur: edge === 'start' ? ev.start : ev.end,
    }
    applyDrag()
  }
}

function onMouseMove(e) {
  if (adrag.value) {
    adrag.value.cur = yToMin(e.clientY)
    applyDrag()
  }
  lastHoverMin.value = yToMin(e.clientY)
  overGrid.value = true
}

function onMouseUp() {
  if (adrag.value) {
    endDrag(true)
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
  if (store.selectedBlocks.has(ev.id)) {
    store.selectedBlocks.delete(ev.id)
  } else {
    store.selectedBlocks.add(ev.id)
  }
}

// --- Keyboard ---
function onKeyDown(e) {
  // Don't handle keyboard when modal is open
  if (props.modalOpen) return

  // During drag: arrow keys fine-tune, Escape cancels
  if (adrag.value) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      adrag.value.cur = Math.max(0, Math.min(DAY_MIN,
        adrag.value.cur + (e.key === 'ArrowUp' ? -1 : 1)))
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
    if (store.copySelected()) e.preventDefault()
    return
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
    if (store.clipboard.length) {
      e.preventDefault()
      doPaste()
    }
    return
  }

  // Delete / Backspace
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (store.selectedBlocks.size) {
      e.preventDefault()
      store.deleteSelectedBlocks()
    }
    return
  }

  // Escape clears selection
  if (e.key === 'Escape' && store.selectedBlocks.size) {
    store.selectedBlocks.clear()
    return
  }
}

function doPaste() {
  if (!store.clipboard.length) return
  const minStart = Math.min(...store.clipboard.map(c => c.start))
  let offset = 0
  if (overGrid.value) {
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
}

// --- Scroll to now ---
function scrollToNow() {
  const autoScrollRaw = localStorage.getItem('timelog:autoScroll')
  const autoScroll = autoScrollRaw !== null ? (autoScrollRaw === '1') : true
  if (!autoScroll) return
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
  if (!adrag.value) return
  adrag.value.cur = yToMin(e.clientY)
  applyDrag()
}

function onWindowMouseUp() {
  if (!adrag.value) return
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
.tdot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 3px;
  vertical-align: middle;
}
.block .bnote {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.35;
  opacity: .9;
  overflow: hidden;
}
.block .bnote > div,
.block .bnote li {
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
}
.block .bnote ul,
.block .bnote ol {
  margin: 2px 0;
  padding-left: 2px;
  list-style-position: inside;
}
.block .bnote ul ul,
.block .bnote ol ol,
.block .bnote ul ol,
.block .bnote ol ul {
  padding-left: 14px;
  margin-top: 0;
  margin-bottom: 0;
}
.block .bnote code {
  background: rgba(0,0,0,.07);
  padding: 0 3px;
  border-radius: 3px;
  font-family: Menlo,Consolas,monospace;
  font-size: 10px;
}
.block .bnote .md-h {
  font-weight: 700;
  margin: 1px 0;
}
.block .bnote a {
  color: inherit;
  text-decoration: underline;
}
.ghost {
  position: absolute;
  background: var(--blue-soft);
  border: 1px solid var(--blue);
  border-radius: 6px;
  opacity: .85;
  pointer-events: none;
  font-size: 11px;
  color: var(--blue);
  padding: 2px 6px;
  font-weight: 600;
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
.dlabel {
  position: absolute;
  right: 6px;
  transform: translateY(-50%);
  background: #2C2C2B;
  color: #fff;
  font-size: 11px;
  line-height: 1.4;
  padding: 1px 7px;
  border-radius: 5px;
  z-index: 45;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0,0,0,.2);
}
</style>
