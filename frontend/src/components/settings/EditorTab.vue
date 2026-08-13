<template>
  <div>
    <div class="section-head">
      <h4 class="section-title">{{ STR.settings.sectionEditor }}</h4>
      <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetEditor">
        <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
      </button>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.minBlockMinutes }}</label>
        <div>
          <input type="number" min="0" max="120" style="width:80px;" :value="settings.minBlockMinutes" @change="onMinBlockMinutesChange">
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setMinBlockMinutes(DEFAULT_MIN_BLOCK_MINUTES)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
      <div class="small">{{ STR.settings.descMinBlockMinutes }}</div>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.defaultDuration }}</label>
        <div>
          <input type="number" min="1" max="1440" style="width:80px;" :value="settings.defaultDuration" @change="onDurationChange">
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setDuration(DEFAULT_DURATION)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
      <div class="small">{{ STR.settings.descDefaultDuration }}</div>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.endTimeAtNow }}</label>
        <div>
          <label class="toggle"><input type="checkbox" :checked="settings.endTimeAtNow" @change="settings.setEndTimeAtNow($event.target.checked)"><span class="tk"></span></label>
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setEndTimeAtNow(DEFAULT_END_TIME_AT_NOW)"><span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span></button>
        </div>
      </div>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.markdownPreview }}</label>
        <div>
          <label class="toggle"><input type="checkbox" :checked="settings.markdownPreview" @change="settings.setMarkdownPreview($event.target.checked)"><span class="tk"></span></label>
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setMarkdownPreview(DEFAULT_MARKDOWN_PREVIEW)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
      <div class="small">{{ STR.settings.descMarkdownPreview }}</div>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.tabToIndent }}</label>
        <div>
          <label class="toggle"><input type="checkbox" :checked="settings.tabToIndent" @change="settings.setTabToIndent($event.target.checked)"><span class="tk"></span></label>
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setTabToIndent(DEFAULT_TAB_TO_INDENT)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
      <div class="small">{{ STR.settings.descTabToIndent }}</div>
    </div>

    <div class="section-head">
      <h4 class="section-title">{{ STR.settings.sectionBatchCreate }}</h4>
      <button class="btn-restore" :title="STR.settings.restoreCategory" @click="resetBatchCreate">
        <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
      </button>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.batchMarkdownPreview }}</label>
        <div>
          <label class="toggle"><input type="checkbox" :checked="settings.batchMarkdownPreview" @change="settings.setBatchMarkdownPreview($event.target.checked)"><span class="tk"></span></label>
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setBatchMarkdownPreview(DEFAULT_BATCH_MARKDOWN_PREVIEW)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
      <div class="small">{{ STR.settings.descBatchMarkdownPreview }}</div>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.batchTabToIndent }}</label>
        <div>
          <label class="toggle"><input type="checkbox" :checked="settings.batchTabToIndent" @change="settings.setBatchTabToIndent($event.target.checked)"><span class="tk"></span></label>
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setBatchTabToIndent(DEFAULT_BATCH_TAB_TO_INDENT)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
      <div class="small">{{ STR.settings.descBatchTabToIndent }}</div>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.checkBeforeCreate }}</label>
        <div>
          <label class="toggle"><input type="checkbox" :checked="settings.checkBeforeCreate" @change="settings.setCheckBeforeCreate($event.target.checked)"><span class="tk"></span></label>
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setCheckBeforeCreate(DEFAULT_CHECK_BEFORE_CREATE)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
      <div class="small">{{ STR.settings.descCheckBeforeCreate }}</div>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.copyAfterCreate }}</label>
        <div>
          <label class="toggle"><input type="checkbox" :checked="settings.copyAfterCreate" @change="settings.setCopyAfterCreate($event.target.checked)"><span class="tk"></span></label>
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setCopyAfterCreate(DEFAULT_COPY_AFTER_CREATE)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
      <div class="small">{{ STR.settings.descCopyAfterCreate }}</div>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.autoSelectOnFocus }}</label>
        <div>
          <label class="toggle"><input type="checkbox" :checked="settings.autoSelectOnFocus" @change="settings.setAutoSelectOnFocus($event.target.checked)"><span class="tk"></span></label>
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setAutoSelectOnFocus(DEFAULT_AUTO_SELECT_ON_FOCUS)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
    </div>

    <div class="setting-item">
      <div class="row">
        <label>{{ STR.settings.tagDelimiters }}</label>
        <div>
          <input type="text" :value="settings.tagDelimiters" @change="settings.setTagDelimiters($event.target.value)" placeholder="," style="width:200px;">
          <button class="btn-restore" :title="STR.settings.restoreDefault" @click="settings.setTagDelimiters(DEFAULT_TAG_DELIMITERS)">
            <span class="mico restico" style="-webkit-mask-image: url(/icons/restore.svg)"></span>
          </button>
        </div>
      </div>
      <div class="small">{{ STR.settings.descTagDelimiters }}</div>
    </div>
  </div>
</template>

<script setup>
import { useSettingsStore } from '../../store/settings.js'
import { STR } from '../../strings.js'
import {
  DEFAULT_DURATION, DEFAULT_MARKDOWN_PREVIEW, DEFAULT_TAB_TO_INDENT,
  DEFAULT_BATCH_MARKDOWN_PREVIEW, DEFAULT_BATCH_TAB_TO_INDENT,
  DEFAULT_CHECK_BEFORE_CREATE, DEFAULT_COPY_AFTER_CREATE, DEFAULT_TAG_DELIMITERS,
  DEFAULT_MIN_BLOCK_MINUTES, DEFAULT_END_TIME_AT_NOW, DEFAULT_AUTO_SELECT_ON_FOCUS,
} from '../../constants.js'

const settings = useSettingsStore()

function onDurationChange(e) {
  settings.setDuration(e.target.value)
  e.target.value = settings.defaultDuration
}

function onMinBlockMinutesChange(e) {
  settings.setMinBlockMinutes(e.target.value)
  e.target.value = settings.minBlockMinutes
}

function resetEditor() {
  settings.setDuration(DEFAULT_DURATION)
  settings.setMarkdownPreview(DEFAULT_MARKDOWN_PREVIEW)
  settings.setTabToIndent(DEFAULT_TAB_TO_INDENT)
}

function resetBatchCreate() {
  settings.setBatchMarkdownPreview(DEFAULT_BATCH_MARKDOWN_PREVIEW)
  settings.setBatchTabToIndent(DEFAULT_BATCH_TAB_TO_INDENT)
  settings.setCheckBeforeCreate(DEFAULT_CHECK_BEFORE_CREATE)
  settings.setCopyAfterCreate(DEFAULT_COPY_AFTER_CREATE)
  settings.setTagDelimiters(DEFAULT_TAG_DELIMITERS)
}
</script>
