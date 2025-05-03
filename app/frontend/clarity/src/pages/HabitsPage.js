// src/pages/HabitsPage.js
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import QuickAdd from '../components/QuickAdd';
import ContributionGraph from '../components/ContributionGraph';
import '../styles/HabitsPage.css';

const HabitsPage = () => {
  const { userId } = useContext(AuthContext);
  const [habits, setHabits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [editText, setEditText] = useState('');
  const [filter, setFilter] = useState('all'); // all, daily, weekly, monthly
  const [view, setView] = useState('list'); // list, calendar
  const [currentDate, setCurrentDate] = useState(new Date());
  const [habitActivities, setHabitActivities] = useState({});

  // Fetch habits and activities
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        
        // Fetch habits
        const habitsResponse = await fetch(`/api/users/${userId}/habits`);
        if (!habitsResponse.ok) {
          throw new Error('Failed to fetch habits');
        }
        const habitsData = await habitsResponse.json();
        
        // Fetch habit activities for the current week
        const startDate = getStartOfWeek(currentDate);
        const endDate = getEndOfWeek(currentDate);
        
        const activitiesResponse = await fetch(
          `/api/users/${userId}/habit-activities?start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}`
        );
        if (!activitiesResponse.ok) {
          throw new Error('Failed to fetch habit activities');
        }
        const activitiesData = await activitiesResponse.json();
        
        // Organize activities by habit_id and date
        const activitiesByHabit = {};
        activitiesData.forEach(activity => {
          if (!activitiesByHabit[activity.habit_id]) {
            activitiesByHabit[activity.habit_id] = {};
          }
          activitiesByHabit[activity.habit_id][activity.date] = activity.status;
        });
        
        setHabits(habitsData);
        setHabitActivities(activitiesByHabit);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load habits. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Listen for habit updates
    const handleHabitAdded = (e) => {
      if (e.detail.type === 'habit') {
        fetchData();
      }
    };
    
    window.addEventListener('item-added', handleHabitAdded);
    
    return () => {
      window.removeEventListener('item-added', handleHabitAdded);
    };
  }, [userId, currentDate]);

  // Format date as YYYY-MM-DD
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Get start of week (Sunday)
  const getStartOfWeek = (date) => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    return result;
  };

  // Get end of week (Saturday)
  const getEndOfWeek = (date) => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() + (6 - day));
    return result;
  };

  // Get days of current week
  const getDaysOfWeek = () => {
    const startDate = getStartOfWeek(currentDate);
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    
    return days;
  };

  // Format day name
  const formatDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Format day number
  const formatDayNumber = (date) => {
    return date.getDate();
  };

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  // Go to current week
  const goToCurrentWeek = () => {
    setCurrentDate(new Date());
  };

  // Delete habit
  const deleteHabit = async (habitId) => {
    if (!window.confirm('Are you sure you want to delete this habit?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${userId}/habits/${habitId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete habit');
      }
      
      setHabits(habits.filter(habit => habit.id !== habitId));
    } catch (err) {
      console.error('Error deleting habit:', err);
      alert('Failed to delete habit. Please try again.');
    }
  };

  // Start editing a habit
  const startEditing = (habit) => {
    setEditingHabitId(habit.id);
    setEditText(habit.title);
  };

  // Save edited habit
  const saveEditedHabit = async () => {
    if (!editText.trim()) {
      return;
    }
    
    try {
      const habitToUpdate = habits.find(habit => habit.id === editingHabitId);
      
      const response = await fetch(`/api/users/${userId}/habits/${editingHabitId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ...habitToUpdate,
          title: editText.trim() 
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update habit');
      }
      
      const updatedHabit = await response.json();
      
      setHabits(habits.map(habit => 
        habit.id === updatedHabit.id ? updatedHabit : habit
      ));
      setEditingHabitId(null);
      setEditText('');
    } catch (err) {
      console.error('Error updating habit:', err);
      alert('Failed to update habit. Please try again.');
    }
  };

  // Track habit for a specific date
  const trackHabit = async (habitId, date, currentStatus) => {
    const dateStr = formatDate(date);
    
    // Determine next status (none -> done -> skipped -> none)
    let nextStatus;
    if (!currentStatus || currentStatus === 'none') {
      nextStatus = 'done';
    } else if (currentStatus === 'done') {
      nextStatus = 'skipped';
    } else {
      nextStatus = 'none';
    }
    
    try {
      const response = await fetch(`/api/users/${userId}/habits/${habitId}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          date: dateStr,
          status: nextStatus
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to track habit');
      }
      
      // Update local state
      setHabitActivities(prev => {
        const updated = { ...prev };
        if (!updated[habitId]) {
          updated[habitId] = {};
        }
        
        if (nextStatus === 'none') {
          delete updated[habitId][dateStr];
        } else {
          updated[habitId][dateStr] = nextStatus;
        }
        
        return updated;
      });
    } catch (err) {
      console.error('Error tracking habit:', err);
      alert('Failed to track habit. Please try again.');
    }
  };

  // Get status for a habit on a specific date
  const getHabitStatus = (habitId, date) => {
    const dateStr = formatDate(date);
    return habitActivities[habitId]?.[dateStr] || 'none';
  };

  // Get CSS class for habit status
  const getStatusClass = (status) => {
    switch (status) {
      case 'done':
        return 'status-done';
      case 'skipped':
        return 'status-skipped';
      default:
        return 'status-none';
    }
  };

  // Calculate streak for a habit
  const calculateStreak = (habitId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentStreak = 0;
    let date = new Date(today);
    
    // Check backwards from yesterday
    date.setDate(date.getDate() - 1);
    
    while (true) {
      const dateStr = formatDate(date);
      const status = habitActivities[habitId]?.[dateStr];
      
      if (status === 'done') {
        currentStreak++;
      } else if (status === 'skipped') {
        // Skipped days don't break the streak but don't add to it
      } else {
        break;
      }
      
      date.setDate(date.getDate() - 1);
    }
    
    return currentStreak;
  };

  // Filter habits based on frequency
  const filteredHabits = habits.filter(habit => {
    if (filter === 'all') return true;
    return habit.frequency === filter;
  });

  // Render loading state
  if (isLoading) {
    return (
      <div className="habits-page loading">
        <div className="loading-spinner"></div>
        <p>Loading habits...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="habits-page error">
        <div className="error-message">
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="habits-page">
      <header className="habits-header">
        <h1>Habits</h1>
        <QuickAdd userId={userId} />
      </header>
      
      <div className="habits-controls">
        <div className="filters">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={filter === 'daily' ? 'active' : ''} 
            onClick={() => setFilter('daily')}
          >
            Daily
          </button>
          <button 
            className={filter === 'weekly' ? 'active' : ''} 
            onClick={() => setFilter('weekly')}
          >
            Weekly
          </button>
          <button 
            className={filter === 'monthly' ? 'active' : ''} 
            onClick={() => setFilter('monthly')}
          >
            Monthly
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
            className={view === 'calendar' ? 'active' : ''} 
            onClick={() => setView('calendar')}
          >
            <i className="fas fa-calendar-alt"></i>
            Calendar
          </button>
        </div>
      </div>
      
      <div className="contribution-section">
        <h2>Your Activity</h2>
        <ContributionGraph userId={userId} />
      </div>
      
      <div className="week-navigation">
        <button onClick={goToPreviousWeek} className="nav-button">
          <i className="fas fa-chevron-left"></i>
        </button>
        <h2>
          {getStartOfWeek(currentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
          {getEndOfWeek(currentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </h2>
        <button onClick={goToNextWeek} className="nav-button">
          <i className="fas fa-chevron-right"></i>
        </button>
        <button onClick={goToCurrentWeek} className="today-button">
          Today
        </button>
      </div>
      
      {filteredHabits.length === 0 ? (
        <div className="no-habits">
          <p>No habits found</p>
          <button className="add-habit-btn" onClick={() => document.querySelector('.quick-add-button').click()}>
            Add Your First Habit
          </button>
        </div>
      ) : (
        <div className="habits-tracker">
          <div className="tracker-header">
            <div className="habit-column">Habit</div>
            {getDaysOfWeek().map((day, index) => (
              <div key={index} className={`day-column ${isToday(day) ? 'today' : ''}`}>
                <div className="day-name">{formatDayName(day)}</div>
                <div className="day-number">{formatDayNumber(day)}</div>
              </div>
            ))}
            <div className="streak-column">Streak</div>
          </div>
          
          <div className="tracker-body">
            {filteredHabits.map(habit => (
              <div key={habit.id} className="habit-row">
                <div className="habit-info">
                  {editingHabitId === habit.id ? (
                    <div className="habit-edit">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={saveEditedHabit}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditedHabit()}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <>
                      <h3 className="habit-title">{habit.title}</h3>
                      <div className="habit-meta">
                        <span className="habit-frequency">{habit.frequency}</span>
                      </div>
                      <div className="habit-actions">
                        <button 
                          className="edit-habit-btn" 
                          onClick={() => startEditing(habit)}
                          aria-label="Edit habit"
                        >
                          <i className="fas fa-pencil-alt"></i>
                        </button>
                        <button 
                          className="delete-habit-btn" 
                          onClick={() => deleteHabit(habit.id)}
                          aria-label="Delete habit"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                
                {getDaysOfWeek().map((day, index) => {
                  const status = getHabitStatus(habit.id, day);
                  return (
                    <div 
                      key={index} 
                      className={`day-cell ${getStatusClass(status)} ${isToday(day) ? 'today' : ''}`}
                      onClick={() => trackHabit(habit.id, day, status)}
                    >
                      {status === 'done' && <i className="fas fa-check"></i>}
                      {status === 'skipped' && <i className="fas fa-times"></i>}
                    </div>
                  );
                })}
                
                <div className="streak-cell">
                  <div className="streak-count">{calculateStreak(habit.id)}</div>
                  <div className="streak-label">days</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitsPage;
