<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')">
    <div class="modal">
      <h2>管理标签</h2>
      <div class="sub">点左侧色块自定义颜色；相同"分组"的标签会归类显示。</div>

      <div id="tagList">
        <div v-for="(tag, i) in tagDraft" :key="i" class="tagrow">
          <input type="color" v-model="tag.color">
          <input type="text" class="tn" v-model="tag.name" placeholder="标签名称">
          <input type="text" class="tg" v-model="tag.group" placeholder="分组">
          <button class="del" @click="onDeleteTag(i)">删除</button>
        </div>
      </div>

      <button style="margin-top:8px" @click="onAddTag">＋ 新增标签</button>

      <div class="actions">
        <span class="spacer"></span>
        <button @click="onCancel">取消</button>
        <button class="primary" @click="onSave">保存</button>
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

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close', 'saved'])

const tagStore = useTagStore()
const { showConfirm } = useConfirm()

const tagDraft = ref([])
const origNames = ref([])
const deletedNames = ref(new Set())

watch(() => props.show, (val) => {
  if (!val) return
  tagDraft.value = tagStore.tags.map(t => ({ ...t }))
  origNames.value = tagStore.tags.map(t => t.name)
  deletedNames.value = new Set()
})

function onAddTag() {
  tagDraft.value.push({ name: '', color: '#4C9AE0', group: '' })
}

async function onDeleteTag(index) {
  const name = tagDraft.value[index].name.trim()
  if (name) {
    const ok = await showConfirm(STR.confirm.deleteTag(name))
    if (!ok) return
    deletedNames.value.add(name)
  }
  tagDraft.value.splice(index, 1)
  origNames.value.splice(index, 1)
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
      if (!Array.isArray(data)) continue
      let changed = false
      data.forEach(b => {
        if (b.tags) {
          const filtered = b.tags.filter(t => t !== name)
          if (filtered.length !== b.tags.length) {
            b.tags = filtered
            changed = true
          }
        }
      })
      if (changed) localStorage.setItem(k, JSON.stringify(data))
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

  // Handle renames: compare original names with current names at same indices
  for (let i = 0; i < tagDraft.value.length && i < origNames.value.length; i++) {
    const on = origNames.value[i]
    const nn = tagDraft.value[i].name.trim()
    if (on && nn && on !== nn) {
      const ok = await showConfirm(STR.confirm.renameTag(on, nn))
      if (ok) tagStore.replaceTagInBlocks(on, nn)
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
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(20,20,20,.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}
.modal {
  background: var(--canvas);
  border-radius: 12px;
  width: 480px;
  max-width: 100%;
  padding: 20px;
  box-shadow: 0 8px 40px rgba(0,0,0,.18);
  max-height: 90vh;
  overflow: auto;
}
.modal h2 {
  font-size: 15px;
  margin: 0 0 6px;
  font-weight: 650;
}
.modal .sub {
  color: var(--text2);
  font-size: 12.5px;
  margin-bottom: 10px;
}
.tagrow {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
.tagrow input[type=color] {
  width: 38px;
  height: 34px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--canvas);
  cursor: pointer;
  flex: none;
}
.tagrow input[type=text] {
  width: auto;
}
.tagrow .tn {
  flex: 1 1 auto;
  min-width: 0;
}
.tagrow .tg {
  flex: 0 0 116px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}
.spacer { flex: 1; }
</style>
