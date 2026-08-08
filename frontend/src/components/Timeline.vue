<template>
  <div class="grid">
    <div class="gutter-container">
      <!-- Glue-prev gutter -->
      <div v-if="gutterHeights.prev" class="glue-from-prev">
        <div class="gutter glue-prev"
          :style="{ width: GUTTER_WIDTH + 'px', height: gutterHeights.prev * PX_MIN + 'px' }"
          @contextmenu.prevent="onGluePrevRightClick" @mousemove="onGutterHover" @mouseleave="onGutterLeave">
          <div v-for="label in gluePrevLabels" :key="label.min" class="hlabel" :style="{ top: label.top + 'px' }">{{
            label.text }}</div>
        </div>
      </div>

      <!-- Today gutter -->
      <div class="gutter today" :style="{ width: GUTTER_WIDTH + 'px', height: gutterHeights.today * PX_MIN + 'px' }"
        @contextmenu.prevent="onTodayRightClick" @mousemove="onGutterHover" @mouseleave="onGutterLeave">
        <div v-for="label in todayLabels" :key="label.min" class="hlabel" :style="{ top: label.top + 'px' }">{{
          label.text }}</div>
      </div>

      <!-- Glue-next gutter -->
      <div v-if="gutterHeights.next" class="glue-from-next">
        <div class="gutter glue-next"
          :style="{ width: GUTTER_WIDTH + 'px', height: gutterHeights.next * PX_MIN + 'px' }"
          @contextmenu.prevent="onGlueNextRightClick" @mousemove="onGutterHover" @mouseleave="onGutterLeave">
          <div v-for="label in glueNextLabels" :key="label.min" class="hlabel" :style="{ top: label.top + 'px' }">{{
            label.text }}</div>
        </div>
      </div>
    </div>

    <!-- Single day area -->
    <div class="day" ref="dayRef" :style="{ height: totalHeight * PX_MIN + 'px' }" @mousedown="onDayMouseDown"
      @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseUp" @click.self="onDayClick"
      @contextmenu.prevent>
      <div v-if="selRect" class="selrect" :style="{
        top: Math.min(selRect.top, selRect.bottom) + 'px',
        height: Math.abs(selRect.bottom - selRect.top) + 'px',
        left: Math.min(selRect.left, selRect.right) + 'px',
        width: Math.abs(selRect.right - selRect.left) + 'px'
      }" />
      <div v-for="(label, i) in allLabels" :key="'hl' + i" class="hourline" :style="{ top: label.y + 'px' }" />
      <template v-for="(label, i) in allLabels" :key="'hfl' + i">
        <div v-if="i < allLabels.length - 1" class="halfline" :style="{ top: label.y + 30 * PX_MIN + 'px' }" />
      </template>
      <div v-for="ev in layoutBlocks" :key="ev.id" class="block" :class="{ bsel: selectedBlocks.has(ev.id) }"
        :style="computeBlockStyle(ev)" :title="blockTitle(ev)" @mousemove="onBlockMouseMove($event, ev)"
        @mousedown.left="onBlockMouseDown($event, ev)" @click="onBlockClick($event, ev)"
        @contextmenu.prevent="onBlockContextMenu(ev)">
        <div v-if="settingsStore.showBlockColorBar" class="cbar">
          <i v-for="(t, ti) in (ev.tags || [])" :key="ti" :style="{ background: colorOf(t).hex }" />
          <i v-if="!ev.tags || !ev.tags.length" style="background:#C4C3C0" />
        </div>
        <div v-if="settingsStore.showBlockTitle" class="bt">{{ ev.title || '(未命名)' }}</div>
        <div v-if="settingsStore.showBlockTime && (ev.end - ev.start) * PX_MIN >= 32" class="bs">{{ fmtSigned(ev.start)
        }}–{{
            fmtSigned(ev.end) }}</div>
        <div v-if="settingsStore.showBlockTags && (ev.end - ev.start) * PX_MIN >= 18 && ev.tags && ev.tags.length"
          class="btags">
          <span v-for="t in ev.tags" :key="t"><span class="tdot" :style="{ background: colorOf(t).hex }" />{{ t
          }}</span>
        </div>
        <div
          v-if="settingsStore.showBlockNote && ev.note && (ev.end - ev.start) * PX_MIN >= 16 && settingsStore.renderNoteMarkdown"
          class="bnote" v-html="mdToHtml(ev.note)" />
        <div
          v-if="settingsStore.showBlockNote && ev.note && (ev.end - ev.start) * PX_MIN >= (ev.tags?.length ? 66 : 48) && !settingsStore.renderNoteMarkdown"
          class="bnote" style="white-space: pre-wrap">{{ ev.note }}</div>
        <div v-if="settingsStore.maskBlockOverflow" class="block-mask" :style="maskGradientStyle" />
      </div>

      <div v-if="hoverLine" class="cut-hover" :style="{ top: hoverLine.y + 'px' }">
        <span class="cut-hover-label">{{ hoverLine.label }}</span>
      </div>
      <div v-if="nowInToday" class="nowline" :style="{ top: nowLineY() + 'px' }" />
    </div>
  </div>

  <CutConfirm :show="showCutConfirm" :initialMin="cutInitialMin" :availableDirs="availableDirs" @confirm="onCutConfirm"
    @close="showCutConfirm = false" />
  <GlueConfirm :show="showGlueConfirm" :sourceDate="glueTarget" @confirm="onGlueBackConfirm"
    @close="showGlueConfirm = false; glueTarget = null" />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTimelogStore, fmt, fmtSigned, dkey, addDays, cutDay, glueBack, canCutForward, canCutBackward } from '../store/timelog.js'
import { useSettingsStore } from '../store/settings.js'
import { mdToHtml } from '../utils/markdown.js'
import { createAutoScroll } from '../utils/autoScroll.js'
import { buildGluePrevLabels, buildTodayLabels, buildGlueNextLabels, mergeAllLabels } from '../utils/timelineLabels.js'

import { PX_MIN, DAY_MIN, EDGE, GUTTER_WIDTH, DAY_OFFSET } from '../constants.js'
import { useToast } from '../composables/useToast.js'
import { useConfirm } from '../composables/useConfirm.js'
import { STR } from '../strings.js'
import { useCoordConverter, localMinToUnified } from '../composables/useCoordConverter.js'
import CutConfirm from './CutConfirm.vue'
import GlueConfirm from './GlueConfirm.vue'

const props = defineProps({
  modalOpen: { type: Boolean, default: false },
})
const emit = defineEmits(['edit-block', 'create-block'])

const store = useTimelogStore()
const { selectedBlocks } = storeToRefs(store)
const { colorOf } = store
const settingsStore = useSettingsStore()
const { toast } = useToast()
const { showConfirm } = useConfirm()

const { gutterHeights, totalHeight, pageRange, blockTop, yToMinute, minuteToY } = useCoordConverter()

const TOTAL_MIN = DAY_MIN * 3
const ARROW_CTRL_MULT = 10  // Ctrl+↑↓ 加速倍数

const dayRef = ref(null)

// --- Modals ---
const showCutConfirm = ref(false)
const cutInitialMin = ref(0)
const showGlueConfirm = ref(false)
const glueTarget = ref(null)

// --- Drag state ---
let adrag = null
let ghost = null
let dlabel = null
const suppressClick = ref(false)
let dragPending = null
let dragStartX = 0
let dragStartY = 0
let blockClickPending = false  // Track if block click might be a drag

// --- Auto-scroll during drag ---
const _as = createAutoScroll(
  () => document.querySelector('main'),
  (x, y) => {
    if (adrag) {
      adrag.cur = yToMinute(y, adrag.dayEl || dayRef.value)
      applyDrag()
    }
    if (selRect.value) {
      const r = dayRef.value.getBoundingClientRect()
      const z = settingsStore.zoom / 100
      selRect.value = { ...selRect.value, bottom: (y - r.top) / z, right: (x - r.left) / z }
    }
  },
)

// --- Right-drag selection ---
const selRect = ref(null)
let selPending = null
let selMoved = false
const suppressContextMenu = ref(false)

// --- Gutter hover (cut/glue preview) ---
const hoverLine = ref(null)

// --- Hover tracking (for paste) ---
const lastHoverMin = ref(0)
const overGrid = ref(false)

// --- Now line ---
const nowMin = ref(0)//现在时间(统一帧)
let nowTimer = null//定时器句柄,每60s更新nowMin让时间红线走动
// 当前时间是否落在本页显示范围内（today 优先于 glue-prev/glue-next）
const nowInToday = computed(() =>
  nowMin.value >= pageRange.value.lo && nowMin.value < pageRange.value.hi && nowMin.value != 0)
// now 线在 .day 中的 y 坐标（today 优先）.
function nowLineY() {
  if (!nowInToday.value) return 0
  return (nowMin.value - pageRange.value.lo) * PX_MIN
}

function updateNowMin() {
  const now = new Date()
  const localMin = now.getHours() * 60 + now.getMinutes()
  const todayKey = dkey(now)

  if (store.dateKey === todayKey) {
    nowMin.value = localMinToUnified('today', localMin)
  } else if (store.dateKey === addDays(todayKey, -1)) {
    nowMin.value = localMinToUnified('next', localMin)
  } else if (store.dateKey === addDays(todayKey, 1)) {
    nowMin.value = localMinToUnified('prev', localMin)
  } else {
    nowMin.value = 0
  }
}

// 诚实存储：storage = display，无需转换函数

// --- Layout algorithm ---
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

    // Calculate span: how many consecutive columns each block can expand into
    // Note: ev.start, ev.end are unified frame coordinates (昨天 [0,1440), 今天 [1440,2880), 明天 [2880,4320))
    grp.forEach(ev => {
      let span = 1
      for (let c = ev._col + 1; c < cols.length; c++) {
        // Check if column c is free during [ev.start, ev.end) using unified frame coordinates
        const occupied = grp.some(other => other._col === c && other.start < ev.end && other.end > ev.start)
        if (occupied) break
        span++
      }
      ev._span = span
    })

    i = j + 1
  }
  return evs
}

const layoutBlocks = computed(() => layout(store.blocks.slice()))

// --- Labels ---
const gluePrevLabels = computed(() =>
  buildGluePrevLabels(store._cutMeta?.fromPrev?.cutAt))

const todayLabels = computed(() =>
  buildTodayLabels(pageRange.value.lo, pageRange.value.hi))

const glueNextLabels = computed(() =>
  buildGlueNextLabels(store._cutMeta?.fromNext?.cutAt))

const allLabels = computed(() =>
  mergeAllLabels(gluePrevLabels.value, todayLabels.value, glueNextLabels.value, gutterHeights.value))

// --- Cut availability ---
const canCutFwd = computed(() => canCutForward(store._cutMeta))
const canCutBwd = computed(() => canCutBackward(store._cutMeta))
const availableDirs = computed(() => {
  const dirs = []
  if (canCutFwd.value) dirs.push('forward')
  if (canCutBwd.value) dirs.push('backward')
  return dirs
})

// --- Visual helpers ---
const maskGradientStyle = computed(() => {
  const c = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim() || '#ffffff'
  return { background: `linear-gradient(to bottom, ${c}00, ${c} 90%)` }
})

function computeBlockStyle(ev) {
  const has = ev.tags && ev.tags.length
  const c0 = colorOf(has ? ev.tags[0] : null)
  const top = blockTop(ev)
  const height = (ev.end - ev.start) * PX_MIN
  const colW = 100 / (ev._cols || 1)
  const left = (ev._col || 0) * colW
  const span = ev._span || 1
  const width = span * colW
  return {
    top: top + 'px',
    height: height + 'px',
    left: `calc(${left}% + 2px)`,
    width: `calc(${width}% - 4px)`,
    background: c0.bg,
    '--block-bg': c0.bg,
    color: '#2C2C2B',
  }
}

function blockTitle(ev) {
  let t = fmtSigned(ev.start) + '–' + fmtSigned(ev.end) + '  ' + (ev.title || '')
  if (ev.tags?.length) t += '  [' + ev.tags.join(',') + ']'
  if (ev.note) t += '\n' + ev.note
  return t
}

// --- Mouse helpers ---
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
  if (en > TOTAL_MIN) en = TOTAL_MIN
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
      ; (adrag?.dayEl || dayRef.value).appendChild(dlabel)
  }
  dlabel.style.top = minuteToY(min) + 'px'
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
        ; (adrag?.dayEl || dayRef.value).appendChild(ghost)
    }
    ghost.style.top = minuteToY(b.s) + 'px'
    ghost.style.height = Math.max((b.en - b.s) * PX_MIN, 2) + 'px'
    ghost.style.left = '2px'
    ghost.style.right = '2px'
    ghost.textContent = fmtSigned(b.s) + ' – ' + fmtSigned(b.en)
  } else if (adrag.el) {
    adrag.el.style.top = minuteToY(b.s) + 'px'
    adrag.el.style.height = Math.max((b.en - b.s) * PX_MIN, 2) + 'px'
    adrag.el.classList.add('resizing')
  }
  showDLabel(activeMin(), fmtSigned(b.s) + ' – ' + fmtSigned(b.en) + '（' + (b.en - b.s) + 'm，↑↓微调）')
}

function endDrag(commit) {
  if (!adrag) return
  _as.stop()
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
  if (selectedBlocks.value.size > 0) selectedBlocks.value.clear()
}

function onDayMouseDown(e) {
  if (e.button === 2) {
    e.preventDefault()
    selPending = { clientX: e.clientX, clientY: e.clientY }
    return
  }
  if (e.button !== 0 || adrag) return
  const dayEl = e.currentTarget
  const s = yToMinute(e.clientY, dayEl)
  dragPending = { anchor: s, dayEl }
  dragStartX = e.clientX
  dragStartY = e.clientY
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
      el,
    }
    applyDrag()
  } else {
    // Not on edge - mark as potential click (will be cancelled if mouse moves 3px)
    blockClickPending = true
  }
}

function onMouseMove(e) {
  _as.updatePos(e.clientX, e.clientY)
  if (adrag) {
    adrag.cur = yToMinute(e.clientY, adrag.dayEl || dayRef.value)
    applyDrag()
    _as.start()
  }
  if (dragPending) {
    const dy = Math.abs(e.clientY - dragStartY)
    const dx = Math.abs(e.clientX - dragStartX)
    if (dy > 3 || dx > 3) {
      const s = yToMinute(dragStartY, dragPending.dayEl)
      adrag = { type: 'create', anchor: s, cur: yToMinute(e.clientY, dragPending.dayEl), dayEl: dragPending.dayEl }
      dragPending = null
      blockClickPending = false  // Cancel block click if drag starts
      applyDrag()
    }
    return
  }
  // If mouse moves while block click is pending, cancel it
  if (blockClickPending) {
    const dy = Math.abs(e.clientY - dragStartY)
    const dx = Math.abs(e.clientX - dragStartX)
    if (dy > 3 || dx > 3) {
      blockClickPending = false
    }
  }
  if (selPending) {
    const dy = Math.abs(e.clientY - selPending.clientY)
    const dx = Math.abs(e.clientX - selPending.clientX)
    if (dy > 3 || dx > 3) {
      const r = e.currentTarget.getBoundingClientRect()
      const z = settingsStore.zoom / 100
      const top = (selPending.clientY - r.top) / z
      const bottom = (e.clientY - r.top) / z
      const left = (selPending.clientX - r.left) / z
      const right = (e.clientX - r.left) / z
      selRect.value = { top, bottom, left, right }
      selPending = null
      selMoved = true
    }
    return
  }
  if (selRect.value) {
    const r = e.currentTarget.getBoundingClientRect()
    const z = settingsStore.zoom / 100
    selRect.value = { ...selRect.value, bottom: (e.clientY - r.top) / z, right: (e.clientX - r.left) / z }
    _as.start()
  }
  lastHoverMin.value = yToMinute(e.clientY, e.currentTarget)
  overGrid.value = true
}

function onMouseUp(e) {
  _as.stop()
  if (adrag) { endDrag(true) }

  dragPending = null
  // Don't reset blockClickPending here - let onBlockClick handle it
  selPending = null
  const hadSelMoved = selMoved
  selMoved = false
  if (selRect.value) {
    const sr = selRect.value
    selRect.value = null
    const selTop = Math.min(sr.top, sr.bottom)
    const selBottom = Math.max(sr.top, sr.bottom)
    const selLeft = Math.min(sr.left, sr.right)
    const selRight = Math.max(sr.left, sr.right)
    const z = settingsStore.zoom / 100
    const dayW = dayRef.value.offsetWidth
    console.log('[Selection] selRect:', { selTop, selBottom, selLeft, selRight, dayW, zoom: z })
    layoutBlocks.value.forEach(ev => {
      const bTop = blockTop(ev)
      const bBottom = bTop + (ev.end - ev.start) * PX_MIN
      const verticalOverlap = !(selBottom < bTop || selTop > bBottom)
      if (!verticalOverlap) return

      const cols = ev._cols || 1
      const colW = dayW / cols
      const blockLeft = (ev._col || 0) * colW + 2
      const blockRight = blockLeft + colW - 4
      const horizontalOverlap = selRight > blockLeft && selLeft < blockRight

      console.log('[Selection Check]', {
        title: ev.title || '(无标题)',
        id: ev.id,
        bTop, bBottom, verticalOverlap,
        blockLeft, blockRight, horizontalOverlap,
        willAdd: horizontalOverlap
      })

      if (horizontalOverlap) {
        selectedBlocks.value.add(ev.id)
        console.log('[Selection Added]', ev.title || '(无标题)', ev.id)
      }
    })
    console.log('[Selection Final] Selected IDs:', Array.from(selectedBlocks.value))
    if (selectedBlocks.value.size > 0) {
      toast(STR.toast.contextSelected(selectedBlocks.value.size))
    }
    if (hadSelMoved) {
      suppressContextMenu.value = true
      setTimeout(() => { suppressContextMenu.value = false }, 10)
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
  // Only open editor if it was a real click (not a drag)
  if (!blockClickPending) return
  emit('edit-block', ev)
}

function onBlockContextMenu(ev) {
  if (selMoved || suppressContextMenu.value) return
  if (selectedBlocks.value.has(ev.id)) {
    selectedBlocks.value.delete(ev.id)
    if (selectedBlocks.value.size === 0) {
      toast(STR.toast.unselected)
    }
  } else {
    selectedBlocks.value.add(ev.id)
    toast(STR.toast.contextSelected(selectedBlocks.value.size))
  }
}

// --- Scissors / Glue handlers ---
function onGutterHover(e) {
  if (!dayRef.value) return
  const min = yToMinute(e.clientY, dayRef.value)
  let label
  if (min < DAY_MIN) {
    label = `-${fmt(min)}`
  } else if (min < 2 * DAY_MIN) {
    label = fmt(min - DAY_MIN)
  } else {
    label = `+${fmt(min - 2 * DAY_MIN)}`
  }
  hoverLine.value = { y: minuteToY(min), label }
}

function onGutterLeave() {
  hoverLine.value = null
}

function onTodayRightClick(e) {
  if (suppressContextMenu.value) return
  if (!availableDirs.value.length) return
  const min = yToMinute(e.clientY, dayRef.value)
  const localMin = Math.max(0, Math.min(DAY_MIN, min - DAY_MIN))
  cutInitialMin.value = localMin
  showCutConfirm.value = true
}

function onGluePrevRightClick() {
  if (suppressContextMenu.value) return
  const sourceDate = store._cutMeta?.fromPrev?.sourceDate
  if (!sourceDate) return
  glueTarget.value = sourceDate
  showGlueConfirm.value = true
}

function onGlueNextRightClick() {
  if (suppressContextMenu.value) return
  const sourceDate = store._cutMeta?.fromNext?.sourceDate
  if (!sourceDate) return
  glueTarget.value = sourceDate
  showGlueConfirm.value = true
}

async function onCutConfirm(cutAt, direction) {
  if (direction === 'forward' && cutAt >= DAY_MIN) {
    toast(STR.cut.extremeNone)
    return
  }
  if (direction === 'backward' && cutAt <= 0) {
    toast(STR.cut.extremeNone)
    return
  }

  const localTodayBlocks = store.blocks
    .filter(b => !b._cut && b.start >= DAY_MIN && b.end <= 2 * DAY_MIN)
    .map(b => ({ ...b, start: b.start - DAY_MIN, end: b.end - DAY_MIN }))

  let hasShort = false
  let shortDur = 0
  for (const b of localTodayBlocks) {
    if (direction === 'forward') {
      if (b.start >= cutAt && b.end - b.start < 10) { hasShort = true; shortDur = b.end - b.start; break }
      if (b.start < cutAt && b.end > cutAt) {
        const secondHalf = b.end - cutAt
        const firstHalf = cutAt - b.start
        if (secondHalf < 10 || firstHalf < 10) { hasShort = true; shortDur = Math.min(secondHalf, firstHalf); break }
      }
    } else {
      if (b.end <= cutAt && b.end - b.start < 10) { hasShort = true; shortDur = b.end - b.start; break }
      if (b.start < cutAt && b.end > cutAt) {
        const firstHalf = cutAt - b.start
        const secondHalf = b.end - cutAt
        if (firstHalf < 10 || secondHalf < 10) { hasShort = true; shortDur = Math.min(firstHalf, secondHalf); break }
      }
    }
  }
  if (hasShort) {
    const ok = await showConfirm(STR.cut.shortBlock(shortDur))
    if (!ok) return
  }

  if (direction === 'forward' && cutAt <= 0) {
    const ok = await showConfirm(STR.cut.extremeAll)
    if (!ok) return
  }
  if (direction === 'backward' && cutAt >= DAY_MIN) {
    const ok = await showConfirm(STR.cut.extremeAll)
    if (!ok) return
  }

  const result = cutDay(store.dateKey, cutAt, direction)
  if (result) {
    store.loadBlocks()
    toast(`已剪切 ${result.moved} 个块到 ${direction === 'forward' ? '明天' : '昨天'}`)
  } else {
    toast(STR.cut.constraintFail)
  }
  showCutConfirm.value = false
}

function onGlueBackConfirm() {
  const sourceDate = glueTarget.value
  if (!sourceDate) return
  const result = glueBack(store.dateKey, sourceDate)
  if (result) {
    store.loadBlocks()
    toast('已粘回')
  }
  showGlueConfirm.value = false
  glueTarget.value = null
}

// --- Keyboard ---
function onKeyDown(e) {
  if (props.modalOpen) return

  if (adrag) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      adrag.cur = Math.max(pageRange.value.lo, Math.min(pageRange.value.hi,
        adrag.cur + (e.ctrlKey ? ARROW_CTRL_MULT : 1) * (e.key === 'ArrowUp' ? -1 : 1)))
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

  if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
    if (copySelectedLocal()) {
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

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.querySelector('.overlay')) return
    if (selectedBlocks.value.size) {
      e.preventDefault()
      onDeleteSelected()
    }
    return
  }

  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && selectedBlocks.value.size) {
    e.preventDefault()
    const step = e.ctrlKey ? ARROW_CTRL_MULT : 1
    const delta = (e.key === 'ArrowUp' ? -1 : 1) * step
    const sel = store.blocks.filter(b => selectedBlocks.value.has(b.id))
    let minStart = Infinity, maxEnd = -Infinity
    for (const b of sel) {
      if (b.start < minStart) minStart = b.start
      if (b.end > maxEnd) maxEnd = b.end
    }
    if (delta < 0 && minStart + delta < pageRange.value.lo) return
    if (delta > 0 && maxEnd + delta > pageRange.value.hi) return
    sel.forEach(b => store.updateBlock({ ...b, start: b.start + delta, end: b.end + delta }))
    return
  }

  if (e.key === 'Escape' && selectedBlocks.value.size) {
    selectedBlocks.value.clear()
    toast(STR.toast.unselected)
    return
  }
}

// 剪贴板统一存存储坐标（保留 _cut 以便跨帧块正确换算显示坐标）
function copySelectedLocal() {
  if (!selectedBlocks.value.size) return false
  store.clipboard = store.blocks
    .filter(b => selectedBlocks.value.has(b.id))
    .sort((a, b) => a.start - b.start)
    .map(b => ({
      start: b.start, end: b.end,
      title: b.title, note: b.note,
      tags: [...(b.tags || [])],
      ...(b._cut ? { _cut: b._cut } : {}),
    }))
  return true
}

async function onDeleteSelected() {
  const n = selectedBlocks.value.size
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
    if (en > TOTAL_MIN) { en = TOTAL_MIN; s = Math.max(0, en - dur) }
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
  const main = document.querySelector('main')
  if (!main) return
  if (nowInToday.value) {
    main.scrollTop = Math.max(0, nowLineY() - 160)
  } else {
    main.scrollTop = Math.max(0, minuteToY(pageRange.value.lo) - 160)
  }
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

function onWindowMouseMove(e) {
  if (!adrag) return
  adrag.cur = yToMinute(e.clientY, adrag.dayEl || dayRef.value)
  applyDrag()
}

function onWindowMouseUp() {
  if (!adrag) return
  _as.stop()
  endDrag(true)
}

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

.gutter-container {
  display: flex;
  flex-direction: column;
  flex: none;
}

.gutter {
  flex: none;
  position: relative;
}

.gutter.today {
  z-index: 1;
  /* 24:00 标签 translateY(-50%) 不被后渲染的 glue-next 背景盖住 */
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
  cursor: default;
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
  box-shadow: 0 1px 2px rgba(0, 0, 0, .05);
}

.block.bsel {
  outline: 2.5px solid var(--blue);
  outline-offset: 1px;
  box-shadow: 0 0 0 3px var(--blue-soft);
}

.block.resizing {
  opacity: .92;
  z-index: 40;
  box-shadow: 0 3px 10px rgba(0, 0, 0, .22);
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
