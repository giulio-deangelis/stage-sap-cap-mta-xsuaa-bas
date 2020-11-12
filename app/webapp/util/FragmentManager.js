/** Utility class to manage view fragments with ease */
sap.ui.define([], function () {
    'use strict'
    
    const fragments = {}
    
    return function (controller) {
        
        /** Returns the fragment at the specified path, creating it if necessary */
        this.get = function (path) {
            let fragment = fragments[path]
            if (!fragment) {
                const id = controller.getView().getId()
                const i18n = controller.getView().getModel('i18n')
                fragment = sap.ui.xmlfragment(id, path, controller)
                fragments[path] = fragment
                fragment.setModel(i18n, 'i18n')
            }
            return fragment 
        }
        
        /** Opens and returns the fragment */
        this.open = function (path) {
            const fragment = this.get(path)
            fragment.open()
            return fragment
        }
        
        /** Closes and returns the fragment */
        this.close = function (path) {
            const fragment = fragments[path]
            if (fragment) fragment.close()
            return fragment
        }
        
        /** Destroys the fragment */
        this.destroy = function (path) {
            const fragment = fragments[path]
            if (fragment) {
                fragment.destroy()
                fragments[path] = undefined
            }
        }
        
        /** Closes and destroys the fragment */
        this.closeAndDestroy = function (path) {
            const fragment = fragments[path]
            if (fragment) {
                fragment.close()
                fragment.destroy()
                fragments[path] = undefined
            }
        }
        
        this.getModel = function (path, model) {
            return this.get(path).getModel(model)
        }
        
        /** Returns the model's data assigned to the specified fragment */
        this.getModelData = function (path, model) {
            return this.getModel(path, model).getData()
        }
    }
})