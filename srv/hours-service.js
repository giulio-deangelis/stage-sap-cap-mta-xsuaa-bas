const cds = require('@sap/cds')
const auth = require('./auth')
const User = require('./user')

const userCache = new Set()

module.exports = cds.service.impl(function () {

  this.before('*', async req => {
    const token = auth.decodeToken(req._.req)
    if (!token) return

    const user = await upsertUser(token)

    if (user)
      console.log(`User ${user.email} registered`)
  })

  // this.before(['CREATE', 'UPDATE', 'DELETE'], 'hours', async req => {
  //   if (req.user.is('admin')) return
  //   const token = auth.decodeToken(req._req)
  //   if (!token) return

  //   if (req.data.user_email !== token.email)
  //     req.reject(401, 'Unauthorized')
  // })

  this.on('deleteProject', async req => {
    const {name} = req.data
    const {Project, Task, SubTask, Hours} = cds.entities
    const tx = cds.transaction(req)

    await tx.run(DELETE.from(Hours).where('task_project_name =', name))
    await tx.run(DELETE.from(SubTask).where('task_project_name =', name))
    await tx.run(DELETE.from(Task).where('project_name =', name))
    await tx.run(DELETE.from(Project).where('name =', name))
    await tx.commit()

    return 'ok'
  })

  this.on('totalHours', async req => {
    const {project, task} = req.data
    const {Hours} = cds.entities
    const tx = cds.transaction(req)

    const query =
      SELECT('sum(hours) as sum')
        .from(Hours)
        .where('task_project_name =', project)

    if (task)
      query.and('task_name =', task)

    return (await tx.run(query))[0].sum || 0
  })

  this.on('env', req => {
    if (!req.user.is('admin'))
      return req.user.id

    const variable = req.data.var

    if (!variable || !process.env[variable])
      return 'Invalid variable'

    try {
      return JSON.parse(process.env[variable])
    }
    catch (err) {
      return process.env[variable]
    }
  })
})

async function upsertUser(token) {
  const user = new User(token)

  if (!user.email) return
  if (userCache.has(user.email)) return
  userCache.add(user.email)
  if (await userExists(user.email)) return

  await cds.run(INSERT.into(cds.entities.User).entries({
    email: user.email,
    name: user.fullName
  }))

  return user
}

async function userExists(email) {
  return (await cds.run(
    SELECT('count(email) as count')
      .from(cds.entities.User)
      .where('email =', email)
  ))[0].count > 0
}