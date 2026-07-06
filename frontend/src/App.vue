<template>
  <div id="app-container">
    <header>
      <img src="/icons/logo.svg" class="logo" alt="">
      <h1>Timelog</h1>
      <div class="datenav">
        <button @click="store.goPrevDay()">&lt;</button>
        <span class="date">{{ dateLabel }}</span>
        <button @click="store.goNextDay()">&gt;</button>
        <button @click="store.goToday()">今天</button>
      </div>
      <span class="spacer"></span>
    </header>
    <main>
      <Timeline />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTimelogStore } from './store/timelog.js'
import Timeline from './components/Timeline.vue'

const store = useTimelogStore()

const dateLabel = computed(() => {
  const d = store.curDate
  const wd = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
  return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日 ' + wd
})
</script>
