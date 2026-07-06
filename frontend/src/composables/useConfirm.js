import { ref } from 'vue'

let confirmVisible = ref(false)
let confirmMessage = ref('')
let confirmType = ref('alert')
let confirmResolve = null

export function useConfirm() {
  function showConfirm(msg) {
    confirmType.value = 'confirm'
    confirmMessage.value = msg
    confirmVisible.value = true
    return new Promise(resolve => {
      confirmResolve = resolve
    })
  }

  function showAlert(msg) {
    confirmType.value = 'alert'
    confirmMessage.value = msg
    confirmVisible.value = true
    return new Promise(resolve => {
      confirmResolve = resolve
    })
  }

  function resolveConfirm(val) {
    confirmVisible.value = false
    if (confirmResolve) {
      const r = confirmResolve
      confirmResolve = null
      r(val)
    }
  }

  return { confirmVisible, confirmMessage, confirmType, showConfirm, showAlert, resolveConfirm }
}
