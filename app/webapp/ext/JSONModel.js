sap.ui.define(['sap/ui/model/json/JSONModel'], (JSONModel) => {
  'use strict'

  $.extend(JSONModel.prototype, {

    /** Adds an element to the beginning of the list at the specified path */
    unshiftProperty(listPath, value) {
      this._addProperty(listPath, value, true)
    },

    /** Pushes an element to the list at the specified path  */
    pushProperty(listPath, value) {
      this._addProperty(listPath, value, false)
    },

    /** Removes a property from this model, even if it refers to an element inside a list */
    removeProperty(path) {
      const index = parseInt(path.substringAfterLast('/'), 0)
      if (index >= 0) { // if it's an array property
        const listPath = path.substringBeforeLast('/')
        const list = this.getProperty(listPath)
        list.removeAt(index)
        this.setProperty(listPath, list)
      } else {
        this.setProperty(path, undefined)
      }
    },

    /** Removes all the specified properties, even if they refer to elements inside a list */
    removeProperties(paths) {
      const sorted = paths.sort((a, b) => {
        a = parseInt(a.substringAfterLast('/'), 0)
        b = parseInt(b.substringAfterLast('/'), 0)
        return (a >= 0 && b >= 0 && (b - a))
      })
      for (const path of sorted)
        this.removeProperty(path)
    },

    /** Attach a liveChange listener to the input so that when it triggers, the property also changes */
    bindLiveChange(input, property, listener) {
      function onChange(ev, prop) {
        const ctx = ev.getSource().getBindingContext()
        const path = ctx.getPath()
        this.setProperty(path + prop, ev.getParameter('value'))
        if (listener) {
          listener({
            value: ev.getParameter('value'),
            context: ctx,
            property,
            path,
            object: ctx.getObject()
          })
        }
      }
      input.attachLiveChange(property.prefixedOnceWith('/'), onChange, this)
    },

    _addProperty(listPath, value, unshift) {
      const list = this.getProperty(listPath)
      if (unshift) list.unshift(value)
      else list.push(value)
      this.setProperty(listPath, list)
    }
  })
})