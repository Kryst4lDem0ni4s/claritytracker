// src/pages/TodoPage.js
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import '../styles/TodoPage.css';

const TodoPage = () => {
  const { userId } = useContext(AuthContext);
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editText, setEditText] = useState('');

  // Fetch todos
  useEffect(() => {
    const fetchTodos = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${userId}/todos`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch todos');
        }
        
        const data = await response.json();
        setTodos(data);
      } catch (err) {
        console.error('Error fetching todos:', err);
        setError('Could not load todos. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTodos();
  }, [userId]);

  // Add new todo
  const addTodo = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;
    
    try {
      const response = await fetch(`/api/users/${userId}/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: inputValue.trim() })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add todo');
      }
      
      const newTodo = await response.json();
      setTodos([...todos, newTodo]);
      setInputValue('');
    } catch (err) {
      console.error('Error adding todo:', err);
      alert('Failed to add todo. Please try again.');
    }
  };

  // Toggle todo completion
  const toggleTodoCompletion = async (todoId, completed) => {
    try {
      const response = await fetch(`/api/users/${userId}/todos/${todoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: !completed })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update todo');
      }
      
      const updatedTodo = await response.json();
      
      setTodos(todos.map(todo => 
        todo.id === updatedTodo.id ? updatedTodo : todo
      ));
    } catch (err) {
      console.error('Error updating todo:', err);
      alert('Failed to update todo. Please try again.');
    }
  };

  // Delete todo
  const deleteTodo = async (todoId) => {
    try {
      const response = await fetch(`/api/users/${userId}/todos/${todoId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete todo');
      }
      
      setTodos(todos.filter(todo => todo.id !== todoId));
    } catch (err) {
      console.error('Error deleting todo:', err);
      alert('Failed to delete todo. Please try again.');
    }
  };

  // Start editing a todo
  const startEditing = (todo) => {
    setEditingTodoId(todo.id);
    setEditText(todo.title);
  };

  // Save edited todo
  const saveEditedTodo = async () => {
    if (!editText.trim()) {
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${userId}/todos/${editingTodoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: editText.trim() })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update todo');
      }
      
      const updatedTodo = await response.json();
      
      setTodos(todos.map(todo => 
        todo.id === updatedTodo.id ? updatedTodo : todo
      ));
      setEditingTodoId(null);
      setEditText('');
    } catch (err) {
      console.error('Error updating todo:', err);
      alert('Failed to update todo. Please try again.');
    }
  };

  // Handle edit input key press
  const handleEditKeyPress = (e) => {
    if (e.key === 'Enter') {
      saveEditedTodo();
    } else if (e.key === 'Escape') {
      setEditingTodoId(null);
      setEditText('');
    }
  };

  // Clear completed todos
  const clearCompleted = async () => {
    const completedTodos = todos.filter(todo => todo.completed);
    
    if (completedTodos.length === 0) return;
    
    if (!window.confirm('Are you sure you want to clear all completed todos?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${userId}/todos/clear-completed`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear completed todos');
      }
      
      setTodos(todos.filter(todo => !todo.completed));
    } catch (err) {
      console.error('Error clearing completed todos:', err);
      alert('Failed to clear completed todos. Please try again.');
    }
  };

  // Filter todos
  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true; // 'all' filter
  });

  // Count active todos
  const activeTodosCount = todos.filter(todo => !todo.completed).length;

  if (isLoading) {
    return (
      <div className="todo-page loading">
        <div className="loading-spinner"></div>
        <p>Loading todos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="todo-page error">
        <div className="error-message">
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="todo-page">
      <div className="todo-container">
        <h1>Todo List</h1>
        
        <form className="todo-form" onSubmit={addTodo}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="What needs to be done?"
            className="todo-input"
          />
          <button type="submit" className="add-todo-btn">Add</button>
        </form>
        
        {todos.length > 0 && (
          <>
            <div className="todo-filters">
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
            
            <ul className="todo-list">
              {filteredTodos.map(todo => (
                <li key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                  <div className="todo-checkbox-container">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodoCompletion(todo.id, todo.completed)}
                      id={`todo-${todo.id}`}
                      className="todo-checkbox"
                    />
                    <label htmlFor={`todo-${todo.id}`} className="checkbox-label">
                      <span className="checkbox-custom"></span>
                    </label>
                  </div>
                  
                  {editingTodoId === todo.id ? (
                    <input
                      type="text"
                      className="edit-todo-input"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={saveEditedTodo}
                      onKeyDown={handleEditKeyPress}
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="todo-title"
                      onDoubleClick={() => startEditing(todo)}
                    >
                      {todo.title}
                    </span>
                  )}
                  
                  <button 
                    className="delete-todo-btn" 
                    onClick={() => deleteTodo(todo.id)}
                    aria-label="Delete todo"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            
            <div className="todo-footer">
              <span className="todo-count">
                {activeTodosCount} {activeTodosCount === 1 ? 'item' : 'items'} left
              </span>
              
              {todos.some(todo => todo.completed) && (
                <button 
                  className="clear-completed-btn"
                  onClick={clearCompleted}
                >
                  Clear completed
                </button>
              )}
            </div>
          </>
        )}
        
        {todos.length === 0 && (
          <div className="empty-todos">
            <p>No todos yet. Add one above!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoPage;
