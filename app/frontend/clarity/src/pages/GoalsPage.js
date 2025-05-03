// src/pages/GoalsPage.js
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import QuickAdd from '../components/QuickAdd';
import '../styles/GoalsPage.css';

const GoalsPage = () => {
  const { userId } = useContext(AuthContext);
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [sortBy, setSortBy] = useState('progress'); // progress, created, alphabetical
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [progressValue, setProgressValue] = useState(0);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

  // Fetch goals
  useEffect(() => {
    const fetchGoals = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${userId}/goals`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch goals');
        }
        
        const data = await response.json();
        setGoals(data);
      } catch (err) {
        console.error('Error fetching goals:', err);
        setError('Could not load goals. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGoals();
    
    // Listen for updates
    const handleItemAdded = (e) => {
      if (e.detail.type === 'goal') {
        fetchGoals();
      }
    };
    
    window.addEventListener('item-added', handleItemAdded);
    
    return () => {
      window.removeEventListener('item-added', handleItemAdded);
    };
  }, [userId]);

  // Delete goal
  const deleteGoal = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${userId}/goals/${goalId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete goal');
      }
      
      setGoals(goals.filter(goal => goal.id !== goalId));
    } catch (err) {
      console.error('Error deleting goal:', err);
      alert('Failed to delete goal. Please try again.');
    }
  };

  // Start editing a goal
  const startEditing = (goal) => {
    setEditingGoalId(goal.id);
    setEditTitle(goal.title);
    setEditDescription(goal.description || '');
  };

  // Save edited goal
  const saveEditedGoal = async () => {
    if (!editTitle.trim()) {
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${userId}/goals/${editingGoalId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: editTitle.trim(),
          description: editDescription.trim() || null
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update goal');
      }
      
      const updatedGoal = await response.json();
      
      setGoals(goals.map(goal => 
        goal.id === updatedGoal.id ? updatedGoal : goal
      ));
      setEditingGoalId(null);
      setEditTitle('');
      setEditDescription('');
    } catch (err) {
      console.error('Error updating goal:', err);
      alert('Failed to update goal. Please try again.');
    }
  };

  // Open progress update modal
  const openProgressModal = (goal) => {
    setSelectedGoal(goal);
    setProgressValue(goal.progress);
  };

  // Close progress modal
  const closeProgressModal = () => {
    setSelectedGoal(null);
    setProgressValue(0);
  };

  // Update goal progress
  const updateGoalProgress = async () => {
    if (!selectedGoal) return;
    
    try {
      setIsUpdatingProgress(true);
      const response = await fetch(`/api/users/${userId}/goals/${selectedGoal.id}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ progress: progressValue })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update goal progress');
      }
      
      const updatedGoal = await response.json();
      
      setGoals(goals.map(goal => 
        goal.id === updatedGoal.id ? updatedGoal : goal
      ));
      
      setSelectedGoal(null);
    } catch (err) {
      console.error('Error updating goal progress:', err);
      alert('Failed to update progress. Please try again.');
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  // Mark goal as completed
  const markGoalAsCompleted = async (goalId, isCompleted) => {
    try {
      const response = await fetch(`/api/users/${userId}/goals/${goalId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          completed: !isCompleted,
          progress: !isCompleted ? 100 : 0
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update goal');
      }
      
      const updatedGoal = await response.json();
      
      setGoals(goals.map(goal => 
        goal.id === updatedGoal.id ? updatedGoal : goal
      ));
    } catch (err) {
      console.error('Error updating goal:', err);
      alert('Failed to update goal. Please try again.');
    }
  };

  // Filter goals
  const filteredGoals = goals.filter(goal => {
    if (filter === 'active') return !goal.completed;
    if (filter === 'completed') return goal.completed;
    return true; // 'all' filter
  });

  // Sort goals
  const sortedGoals = [...filteredGoals].sort((a, b) => {
    if (sortBy === 'progress') {
      return b.progress - a.progress;
    } else if (sortBy === 'created') {
      return new Date(b.created_at) - new Date(a.created_at);
    } else if (sortBy === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  // Calculate overall progress
  const calculateOverallProgress = () => {
    if (goals.length === 0) return 0;
    
    const totalProgress = goals.reduce((sum, goal) => sum + goal.progress, 0);
    return Math.round(totalProgress / goals.length);
  };

  if (isLoading) {
    return (
      <div className="goals-page loading">
        <div className="loading-spinner"></div>
        <p>Loading goals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="goals-page error">
        <div className="error-message">
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="goals-page">
      <header className="goals-header">
        <h1>Goals</h1>
        <QuickAdd userId={userId} />
      </header>
      
      <div className="goals-controls">
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
        
        <div className="sort-control">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="progress">Sort by Progress</option>
            <option value="created">Sort by Created Date</option>
            <option value="alphabetical">Sort Alphabetically</option>
          </select>
        </div>
      </div>
      
      <div className="overall-progress-section">
        <h2>Overall Progress</h2>
        <div className="overall-progress-container">
          <div className="progress-circle-container">
            <div 
              className="progress-circle" 
              style={{ 
                background: `conic-gradient(#4a6cf7 ${calculateOverallProgress() * 3.6}deg, #f0f0f0 0deg)`
              }}
            >
              <div className="progress-inner">
                <span className="progress-percentage">{calculateOverallProgress()}%</span>
              </div>
            </div>
          </div>
          <div className="progress-info">
            <p>{goals.length} goals in total</p>
            <p>{goals.filter(goal => goal.completed).length} completed</p>
          </div>
        </div>
      </div>
      
      {sortedGoals.length === 0 ? (
        <div className="no-goals">
          <p>No goals found</p>
          <button className="add-goal-btn" onClick={() => document.querySelector('.quick-add-button').click()}>
            Add Your First Goal
          </button>
        </div>
      ) : (
        <div className="goals-list">
          {sortedGoals.map(goal => (
            <div key={goal.id} className={`goal-card ${goal.completed ? 'completed' : ''}`}>
              {editingGoalId === goal.id ? (
                <div className="goal-edit">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Goal title"
                    className="edit-title"
                    autoFocus
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Goal description (optional)"
                    className="edit-description"
                  />
                  <div className="edit-actions">
                    <button 
                      className="cancel-edit-btn"
                      onClick={() => setEditingGoalId(null)}
                    >
                      Cancel
                    </button>
                    <button 
                      className="save-edit-btn"
                      onClick={saveEditedGoal}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="goal-header">
                    <h3 className="goal-title">{goal.title}</h3>
                    <div className="goal-actions">
                      <button 
                        className="edit-goal-btn" 
                        onClick={() => startEditing(goal)}
                        aria-label="Edit goal"
                      >
                        <i className="fas fa-pencil-alt"></i>
                      </button>
                      <button 
                        className="delete-goal-btn" 
                        onClick={() => deleteGoal(goal.id)}
                        aria-label="Delete goal"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                  
                  {goal.description && (
                    <p className="goal-description">{goal.description}</p>
                  )}
                  
                  <div className="goal-progress">
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${goal.progress}%` }}
                      ></div>
                    </div>
                    <div className="progress-details">
                      <span className="progress-percentage">{goal.progress}%</span>
                      <div className="progress-actions">
                        <button 
                          className="update-progress-btn"
                          onClick={() => openProgressModal(goal)}
                        >
                          Update Progress
                        </button>
                        <button 
                          className={`complete-goal-btn ${goal.completed ? 'uncomplete' : 'complete'}`}
                          onClick={() => markGoalAsCompleted(goal.id, goal.completed)}
                        >
                          {goal.completed ? 'Mark as Active' : 'Mark as Completed'}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="goal-meta">
                    <span className="goal-created">
                      Created: {new Date(goal.created_at).toLocaleDateString()}
                    </span>
                    {goal.completed && (
                      <span className="goal-completed">
                        Completed: {new Date(goal.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      
      {selectedGoal && (
        <div className="progress-modal-overlay">
          <div className="progress-modal">
            <div className="modal-header">
              <h3>Update Progress</h3>
              <button 
                className="close-modal-btn"
                onClick={closeProgressModal}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <h4>{selectedGoal.title}</h4>
              <div className="progress-slider-container">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={progressValue} 
                  onChange={(e) => setProgressValue(parseInt(e.target.value))}
                  className="progress-slider"
                />
                <div className="progress-value">{progressValue}%</div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={closeProgressModal}
                disabled={isUpdatingProgress}
              >
                Cancel
              </button>
              <button 
                className="save-btn"
                onClick={updateGoalProgress}
                disabled={isUpdatingProgress}
              >
                {isUpdatingProgress ? 'Saving...' : 'Save Progress'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsPage;
