<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal cut-confirm" @keydown="trapFocus" style="max-width:420px">
      <p class="cut-line">
        剪刀落处，
        <input
          ref="timeInput"
          type="text"
          class="cut-time-input"
          v-model="timeStr"
          maxlength="5"
          autocomplete="off"
          @keydown.enter="onConfirm"
          @keydown.escape.stop="emit('close')"
        />，
        <span class="cut-dir-wrap" @click.stop @keydown.escape.stop="showDir = false">
          <span class="cut-dir-btn" @click="showDir = !showDir" tabindex="0" @keydown.enter="showDir = !showDir" @keydown.space.prevent="showDir = !showDir">[{{ directionText }}▾]</span>
          <div v-if="showDir" class="dropdown open" style="position:absolute;left:0;top:100%">
            <button class="dropdown-item" @click="setDir('forward'); showDir = false">{{ STR.cut.forward }}（→明天）</button>
            <button class="dropdown-item" @click="setDir('backward'); showDir = false">{{ STR.cut.backward }}（→昨天）</button>
          </div>
        </span>。
      </p>
      <div class="actions">
        <span class="spacer"></span>
        <button class="primary" @click="onConfirm">{{ STR.btn.ok }}</button>
        <button @click="emit('close')">{{ STR.btn.cancel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { STR } from '../strings.js'
import { fmt } from '../store/timelog.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  initialMin: { type: Number, default: 0 },
  availableDirs: { type: Array, default: () => ['forward', 'backward'] },
})

const emit = defineEmits(['close', 'confirm'])

const timeInput = ref(null)
const timeStr = ref(fmt(props.initialMin))
const direction = ref(props.availableDirs[0])
const showDir = ref(false)

const directionText = computed(() =>
  direction.value === 'forward' ? STR.cut.forward : STR.cut.backward
)

function setDir(d) {
  direction.value = d
}

watch(() => props.show, async (v) => {
  if (v) {
    timeStr.value = fmt(props.initialMin)
    direction.value = props.availableDirs[0]
    showDir.value = false
    await nextTick()
    timeInput.value?.focus()
    timeInput.value?.select()
  }
})

function parseTime(str) {
  // HH:MM
  const m = str.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (m) {
    const h = parseInt(m[1]), min = parseInt(m[2])
    if (h < 0 || h > 23 || min < 0 || min > 59) return null
    return h * 60 + min
  }
  // HHMM (省略 :)
  const n = str.trim().match(/^(\d{2})(\d{2})$/)
  if (n) {
    const h = parseInt(n[1]), min = parseInt(n[2])
    if (h < 0 || h > 23 || min < 0 || min > 59) return null
    return h * 60 + min
  }
  return null
}

function onConfirm() {
  const cutAt = parseTime(timeStr.value)
  if (cutAt == null) {
    timeInput.value?.select()
    return
  }
  emit('confirm', cutAt, direction.value)
}

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const items = e.currentTarget.querySelectorAll('button:not([disabled]), input:not([disabled])')
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

<style scoped>
.cut-confirm .cut-line {
  font-size: 15px;
  line-height: 2.4;
  margin: 8px 0 0;
  text-align: center;
}
.cut-time-input {
  width: 60px;
  text-align: center;
  font-family: inherit;
  font-size: inherit;
  border: none;
  border-bottom: 1.5px solid var(--border);
  background: transparent;
  outline: none;
  border-radius: 0;
  padding: 0 2px;
  font-variant-numeric: tabular-nums;
}
.cut-time-input:focus {
  border-bottom-color: var(--primary);
}
.cut-dir-wrap {
  position: relative;
  display: inline-block;
}
.cut-dir-btn {
  cursor: pointer;
  border-bottom: 1.5px dashed var(--text2);
  padding: 0 2px;
}
</style>
