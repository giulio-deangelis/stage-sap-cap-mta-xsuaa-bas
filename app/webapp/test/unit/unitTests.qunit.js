/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"training/hours/web/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
