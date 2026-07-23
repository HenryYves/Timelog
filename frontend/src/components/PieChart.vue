<!-- frontend/src/components/PieChart.vue -->
<template>
  <div class="pie-wrap">
    <div v-if="slices.length === 0" class="no-data">{{ noDataText }}</div>
    <svg v-else class="pie-svg" viewBox="0 0 700 260" xmlns="http://www.w3.org/2000/svg">
      <path v-for="s in slices" :key="s.tag"
        :d="s.path" :fill="s.color"
        :class="['pie-slice', { interactive }]"
        @mouseenter="$emit('slice-enter', s)"
        @mouseleave="$emit('slice-leave')" />
      <polyline v-for="l in labels" :key="'ln'+l.tag"
        :points="l.linePoints" :stroke="l.color" fill="none"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      <text v-for="l in labels" :key="'tx'+l.tag"
        :x="l.textX" :y="l.textY" :text-anchor="l.anchor"
        class="pie-label" font-size="12">
        <tspan :fill="l.color" font-weight="500">{{ l.tag }}</tspan>
        <tspan v-if="showData" fill="var(--text2)"> {{ l.dataText }}</tspan>
        <tspan v-if="showPercent" fill="var(--text2)"> {{ l.pctText }}</tspan>
      </text>
    </svg>
  </div>
</template>

<script setup>
defineProps({
  slices: { type: Array, required: true },
  labels: { type: Array, required: true },
  interactive: { type: Boolean, default: false },
  showData: { type: Boolean, default: false },
  showPercent: { type: Boolean, default: false },
  noDataText: { type: String, default: '' },
})
defineEmits(['slice-enter', 'slice-leave'])
</script>

<style scoped>
.pie-wrap { display: flex; flex-direction: column; gap: 12px; }
.pie-svg { width: 100%; max-width: calc(950px / var(--zoom, 1)); height: auto; }
.pie-slice { transition: opacity 0.2s ease, filter 0.2s ease; }
.pie-slice.interactive { cursor: pointer; }
.pie-slice.interactive:hover { opacity: 0.8; filter: brightness(1.15) drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
.pie-label { dominant-baseline: middle; }
.no-data { text-align: center; color: var(--text2); font-size: 14px; padding: 20px; }
</style>
