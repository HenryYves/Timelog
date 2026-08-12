<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="onCancel">
    <div class="modal" ref="modalEl" @keydown="trapFocus">
      <h2>管理标签</h2>
      <div class="sub">点左侧色块自定义颜色；相同"分组"的标签会归类显示（如"很自律"与"自律"放同一组）。</div>
      <div class="palette">
        <span v-for="i in 9" :key="i" class="palette-dot"
          :style="{ background: 'var(--skin-palette-' + i + ', transparent)' }"
          :title="'--skin-palette-' + i" />
      </div>

      <div id="tagList">
        <div
          v-for="(tag, i) in tagDraft"
          :key="tag._uid"
          class="tagrow"
          :data-index="i"
        >
          <span class="drag-handle" title="拖拽排序" @mousedown="onMouseDown($event, i)">⋮⋮</span>
          <input type="color" v-model="tag.color">
          <input type="text" class="tn" v-model="tag.name" placeholder="标签名称">
          <input type="text" class="tg" v-model="tag.group" placeholder="分组">
          <button class="del" @click="onDeleteTag(i)">删除</button>
        </div>
      </div>

      <div style="margin-top:8px; display:flex; gap:8px;">
        <button @click="onAddTag">＋ 新增标签</button>
        <button @click="onSortAlpha">按名称排序</button>
        <button @click="onSortByGroup">按分组排序</button>
      </div>

      <div class="actions">
        <span class="spacer"></span>
        <button class="primary" @click="onSave">保存</button>
        <button @click="onCancel">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useTagStore } from '../store/tags.js'
import { KEY_PREFIX } from '../constants.js'
import { useConfirm } from '../composables/useConfirm.js'
import { STR } from '../strings.js'
import { createAutoScroll } from '../utils/autoScroll.js'
import { extractBlocks, extractCutMeta } from '../utils/dayStorage.js'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close', 'saved'])

const tagStore = useTagStore()
const { showConfirm } = useConfirm()

const tagDraft = ref([])
const modalEl = ref(null)
const origNames = ref(new Map())
const deletedNames = ref(new Set())
let nextUid = 0
let draggedIndex = null
let dragTargetIndex = null
let isDragging = false
let startY = 0

// 滚动后重算拖拽目标行
function _retarget(x, y) {
  const el = document.elementFromPoint(x, y)
  if (!el) { clearDragOver(); return }
  const tagrow = el.closest('.tagrow')
  if (!tagrow) { clearDragOver(); return }
  const idx = parseInt(tagrow.dataset.index)
  if (isNaN(idx) || idx === draggedIndex) { clearDragOver(); return }
  dragTargetIndex = idx
  document.querySelectorAll('.tagrow.drag-over').forEach(r => {
    if (r !== tagrow) r.classList.remove('drag-over')
  })
  tagrow.classList.add('drag-over')
}

const _as = createAutoScroll(
  () => document.getElementById('tagList'),
  (x, y) => _retarget(x, y),
)
let _rafId = 0
let _lastClientX = 0
let _lastClientY = 0

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const modal = e.currentTarget
  const focusable = modal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
  )
  const visible = [...focusable].filter(el => el.offsetParent !== null)
  if (!visible.length) { e.preventDefault(); return }
  const idx = visible.indexOf(document.activeElement)
  if (e.shiftKey) {
    e.preventDefault()
    visible[idx <= 0 ? visible.length - 1 : idx - 1].focus()
  } else {
    e.preventDefault()
    visible[idx === -1 || idx >= visible.length - 1 ? 0 : idx + 1].focus()
  }
}

watch(() => props.show, (val) => {
  if (!val) return
  nextUid = 0
  tagDraft.value = tagStore.tags.map(t => ({ ...t, _uid: nextUid++ }))
  origNames.value = new Map(tagDraft.value.map(t => [t._uid, t.name]))
  deletedNames.value = new Set()
}, { immediate: true })

function onAddTag() {
  tagDraft.value.push({ name: '', color: '#4C9AE0', group: '', _uid: nextUid++ })
}

function onSortAlpha() {
  tagDraft.value.sort((a, b) => {
    const an = a.name.trim().toLowerCase()
    const bn = b.name.trim().toLowerCase()
    return an.localeCompare(bn, 'zh-CN')
  })
}

function onSortByGroup() {
  tagDraft.value.sort((a, b) => {
    const ag = a.group.trim()
    const bg = b.group.trim()
    // Empty groups go last
    if (!ag && bg) return 1
    if (ag && !bg) return -1
    // Compare groups
    if (ag !== bg) return ag.localeCompare(bg, 'zh-CN')
    // Same group, compare names
    const an = a.name.trim().toLowerCase()
    const bn = b.name.trim().toLowerCase()
    return an.localeCompare(bn, 'zh-CN')
  })
}

function onMouseDown(e, index) {
  draggedIndex = index
  startY = e.clientY
  isDragging = false

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  e.preventDefault() // Prevent text selection
}

function onMouseMove(e) {
  if (draggedIndex === null) return

  // Start dragging after 3px movement threshold
  if (!isDragging && Math.abs(e.clientY - startY) > 3) {
    isDragging = true
    const draggedRow = document.querySelector(`.tagrow[data-index="${draggedIndex}"]`)
    if (draggedRow) draggedRow.classList.add('dragging')
    // Set cursor globally during drag
    document.body.classList.add('drag-active')
  }

  if (!isDragging) return

  _as.updatePos(e.clientX, e.clientY)
  _as.start()
  _retarget(e.clientX, e.clientY)
}

function onMouseUp(e) {
  _as.stop()
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)

  if (isDragging && draggedIndex !== null && dragTargetIndex !== null && draggedIndex !== dragTargetIndex) {
    // Perform swap
    const [item] = tagDraft.value.splice(draggedIndex, 1)
    tagDraft.value.splice(dragTargetIndex, 0, item)
  }

  // Cleanup
  document.querySelectorAll('.tagrow.dragging').forEach(el => el.classList.remove('dragging'))
  clearDragOver()
  document.body.classList.remove('drag-active')
  draggedIndex = null
  dragTargetIndex = null
  isDragging = false
}

function clearDragOver() {
  dragTargetIndex = null
  document.querySelectorAll('.tagrow.drag-over').forEach(el => el.classList.remove('drag-over'))
}

async function onDeleteTag(index) {
  const tag = tagDraft.value[index]
  const name = tag.name.trim()
  if (name) {
    const ok = await showConfirm(STR.confirm.deleteTag(name))
    if (!ok) { modalEl.value?.querySelector('button')?.focus(); return }
    deletedNames.value.add(name)
  }
  origNames.value.delete(tag._uid)
  tagDraft.value.splice(index, 1)
}

function onCancel() {
  emit('close')
}

function isDayKey(k) {
  return k.startsWith(KEY_PREFIX) && k !== KEY_PREFIX + 'tags' &&
    /^\d{4}-\d{2}-\d{2}$/.test(k.slice(KEY_PREFIX.length))
}

function removeTagFromBlocksAll(name) {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!isDayKey(k)) continue
    try {
      const data = JSON.parse(localStorage.getItem(k))
      const blocks = extractBlocks(data)
      if (!blocks.length) continue
      const meta = extractCutMeta(data)
      let changed = false
      blocks.forEach(b => {
        if (b.tags) {
          const filtered = b.tags.filter(t => t !== name)
          if (filtered.length !== b.tags.length) {
            b.tags = filtered
            changed = true
          }
        }
      })
      if (changed) localStorage.setItem(k, JSON.stringify({ blocks, _cutMeta: meta }))
    } catch { /* skip corrupt keys */ }
  }
}

async function onSave() {
  // Filter out empty names and duplicates
  const seen = {}
  const cleanTags = tagDraft.value
    .filter(t => t.name && t.name.trim())
    .filter(t => {
      const n = t.name.trim()
      if (seen[n]) return false
      seen[n] = true
      return true
    })
    .map(t => ({
      name: t.name.trim(),
      color: tagStore.normColor(t.color),
      group: (t.group || '').trim(),
    }))

  // Remove deleted tags from ALL blocks
  for (const tn of deletedNames.value) {
    if (tn) removeTagFromBlocksAll(tn)
  }

  // Handle renames: compare original names with current names using _uid
  for (const tag of tagDraft.value) {
    const origName = origNames.value.get(tag._uid)
    const newName = tag.name.trim()
    if (origName && newName && origName !== newName) {
      const ok = await showConfirm(STR.confirm.renameTag(origName, newName))
      if (ok) { tagStore.replaceTagInBlocks(origName, newName) }
      else { modalEl.value?.querySelector('button')?.focus() }
    }
  }

  // Update store
  tagStore.tags.splice(0, tagStore.tags.length, ...cleanTags)
  tagStore.saveTags()

  emit('saved')
  emit('close')
}
</script>
<style scoped>
.modal { max-height: calc(82vh / var(--zoom, 1)); overflow: auto; }
#tagList { max-height: 30vh; overflow-y: auto; }
.tagrow {
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  padding: 4px;
  margin: 2px 0;
  border-radius: 4px;
}
.tagrow.dragging {
  opacity: 0.4;
  transform: scale(0.95);
}
.tagrow.drag-over {
  background: rgba(66, 153, 225, 0.1);
  border: 2px dashed #4299E1;
  transform: translateY(-2px);
}
.drag-handle {
  cursor: var(--drag-cursor) 16 16, grab;
  user-select: none;
  color: #999;
  font-size: 14px;
  line-height: 1;
  padding: 4px;
}
.drag-handle:active { cursor: var(--drag-cursor) 16 16, grabbing; }
.tagrow input,
.tagrow button {
  cursor: default;
}
.tagrow.dragging {
  opacity: 0.4;
  cursor: var(--drag-cursor) 16 16, grabbing;
}
</style>


