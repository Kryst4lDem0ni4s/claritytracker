// src/components/goals/GoalProgress.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/GoalProgress.css';

const GoalProgress = ({ userId }) => {
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progressValue, setProgressValue] = useState(0);

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

  const handleProgressUpdate = async () => {
    if (!selectedGoal) return;
    
    try {
      setIsUpdating(true);
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
      
      // Update the goals array with the updated goal
      setGoals(goals.map(goal => 
        goal.id === updatedGoal.id ? updatedGoal : goal
      ));
      
      // Close the modal
      setSelectedGoal(null);
    } catch (err) {
      console.error('Error updating goal progress:', err);
      alert('Failed to update progress. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const openProgressModal = (goal) => {
    setSelectedGoal(goal);
    setProgressValue(goal.progress);
  };

  const closeProgressModal = () => {
    setSelectedGoal(null);
  };

  const calculateOverallProgress = () => {
    if (goals.length === 0) return 0;
    
    const totalProgress = goals.reduce((sum, goal) => sum + goal.progress, 0);
    return Math.round(totalProgress / goals.length);
  };

  if (isLoading) {
    return (
      <div className="goal-progress-container loading">
        <div className="skeleton-loader header-skeleton"></div>
        <div className="skeleton-loader progress-skeleton"></div>
        <div className="skeleton-loader goal-list-skeleton">
          <div className="skeleton-loader goal-item-skeleton"></div>
          <div className="skeleton-loader goal-item-skeleton"></div>
          <div className="skeleton-loader goal-item-skeleton"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="goal-progress-container error">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="goal-progress-container">
      <div className="goal-progress-header">
        <h3>Goal Progress</h3>
        <Link to="/goals" className="view-all-goals">View All</Link>
      </div>
      
      <div className="overall-progress">
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
          <h4>Overall Progress</h4>
          <p>{goals.length} active goals</p>
        </div>
      </div>
      
      {goals.length === 0 ? (
        <div className="no-goals">
          <p>You don't have any goals yet.</p>
          <Link to="/goals" className="add-goal-btn">Add Your First Goal</Link>
        </div>
      ) : (
        <div className="goal-list">
          {goals.slice(0, 3).map(goal => (
            <div key={goal.id} className="goal-item">
              <div className="goal-details">
                <h4>{goal.title}</h4>
                {goal.description && <p>{goal.description}</p>}
              </div>
              <div className="goal-progress">
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${goal.progress}%` }}
                  ></div>
                </div>
                <div className="progress-actions">
                  <span className="progress-percentage">{goal.progress}%</span>
                  <button 
                    className="update-progress-btn"
                    onClick={() => openProgressModal(goal)}
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {goals.length > 3 && (
            <Link to="/goals" className="more-goals">
              View {goals.length - 3} more goals
            </Link>
          )}
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
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button 
                className="save-btn"
                onClick={handleProgressUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Save Progress'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalProgress;
