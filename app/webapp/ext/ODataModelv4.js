sap.ui.define(['sap/ui/model/odata/v4/ODataModel'], ODataModel => {

  $.extend(ODataModel.prototype, {

    url(path) {
      return this.sServiceUrl + path.prefixedOnceWith('/')
    }
  })
})