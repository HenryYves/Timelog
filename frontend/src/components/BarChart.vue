<!-- frontend/src/components/BarChart.vue -->
<template>
  <div class="bar-wrap">
    <div v-if="items.length === 0" class="no-data">{{ noDataText }}</div>
    <div v-else class="bar-chart">
      <div class="bar-row" v-for="d in items" :key="d.tag" :class="{ interactive }"
        @mouseenter="$emit('slice-enter', d)"
        @mouseleave="$emit('slice-leave')">
        <span class="bar-label" :title="d.tag">{{ d.tag }}</span>
        <span class="bar-track">
          <span class="bar-fill" :style="{ width: barW(d.minutes) + '%', background: d.color }"></span>
        </span>
        <span v-if="showData" class="bar-data">{{ fmtDur(d.minutes) }}</span>
        <span v-if="showPercent" class="bar-pct">{{ pctOf(items, d.minutes) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { fmtDur, pctOf } from '../utils/stats.js'

const props = defineProps({
  items: { type: Array, required: true },
  interactive: { type: Boolean, default: false },
  showData: { type: Boolean, default: false },
  showPercent: { type: Boolean, default: false },
  noDataText: { type: String, default: '' },
})
defineEmits(['slice-enter', 'slice-leave'])

function barW(min) {
  const max = Math.max(...props.items.map(d => d.minutes), 1)
  return (min / max) * 100
}
</script>

<style scoped>
.bar-wrap { display: flex; flex-direction: column; }
.bar-chart { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.bar-row { display: flex; align-items: center; gap: 10px; }
.bar-label { width: 90px; font-size: 13px; text-align: right; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.bar-track { flex: 1; height: 20px; background: var(--soft); border-radius: 10px; overflow: hidden; }
.bar-fill { display: block; height: 100%; border-radius: 10px; min-width: 2px; transition: filter 0.2s; }
.bar-row.interactive:hover .bar-fill { filter: brightness(1.1); }
.bar-data, .bar-pct { font-size: 12px; color: var(--text2); min-width: 40px; font-variant-numeric: tabular-nums; }
.no-data { text-align: center; color: var(--text2); font-size: 14px; padding: 20px; }
</style>
