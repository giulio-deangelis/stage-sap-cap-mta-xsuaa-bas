sap.ui.define([], () => {

  var jwt = {}
  var clientId
  var jwtPromise

  return {

    fetchToken(url, fetchNew) {
      if (!fetchNew && jwtPromise)
        return jwtPromise

      // eslint-disable-next-line no-async-promise-executor
      jwtPromise = new Promise(async (resolve, reject) => {
        try {
          jwt = await $.get(url)
          clientId = jwt.client_id.substringAfter('-') + '.'
          resolve(jwt)
        } catch (err) {
          reject(err)
        }
      })

      return jwtPromise
    },

    is(scope) {
      const scopes = jwt.scope
      if (!scopes) return false
      for (const s of scopes) {
        if (s.substringAfter(clientId) === scope)
          return true
      }
      return false
    },

    get scopes() {
      return jwt.scope
    },

    get roleCollections() {
      const attributes = jwt['xs.system.attributes']
      if (attributes) return attributes['xs.rolecollections']
      else return undefined
    },

    get attributes() {
      return jwt['xs.user.attributes']
    },

    get clientId() {
      return jwt['client_id'] || jwt['cid']
    },

    get id() {
      return jwt['user_id']
    },

    get name() {
      return jwt.user_name
    },

    get givenName() {
      return jwt.given_name
    },

    get familyName() {
      return jwt.family_name
    },

    get fullName() {
      const name = this.givenName
      const surname = this.familyName
      const buf = []
      if (name) buf.push(name)
      if (surname) buf.push(surname)
      return buf.join(' ')
    },

    get email() {
      return jwt.email
    },

    get(property) {
      return jwt[property]
    },

    get tokenIssueDate() {
      return jwt['iat']
    },

    get tokenExpirationDate() {
      return jwt['exp']
    },

    get tokenIssuer() {
      return jwt['iss']
    },

    get token() {
      return jwt
    }
  }
})