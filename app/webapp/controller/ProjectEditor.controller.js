sap.ui.define([
  'sap/ui/core/mvc/Controller',
  'sap/ui/model/json/JSONModel',
  'sap/m/StandardListItem',
  'sap/m/ColumnListItem',
  'sap/m/Input',
  'sap/m/InputType',
  'sap/m/Label',
  'sap/ui/model/Filter',
  'sap/ui/export/Spreadsheet',
  'training/hours/web/util/MessageHelper',
  'training/hours/web/util/FragmentManager',
  'training/hours/web/model/Formatter'
], (
  Controller,
  JSONModel,
  StandardListItem,
  ColumnListItem,
  Input,
  InputType,
  Label,
  Filter,
  SpreadSheet,
  MessageHelper,
  FragmentManager,
  Formatter
) => {
  'use strict'

  const bus = sap.ui.getCore().getEventBus()
  var model, tasksModel, msg
  var projectContext, projectBinding
  var deletedTasks = []
  var newProject = false
  var editing = false

  var fragmentManager
  const taskEditorFragment = 'training.hours.web.view.fragment.TaskEditor'
  const dateRangeFragment = 'training.hours.web.view.fragment.DateRange'

  return Controller.extend('training.hours.web.controller.ProjectEditor', {

    onInit() {
      model = this.getOwnerComponent().getAggregation('rootControl').getModel()
      msg = new MessageHelper(this)
      fragmentManager = new FragmentManager(this)

      bus.subscribe('editor', 'onSave', this.onSave, this)
      bus.subscribe('editor', 'onArchive', this.onArchive, this)
      bus.subscribe('editor', 'onBind', this.onBind, this)
      bus.subscribe('editor', 'onLeave', this.onLeave, this)
      bus.subscribe('editor', 'onEdit', this.onEdit, this)
      bus.subscribe('editor', 'onCancel', this.onCancel, this)
      bus.subscribe('editor', 'onRecover', this.onRecover, this)
      bus.subscribe('editor', 'onDelete', this.onDelete, this)
      bus.subscribe('editor', 'onDownload', this.onDownloadRequest, this)
    },

    onLeave() {
      deletedTasks.clear()
    },

    async onBind(_ch, _ev, params) {
      model.resetChanges()
      deletedTasks.clear()

      projectContext = params.context
      projectBinding = params.projectBinding

      const taskBindingInfo = {
        path: '/tasks',
        filters: new Filter('op', 'NE', 'D'),
        template: new StandardListItem({
          title: '{name}',
          description: '{description}',
          type: 'Navigation'
        })
      }

      // the name is a key, therefore it cannot be changed on an existing project
      this.byId('projectName').setEditable(!projectContext)

      if (projectContext) {
        newProject = false

        let tasks = (await model
          .bindList(`${projectContext.getPath()}/tasks`)
          .requestContexts(0, Infinity))
          .map(it => {
            it = it.getObject()
            // the operation property remembers what the user did to the task:
            // C: create, U: update, D: delete, nothing: not modified
            it.op = ''
            delete it.project_name
            return it
          })

        tasksModel = new JSONModel({tasks})
      }
      else {
        newProject = true
        tasksModel = new JSONModel({tasks: []})

        // create an empty project to allow editing
        projectContext = projectBinding.create({
          name: msg.i18n('newProject'),
          description: '',
          archived: false
        })
      }

      this.byId('allHours').setText(
        msg.i18n('totalHours') + ': ' +
        await this.getTotalHours()
      )

      this.getView().setModel(model)
      this.byId('projectForm').setBindingContext(projectContext)
      this.byId('projectName').bindProperty('value', 'name')
      this.byId('projectDescription').bindProperty('value', 'description')
      this.byId('taskList').setModel(tasksModel).bindItems(taskBindingInfo)
    },

    onEdit(_ch, _ev, params, editable = params.editable) {
      this.byId('projectName').setEditable(editable)
      this.byId('projectDescription').setEditable(editable)
      this.byId('addTaskButton').setVisible(editable)
      this.byId('taskList').setMode(editable ? 'Delete' : 'None')
      editing = editable
    },

    onDownloadRequest() {
      fragmentManager.open(dateRangeFragment)
      this.byId('dateStart').setDateValue(null)
      this.byId('dateEnd').setDateValue(new Date())
    },

    async onDownload() {
      const name = projectContext.getProperty('name')
      let start = this.byId('dateStart').getDateValue()
      let end = this.byId('dateEnd').getDateValue()
      const filename = [msg.i18n('projectInfoFilename'), name]
      const url = model.url('projectInfo')

      if (start) {
        start.setHoursToBeginning()
        filename.push(Formatter.formatDate(start).replace('/', '-'))
        start = start.valueOf()
      }

      if (end) {
        end.setHoursToEnd()
        filename.push(Formatter.formatDate(end).replace('/', '-'))
        end = end.valueOf()
      }

      if (start > end) {
        msg.error('invalidDateRange')
        return
      }

      const data = await $.get(url, {name, start, end})

      for (const row of data) {
        if (row.start)
          row.start = Formatter.formatDate(new Date(parseInt(row.start)))
        if (row.end)
          row.end = Formatter.formatDate(new Date(parseInt(row.end)))
      }

      const sheet = new SpreadSheet({
        worker: true,
        fileName: filename.join('_'),
        dataSource: data,
        workbook: {
          columns: [{
            label: msg.i18n('task'),
            property: 'name'
          }, {
            label: msg.i18n('effort'),
            property: 'effort'
          }, {
            label: msg.i18n('totalHours'),
            property: 'total'
          }, {
            label: msg.i18n('start'),
            property: 'start'
          }, {
            label: msg.i18n('end'),
            property: 'end'
          }]
        }
      })

      try {
        await sheet.build()
      }
      catch (err) {
        if (!err.includes('Export cancelled')) {
          console.error(err);
          msg.error('downloadFailed');
        }
      }
      finally {
        fragmentManager.close(dateRangeFragment)
        this.byId('dateStart').setDateValue(null)
        this.byId('dateEnd').setDateValue(null)
      }
    },

    onDownloadCancel() {
      fragmentManager.close(dateRangeFragment)
    },

    onDateReset() {
      this.byId('dateStart').setDateValue(null)
      this.byId('dateEnd').setDateValue(null)
    },

    onCancel() {
      model.resetChanges()
      this.onBind(null, null, {context: projectContext, projectBinding})
      if (newProject)
        bus.publish('editor', 'onNewProjectCancel')
    },

    async onSave() {
      const view = this.getView()
      const valid = await (this.validateProject(projectContext.getObject()))
      if (!valid) return

      try {
        bus.publish('editor', 'onSaving')
        await this.saveProject()
        msg.toast('projectSaved')
        view.byId('projectName').setEditable(false)
      }
      catch (err) {
        console.error(err)
        msg.error('projectSaveError')
      }
      finally {
        bus.publish('editor', 'onSaved')
      }
    },

    async onArchive() {
      const view = this.getView()
      view.setBusy(true)

      try {
        projectContext.setProperty('archived', true)
        await model.submitBatch('batch')
        msg.toast('projectArchived')
        view.byId('taskList').unbindItems()
        bus.publish('editor', 'onArchived')
      }
      catch (err) {
        console.error(err)
        msg.error('projectArchivingFailed')
      }
      finally {
        view.setBusy(false)
      }
    },

    async onRecover() {
      projectContext.setProperty('archived', false)
      await model.submitBatch('batch')
      msg.toast('projectRecovered')
      bus.publish('editor', 'onRecovered', {context: projectContext})
    },

    async onDelete() {
      const name = projectContext.getProperty('name')
      const url = model.sServiceUrl + `/deleteProject(name='${name}')`
      try {
        await $.get(url)
        msg.toast('projectDeleted')
        bus.publish('editor', 'onDeleted')
      } catch (err) {
        console.error(err)
        msg.error('projectDeletionFailed')
      }
    },

    onTaskAdd() {
      this.openTaskEditor()
    },

    onSubTaskAdd() {
      const task = fragmentManager.getModelData(taskEditorFragment)
      task.subTasksModel.unshiftProperty('/subTasks', {op: 'C'})
    },

    onTaskPress(ev) {
      const path = ev.getParameter('listItem').getBindingContextPath()
      this.openTaskEditor(path)
    },

    onTaskRemove(ev) {
      const task = ev.getParameter('listItem').getBindingContextPath()
      const op = task + '/op'
      // to temporarily remove the task, set the operation property to 'D'
      if (tasksModel.getProperty(op) !== 'C') {
        tasksModel.setProperty(op, 'D')
        this.byId('taskList').getBinding('items').filter(new Filter('op', 'NE', 'D'))
      }
      else {
        tasksModel.removeProperty(task)
      }
    },

    onTaskSave() {
      const task = fragmentManager.getModelData(taskEditorFragment)
      if (!this.validateTask(task)) return

      if (task.op === 'C') // if creating
        tasksModel.unshiftProperty('/tasks', task)
      // if updating, we can only change the description since the name is a key
      else tasksModel.setProperty(task.path + '/description', task.description)

      tasksModel.refresh()
      this.closeTaskEditor()
    },

    onTaskCancel() {
      this.closeTaskEditor()
    },

    onProjectNameChange(ev) {
      const newName = ev.getParameter('value')
      projectContext.setProperty('name', newName)
    },

    onSubTaskChange(ev) {
      const subTask = ev.object
      if (subTask.op !== 'C')
        subTask.op = 'U'
      if (ev.property === 'effort')
        this.refreshEffort()
    },

    onSubTaskSelect(ev) {
      const count = ev.getSource().getSelectedItems().length
      this.byId('removeSubTaskButton').setVisible(count > 0)
    },

    onSubTaskRemove() {
      const table = this.byId('subTasksTable')
      for (const item of table.getSelectedItems()) {
        const path = item.getBindingContextPath()
        const task = fragmentManager.getModel(taskEditorFragment)
        const subTasksModel = task.getData().subTasksModel
        if (subTasksModel.getProperty(path + '/op') !== 'C')
          subTasksModel.setProperty(path + '/op', 'D')
        else subTasksModel.removeProperty(path)
      }
      table.getBinding('items').filter(new Filter('op', 'NE', 'D'))
      this.byId('removeSubTaskButton').setVisible(table.getSelectedItems().count > 0)
    },

    refreshEffort() {
      const totalEffort = this.getTotalEffort()
      const task = fragmentManager.getModel(taskEditorFragment)
      task.setProperty('effort', totalEffort)
      this.byId('effortLabel').setText(msg.i18n('effort') + ': ' + totalEffort)
      return totalEffort
    },

    getTotalEffort() {
      return fragmentManager.getModel(taskEditorFragment)
        .getData().subTasksModel.getProperty('/subTasks')
        .map(it => parseInt(it.effort, 0) || 0)
        .reduce((sum, cur) => sum + cur, 0)
    },

    async getTotalHours(task) {
      const projectName = projectContext.getProperty('name')
      const url = [model.url(`/totalHours(project='${projectName}',task=`)]

      if (task) url.push(`'${task.name}'`)
      else url.push('null')
      url.push(')')

      const res = await $.get(encodeURI(url.join('')))

      return res.value
    },

    onProjectDescriptionChange(ev) {
      const newDesc = ev.getParameter('value')
      projectContext.setProperty('description', newDesc)
    },

    async openTaskEditor(path) {
      const taskEditor = fragmentManager.open(taskEditorFragment)
      const task = path ? tasksModel.getProperty(path) : {op: 'C'}
      var nameCell, effortCell

      if (path) {
        task.op = 'U'
        const subTasks = await this.fetchSubTasks(task)
        if (!task.subTasksModel)
          task.subTasksModel = new JSONModel({subTasks})
      }
      else {
        task.subTasksModel = new JSONModel({subTasks: []})
      }

      if (editing) {
        nameCell = new Input({value: '{name}', maxLength: 100})
        effortCell = new Input({value: '{effort}', type: InputType.Number})
        task.subTasksModel.bindLiveChange(nameCell, 'name', this.onSubTaskChange.bind(this))
        task.subTasksModel.bindLiveChange(effortCell, 'effort', this.onSubTaskChange.bind(this))
      }
      else {
        nameCell = new Label({text: '{name}'})
        effortCell = new Label({text: '{effort}'})
      }

      this.byId('subTasksTable')
        .setModel(task.subTasksModel)
        .bindItems({
          path: '/subTasks',
          filters: new Filter('op', 'NE', 'D'),
          template: new ColumnListItem({
            cells: [nameCell, effortCell]
          })
        })

      task.subTasksModel.attachPropertyChange(null, ev => {
        const ctx = ev.getParameter('context')
        if (ctx.getProperty('op') !== 'C')
          ctx.setProperty('op', 'U')
      })

      taskEditor.setModel(new JSONModel(task))
      this.byId('taskName').setEditable(editing && task.op === 'C')
      this.byId('taskDesc').setEditable(editing).setHeight(editing ? '10rem' : '5rem')
      this.byId('addSubTaskButton').setVisible(editing)
      this.byId('subTasksTable').setMode(editing ? 'MultiSelect' : 'None')
      this.byId('taskSaveButton').setVisible(editing)
      this.byId('taskCancelButton').setText(msg.i18n(editing ? 'cancel' : 'close'))

      const totalEffort = this.refreshEffort()

      if (editing) {
        this.byId('totalHours')
          .setVisible(false)
      }
      else {
        const totalHours = await this.getTotalHours(task)
        const label = this.byId('totalHours')

        label
          .setVisible(true)
          .setText(msg.i18n('totalHours') + ': ' + totalHours)

        if (totalEffort < totalHours)
          label.addStyleClass('negative')
        else label.removeStyleClass('negative')
      }
    },

    async fetchSubTasks(task) {
      const path = encodeURI(`/tasks(name='${task.name}',project_name='${projectContext.getProperty('name')}')/subtasks`)
      const binding = model.bindList(path)
      return (await binding
        .requestContexts(0, Infinity))
        .map(it => {
          it = it.getObject()
          it.op = ''
          return it
        })
    },

    closeTaskEditor() {
      const fragment = fragmentManager.close(taskEditorFragment)
      fragment.getModel().setData({})
      this.byId('subTasksTable').unbindItems()
    },

    validateTask(task) {
      if (!task.name || task.name.isBlank()) {
        msg.error('invalidName')
        return false
      }
      task.name = task.name.trim()
      task.description = task.description ? task.description.trim() : null
      return true
    },

    async validateProject(project) {
      if (!project.name || project.name.isBlank()) {
        msg.error('invalidName')
        return false
      }

      if (newProject) {
        const duplicate = (await (model
          .bindList('/projects', null, null, new Filter('name', 'EQ', project.name))
          .requestContexts())).first()
        if (duplicate) {
          msg.error('duplicateProjectError')
          return false
        }
      }

      return true
    },

    async saveProject() {
      let project = projectContext.getObject()
      const tasksCtx = tasksModel.bindList('/tasks').getContexts()
      const url = model.sServiceUrl + '/saveProject'
      const deletedTasks = []

      project = {
        name: project.name,
        description: project.description,
        archived: project.archived,
        op: newProject ? 'C' : 'U',
        tasks: []
      }

      for (const ctx of tasksCtx) {
        const task = ctx.getObject()

        if (task.subTasksModel) {
          const subTasks = task.subTasksModel.getProperty('/subTasks')
          delete task.subTasksModel
          task.subTasks = subTasks
        }

        if (task.op === 'D')
          deletedTasks.push(ctx.getPath())

        if (task.op)
          project.tasks.push(task)
      }

      // await $.get(`${url}(project='${JSON.stringify(project)}')`)

      await $.post(url, project)

      tasksModel.removeProperties(deletedTasks)
      newProject = false
      await model.resetChanges()
      await model.refresh()
      tasksModel.refresh()
    },

    // async saveProject() {
    //   const projectName = projectContext.getObject().name
    //   const tasks = tasksModel.bindList('/tasks').getContexts()
    //   const deletedTasks = []
    //   let op

    //   for (const taskCtx of tasks) {
    //     const task = taskCtx.getObject()
    //     const subTasksModel = task.subTasksModel
    //     delete task.subTasksModel

    //     // task logic
    //     try {
    //       op = task.op
    //       delete task.op

    //       // we can't delete subtasks due to integrity violation, so we use AJAX
    //       if (task.op === 'D') {
    //         const url = model.sServiceUrl + `/deleteTask(name='${task.name}')`
    //         await $.get(url)
    //         deletedTasks.push(taskCtx.getPath())
    //         continue
    //       }

    //       if (op === 'C') {
    //         task.project_name = projectName
    //         model.bindList('/tasks').create({...task})
    //       } else if (op === 'U') {
    //         const filters = [
    //           new Filter('project_name', 'EQ', projectName),
    //           new Filter('name', 'EQ', task.name)
    //         ]
    //         const binding = model.bindList('/tasks', null, null, filters)
    //         const ctx = (await binding.requestContexts()).first()
    //         ctx.setProperty('description', task.description)
    //       }

    //       op = ''
    //     } finally {
    //       task.op = op
    //     }

    //     // sub task logic
    //     if (subTasksModel) {
    //       const subTasks = subTasksModel.bindList('/subTasks').getContexts()

    //       for (const subTaskCtx of subTasks) {
    //         const subTask = subTaskCtx.getObject()
    //         op = subTask.op

    //         try {
    //           delete subTask.op

    //           if (op === 'C') {
    //             model.bindList('/subtasks').create({
    //               task_name: subTask.task,
    //               task_project_name: projectName,
    //               name: subTask.name,
    //               effort: parseInt(subTask.effort, 0)
    //             })
    //           } else if (op) {
    //             const filters = [
    //               new Filter('task_name', 'EQ', task.name),
    //               new Filter('name', 'EQ', subTask.name)
    //             ]
    //             const binding = model.bindList('/subtasks', null, null, filters)
    //             const ctx = (await binding.requestContexts()).first()
    //             if (op === 'D')
    //               ctx.delete('$direct')
    //             else ctx.setProperty('effort', subTask.effort)
    //           }

    //           op = ''
    //         } finally {
    //           subTask.op = op
    //         }
    //       }
    //     }
    //   }

    //   tasksModel.removeProperties(deletedTasks)
    //   await model.submitBatch('batch')
    //   newProject = false
    //   tasksModel.refresh()
    // },
  })
})