sap.ui.define([
  'sap/ui/core/UIComponent',
  'sap/ui/Device',
  'sap/ui/model/json/JSONModel',
  './util/User',
  './model/models',
  './ext/String',
  './ext/Array',
  './ext/Date',
  './ext/Table',
  './ext/JSONModel',
  './ext/ODataModelv4'
], function (UIComponent, Device, JSONModel, User, models) {
  'use strict';

  return UIComponent.extend('training.hours.web.Component', {

    metadata: {
      manifest: 'json'
    },

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
    init() {
      // call the base component's init function
      UIComponent.prototype.init.apply(this, arguments)

      // enable routing
      this.getRouter().initialize()

      // set the device model
      this.setModel(models.createDeviceModel(), 'device')

      // fetch the jwt and set it as a model
      const url = this.getModel().sServiceUrl + '/jwt'
      User.fetchToken(url).then(jwt => {
        this.setModel(new JSONModel(jwt), 'jwt')
      })
    }
  });
});