sap.ui.define([
  "sap/ui/core/format/DateFormat"
], function (DateFormat) {
  "use strict";

  const dateFormatter = DateFormat.getDateInstance({pattern: "dd/MM/yyyy"});

  return {

    formatDate: function (date, utc = false) {
      const parsedDate = (typeof date === "string") ? dateFormatter.parse(date) : date;
      return dateFormatter.format(parsedDate, utc);
    },

    parseDate: function (dateStr, utc = false) {
      return dateFormatter.parse(dateStr, utc);
    }
  };
});