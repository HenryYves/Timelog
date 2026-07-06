import { ref } from 'vue'
import { TOAST_DURATION } from '../constants.js'

let toastMsg = ref('')
let toastVisible = ref(false)
let toastTimer = null

export function useToast() {
  function toast(msg) {
    toastMsg.value = msg
    toastVisible.value = true
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastVisible.value = false }, TOAST_DURATION)
  }
  return { toastMsg, toastVisible, toast }
}
