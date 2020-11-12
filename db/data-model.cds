namespace training.hours;

entity Project {
    key name: String(100);
    description: String(1000);
    archived: Boolean not null default false;
    
    tasks: Association to many Task on tasks.project = $self;
}

entity Task {
    key name: String(60);
    description: String(1000);
    
    @cascade: {delete}
    key project: Association to Project;
    
    hours: Association to many Hours on hours.task = $self;
    subtasks: Association to many SubTask on subtasks.task = $self;
}

entity SubTask {
  key name: String(60);
  description: String(1000);
  effort: Integer;
  
  @cascade: {delete}
  key task: Association to Task;
}

entity Hours {
    key day: Integer64 not null;
    key hours: Integer not null;
    
    @cascade: {delete}
    key task: Association to Task;
    @cascade: {delete}
    key user: Association to User;
}

entity User {
  key email: String;
  name: String;
  memo: Boolean not null default false;
}