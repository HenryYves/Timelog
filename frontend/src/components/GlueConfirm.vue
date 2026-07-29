<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal" @keydown="trapFocus" style="max-width:360px">
      <p style="text-align:center;font-size:15px;margin-bottom:16px">{{ STR.glue.confirm(sourceLabel) }}</p>
      <div class="actions">
        <span class="spacer"></span>
        <button class="primary" @click="emit('confirm')" ref="okBtn">{{ STR.btn.ok }}</button>
        <button @click="emit('close')">{{ STR.btn.cancel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { STR } from '../strings.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  sourceDate: { type: String, default: '' },
})

const emit = defineEmits(['close', 'confirm'])
const okBtn = ref(null)

const sourceLabel = computed(() => {
  if (!props.sourceDate) return ''
  const [y, m, d] = props.sourceDate.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
})

watch(() => props.show, async (v) => {
  if (v) {
    await nextTick()
    okBtn.value?.focus()
  }
})

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const items = e.currentTarget.querySelectorAll('button:not([disabled])')
  const visible = [...items].filter(el => el.offsetParent !== null)
  if (!visible.length) { e.preventDefault(); return }
  const first = visible[0], last = visible[visible.length - 1]
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus() }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus() }
  }
}
</script>
