sap.ui.define([], () => {

  const themes = [
    {
      name: 'dark',
      properties: {}
    },
    {
      name: 'light',
      properties: {}
    }
  ]

  var activeTheme = null

  return {

    get activeTheme() {
      return activeTheme
    },

    getTheme(name) {
      return themes.find(it => it.name === name)
    },

    setTheme(name) {
      const theme = this.getTheme(name)
      if (!theme) return

      for (const prop of Object.keys(theme.properties))
        document.documentElement.style.setProperty(prop, theme.properties[prop])

      activeTheme = theme
    }
  }
})