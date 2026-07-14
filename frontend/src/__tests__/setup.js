/**
 * Mock window.getSelection for jsdom (which doesn't properly support Selection.addRange).
 *
 * jsdom's Selection object has all the right methods, but addRange() is a no-op:
 * rangeCount stays 0 and getRangeAt(0) throws.  This mock stores ranges in an
 * internal array so that saveCursor (and any other cursor-aware code) can
 * retrieve them during tests.
 *
 * The mock is a singleton — getSelection() always returns the same object so
 * that placeCursor() in the test and saveCursor() in the implementation share
 * the same backing range list.
 */
if (typeof window !== 'undefined') {
  const _ranges = []

  // Build a singleton selection mock once, then always return it.
  const mockSelection = {
    get rangeCount() {
      return _ranges.length
    },
    configurable: true,
    addRange(range) {
      _ranges.push(range)
    },
    removeAllRanges() {
      _ranges.length = 0
    },
    removeRange(range) {
      const idx = _ranges.indexOf(range)
      if (idx !== -1) _ranges.splice(idx, 1)
    },
    getRangeAt(index) {
      if (index < 0 || index >= _ranges.length) throw new Error('Invalid range index.')
      return _ranges[index]
    },
    collapse(node, offset) {
      // no-op for tests; ranges are set up directly via placeCursor
    },
    collapseToStart() {},
    collapseToEnd() {},
    extend() {},
    setBaseAndExtent() {},
    selectAllChildren() {},
    deleteFromDocument() {},
    containsNode() {},
    toString() { return '' },
    empty() { _ranges.length = 0 },
    setPosition() {},
  }

  window.getSelection = function () {
    return mockSelection
  }
}
