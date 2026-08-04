<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="onCancel">
    <div class="modal" ref="modalEl" @keydown="trapFocus">
      <h2>管理标签</h2>
      <div class="sub">点左侧色块自定义颜色；相同"分组"的标签会归类显示（如"很自律"与"自律"放同一组）。</div>

      <div id="tagList">
        <div
          v-for="(tag, i) in tagDraft"
          :key="tag._uid"
          class="tagrow"
          draggable="true"
          @dragstart="onDragStart($event, i)"
          @dragover.prevent="onDragOver($event, i)"
          @drop="onDrop($event, i)"
          @dragend="onDragEnd"
        >
          <span class="drag-handle" title="拖拽排序">⋮⋮</span>
          <input type="color" v-model="tag.color">
          <input type="text" class="tn" v-model="tag.name" placeholder="标签名称">
          <input type="text" class="tg" v-model="tag.group" placeholder="分组">
          <button class="del" @click="onDeleteTag(i)">删除</button>
        </div>
      </div>

      <div style="margin-top:8px; display:flex; gap:8px;">
        <button @click="onAddTag">＋ 新增标签</button>
        <button @click="onSortAlpha">按名称排序</button>
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

function onDragStart(e, index) {
  draggedIndex = index
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e, index) {
  if (draggedIndex === null || draggedIndex === index) return
  e.dataTransfer.dropEffect = 'move'
}

function onDrop(e, targetIndex) {
  if (draggedIndex === null || draggedIndex === targetIndex) return
  const [item] = tagDraft.value.splice(draggedIndex, 1)
  tagDraft.value.splice(targetIndex, 0, item)
  draggedIndex = null
}

function onDragEnd() {
  draggedIndex = null
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
.tagrow { display: flex; align-items: center; gap: 4px; cursor: move; }
.tagrow.dragging { opacity: 0.5; }
.drag-handle { cursor: grab; user-select: none; color: #999; font-size: 14px; line-height: 1; }
.drag-handle:active { cursor: grabbing; }
</style>


