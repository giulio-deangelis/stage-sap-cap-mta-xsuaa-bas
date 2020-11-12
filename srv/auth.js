const xsenv = require('@sap/xsenv')
const xssec = require('@sap/xssec')
const passport = require('passport')

xsenv.loadEnv()

const xsuaa = xsenv.getServices({xsuaa: {tags: 'xsuaa'}}).xsuaa

module.exports = {

  get credentials() {
    return xsuaa
  },

  get jwtStrategy() {
    return new xssec.JWTStrategy(this.credentials)
  },

  get passport() {
    return passport
  },

  scope(name) {
    return this.credentials.xsappname + '.' + name
  },

  authenticate(scope, req, res) {
    if (!req.authInfo.checkScope(this.scope(scope))) {
      res.status(401)
      return false
    }
    return true
  },

  configure(app) {
    passport.use(this.jwtStrategy)
    app.use(passport.initialize())
    app.use(passport.authenticate('JWT', {session: false}))
  },

  decodeToken(req) {
    try {
      const token = req.headers.authorization.substring(7).split('.')[1]
      return JSON.parse(Buffer.from(token, 'base64').toString('ascii'))
    }
    catch (err) {
      return null
    }
  }
}