sap.ui.define([
  'sap/ui/core/mvc/Controller',
  'training/hours/web/util/User',
  'training/hours/web/util/Theme'
], (Controller, User, Theme) => {
  'use strict'

  const bus = sap.ui.getCore().getEventBus()

  return Controller.extend('training.hours.web.controller.Home', {
    
    async onInit() {
      await User.fetchToken()
      this.byId('projectsTile').setVisible(User.is('admin'))
      this.setTheme(localStorage.getItem('theme') || 'light')
      bus.subscribe('app', 'onLimitWidth', this.onLimitWidth, this)

      this.getOwnerComponent()
        .getRouter()
        .getRoute('Home')
        .attachPatternMatched(this.onEnter, this)
    },

    onEnter() {
      this.byId('shell').setAppWidthLimited(true)
    },

    navTo(target) {
      this.getOwnerComponent().getRouter().navTo(target)
    },

    onShowProjects() {
      this.navTo('Projects')
    },

    onShowHours() {
      this.navTo('Hours')
    },

    onLimitWidth(_ev, _ch, params, limit = params.limit) {
      this.byId('shell').setAppWidthLimited(limit)
    },

    onThemeChange() {
      const currentTheme = localStorage.getItem('theme')
      this.setTheme(currentTheme === 'dark' ? 'light' : 'dark')
    },

    setTheme(theme) {
      Theme.set(theme)
      this.byId('themeButton').setText(theme === 'dark' ? 'Dark' : 'Light')
    }
  });
});