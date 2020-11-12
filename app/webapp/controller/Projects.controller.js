sap.ui.define([
  'sap/ui/core/mvc/Controller',
  'sap/ui/model/Filter',
  'training/hours/web/util/MessageHelper',
  'training/hours/web/util/User'
], function (Controller, Filter, MessageHelper, User) {
  'use strict'

  var model, msg
  const bus = sap.ui.getCore().getEventBus()

  return Controller.extend('training.hours.web.controller.Projects', {

    onInit() {
      this.onEnter()
      bus.subscribe('editor', 'onArchived', this.onArchived, this)
      bus.subscribe('editor', 'onSaving', this.onSaving, this)
      bus.subscribe('editor', 'onSaved', this.onSaved, this)
      bus.subscribe('editor', 'onNewProjectCancel', this.onNewProjectCancel, this)
      bus.subscribe('editor', 'onRecovered', this.onRecovered, this)
      bus.subscribe('editor', 'onDeleted', this.onDeleted, this)

      this.getOwnerComponent().getRouter().getRoute('Projects')
        .attachPatternMatched(this.onEnter, this)
    },

    onEnter() {
      model = this.getView().getModel()
      msg = new MessageHelper(this)
      this.setEditable(false)
      bus.publish('app', 'onLimitWidth', {limit: true})

      if (!User.is('admin')) {
        msg.error('adminRequired', null, this.onLeave.bind(this))
        return
      }

      this.selectFirstItem()
    },

    selectFirstItem() {
      const list = this.byId('projectList')
      let item = list.getItems().first()

      if (item) {
        list.setSelectedItem(item)
        this.showProject(item.getBindingContext())
      }
      else {
        list.attachEventOnce('updateFinished', null, () => {
          item = list.getItems().first()
          list.setSelectedItem(item)
          this.showProject(item.getBindingContext())
        }, this)
      }
    },

    onLeave() {
      this.getOwnerComponent().getRouter().navTo('Home')
      this.navTo('blank')
    },

    navTo(id) {
      if (model) model.resetChanges()
      this.byId('app').toDetail(this.createId(id), 'fade')
    },

    onProjectsLoaded() {
      for (const item of this.byId('projectList').getItems()) {
        if (!item || !item.getBindingContext()) continue
        if (item.getBindingContext().getProperty('archived'))
          item.setIcon('sap-icon://locked')
        else item.setIcon(null)
      }
    },

    onCreate() {
      this.navTo('editor')
      const projectBinding = this.byId('projectList').getBinding('items')
      this.setEditable(true)
      bus.publish('editor', 'onBind', {projectBinding})
    },

    onShow(ev) {
      const context = ev.getParameter('listItem').getBindingContext()
      this.showProject(context)
    },

    showProject(context) {
      const projectBinding = this.byId('projectList').getBinding('items')
      this.setEditable(false, !context.getProperty('archived'))
      bus.publish('editor', 'onBind', {context, projectBinding})
      this.navTo('editor')
    },

    onEdit() {
      this.setEditable(true)
    },

    onCancel() {
      this.setEditable(false)
      bus.publish('editor', 'onCancel')
    },

    onNewProjectCancel() {
      this.navTo('blank')
    },

    onSave() {
      bus.publish('editor', 'onSave')
    },

    onSaving() {
      this.getView()
        .setBusyIndicatorDelay(0)
        .setBusy(true)
    },

    onSaved() {
      this.getView()
        .setBusy(false)
        .setBusyIndicatorDelay(1000)
      this.setEditable(false)
    },

    onArchive() {
      bus.publish('editor', 'onArchive')
    },

    onArchived() {
      this.leaveEditor()
    },

    onRecover() {
      bus.publish('editor', 'onRecover')
    },

    async onRecovered(_ev, _ch, params, ctx = params.context) {
      model.refresh()
      this.showProject(ctx)
    },

    onDelete() {
      msg.confirm('confirmDeletion', 'confirm', ok => {
        if (ok) bus.publish('editor', 'onDelete')
      })
    },

    onDeleted() {
      this.leaveEditor()
    },

    onSearch(ev) {
      const filter = new Filter('name', 'Contains', ev.getParameter('newValue'))
      this.byId('projectList').getBinding('items').filter(filter)
    },

    onDownload() {
      bus.publish('editor', 'onDownload')
    },

    leaveEditor() {
      bus.publish('editor', 'onLeave')
      this.navTo('blank')
      model.refresh()
    },

    setEditable(editable, archivable = !editable) {
      this.byId('saveButton').setVisible(editable)
      this.byId('cancelButton').setVisible(editable)
      this.byId('editButton').setVisible(!editable && archivable)
      this.byId('archiveButton').setVisible(archivable)
      this.byId('recoverButton').setVisible(!editable && !archivable)
      this.byId('deleteButton').setVisible(!editable && !archivable)
      this.byId('downloadButton').setVisible(!editable)
      bus.publish('editor', 'onEdit', {editable})
    }
  })
})









