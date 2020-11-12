/** Kotlin-like List extension methods */
sap.ui.define([], function () {
  "use strict";

  $.extend(Array.prototype, {

    distinct() {
      const set = new Set();
      for (const element of this)
        set.add(element);
      return Array.from(set);
    },

    clear() {
      this.length = 0;
    },

    isEmpty() {
      return this.length === 0;
    },

    isNotEmpty() {
      return this.length > 0;
    },

    first() {
      return this[0];
    },

    last() {
      return this[this.length - 1];
    },

    getOrNull(index) {
      return index < this.length ? this[index] : null
    },

    firstOrNull() {
      return this.getOrNull(0)
    },

    lastOrNull() {
      return this.getOrNull(this.length - 1)
    },

    mapNotNull(transform) {
      const list = [];
      for (const element of this) {
        const transformed = transform(element);
        if (transformed) list.push(transformed);
      }
      return list;
    },

    removeAt(index) {
      const element = this[index];
      this.splice(index, 1);
      return element;
    },

    removeFirst(predicate) {
      const index = this.findIndex(predicate);
      if (index >= 0) return this.remove(index);
      else return null;
    },

    remove(element, key) {
      return this.removeFirst(it => it[key] === element[key]);
    },

    removeAll(elements, key) {
      for (const element of elements)
        this.remove(element, key);
      return this;
    },

    findBy(values) {
      const keys = Object.keys(values)
      for (const element of this) {
        let found = true
        for (const key of keys) {
          if (element[key] !== values[key]) {
            found = false
            break
          }
        }
        if (found) return element
      }
      return null
    }
  });
});










