/**
 * displayBlocks.js — v2 存储坐标 → 统一显示坐标的归一化
 *
 * forward 剪切后（_cutMeta.toNext 存在），源日的今天块以局部坐标 [0, cutAt) 存储，
 * 渲染/导出时需要 +1440 回到今天帧 [1440, 2880)。
 * backward 剪切后今天块直接存储在今天帧，无需转换。
 *
 * 统一显示坐标系：昨天 [0, 1440)，今天 [1440, 2880)，明天 [2880, 4320)。
 */
import { DAY_MIN } from '../constants.js'

/** 今天块从存储坐标到显示坐标的偏移量（0 或 1440） */
export function todayStorageOffset(cutMeta, storageStart) {
  return cutMeta?.toNext && storageStart < DAY_MIN ? DAY_MIN : 0
}

/**
 * 存储块 → 显示块。保留原始坐标到 _storageStart/_storageEnd。
 * 胶水块（_cut）坐标本就在正确帧上，不转换。
 */
export function toDisplayBlock(b, cutMeta) {
  const off = todayStorageOffset(cutMeta, b.start)
  if (b._cut || !off) {
    return { ...b, _storageStart: b.start, _storageEnd: b.end }
  }
  return {
    ...b,
    start: b.start + off,
    end: b.end + off,
    _storageStart: b.start,
    _storageEnd: b.end,
  }
}
