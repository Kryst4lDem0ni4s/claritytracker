// src/components/tasks/RecentTasks.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/RecentTasks.css';

const RecentTasks = ({ userId }) => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${userId}/recent-tasks`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch tasks');
        }
        
        const data = await response.json();
        setTasks(data);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        setError('Could not load tasks. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
    
    // Listen for updates
    const handleItemAdded = (e) => {
      if (e.detail.type === 'task') {
        fetchTasks();
      }
    };
    
    window.addEventListener('item-added', handleItemAdded);
    
    return () => {
      window.removeEventListener('item-added', handleItemAdded);
    };
  }, [userId]);

  const toggleTaskCompletion = async (taskId, completed) => {
    try {
      setUpdatingTaskId(taskId);
      
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
      
      // Update the tasks array with the updated task
      setTasks(tasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      ));
    } catch (err) {
      console.error('Error updating task:', err);
      alert('Failed to update task. Please try again.');
    } finally {
      setUpdatingTaskId(null);
    }
  };

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

  if (isLoading) {
    return (
      <div className="recent-tasks-container loading">
        <div className="skeleton-loader header-skeleton"></div>
        <div className="tasks-list-skeleton">
          <div className="skeleton-loader task-item-skeleton"></div>
          <div className="skeleton-loader task-item-skeleton"></div>
          <div className="skeleton-loader task-item-skeleton"></div>
          <div className="skeleton-loader task-item-skeleton"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="recent-tasks-container error">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="recent-tasks-container">
      <div className="recent-tasks-header">
        <h3>Tasks Due Soon</h3>
        <Link to="/tasks" className="view-all-tasks">View All</Link>
      </div>
      
      {tasks.length === 0 ? (
        <div className="no-tasks">
          <p>No upcoming tasks</p>
          <Link to="/tasks" className="add-task-btn">Add Task</Link>
        </div>
      ) : (
        <div className="tasks-list">
          {tasks.map(task => (
            <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
              <div className="task-checkbox-container">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTaskCompletion(task.id, task.completed)}
                  disabled={updatingTaskId === task.id}
                  className="task-checkbox"
                  id={`task-${task.id}`}
                />
                <label 
                  htmlFor={`task-${task.id}`}
                  className="checkbox-label"
                >
                  <span className="checkbox-custom"></span>
                </label>
              </div>
              
              <div className="task-content">
                <div className="task-title-row">
                  <h4 className="task-title">{task.title}</h4>
                  {updatingTaskId === task.id && (
                    <span className="updating-indicator"></span>
                  )}
                </div>
                
                {task.description && (
                  <p className="task-description">{task.description}</p>
                )}
                
                {task.due_date && (
                  <div className={`task-due-date ${getDueDateClass(task.due_date)}`}>
                    <i className="calendar-icon"></i>
                    <span>{formatDueDate(task.due_date)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <Link to="/tasks" className="tasks-link">
            View All Tasks
          </Link>
        </div>
      )}
    </div>
  );
};

export default RecentTasks;
