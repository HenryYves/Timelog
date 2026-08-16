<template>
  <Transition name="toast">
    <div v-if="visible" class="toast">{{ message }}</div>
  </Transition>
</template>

<script setup>
import { useToast } from '../composables/useToast.js'

const { toastMsg: message, toastVisible: visible } = useToast()
</script>

<style scoped>
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--toast-bg, #2C2C2B);
  color: var(--toast-text, #fff);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 9999;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(0,0,0,.25);
  max-width: 80vw;
  text-align: center;
  white-space: nowrap;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity .2s var(--ease-out), transform .2s var(--ease-out);
}
.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, 6px);
}
.toast-leave-to {
  opacity: 0;
}
</style>
