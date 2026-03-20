import { useState, useEffect } from 'react';
import { useTaskStore } from '../../stores';
import { CheckSquare, CheckCircle2, Circle, Clock, Trash2, Plus, X, ArrowDown, ArrowUp, ListTodo, GitBranch } from 'lucide-react';
import { TaskDagView } from './TaskDagView';
import type { TaskStatus, Task as TaskType } from '../../types';

const statusConfig: Record<TaskStatus, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Circle className="w-4 h-4" />, color: 'text-gray-400', label: 'Pending' },
  in_progress: { icon: <Clock className="w-4 h-4" />, color: 'text-blue-500', label: 'In Progress' },
  completed: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-500', label: 'Completed' },
  deleted: { icon: <Trash2 className="w-4 h-4" />, color: 'text-red-400', label: 'Deleted' },
};

const filterOptions: { value: 'all' | TaskStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

function TaskItem({ task, isSelected, onSelect, onStatusChange }: {
  task: TaskType;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const status = statusConfig[task.status];

  // Find blocking tasks
  const tasks = useTaskStore.getState().tasks;
  const blockedByTasks = task.blockedBy
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean) as TaskType[];
  const blocksTasks = task.blocks
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean) as TaskType[];

  const nextStatus: Record<TaskStatus, TaskStatus | null> = {
    pending: 'in_progress',
    in_progress: 'completed',
    completed: null,
    deleted: null,
  };

  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'border-purple-500 bg-purple-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next = nextStatus[task.status];
              if (next) onStatusChange(next);
            }}
            className={`mt-0.5 ${status.color} hover:opacity-70 transition-opacity`}
            disabled={!nextStatus[task.status]}
            title={nextStatus[task.status] ? `Mark as ${statusConfig[nextStatus[task.status]!].label}` : undefined}
          >
            {status.icon}
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-gray-900 truncate">{task.subject}</div>
            {task.description && (
              <div className="text-sm text-gray-500 line-clamp-2 mt-0.5">
                {task.description}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dependencies */}
      {(blockedByTasks.length > 0 || blocksTasks.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {blockedByTasks.length > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <ArrowDown className="w-3 h-3" />
              <span>Blocked by {blockedByTasks.length}</span>
            </div>
          )}
          {blocksTasks.length > 0 && (
            <div className="flex items-center gap-1 text-blue-600">
              <ArrowUp className="w-3 h-3" />
              <span>Blocks {blocksTasks.length}</span>
            </div>
          )}
        </div>
      )}

      {/* Meta info */}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        <span>{status.label}</span>
        {task.owner && <span>@{task.owner}</span>}
      </div>
    </div>
  );
}

function TaskForm({ onSubmit, onCancel, initialData, availableTasks }: {
  onSubmit: (data: { subject: string; description: string; priority?: number; owner?: string; blockedBy?: string[] }) => void;
  onCancel: () => void;
  initialData?: TaskType;
  availableTasks: TaskType[];
}) {
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [priority, setPriority] = useState(initialData?.priority ?? 100);
  const [owner, setOwner] = useState(initialData?.owner || '');
  const [blockedBy, setBlockedBy] = useState<string[]>(initialData?.blockedBy || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    onSubmit({ subject, description, priority, owner: owner || undefined, blockedBy });
  };

  const toggleBlockedBy = (taskId: string) => {
    setBlockedBy(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Task title"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          rows={3}
          placeholder="Task description (optional)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Owner
        </label>
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Assignee (optional)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Priority
        </label>
        <input
          type="number"
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value) || 100)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Lower number = higher priority"
        />
        <p className="text-xs text-gray-400 mt-1">Lower number = higher priority (1 = highest)</p>
      </div>

      {availableTasks.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Blocked By
          </label>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {availableTasks.map(task => (
              <button
                key={task.id}
                type="button"
                onClick={() => toggleBlockedBy(task.id)}
                className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                  blockedBy.includes(task.id)
                    ? 'bg-orange-100 border-orange-300 text-orange-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {task.subject}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!subject.trim()}
          className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initialData ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function TaskPanel() {
  const {
    tasks,
    selectedTaskId,
    filter,
    fetchTasks,
    addTask,
    updateTask,
    deleteTask,
    setTaskStatus,
    setSelectedTaskId,
    setFilter,
    getFilteredTasks,
  } = useTaskStore();

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskType | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'dag'>('list');

  // Fetch tasks from API on mount
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredTasks = getFilteredTasks();
  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // Available tasks for blocking (exclude current task and already blocked)
  const availableTasks = tasks.filter(t =>
    t.id !== selectedTaskId &&
    !(selectedTask?.blockedBy.includes(t.id))
  );

  const handleCreateTask = async (data: { subject: string; description: string; priority?: number; owner?: string; blockedBy?: string[] }) => {
    const newTask = await addTask(data);
    setSelectedTaskId(newTask.id);
    setShowForm(false);
  };

  const handleUpdateTask = (data: { subject: string; description: string; priority?: number; owner?: string; blockedBy?: string[] }) => {
    if (!editingTask) return;
    updateTask(editingTask.id, data);
    setEditingTask(null);
  };

  const handleDeleteTask = () => {
    if (!selectedTaskId) return;
    deleteTask(selectedTaskId);
  };

  // Stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <div className="flex h-full">
      {/* Left: Task List */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-gray-900">Tasks</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                title="List View"
              >
                <ListTodo className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('dag')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'dag'
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                title="Graph View"
              >
                <GitBranch className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditingTask(null);
                  setShowForm(true);
                }}
                className="p-1.5 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors ml-1"
                title="New Task"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === opt.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="flex justify-between mt-3 text-xs text-gray-500">
            <span>{stats.total} total</span>
            <span className="flex gap-3">
              <span className="text-blue-500">{stats.inProgress} active</span>
              <span className="text-green-500">{stats.completed} done</span>
            </span>
          </div>
        </div>

        {/* Task List or DAG View */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'dag' ? (
            <div className="h-full">
              <TaskDagView
                tasks={tasks}
                onSelectTask={(taskId) => {
                  setSelectedTaskId(taskId);
                  setViewMode('list');
                }}
              />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-3 text-center py-8 text-gray-400">
              <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tasks yet</p>
              <p className="text-xs mt-1">Click + to create one</p>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-3 space-y-2">
              {filteredTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  onSelect={() => setSelectedTaskId(task.id)}
                  onStatusChange={(status) => setTaskStatus(task.id, status)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Task Detail / Form */}
      <div className="flex-1 bg-white overflow-y-auto">
        {showForm ? (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingTask ? 'Edit Task' : 'New Task'}
            </h2>
            <TaskForm
              onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
              onCancel={() => {
                setShowForm(false);
                setEditingTask(null);
              }}
              initialData={editingTask || undefined}
              availableTasks={availableTasks}
            />
          </div>
        ) : selectedTask ? (
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                {statusConfig[selectedTask.status].icon}
                <span className={`font-medium ${statusConfig[selectedTask.status].color}`}>
                  {statusConfig[selectedTask.status].label}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingTask(selectedTask);
                    setShowForm(true);
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteTask}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {selectedTask.subject}
            </h2>

            {selectedTask.description && (
              <p className="text-gray-600 mb-6 whitespace-pre-wrap">
                {selectedTask.description}
              </p>
            )}

            {/* Dependencies */}
            {(selectedTask.blockedBy.length > 0 || selectedTask.blocks.length > 0) && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Dependencies</h3>
                <div className="space-y-2">
                  {selectedTask.blockedBy.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <ArrowDown className="w-3 h-3" />
                        Blocked by
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTask.blockedBy.map(id => {
                          const task = tasks.find(t => t.id === id);
                          return task ? (
                            <button
                              key={id}
                              onClick={() => setSelectedTaskId(id)}
                              className="px-2 py-1 text-sm bg-orange-50 border border-orange-200 rounded-lg text-orange-700 hover:bg-orange-100 transition-colors"
                            >
                              {task.subject}
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  {selectedTask.blocks.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <ArrowUp className="w-3 h-3" />
                        Blocks
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTask.blocks.map(id => {
                          const task = tasks.find(t => t.id === id);
                          return task ? (
                            <button
                              key={id}
                              onClick={() => setSelectedTaskId(id)}
                              className="px-2 py-1 text-sm bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              {task.subject}
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="text-xs text-gray-400 pt-4 border-t">
              <p>Created: {new Date(selectedTask.createdAt).toLocaleString()}</p>
              <p>Updated: {new Date(selectedTask.updatedAt).toLocaleString()}</p>
              {selectedTask.owner && <p>Owner: {selectedTask.owner}</p>}
            </div>

            {/* Quick Actions */}
            <div className="mt-6 flex gap-2">
              {selectedTask.status === 'pending' && (
                <button
                  onClick={() => setTaskStatus(selectedTask.id, 'in_progress')}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Start Task
                </button>
              )}
              {selectedTask.status === 'in_progress' && (
                <button
                  onClick={() => setTaskStatus(selectedTask.id, 'completed')}
                  className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Complete Task
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a task to view details</p>
              <p className="text-sm mt-1">or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
