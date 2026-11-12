<!--
  ThanksPanel.vue — 特别鸣谢弹窗
  内容：开源依赖、素材来源、贡献者致谢、出票机与可翻转赞赏卡片。
  卡片 UI 基于 Uiverse.io / Marcelo Dolza 的 ticket 设计（MIT），按本项目需求改写：
  票面形状、缺口、条码、立体方块、反光、悬浮与出票节奏均保留。
  外部链接经 tauri opener 插件交给系统浏览器打开，避免 WebView 自身导航。
-->
<template>
  <div v-if="show" class="overlay" @mousedown.self="emit('close')" @keydown.escape.stop="emit('close')">
    <div class="modal thanks-modal" @keydown="trapFocus">
      <h2>{{ STR.thanks.title }}</h2>

      <div class="thanks-section">
        <h3>{{ STR.thanks.sectionProjects }}</h3>
        <ul class="thanks-list">
          <li v-for="p in STR.thanks.projects" :key="p.name">
            <a :href="p.url" @click.prevent="openLink(p.url)">{{ p.name }}</a>
            <span class="thanks-license">{{ p.license }}</span>
            <span class="thanks-desc">{{ p.desc }}</span>
          </li>
        </ul>
        <p class="thanks-note">{{ STR.thanks.projectsNote }}</p>
      </div>

      <div class="thanks-section">
        <h3>{{ STR.thanks.sectionAssets }}</h3>
        <ul class="thanks-list">
          <li v-for="a in STR.thanks.assets" :key="a.name">
            <a :href="a.url" @click.prevent="openLink(a.url)">{{ a.name }}</a>
            <span class="thanks-license">{{ a.license }}</span>
            <span class="thanks-desc">{{ a.desc }}</span>
          </li>
        </ul>
      </div>

      <div class="thanks-section">
        <h3>{{ STR.thanks.sectionPeople }}</h3>
      </div>

      <div class="thanks-card-wrap">
        <button v-if="!ejected" class="tk-eject" @click="eject">
          <span class="tk-eject-circle"><span class="tk-eject-arrow" /></span>
          <span class="tk-eject-text">{{ STR.thanks.eject }}</span>
        </button>
        <div class="tk-slot" />
        <div class="tk-slot-wrap" :class="{ open: ejected }">
          <div ref="ticketRef" class="tk-ticket" :class="{ settled }" role="button" :tabindex="ejected ? 0 : -1"
            :aria-hidden="!ejected" :aria-label="STR.thanks.cardHint"
            @click="flipped = !flipped"
            @keydown.enter.prevent="flipped = !flipped" @keydown.space.prevent="flipped = !flipped">
            <div class="tk-float">
              <div class="tk-flip-container" :class="{ flipped }">
                <!-- 正面 -->
                <div class="tk-face tk-front">
                  <div class="tk-body">
                    <div class="tk-reflex" />
                    <svg class="tk-cube" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path style="--i: 1" class="tk-path-center" d="M12 12.75L14.25 11.437M12 12.75L9.75 11.437M12 12.75V15" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
                      <path style="--i: 2" class="tk-path-t" d="M9.75 3.562L12 2.25L14.25 3.563" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
                      <path style="--i: 3" class="tk-path-tr" d="M21 7.5L18.75 6.187M21 7.5V9.75M21 7.5L18.75 8.813" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
                      <path style="--i: 4" class="tk-path-br" d="M21 14.25V16.5L18.75 17.813" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
                      <path style="--i: 5" class="tk-path-b" d="M12 21.75L14.25 20.437M12 21.75V19.5M12 21.75L9.75 20.437" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
                      <path style="--i: 6" class="tk-path-bl" d="M5.25 17.813L3 16.5V14.25" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
                      <path style="--i: 7" class="tk-path-tl" d="M3 7.5L5.25 6.187M3 7.5L5.25 8.813M3 7.5V9.75" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <header class="tk-head">
                      <div class="tk-name">
                        <div class="tk-line tk-line-thin">
                          <span v-for="(ch, i) in frontChars" :key="i"
                            :style="{ '--i': i + 1 }">{{ ch }}</span>
                        </div>
                        <div class="tk-line tk-line-bold">
                          <span v-for="(ch, i) in subChars" :key="i" class="tk-bold"
                            :style="{ '--i': i + frontChars.length + 1 }">{{ ch }}</span>
                        </div>
                      </div>
                      <div class="tk-barcode" />
                    </header>
                    <div class="tk-contents">
                      <div class="tk-event">
                        <div class="tk-event-main">{{ STR.thanks.cardFrontSub }}</div>
                        <div class="tk-event-sub">{{ STR.thanks.cardThanksLine }}</div>
                      </div>
                      <div class="tk-number">#001</div>
                    </div>
                  </div>
                </div>

                <!-- 背面 -->
                <div class="tk-face tk-back">
                  <div class="tk-body">
                    <div class="tk-reflex" />
                    <header class="tk-head">
                      <div class="tk-name tk-name-static">{{ STR.thanks.cardFront }}</div>
                      <div class="tk-barcode" />
                    </header>
                    <div class="tk-contents tk-contents-center">
                      <div class="tk-qrbox">
                        <img class="tk-qr" :src="qrSrc" :alt="STR.thanks.cardBackHint" draggable="false" />
                      </div>
                      <div class="tk-back-hint">{{ STR.thanks.cardBackHint }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p v-if="ejected" class="thanks-note">{{ STR.thanks.donateNote }}</p>
      </div>

      <div class="actions">
        <span class="spacer"></span>
        <button @click="emit('close')">{{ STR.thanks.close }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { STR } from '../strings.js'
import { logger } from '../utils/log.js'
import qrSrc from '../assets/thanks-qr.png'

defineProps({ show: Boolean })
const emit = defineEmits(['close'])

const flipped = ref(false)
const ejected = ref(false)
const settled = ref(false)   // 出票动画结束后才允许悬停/点击翻面
const ticketRef = ref(null)
let settleTimer = null

const frontChars = computed(() => Array.from(STR.thanks.cardFront || ''))
const subChars = computed(() => Array.from(STR.thanks.cardFrontSub || ''))

// 出票：卡片从票槽逐格滑出，容器高度随之增长（不预留空间）
function eject() {
  ejected.value = true
  settleTimer = setTimeout(() => { settled.value = true }, 1900)
  nextTick(() => ticketRef.value?.focus?.())
}

onBeforeUnmount(() => clearTimeout(settleTimer))

async function openLink(url) {
  try {
    if (window.__TAURI__?.core?.invoke) {
      await window.__TAURI__.core.invoke('plugin:opener|open_url', { url })
      return
    }
  } catch (e) {
    logger.error('thanks', 'open external link failed', e)
  }
  window.open(url, '_blank', 'noopener')
}

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const modal = e.currentTarget
  const focusable = modal.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')
  const visible = [...focusable].filter(el => el.offsetParent !== null)
  if (!visible.length) return
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
.thanks-modal {
  width: 520px;
  max-width: calc(100vw - 48px);
}

.thanks-section {
  margin-bottom: 14px;
}

.thanks-section h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text2);
  margin: 0 0 6px;
}

.thanks-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
}

.thanks-list a {
  color: var(--link, #3a7bd5);
  text-decoration: none;
}

.thanks-list a:hover,
.thanks-list a:focus-visible {
  text-decoration: underline;
}

.thanks-license {
  margin-left: 8px;
  font-size: 11px;
  color: var(--text2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 4px;
}

.thanks-desc {
  margin-left: 8px;
  color: var(--text2);
}

.thanks-note {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text2);
}

.thanks-card-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 18px 0 6px;
}

/* ---- 出票按钮（UI 基于 Uiverse.io / cssbuttons-io，MIT，已改写） ---- */
.tk-eject {
  position: relative;
  display: inline-block;
  cursor: pointer;
  border: 0;
  padding: 0;
  background: transparent;
  width: 12rem;
  height: 3rem;
  font: inherit;
}

.tk-eject-circle {
  transition: all 0.45s cubic-bezier(0.65, 0, 0.076, 1);
  position: relative;
  display: block;
  margin: 0;
  width: 3rem;
  height: 3rem;
  background: #282936;
  border-radius: 1.625rem;
}

.tk-eject-arrow {
  transition: all 0.45s cubic-bezier(0.65, 0, 0.076, 1);
  position: absolute;
  top: 0;
  bottom: 0;
  margin: auto;
  left: 0.625rem;
  width: 1.125rem;
  height: 0.125rem;
  background: none;
}

.tk-eject-arrow::before {
  position: absolute;
  content: "";
  top: -0.29rem;
  right: 0.0625rem;
  width: 0.625rem;
  height: 0.625rem;
  border-top: 0.125rem solid #fff;
  border-right: 0.125rem solid #fff;
  transform: rotate(45deg);
}

.tk-eject-text {
  transition: all 0.45s cubic-bezier(0.65, 0, 0.076, 1);
  position: absolute;
  inset: 0;
  padding: 0.75rem 0;
  margin: 0 0 0 1.85rem;
  color: #282936;
  font-weight: 700;
  line-height: 1.6;
  text-align: center;
  letter-spacing: 0.04em;
}

.tk-eject:hover .tk-eject-circle,
.tk-eject:focus-visible .tk-eject-circle {
  width: 100%;
}

.tk-eject:hover .tk-eject-arrow,
.tk-eject:focus-visible .tk-eject-arrow {
  background: #fff;
  transform: translate(1rem, 0);
}

.tk-eject:hover .tk-eject-text,
.tk-eject:focus-visible .tk-eject-text {
  color: #fff;
}

.tk-eject:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 4px;
  border-radius: 26px;
}

/* ---- 票槽 ---- */
.tk-slot {
  width: 348px;
  max-width: 100%;
  height: 10px;
  border-radius: 5px;
  background: linear-gradient(#363c49, #0d1015);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.65), 0 1px 0 rgba(255, 255, 255, 0.06);
  position: relative;
}

.tk-slot::after {
  content: "";
  position: absolute;
  left: 14px;
  right: 14px;
  top: 4px;
  height: 2px;
  border-radius: 2px;
  background: #000;
  opacity: 0.85;
}

.tk-slot-wrap {
  width: 100%;
  max-height: 0;
  overflow: hidden;
  display: flex;
  justify-content: center;
}

.tk-slot-wrap.open {
  animation: tk-grow 1.8s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
  padding-bottom: 8px;
}

/* 与出票动作同步的间歇式增高（一卡一卡地让出位置） */
@keyframes tk-grow {
  0% { max-height: 0; }
  16% { max-height: 60px; }
  26% { max-height: 60px; }
  38% { max-height: 150px; }
  48% { max-height: 150px; }
  60% { max-height: 240px; }
  70% { max-height: 240px; }
  84% { max-height: 320px; }
  100% { max-height: 320px; }
}

/* ---- 赞赏卡片（UI 基于 Uiverse.io / Marcelo Dolza，MIT，已改写） ---- */
.tk-ticket {
  width: 320px;
  max-width: 100%;
  outline: none;
  cursor: pointer;
  perspective: 1600px;
}

/* 出票期间不响应指针，避免光标停在按钮位置时提前触发悬停翻面 */
.tk-ticket:not(.settled) {
  pointer-events: none;
}

.tk-slot-wrap.open .tk-ticket {
  animation: tk-eject 1.8s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

.tk-ticket:focus-visible .tk-body {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* 参考原素材的「一卡一卡」节奏：走一段，停一下 */
@keyframes tk-eject {
  0% { transform: translateY(-280px); opacity: 0; }
  8% { opacity: 1; }
  16% { transform: translateY(-215px); }
  26% { transform: translateY(-215px); }
  38% { transform: translateY(-130px); }
  48% { transform: translateY(-130px); }
  60% { transform: translateY(-40px); }
  70% { transform: translateY(-40px); }
  84% { transform: translateY(10px); }
  92% { transform: translateY(-4px); }
  100% { transform: translateY(0); }
}

.tk-float {
  animation: tk-float 3s ease-in-out 1.9s infinite;
}

@keyframes tk-float {
  0% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
  100% { transform: translateY(0); }
}

.tk-flip-container {
  position: relative;
  width: 100%;
  height: 264px;
  transform-style: preserve-3d;
  transition: transform 0.6s;
}

.tk-flip-container.flipped,
.tk-ticket.settled:hover .tk-flip-container {
  transform: rotateY(180deg);
}

.tk-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  transform-style: preserve-3d;
}

.tk-back {
  transform: rotateY(-180deg);
}

.tk-body {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 248px;
  border-radius: 7px 7px 0 0;
  background: linear-gradient(to bottom, #ffffff, #dcfffd);
  color: #111;
  box-shadow: 0 18px 40px -18px rgba(0, 0, 0, 0.55);
}

/* 票根锯齿 */
.tk-body::after {
  content: "";
  position: absolute;
  bottom: -16px;
  left: 0;
  width: 100%;
  height: 16px;
  background:
    linear-gradient(-135deg, #dcfffd 50%, transparent 50%) 0 50%,
    linear-gradient(-45deg, #dcfffd 50%, transparent 50%) 0 50%,
    transparent;
  background-repeat: repeat-x;
  background-size: 16px 16px;
  pointer-events: none;
}

/* 彩虹渐层 */
.tk-body::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 7px 7px 0 0;
  mask-image: linear-gradient(white 50%, transparent 100%);
  background:
    radial-gradient(at 30% -5%, #90f1f1, #d3ccf0, rgba(255, 255, 255, 0) 25%),
    radial-gradient(at 30% 40%, #aad1f0, rgba(255, 255, 255, 0) 20%),
    radial-gradient(at 50% 70%, #c4f2e5, rgba(255, 255, 255, 0) 30%),
    radial-gradient(at 70% 0%, #d3ccf0, rgba(255, 255, 255, 0) 20%),
    linear-gradient(75deg, #90f1f1 5%, rgba(255, 255, 255, 0), #aad1f0, rgba(255, 255, 255, 0), #e9d0ed, rgba(255, 255, 255, 0), #d3ccf0, rgba(255, 255, 255, 0), #c4f2e5 90%);
  pointer-events: none;
}

.tk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  padding: 15px;
  height: 54px;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.4);
  box-sizing: border-box;
}

/* 撕口 */
.tk-head::before,
.tk-head::after {
  content: "";
  display: block;
  width: 13px;
  height: 13px;
  background: var(--canvas);
  position: absolute;
  right: -8px;
  bottom: -7px;
  border-radius: 50%;
  z-index: 11;
}

.tk-head::after {
  left: -8px;
  right: auto;
}

.tk-name {
  font-weight: 300;
  font-size: 1.05em;
  line-height: normal;
  letter-spacing: -2px;
  position: relative;
  z-index: 1;
}

.tk-line {
  display: flex;
  line-height: 1.2;
}

.tk-line span {
  display: inline-block;
  opacity: 0;
  animation: tk-appear 0.5s cubic-bezier(0.5, 2, 0.3, 0.8) forwards calc(var(--i) * 40ms + 260ms);
}

.tk-line-thin {
  font-size: 15px;
  margin-bottom: 2px;
}

.tk-line-bold span {
  font-weight: 800;
  font-size: 15px;
}

@keyframes tk-appear {
  0% { opacity: 0; transform: translateX(100%); }
  100% { opacity: 1; transform: translateY(0); }
}

.tk-name-static {
  font-weight: 300;
  font-size: 15px;
  letter-spacing: 0.5px;
}

.tk-barcode {
  display: inline-block;
  height: 30px;
  width: 0;
  position: absolute;
  left: 65%;
  top: 12px;
  box-shadow:
    1px 0 0 1px, 5px 0 0 1px, 10px 0 0 1px, 11px 0 0 1px, 15px 0 0 1px,
    18px 0 0 1px, 22px 0 0 1px, 23px 0 0 1px, 26px 0 0 1px, 30px 0 0 1px,
    35px 0 0 1px, 37px 0 0 1px, 41px 0 0 1px, 44px 0 0 1px, 47px 0 0 1px,
    51px 0 0 1px, 56px 0 0 1px, 59px 0 0 1px, 64px 0 0 1px, 68px 0 0 1px,
    72px 0 0 1px, 74px 0 0 1px, 77px 0 0 1px, 81px 0 0 1px, 85px 0 0 1px,
    88px 0 0 1px, 92px 0 0 1px, 95px 0 0 1px, 96px 0 0 1px, 97px 0 0 1px;
}

.tk-cube {
  position: absolute;
  height: 110%;
  z-index: 1;
  top: -3px;
  left: 0;
  right: 0;
  margin: auto;
  mix-blend-mode: soft-light;
  opacity: 0.6;
  pointer-events: none;
}

.tk-cube path {
  animation-delay: calc(var(--i) * 100ms) !important;
  transform-origin: center;
}

.tk-path-center { animation: tk-center 3s ease-in-out infinite; }
.tk-path-t { animation: tk-t 1.6s ease-in-out infinite; }
.tk-path-tr { animation: tk-tr 1.6s ease-in-out infinite; }
.tk-path-br { animation: tk-br 1.6s ease-in-out infinite; }
.tk-path-b { animation: tk-b 1.6s ease-in-out infinite; }
.tk-path-bl { animation: tk-bl 1.6s ease-in-out infinite; }
.tk-path-tl { animation: tk-tl 1.6s ease-in-out infinite; }

@keyframes tk-center { 50% { transform: scale(1.3); } }
@keyframes tk-t { 50% { transform: translateY(1px); } }
@keyframes tk-tl { 50% { transform: translateX(1px) translateY(1px); } }
@keyframes tk-tr { 50% { transform: translateX(-1px) translateY(1px); } }
@keyframes tk-br { 50% { transform: translateX(-1px) translateY(-1px); } }
@keyframes tk-bl { 50% { transform: translateX(1px) translateY(-1px); } }
@keyframes tk-b { 50% { transform: translateY(-1px); } }

.tk-contents {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px 20px;
  pointer-events: all;
}

.tk-contents-center {
  flex-direction: column;
  gap: 6px;
}

.tk-event {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
  margin-top: -8px;
  font-weight: 600;
}

.tk-event-main {
  font-size: 2.1rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.02em;
}

.tk-event-sub {
  margin-top: 6px;
  font-size: 12px;
  letter-spacing: 0.3em;
  color: rgba(47, 76, 139, 0.55);
}

.tk-number {
  position: absolute;
  left: 15px;
  bottom: 2px;
  font-size: 2em;
  color: #b5ddff;
  font-weight: bolder;
  pointer-events: none;
}

.tk-qrbox {
  padding: 6px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}

.tk-qr {
  display: block;
  width: 146px;
  height: 146px;
  pointer-events: none;
  user-select: none;
}

.tk-back-hint {
  font-size: 12px;
  color: #2f4c8b;
}

/* 反光 */
.tk-reflex {
  pointer-events: none;
  position: absolute;
  inset: 0;
  bottom: -5px;
  z-index: 10;
  overflow: hidden;
}

.tk-reflex::before {
  content: "";
  position: absolute;
  width: 300px;
  top: -10%;
  bottom: -10%;
  left: -132%;
  transform: translateX(0) skew(-30deg);
  background: linear-gradient(
    to right,
    rgba(221, 249, 255, 0.4) 10%,
    rgba(221, 245, 255, 0.7) 60%,
    rgba(221, 246, 255, 0.6) 60%,
    rgba(221, 255, 254, 0.4) 90%
  );
  transition: all 0.7s ease;
}

.tk-ticket:hover .tk-reflex::before {
  transform: translate(280%, 0) skew(-30deg);
}
</style>
