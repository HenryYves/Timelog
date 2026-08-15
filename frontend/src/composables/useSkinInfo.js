/**
 * @fileoverview 皮肤元信息共享状态（模块级单例，同 useToast 模式）
 *
 * 职责：
 * - 持有当前激活皮肤的元信息（作者/版本/提示/警告 + 默认展开标记）
 * - 提供 refreshSkinInfo() 重读皮肤元信息
 *
 * 用法：App.vue 在皮肤注入完成后调 refreshSkinInfo() 写入；
 *      AppearanceTab.vue 通过 useSkinInfo() 读取渲染。
 */

import { ref } from 'vue'
import { readSkinInfo } from '../utils/skin.js'

const skinInfo = ref({ author: '', version: '', tip: '', warning: '', expanded: false })

export function refreshSkinInfo() {
  skinInfo.value = readSkinInfo()
}

export function useSkinInfo() {
  return { skinInfo, refreshSkinInfo }
}
