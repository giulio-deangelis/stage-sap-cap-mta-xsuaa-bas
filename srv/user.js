class User {

  constructor(jwt) {
    this.jwt = jwt
    this._clientId = jwt.client_id.split('-')[1] + '.'
  }

  is(scope) {
    const scopes = this.jwt.scope
    if (!scopes) return false
    for (const s of scopes) {
      if (s.split(this._clientId)[1] === scope)
        return true
    }
    return false
  }

  get scopes() {
    return this.jwt.scope
  }

  get roleCollections() {
    const attributes = this.jwt['xs.system.attributes']
    if (attributes) return attributes['xs.rolecollections']
    else return undefined
  }

  get attributes() {
    return this.jwt['xs.user.attributes']
  }

  get clientId() {
    return this.jwt['client_id'] || this.jwt['cid']
  }

  get id() {
    return this.jwt['user_id']
  }

  get name() {
    return this.jwt.user_name
  }

  get givenName() {
    return this.jwt.given_name
  }

  get familyName() {
    return this.jwt.family_name
  }

  get fullName() {
    const name = this.givenName
    const surname = this.familyName
    const buf = []
    if (name) buf.push(name)
    if (surname) buf.push(surname)
    return buf.join(' ')
  }

  get email() {
    return this.jwt.email
  }

  get(property) {
    return this.jwt[property]
  }

  get tokenIssueDate() {
    return this.jwt['iat']
  }

  get tokenExpirationDate() {
    return this.jwt['exp']
  }

  get tokenIssuer() {
    return this.jwt['iss']
  }

  get token() {
    return this.jwt
  }
}

module.exports = User