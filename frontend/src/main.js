import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useSettingsStore } from './store/settings.js'
import { initI18n } from './i18n/index.js'
import { vEllipsis } from './directives/ellipsis.js'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.directive('ellipsis', vEllipsis)
// 应用持久化语言并跟随 settings.language 变化（挂载前完成，保证首屏语言正确）
initI18n(useSettingsStore())
app.mount('#app')
