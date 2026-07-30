// frontend/src/utils/dayStorage.js
// v1/v2 day-storage normalization helpers.
// v1 stored an array of blocks; v2 stores { blocks: [...], _cutMeta: {...} }.

/**
 * @param {*} data - parsed localStorage value for a day key
 * @returns {Array} the blocks array
 */
export function extractBlocks(data) {
  if (Array.isArray(data)) return data
  return data?.blocks || []
}

/**
 * @param {*} data - parsed localStorage value for a day key
 * @returns {Object} the _cutMeta object
 */
export function extractCutMeta(data) {
  if (Array.isArray(data)) return {}
  return data?._cutMeta || {}
}

/**
 * @param {*} data - parsed localStorage value for a day key
 * @returns {{ blocks: Array, _cutMeta: Object }}
 */
export function normalizeDayData(data) {
  return {
    blocks: extractBlocks(data),
    _cutMeta: extractCutMeta(data),
  }
}
