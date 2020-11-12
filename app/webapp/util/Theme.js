sap.ui.define([], () => {
  return {
    set(theme) {
      const dark = theme === 'dark'
      sap.ui.getCore().applyTheme(dark ? 'sap_fiori_3_dark' : 'sap_fiori_3');
      localStorage.setItem('theme', theme)
    }
  }
})