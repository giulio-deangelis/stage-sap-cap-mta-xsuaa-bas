require('./util/date-extensions')

const cds = require('@sap/cds')
const auth = require('./auth')
const User = require('./user')
const scheduler = require('node-schedule')

var mail

// custom middleware
cds.on('bootstrap', app => {
  const express = require('express')
  const mailer = require('nodemailer')
  const config = require('./config.json')

  auth.configure(app)

  app.use(express.urlencoded())
  app.use(express.json())

  app.get('/jwt', GET_jwt)
  app.get('/user', GET_user)
  app.post('/saveProject', POST_saveProject)
  app.get('/projectInfo', GET_projectInfo)
  app.post('/saveHours', POST_saveHours)
  app.get('/lateUsers', GET_lateUsers)

  if (config.mail && config.mail.enabled) {
    mail = mailer.createTransport(require('./config.json').mail)
    scheduler.scheduleJob('00 00 10 15 * *', sendMailToLateUsers)
    scheduler.scheduleJob('00 00 10 L * *', sendMailToLateUsers)
    // scheduler.scheduleJob('00 00 * * * *', sendMailToLateUsers)
  }
})

/* ------ Endpoints ------ */

function GET_jwt(req, res) {
  const token = auth.decodeToken(req)
  if (token) {
    res.status(200)
    res.send(token)
  }
  else {
    res.status(400)
    res.send({error: 'Invalid JWT token'})
  }
}

function GET_user(req, res) {
  res.send({
    ...req.user,
    roles: {
      admin: req.authInfo.checkScope(auth.scope('admin')),
      user: req.authInfo.checkScope(auth.scope('user'))
    }
  })
}

async function POST_saveProject(req, res) {
  if (!auth.authenticate('admin', req, res)) return

  try {
    const {Project, Task, SubTask} = cds.entities
    const project = req.body
    const tasks = project.tasks
    const tx = cds.transaction()
    let op = project.op

    delete project.op
    delete project.tasks

    switch (op) {
      case 'C':
        project.archived = 0
        await tx.run(INSERT.into(Project).entries(project))
        break
      case 'U':
        await tx.run(
          UPDATE(Project)
            .set('description =', project.description)
            .where('name =', project.name)
        )
        break
      case 'D':
        await tx.run(
          UPDATE(Project)
            .set('archived =', true)
            .where('name =', project.name)
        )
    }

    if (!tasks || op === 'D') {
      await tx.commit()
      res.status(200)
      res.send()
      return
    }

    for (const task of tasks) {
      const subTasks = task.subTasks
      op = task.op

      delete task.subTasks
      delete task.op
      task.project_name = project.name

      switch (op) {
        case 'C':
          await tx.run(INSERT.into(Task).entries(task))
          break
        case 'U':
          await tx.run(
            UPDATE(Task)
              .set('description =', task.description)
              .where('name =', task.name)
              .and('project_name =', project.name)
          )
          break
        case 'D':
          await tx.run(
            DELETE.from(Task)
              .where('name =', task.name)
              .and('project_name =', project.name)
          )
          await tx.run(
            DELETE.from(SubTask)
              .where('task_name =', task.name)
              .and('task_project_name =', project.name)
          )
          break
      }

      if (op === 'D' || !subTasks) break

      for (const subTask of subTasks) {
        subTask.task_name = task.name
        subTask.task_project_name = project.name
        op = subTask.op
        delete subTask.op

        switch (op) {
          case 'C':
            await tx.run(INSERT.into(SubTask).entries(subTask))
            break
          case 'U':
            await tx.run(
              UPDATE(SubTask)
                .set('effort =', subTask.effort)
                .where('name =', subTask.name)
                .and('task_name =', task.name)
                .and('task_project_name =', project.name)
            )
            break
          case 'D':
            await tx.run(
              DELETE.from(SubTask)
                .where('name =', subTask.name)
                .and('task_name =', task.name)
                .and('task_project_name =', project.name)
            )
            break
        }
      }
    }

    await tx.commit()
    res.status(200)
    res.send()
  }
  catch (err) {
    console.error(err)
    res.status(500)
    res.send('Internal server error')
  }
}

async function POST_saveHours(req, res) {
  const {Hours} = cds.entities
  const {hours} = req.body
  const token = auth.decodeToken(req)
  const user = new User(token)
  const tx = cds.transaction()
  const admin = user.is('admin')
  const insert = []

  async function exists(hour) {
    return (await tx.run(
      SELECT('count(*) as count')
        .from(Hours)
        .where('user_email =', hour.user_email)
        .and('task_name =', hour.task_name)
        .and('task_project_name =', hour.task_project_name)
        .and('day =', hour.day)
    ))[0].count > 0
  }

  for (const hour of hours) {
    if (!admin && hour.user_email !== user.email) {
      res.status(401)
      res.send('Unauthorized')
      return
    }
    if (hour.hours > 24)
      hour.hours = 24
  }

  try {
    for (const hour of hours) {
      hour.day = setHours(hour.day)
      if (hour.delete || !hour.hours || hour.hours <= 0 || isNaN(hour.hours)) {
        await tx.run(
          DELETE
            .from(Hours)
            .where('user_email =', hour.user_email)
            .and('task_name =', hour.task_name)
            .and('task_project_name =', hour.task_project_name)
            .and('day =', hour.day)
        )
      }
      else if (await exists(hour)) {
        await tx.run(
          UPDATE(Hours)
            .set('hours =', hour.hours)
            .where('user_email =', hour.user_email)
            .and('task_name =', hour.task_name)
            .and('task_project_name =', hour.task_project_name)
            .and('day = ', hour.day)
        )
      }
      else {
        insert.push(hour)
      }
    }

    if (insert.length > 0)
      await tx.run(INSERT.into(Hours).entries(insert))

    await tx.commit()

    res.status(200)
    res.send()
  }
  catch (err) {
    tx.rollback()
    console.error(err)
    res.status(400)
    res.send(err.message)
  }
}

async function GET_projectInfo(req, res) {
  if (!auth.authenticate('admin', req, res)) return

  const {name, start, end} = req.query

  try {
    let query =
      SELECT('t.name', 'sum(h.hours) as total')
        .from('training.hours.Hours as h')
        .join('training.hours.Task as t')
        .on('h.task_name = t.name')
        .and('h.task_project_name = t.project_name')
        .where('h.task_project_name =', name)
        .groupBy('h.task_name')

    if (start) query.and('h.day >=', setHours(start))
    if (end) query.and('h.day <=', setHours(end, true))

    const totalHours = await cds.read(query)

    query =
      SELECT('t.name', 'sum(st.effort) as effort')
        .from('training.hours.Task as t')
        .join('training.hours.SubTask as st')
        .on('t.name = st.task_name')
        .groupBy('t.name')

    const totalEfforts = await cds.read(query)

    for (const h of totalHours) {
      const effort = totalEfforts.find(it => it.name === h.name)
      delete h.day // ????
      h.effort = effort.effort
      h.project = name
      h.start = start
      h.end = end
    }

    res.json(totalHours)
  }
  catch (err) {
    console.error(err)
    res.status(500)
    res.send({
      error: err.message,
      params: {name, start, end},
    })
  }
}

async function GET_lateUsers(req, res) {
  const date = req.query.date
  const users = await getLateUsers(date ? new Date(req.query.date) : new Date())
  if (req.query.send !== undefined && auth.authenticate('admin', req, res))
    sendMailToLateUsers(users)
  res.send(users)
}

/* ----------------------- */

async function getLateUsers(date = new Date()) {
  const {Hours, User} = cds.entities
  const {firstDate, lastDate} = date.getFortnight()

  return (await cds.read(
    SELECT('email')
      .from(User)
      .where('email not in',
        SELECT('user_email')
          .from(Hours)
          .where('day >=', firstDate.valueOf())
          .and('day <=', lastDate.valueOf())
      )
  )).map(it => it.email)
}

async function sendMailToLateUsers(users) {
  if (!users) users = await getLateUsers()
  let timeout = 0

  for (const userEmail of users) {
    setTimeout(() => {
      console.log('Sending reminder email to ' + userEmail)
      mail.sendMail({
        to: userEmail,
        subject: 'Memo App Ore',
        text: "Ricorda di mettere le ore sull'app"
      }).catch(err => {
        console.error(err)
      })
    }, timeout)

    timeout += 5000
  }
}

function setHours(epochDate, endOfDay) {
  if (typeof epochDate === 'string')
    epochDate = parseInt(epochDate)

  const date = new Date(epochDate)

  if (endOfDay) {
    date.setHours(23, 59, 59, 999)
  }
  else {
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + 1)
  }

  return date.valueOf()
}

module.exports = cds.server // default server.js