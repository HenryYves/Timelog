<template>
  <div
    v-if="show"
    class="dlg-overlay"
    @mousedown.self="$emit('close')"
    @keydown.escape.stop="$emit('close')"
  >
    <div class="dlg-card" ref="cardRef" @keydown="trapFocus">
      <div class="dlg-msg">{{ message }}</div>
      <div class="dlg-btns">
        <button
          v-if="type === 'confirm'"
          class="dlg-cancel"
          @click="$emit('close')"
        >{{ cancelLabel }}</button>
        <button
          class="dlg-ok"
          ref="okBtnRef"
          @click="$emit('confirm')"
        >{{ okLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { STR } from '../strings.js'

const props = defineProps({
  show: Boolean,
  message: { type: String, default: '' },
  type: { type: String, default: 'alert' }, // 'confirm' | 'alert'
})

defineEmits(['close', 'confirm'])

const okBtnRef = ref(null)
const cardRef = ref(null)

// Auto-focus OK button when dialog opens
watch(() => props.show, (val) => {
  if (val) {
    nextTick(() => {
      if (okBtnRef.value) okBtnRef.value.focus()
    })
  }
})

// Focus trap: Tab cycling within the dialog
function trapFocus(e) {
  if (e.key !== 'Tab') return
  const card = cardRef.value
  if (!card) return
  const focusable = card.querySelectorAll(
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

const okLabel = STR.btn.ok
const cancelLabel = STR.btn.cancel
</script>

<style scoped>
.dlg-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20,20,20,.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}
.dlg-card {
  background: #FFFBF0;
  border-radius: 16px;
  padding: 28px 32px 22px;
  max-width: 360px;
  min-width: 220px;
  box-shadow: 0 8px 40px rgba(0,0,0,.18);
}
.dlg-msg {
  font-size: 14px;
  color: var(--text);
  line-height: 1.6;
  text-align: center;
  margin: 0 0 22px;
  word-break: break-word;
}
.dlg-btns {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.dlg-btns button {
  font-family: inherit;
  font-size: 13.5px;
  border-radius: 10px;
  padding: 8px 24px;
  cursor: pointer;
  min-width: 80px;
  transition: background .12s, opacity .12s;
}
.dlg-ok {
  background: #A1AFC9;
  border: 1px solid #A1AFC9;
  color: #fff;
}
.dlg-ok:hover { opacity: .88; }
.dlg-cancel {
  background: var(--canvas);
  border: 1px solid #A1AFC9;
  color: #A1AFC9;
}
.dlg-cancel:hover { background: #F0F2F7; }
</style>
