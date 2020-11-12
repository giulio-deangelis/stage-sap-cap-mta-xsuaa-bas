sap.ui.define([
  'sap/ui/core/mvc/Controller',
  'sap/ui/model/json/JSONModel',
  'sap/ui/model/Context',
  'sap/ui/model/Filter',
  'sap/ui/model/Sorter',
  'sap/m/HBox',
  'sap/m/Column',
  'sap/m/ColumnListItem',
  'sap/ui/core/ListItem',
  'sap/m/ComboBox',
  'sap/m/Label',
  'sap/m/Input',
  'sap/m/InputType',
  'sap/m/ListMode',
  'sap/ui/export/Spreadsheet',
  'training/hours/web/model/Formatter',
  'training/hours/web/util/User',
  'training/hours/web/util/MessageHelper'
], (
  Controller,
  JSONModel,
  Context,
  Filter,
  Sorter,
  HBox,
  Column,
  ColumnListItem,
  ListItem,
  ComboBox,
  Label,
  Input,
  InputType,
  ListMode,
  SpreadSheet,
  Formatter,
  User,
  MessageHelper
) => {
  'use strict'

  var model, odataModel, msg
  var oldData, selectedRow, editing
  var currentDate, firstDate, lastDate
  var projectsBinding, tasksBinding, hoursBinding, usersBinding
  var projects, tasks, hours, users
  const bus = sap.ui.getCore().getEventBus()

  return Controller.extend('training.hours.web.controller.Hours', {

    onInit() {
      this.getOwnerComponent()
        .getRouter()
        .getRoute('Hours')
        .attachPatternMatched(this.onEnter, this)
    },

    async onEnter() {
      model = new JSONModel()
      odataModel = this.getView().getModel()
      msg = new MessageHelper(this)

      bus.publish('app', 'onLimitWidth', {limit: false})

      projectsBinding = odataModel.bindList('/projects')
      tasksBinding = odataModel.bindList('/tasks')
      usersBinding = odataModel.bindList('/users')
      projects = await projectsBinding.requestContexts(0, Infinity)
      tasks = await tasksBinding.requestContexts(0, Infinity)
      users = await usersBinding.requestContexts(0, Infinity)

      this.byId('shell')?.setAppWidthLimited(false)

      this.setDate(new Date())
    },

    onLeave() {
      this.getOwnerComponent().getRouter().navTo('Home')
      this.setEditable(false)
    },

    onDateChange(ev) {
      const date = Formatter.parseDate(ev.getParameter('value'))
      this.setEditable(false)
      this.setDate(date)
    },

    onPreviousFortnight() {
      const date = new Date(firstDate)
      date.setDate(date.getDate() - 1)
      this.setDate(date)
    },

    onNextFortnight() {
      const date = new Date(lastDate)
      date.setDate(date.getDate() + 1)
      this.setDate(date)
    },

    onRefresh() {
      const date = Formatter.parseDate(this.byId('date').getValue())
      this.setDate(date)
    },

    onSelect(ev) {
      const count = ev.getSource().getSelectedItems().length
      this.byId('editButton').setVisible(count === 1)
      this.byId('removeButton').setVisible(count > 0)
    },

    onUserSelect(_ev, params) {
      const usersBox = params.usersBox

      const user = usersBox
        .getSelectedItem()
        .getBindingContext()

      const jsonPath = selectedRow.getBindingContext().getPath()
      model.setProperty(`${jsonPath}/userId`, user.getProperty('email'))
      model.setProperty(`${jsonPath}/user`, user.getProperty('email')) // TODO use name
    },

    onProjectSelect(_ev, params) {
      const projectsBox = params.projectsBox
      const tasksBox = params.tasksBox

      const projectName = projectsBox
        .getSelectedItem()
        .getBindingContext()
        .getProperty('name')

      // update the json model accordingly
      const jsonPath = selectedRow.getBindingContext().getPath()
      model.setProperty(`${jsonPath}/project`, projectName)

      tasksBox.setSelectedItem(null)

      const filters = [new Filter('project_name', 'EQ', projectName)]

      // don't show already selected tasks
      // for (const task of this._getSelectedTasksFor(projectName))
        // filters.push(new Filter('name', 'NE', task))

      tasksBox.bindItems({
        path: '/tasks',
        filters: new Filter({and: true, filters}),
        template: new ListItem({
          key: '{name}',
          text: '{name}'
        })
      })
    },

    onTaskSelect(ev) {
      const taskName = ev.getParameter('value')
      const jsonPath = selectedRow.getBindingContext().getPath()
      model.setProperty(`${jsonPath}/task`, taskName)
    },

    onAdd() {
      oldData = this._copyData()
      editing = false
      model.unshiftProperty('/hours', {user: User.email, userId: User.email})
      this.setEditable(true, this.byId('hoursTable').getItems()[0], true)
    },

    onEdit() {
      oldData = this._copyData()
      // eslint-disable-next-line no-unused-vars
      editing = true
      this.setEditable(true)
    },

    setBusy(busy) {
      this.byId('hoursTable').setBusy(busy)
      this.byId('saveButton').setEnabled(!busy)
      this.byId('cancelButton').setEnabled(!busy)
      this.byId('date').setEnabled(!busy)
      this.byId('refreshButton').setEnabled(!busy)
    },

    onRemove() {
      msg.confirm('confirmRemove', 'confirm', async ok => {
        if (!ok) return
        const table = this.byId('hoursTable')
        const selectedRows = table.getSelectedItems().slice()
        const paths = []
        const hours = []

        this.setBusy(true)

        try {
          for (const row of selectedRows) {
            hours.push(...this._getHoursFromRow(row))

            // remember the path to delete it from the json model later
            paths.push(row.getBindingContext().getPath())
          }

          for (const hour of hours)
            hour.delete = true

          await this.saveHours(hours)
          model.removeProperties(paths)

        }
        catch (err) {
          console.error(err)
          msg.error('removeFailed')
        }
        finally {
          this.setBusy(false)
          table.removeSelections(true)
          this.byId('removeButton').setVisible(false)
          this.byId('editButton').setVisible(false)
        }
      })
    },

    onCancel() {
      model.setData(oldData)
      this.setEditable(false)
    },

    async onSave() {
      if (!this._isFirstRowValid()) {
        msg.error('invalidRow')
        return
      }

      const saveButton = this.byId('saveButton')
      const row = selectedRow.getBindingContext().getObject()
      const hours = this._getHoursFromRow(row)

      this.setBusy(true)
      saveButton.setEnabled(false)

      try {
        await this.saveHours(hours)
        this.onRefresh()
      }
      catch (err) {
        console.error(err)
        msg.error('saveFailed')
        model.setData(oldData)
      }
      finally {
        this.setBusy(false)
        saveButton.setEnabled(true)
        this.setEditable(false)
      }
    },

    onDownload() {
      const firstDay = firstDate.getDate()
      const lastDay = lastDate.getDate()
      const dateString = `${currentDate.getDate()}-${currentDate.getMonth() + 1}-${currentDate.getFullYear()}`

      const columns = [{
        label: msg.i18n('user'),
        property: 'user'
      }, {
        label: msg.i18n('project'),
        property: 'task'
      }, {
        label: msg.i18n('task'),
        property: 'project'
      }]

      for (let day = firstDay; day <= lastDay; ++day) {
        columns.push({
          label: day,
          property: `day${day}`
        })
      }

      const sheet = new SpreadSheet({
        worker: true,
        fileName: msg.i18n('hoursFileName') + `_${dateString}.xlsx`,
        workbook: {columns},
        dataSource: model.getProperty('/hours')
      })

      sheet.build().catch((err) => {
        if (!err.includes('Export cancelled')) {
          console.error(err);
          msg.error('downloadFailed');
        }
      });
    },

    setEditable(editable, row, editableKeys) {
      const table = this.byId('hoursTable')
      row = row || selectedRow || table.getSelectedItem()
      selectedRow = editable ? row : null

      this.byId('saveButton').setVisible(editable)
      this.byId('addButton').setVisible(!editable)
      this.byId('editButton').setVisible(!editable && !!selectedRow)
      this.byId('removeButton').setVisible(!editable && !!selectedRow)
      this.byId('cancelButton').setVisible(editable)
      table.setMode(editable ? ListMode.None : ListMode.MultiSelect)

      if (!row) return

      const cells = row.getCells()
      let i = editable ? editableKeys ? 0 : 3 : 0

      function setEditable(control) {
        if (control instanceof Input) {
          control.setEditable(editable)
        } else if (control instanceof HBox) {
          for (const child of cells[i].findElements()) {
            if (child instanceof Label)
              child.setVisible(!editable)
            else if (child instanceof ComboBox)
              child.setVisible(editable)
          }
        }
      }

      function getComboBox(index) {
        return cells[index].findElements().find(it => it instanceof ComboBox)
      }

      if (i < 3) {
        const usersBox = User.is('admin') ? getComboBox(0) : null
        const projectsBox = getComboBox(1)
        const tasksBox = getComboBox(2)
        this._bindComboBoxes(usersBox, projectsBox, tasksBox)
      }

      // don't set user field editable if they're not admin
      if (!User.is('admin')) ++i

      for (; i < cells.length; ++i)
        setEditable(cells[i])
    },

    async setDate(date) {
      const table = this.byId('hoursTable')
      table.setBusy(true)

      const fortnight = date.getFortnight()
      currentDate = date
      firstDate = fortnight.firstDate
      lastDate = fortnight.lastDate
      const filter = new Filter('day', 'BT', firstDate.valueOf(), lastDate.valueOf())
      const sorters = [new Sorter('user_email'), new Sorter('task_project_name'), new Sorter('task_name'), new Sorter('day')]

      hoursBinding = odataModel.bindList('/hours', null, sorters, filter)
      hours = await hoursBinding.requestContexts(0, Infinity)

      this.byId('date').setValue(Formatter.formatDate(date, false))
      this._bindTable()
      table.setBusy(false)
    },

    _bindTable() {
      const table = this.byId('hoursTable').destroyRows()
      const cells = []
      const month = firstDate.getMonth()
      const year = firstDate.getFullYear()
      const firstDay = firstDate.getDate()
      const lastDay = lastDate.getDate()

      const usersWrapper = new HBox()
        .addStyleClass('hours-wrapper')
        .addItem(new Label({text: '{user}'}))
        .addItem(new ComboBox({visible: false}))

      const projectsWrapper = new HBox()
        .addStyleClass('hours-wrapper')
        .addItem(new Label({text: '{project}'}))
        .addItem(new ComboBox({visible: false}))

      const tasksWrapper = new HBox()
        .addStyleClass('hours-wrapper')
        .addItem(new Label({text: '{task}'}))
        .addItem(new ComboBox({visible: false}))

      cells.push(usersWrapper)
      cells.push(projectsWrapper)
      cells.push(tasksWrapper)

      table.addColumn(new Column({width: '11rem'}).setHeader(new Label({text: msg.i18n('user')})))
      table.addColumn(new Column({width: '8rem'}).setHeader(new Label({text: msg.i18n('project')})))
      table.addColumn(new Column({width: '8rem'}).setHeader(new Label({text: msg.i18n('task')})))

      for (let day = firstDay; day <= lastDay; ++day) {
        const label = new Label({text: day})

        table.addColumn(new Column({width: '4rem'}).setHeader(label))

        if (new Date(year, month, day).isWeekendDay())
          label.addStyleClass('weekend-day')

        cells.push(new Input({
          value: `{day${day}}`,
          editable: false,
          width: '.5rem',
          type: InputType.Number,
        }))
      }

      table.setModel(model)

      const rows = []
      let prevUser, prevProject, prevTask

      for (const hour of hours) {
        const user = hour.getProperty('user_email') // TODO use name
        const userId = hour.getProperty('user_email')
        const project = hour.getProperty('task_project_name')
        const task = hour.getProperty('task_name')
        const day = new Date(parseInt(hour.getProperty('day'), 0)).getDate()
        const hours = hour.getProperty('hours')

        if (prevUser !== user || prevProject !== project || prevTask !== task)
          rows.push({user, project, task, userId})
        rows.last()[`day${day}`] = hours

        prevUser = user
        prevProject = project
        prevTask = task
      }

      model.setData({
        users: users.map(it => it.getObject()),
        projects: projects.map(it => it.getObject()),
        tasks: tasks.map(it => it.getObject()),
        hours: rows
      })

      table.bindItems({
        path: '/hours',
        template: new ColumnListItem({cells})
      })
    },

    _bindComboBoxes(usersBox, projectsBox, tasksBox) {
      usersBox?.setSelectedItem(null)
      projectsBox.setSelectedItem(null)
      tasksBox.setSelectedItem(null)

      if (User.is('admin')) {
        usersBox.bindItems({
          path: '/users',
          template: new ListItem({
            key: '{email}',
            text: '{email}'
          })
        })

        usersBox.setValue(User.email)
        usersBox.attachChange({usersBox}, this.onUserSelect, this)
      }

      projectsBox.bindItems({
        path: '/projects',
        filters: [new Filter('archived', 'EQ', '0')],
        template: new ListItem({
          key: '{name}',
          text: '{name}'
        })
      })

      tasksBox.unbindItems()
      projectsBox.attachChange({projectsBox, tasksBox}, this.onProjectSelect, this)
      tasksBox.attachChange(this.onTaskSelect, this)
    },

    _copyData() {
      const data = model.getData()
      const newData = {users: [], projects: [], tasks: [], hours: []}

      for (const user of data.users)
        newData.users.push(Object.assign({}, user))

      for (const project of data.projects)
        newData.projects.push(Object.assign({}, project))

      for (const task of data.tasks)
        newData.tasks.push(Object.assign({}, task))

      for (const hour of data.hours)
        newData.hours.push(Object.assign({}, hour))

      return newData
    },

    _getHoursFromRow(row) {
      if (row.getBindingContext) // can either pass context or object directly
        row = row.getBindingContext().getObject()

      const user = row.userId
      const year = firstDate.getFullYear()
      const month = firstDate.getMonth() + 1
      const projectName = row.project
      const taskName = row.task
      const hours = []

      for (let day = firstDate.getDate(); day <= lastDate.getDate(); ++day) {
        hours.push({
          'user_email': user,
          'task_project_name': projectName,
          'task_name': taskName,
          'day': Formatter.parseDate(`${day}/${month}/${year}`).valueOf().toString(),
          'hours': parseInt(row[`day${day}`]),
        })
      }

      return hours
    },

    async saveHours(hours) {
      const url = odataModel.url('/saveHours')
      await $.post(url, {hours})
    },

    async _create(newEntity, checkDuplicate = true) {
      const entity = await this._getHoursContext(newEntity)
      if (checkDuplicate && entity)
        this._update(entity)
      return hoursBinding.create(newEntity)
    },

    async _update(newEntity) {
      const entity = newEntity instanceof Context ? newEntity : await this._getHoursContext(newEntity)
      if (!entity && newEntity.hours > 0) {
        await this._create(newEntity, false)
      }
      else if (entity) {
        if (newEntity.hours > 0 && entity.getProperty('hours') !== newEntity.hours) {
          await entity.delete('$direct')
          await this._create(newEntity, false)
          // TODO update hangs
          // await entity.setProperty('hours', newEntity.hours)
        }
        else if (!newEntity.hours) {
          await entity.delete('$direct')
        }
      }
    },

    async _submitBatch() {
      return odataModel.submitBatch('batch')
    },

    async _getHoursContext(hours) {
      const filters = [
        new Filter('user_email', 'EQ', User.email),
        new Filter('task_project_name', 'EQ', hours.task_project_name),
        new Filter('task_name', 'EQ', hours.task_name),
        new Filter('day', 'EQ', hours.day.valueOf())
      ]
      const binding = odataModel.bindList('/hours', null, null, filters)
      const contexts = await binding.requestContexts(0, Infinity)
      return contexts.firstOrNull()
    },

    _getSelectedTasksFor(project) {
      return model.getProperty('/hours')
        .filter(it => it.task && it.project === project)
        .map(it => it.task)
    },

    _isFirstRowValid() {
      const row = model.getProperty('/hours/0')
      if (!row.task || row.task.isBlank())
        return false
      if (!row.project || row.project.isBlank())
        return false
      for (let day = firstDate.getDate(); day <= lastDate.getDate(); ++day)
        if (parseInt(row[`day${day}`], 0)) return true
      return false
    }
  })
})