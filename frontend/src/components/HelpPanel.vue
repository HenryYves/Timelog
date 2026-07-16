<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal" @keydown="trapFocus">
      <h2>操作指南</h2>

      <div class="help-section">
        <h3>时间块操作</h3>
        <ul>
          <li>在时间轴上<span>拖动</span>选择时段，松开后填写内容</li>
          <li><span>左键</span>点击色块编辑</li>
          <li><span>右键</span>勾选/取消色块（多选）</li>
          <li>拖动色块<span>顶部/底部边缘</span>调整时长</li>
        </ul>
      </div>

      <div class="help-section">
        <h3>快捷键</h3>
        <ul>
          <li><kbd>Esc</kbd> 关闭弹窗 / 取消选择</li>
          <li><kbd>Delete</kbd> 删除选中的时间块</li>
          <li><kbd>Ctrl</kbd> + <kbd>C</kbd> 复制选中</li>
          <li><kbd>Ctrl</kbd> + <kbd>V</kbd> 粘贴到鼠标悬停位置</li>
          <li><kbd>T</kbd> 快速记录当前时间</li>
          <li><kbd>?</kbd> 打开此帮助</li>
          <li><kbd>&uarr;</kbd><kbd>&darr;</kbd> 拖动时微调时间（&plusmn;1 分钟）</li>
        </ul>
      </div>

      <div class="help-section">
        <h3>数据备份</h3>
        <ul>
          <li>桌面应用<span>自动静默备份</span>到 <code>timelog_data</code> 文件夹</li>
          <li>浏览器中请用<span>「导出备份」</span>按钮手动保存 JSON</li>
          <li>每天首次操作时生成上一日期的备份，<span>最多保留 4 个</span></li>
        </ul>
      </div>

      <div class="help-section">
        <h3>文本导入/导出</h3>
        <ul>
          <li>用<span>「导出文本」</span>复制当天内容，可粘贴到笔记</li>
          <li>用<span>「文本导入」</span>把之前导出的文本解析回来</li>
          <li>也支持<span>「导出备份」&rarr;「导入」</span>做完整 JSON 迁移</li>
        </ul>
      </div>

      <div class="help-footer">
        Made by Yves / 陈虹宇 &middot; 2026
      </div>

      <div class="actions">
        <span class="spacer"></span>
        <button @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  show: Boolean,
})
const emit = defineEmits(['close'])

// Focus trap
function trapFocus(e) {
  if (e.key !== 'Tab') return
  const modal = e.currentTarget
  const focusable = modal.querySelectorAll(
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
</script>

<style scoped>
.modal { max-height: calc(82vh / var(--zoom, 1)); overflow: auto; }
.help-section {
  margin: 12px 0;
  position: relative;
  padding-left: 14px;
}
.help-section::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 6px;
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(to bottom, rgb(145,234,228) 0%, rgb(134,168,231) 15%, rgb(127,127,213) 40%);
}
.help-section h3 {
  font-size: 13.5px;
  margin: 0 0 4px;
  color: var(--text);
}
.help-section ul {
  margin: 0;
  padding: 0 0 0 18px;
}
.help-section li {
  font-size: 13px;
  line-height: 1.9;
  color: var(--text2);
}
.help-section li span {
  color: var(--text);
}
.help-footer {
  text-align: center;
  font-size: 12px;
  color: var(--text2);
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}
</style>
