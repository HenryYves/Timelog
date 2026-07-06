import { defineStore } from 'pinia'
import { ref } from 'vue'
import { KEY_PREFIX } from '../constants.js'
import { useTimelogStore } from './timelog.js'

const DEFAULT_TAGS = [
  { name: '专注', color: '#A1AFC9', group: '自我评价' },
  { name: '摸鱼', color: '#F0C7C1', group: '自我评价' },
  { name: '学习', color: '#C4E0D4', group: '正事' },
  { name: '工作', color: '#A1AFC9', group: '正事' },
  { name: '运动', color: '#B5D8A8', group: '生活' },
  { name: '社交', color: '#FCE38A', group: '生活' },
]

export const useTagStore = defineStore('tags', () => {
  const tags = ref([])

  function loadTags() {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + 'tags')
      tags.value = raw ? JSON.parse(raw) : [...DEFAULT_TAGS]
    } catch { tags.value = [...DEFAULT_TAGS] }
  }

  function saveTags() {
    localStorage.setItem(KEY_PREFIX + 'tags', JSON.stringify(tags.value))
  }

  function normColor(c) {
    if (!c || !c.trim()) return '#C4C3C0'
    let v = c.trim()
    if (!v.startsWith('#')) v = '#' + v
    if (v.length === 4) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]
    return v.slice(0, 7)
  }

  function addTag(tag) {
    tags.value.push({ name: tag.name, color: normColor(tag.color), group: tag.group || '' })
    saveTags()
  }

  function updateTag(index, tag) {
    const oldName = tags.value[index].name
    tags.value[index] = { name: tag.name, color: normColor(tag.color), group: tag.group || '' }
    saveTags()
    if (oldName !== tag.name) replaceTagInBlocks(oldName, tag.name)
  }

  function deleteTag(index) {
    const name = tags.value[index].name
    tags.value.splice(index, 1)
    saveTags()
    removeTagFromBlocks(name)
  }

  function removeTagFromBlocks(name) {
    const store = useTimelogStore()
    let changed = false
    store.blocks.forEach(b => { if (b.tags) { b.tags = b.tags.filter(t => t !== name); changed = true } })
    if (changed) store.saveBlocks()
  }

  function replaceTagInBlocks(oldName, newName) {
    const store = useTimelogStore()
    let changed = false
    store.blocks.forEach(b => { if (b.tags) { b.tags = b.tags.map(t => t === oldName ? newName : t); changed = true } })
    if (changed) store.saveBlocks()
    // Also check ALL date keys
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k.startsWith(KEY_PREFIX) && k !== KEY_PREFIX + 'tags') {
        try {
          const data = JSON.parse(localStorage.getItem(k))
          let changed2 = false
          data.forEach(b => { if (b.tags) { b.tags = b.tags.map(t => t === oldName ? newName : t); changed2 = true } })
          if (changed2) localStorage.setItem(k, JSON.stringify(data))
        } catch {}
      }
    }
  }

  function colorOf(name) {
    const t = tags.value.find(t => t.name === name)
    if (!t) return { hex: '#C4C3C0', bg: '#F0EFED' }
    return { hex: t.color, bg: t.color + '22' }
  }

  loadTags()
  return { tags, loadTags, saveTags, addTag, updateTag, deleteTag, removeTagFromBlocks, replaceTagInBlocks, colorOf, normColor }
})
