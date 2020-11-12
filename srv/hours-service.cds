using training.hours as h from '../db/data-model';

@path: '/'
service Hours @(impl:'./hours-service') {

  entity projects @(restrict: [
    {grant: ['READ', 'WRITE'], to: 'admin'},
    {grant: ['READ'], to: 'user'}
  ]) as projection on h.Project { 
    *, tasks: redirected to tasks
  };

  entity tasks @(restrict: [
    {grant: ['READ', 'WRITE'], to: 'admin'},
    {grant: ['READ'], to: 'user'}
  ]) as projection on h.Task {
    *,
    hours: redirected to hours,
    subtasks: redirected to subtasks
  };

  entity subtasks @(restrict: [
    {grant: ['READ', 'WRITE'], to: 'admin'}
  ]) as projection on h.SubTask;

  entity hours @(restrict: [{
    grant: ['READ'],
    to: ['user'],
    where: '$user = user_email'
  }, {
    grant: ['READ'],
    to: ['admin']
  }]) as projection on h.Hours {
    *, user: redirected to users
  };

  entity users @(restrict: [
    {grant: ['READ', 'WRITE'], to: ['admin']},
    {grant: ['READ'], to: ['user'], where: '$user = email'}
  ]) as projection on h.User;
  
  function env(var: String) returns String;
  function deleteProject(name: String) returns String;
  function totalHours(project: String, task: String) returns Integer;
}