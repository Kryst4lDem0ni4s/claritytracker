// src/pages/TasksPage.js
import React, { useState, useEffect, useContext } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { AuthContext } from '../App';
import QuickAdd from '../components/QuickAdd';
import '../styles/TasksPage.css';

const TasksPage = () => {
  const { userId } = useContext(AuthContext);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editText, setEditText] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('dueDate'); // dueDate, priority, alphabetical
  const [view, setView] = useState('list'); // list, board
  
  // Fetch tasks and categories
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        
        // Fetch tasks
        const tasksResponse = await fetch(`/api/users/${userId}/tasks`);
        if (!tasksResponse.ok) {
          throw new Error('Failed to fetch tasks');
        }
        const tasksData = await tasksResponse.json();
        
        // Fetch categories
        const categoriesResponse = await fetch(`/api/users/${userId}/task-categories`);
        if (!categoriesResponse.ok) {
          throw new Error('Failed to fetch categories');
        }
        const categoriesData = await categoriesResponse.json();
        
        setTasks(tasksData);
        setCategories(categoriesData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load tasks. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Listen for task updates
    const handleTaskAdded = (e) => {
      if (e.detail.type === 'task') {
        fetchData();
      }
    };
    
    window.addEventListener('item-added', handleTaskAdded);
    
    return () => {
      window.removeEventListener('item-added', handleTaskAdded);
    };
  }, [userId]);
  
  // Toggle task completion
  const toggleTaskCompletion = async (taskId, completed) => {
    try {
      const response = await fetch(`/api/users/${userId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: !completed })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update task');
      }
      
      const updatedTask = await response.json();
      
      setTasks(tasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      ));
    } catch (err) {
      console.error('Error updating task:', err);
      alert('Failed to update task. Please try again.');
    }
  };
  
  // Delete task
  const deleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${userId}/tasks/${taskId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete task');
      }
      
      setTasks(tasks.filter(task => task.id !== taskId));
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Failed to delete task. Please try again.');
    }
  };
  
  // Start editing a task
  const startEditing = (task) => {
    setEditingTaskId(task.id);
    setEditText(task.title);
  };
  
  // Save edited task
  const saveEditedTask = async () => {
    if (!editText.trim()) {
      return;
    }
    
    try {
      const taskToUpdate = tasks.find(task => task.id === editingTaskId);
      
      const response = await fetch(`/api/users/${userId}/tasks/${editingTaskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ...taskToUpdate,
          title: editText.trim() 
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update task');
      }
      
      const updatedTask = await response.json();
      
      setTasks(tasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      ));
      setEditingTaskId(null);
      setEditText('');
    } catch (err) {
      console.error('Error updating task:', err);
      alert('Failed to update task. Please try again.');
    }
  };
  
  // Handle drag and drop
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update the order property of each task
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index
    }));
    
    setTasks(updatedItems);
    
    // Update the order in the backend
    try {
      const response = await fetch(`/api/users/${userId}/tasks/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          taskIds: updatedItems.map(item => ({ id: item.id, order: item.order }))
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update task order');
      }
    } catch (err) {
      console.error('Error updating task order:', err);
      // Silently fail, the UI is already updated
    }
  };
  
  // Filter tasks based on current filter, category, and search query
  const filteredTasks = tasks
    .filter(task => {
      // Filter by completion status
      if (filter === 'active') return !task.completed;
      if (filter === 'completed') return task.completed;
      return true; // 'all' filter
    })
    .filter(task => {
      // Filter by category
      if (selectedCategory === 'all') return true;
      return task.category_id === parseInt(selectedCategory);
    })
    .filter(task => {
      // Filter by search query
      if (!searchQuery.trim()) return true;
      return task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
             (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
    });
  
  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'dueDate') {
      // Sort by due date (null dates at the end)
      if (!a.due_date && !b.due_date) return a.order - b.order;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    } else if (sortBy === 'priority') {
      // Sort by priority (high to low)
      const priorityOrder = { high: 0, medium: 1, low: 2, null: 3 };
      const aPriority = a.priority || 'null';
      const bPriority = b.priority || 'null';
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    } else if (sortBy === 'alphabetical') {
      // Sort alphabetically
      return a.title.localeCompare(b.title);
    }
    return 0;
  });
  
  // Group tasks by category for board view
  const tasksByCategory = categories.reduce((acc, category) => {
    acc[category.id] = sortedTasks.filter(task => task.category_id === category.id);
    return acc;
  }, {});
  
  // Tasks without category
  const uncategorizedTasks = sortedTasks.filter(task => !task.category_id);
  
  // Format due date
  const formatDueDate = (dateString) => {
    if (!dateString) return null;
    
    const dueDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dueDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (dueDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else if (dueDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return dueDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };
  
  // Get due date class
  const getDueDateClass = (dateString) => {
    if (!dateString) return '';
    
    const dueDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
      return 'overdue';
    } else if (dueDate.getTime() === today.getTime()) {
      return 'due-today';
    } else {
      return 'upcoming';
    }
  };
  
  // Get priority class
  const getPriorityClass = (priority) => {
    if (!priority) return '';
    return `priority-${priority.toLowerCase()}`;
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="tasks-page loading">
        <div className="loading-spinner"></div>
        <p>Loading tasks...</p>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="tasks-page error">
        <div className="error-message">
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="tasks-page">
      <header className="tasks-header">
        <h1>Tasks</h1>
        <QuickAdd userId={userId} />
      </header>
      
      <div className="tasks-controls">
        <div className="filters">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={filter === 'active' ? 'active' : ''} 
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button 
            className={filter === 'completed' ? 'active' : ''} 
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
        </div>
        
        <div className="view-controls">
          <button 
            className={view === 'list' ? 'active' : ''} 
            onClick={() => setView('list')}
          >
            <i className="fas fa-list"></i>
            List
          </button>
          <button 
            className={view === 'board' ? 'active' : ''} 
            onClick={() => setView('board')}
          >
            <i className="fas fa-columns"></i>
            Board
          </button>
        </div>
      </div>
      
      <div className="tasks-toolbar">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button 
              className="clear-search" 
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>
        
        <div className="category-filter">
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value="none">Uncategorized</option>
          </select>
        </div>
        
        <div className="sort-control">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="dueDate">Sort by Due Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="alphabetical">Sort Alphabetically</option>
          </select>
        </div>
      </div>
      
      {view === 'list' ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="tasks">
            {(provided) => (
              <ul 
                className="tasks-list"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {sortedTasks.length === 0 ? (
                  <div className="no-tasks">
                    <p>No tasks found</p>
                    <button className="add-task-btn" onClick={() => document.querySelector('.quick-add-button').click()}>
                      Add Your First Task
                    </button>
                  </div>
                ) : (
                  sortedTasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                      {(provided) => (
                        <li 
                          className={`task-item ${task.completed ? 'completed' : ''}`}
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <div className="task-checkbox-container">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => toggleTaskCompletion(task.id, task.completed)}
                              id={`task-${task.id}`}
                              className="task-checkbox"
                            />
                            <label htmlFor={`task-${task.id}`} className="checkbox-label">
                              <span className="checkbox-custom"></span>
                            </label>
                          </div>
                          
                          <div className="task-content">
                            {editingTaskId === task.id ? (
                              <div className="task-edit">
                                <input
                                  type="text"
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  onBlur={saveEditedTask}
                                  onKeyDown={(e) => e.key === 'Enter' && saveEditedTask()}
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <>
                                <div className="task-title-row">
                                  <h3 className="task-title">{task.title}</h3>
                                  {task.priority && (
                                    <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
                                      {task.priority}
                                    </span>
                                  )}
                                </div>
                                
                                {task.description && (
                                  <p className="task-description">{task.description}</p>
                                )}
                                
                                <div className="task-meta">
                                  {task.category_id && (
                                    <span className="task-category">
                                      {categories.find(c => c.id === task.category_id)?.name}
                                    </span>
                                  )}
                                  
                                  {task.due_date && (
                                    <span className={`task-due-date ${getDueDateClass(task.due_date)}`}>
                                      <i className="far fa-calendar"></i>
                                      {formatDueDate(task.due_date)}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          
                          <div className="task-actions">
                            <button 
                              className="edit-task-btn" 
                              onClick={() => startEditing(task)}
                              aria-label="Edit task"
                            >
                              <i className="fas fa-pencil-alt"></i>
                            </button>
                            <button 
                              className="delete-task-btn" 
                              onClick={() => deleteTask(task.id)}
                              aria-label="Delete task"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </li>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className="tasks-board">
          {categories.map(category => (
            <div key={category.id} className="board-column">
              <h3 className="column-title">{category.name}</h3>
              <ul className="column-tasks">
                {tasksByCategory[category.id]?.length ? (
                  tasksByCategory[category.id].map(task => (
                    <li 
                      key={task.id} 
                      className={`board-task-item ${task.completed ? 'completed' : ''}`}
                    >
                      <div className="task-checkbox-container">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTaskCompletion(task.id, task.completed)}
                          id={`board-task-${task.id}`}
                          className="task-checkbox"
                        />
                        <label htmlFor={`board-task-${task.id}`} className="checkbox-label">
                          <span className="checkbox-custom"></span>
                        </label>
                      </div>
                      
                      <div className="task-content">
                        <h3 className="task-title">{task.title}</h3>
                        
                        {task.due_date && (
                          <span className={`task-due-date ${getDueDateClass(task.due_date)}`}>
                            <i className="far fa-calendar"></i>
                            {formatDueDate(task.due_date)}
                          </span>
                        )}
                      </div>
                      
                      <div className="task-actions">
                        <button 
                          className="edit-task-btn" 
                          onClick={() => startEditing(task)}
                          aria-label="Edit task"
                        >
                          <i className="fas fa-pencil-alt"></i>
                        </button>
                        <button 
                          className="delete-task-btn" 
                          onClick={() => deleteTask(task.id)}
                          aria-label="Delete task"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="empty-column">No tasks</li>
                )}
              </ul>
            </div>
          ))}
          
          <div className="board-column">
            <h3 className="column-title">Uncategorized</h3>
            <ul className="column-tasks">
              {uncategorizedTasks.length ? (
                uncategorizedTasks.map(task => (
                  <li 
                    key={task.id} 
                    className={`board-task-item ${task.completed ? 'completed' : ''}`}
                  >
                    <div className="task-checkbox-container">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTaskCompletion(task.id, task.completed)}
                        id={`board-task-${task.id}`}
                        className="task-checkbox"
                      />
                      <label htmlFor={`board-task-${task.id}`} className="checkbox-label">
                        <span className="checkbox-custom"></span>
                      </label>
                    </div>
                    
                    <div className="task-content">
                      <h3 className="task-title">{task.title}</h3>
                      
                      {task.due_date && (
                        <span className={`task-due-date ${getDueDateClass(task.due_date)}`}>
                          <i className="far fa-calendar"></i>
                          {formatDueDate(task.due_date)}
                        </span>
                      )}
                    </div>
                    
                    <div className="task-actions">
                      <button 
                        className="edit-task-btn" 
                        onClick={() => startEditing(task)}
                        aria-label="Edit task"
                      >
                        <i className="fas fa-pencil-alt"></i>
                      </button>
                      <button 
                        className="delete-task-btn" 
                        onClick={() => deleteTask(task.id)}
                        aria-label="Delete task"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  </li>
                ))
              ) : (
                <li className="empty-column">No tasks</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
