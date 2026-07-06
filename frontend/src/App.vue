<template>
  <div id="app-container">
    <header>
      <img src="/icons/logo.svg" class="logo" alt="">
      <h1>Timelog</h1>
      <div class="datenav">
        <button @click="store.goPrevDay()">&lt;</button>
        <span class="date">{{ dateLabel }}</span>
        <button @click="store.goNextDay()">&gt;</button>
        <button @click="store.goToday()">今天</button>
      </div>
      <span class="spacer"></span>
    </header>
    <main>
      <Timeline
        :modal-open="showModal"
        @edit-block="onEditBlock"
        @create-block="onCreateBlock"
      />
    </main>
    <EditModal
      :show="showModal"
      :editing-block="editingBlock"
      :create-times="createTimes"
      @close="closeModal"
      @manage-tags="onManageTags"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTimelogStore, dkey } from './store/timelog.js'
import Timeline from './components/Timeline.vue'
import EditModal from './components/EditModal.vue'

const store = useTimelogStore()

const dateLabel = computed(() => {
  const d = store.curDate
  const wd = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
  return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日 ' + wd
})

// EditModal state
const showModal = ref(false)
const editingBlock = ref(null)
const createTimes = ref(null)

function onEditBlock(block) {
  editingBlock.value = block
  createTimes.value = null
  showModal.value = true
}

function onCreateBlock(start, end) {
  editingBlock.value = null
  createTimes.value = { start, end }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingBlock.value = null
  createTimes.value = null
}

function onManageTags() {
  // Future: open tag manager modal
}

// T key: quick create at current time
function onWindowKeyDown(e) {
  if (showModal.value) return
  const tag = e.target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.key === 't' || e.key === 'T') {
    e.preventDefault()
    const now = new Date()
    let s = dkey(now) === store.dateKey
      ? now.getHours() * 60 + now.getMinutes()
      : 540
    s = Math.round(s / 5) * 5
    if (s > 1380) s = 1380
    const duration = 30
    editingBlock.value = null
    createTimes.value = { start: s, end: Math.min(s + duration, 1440) }
    showModal.value = true
  }
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeyDown)
})
</script>
