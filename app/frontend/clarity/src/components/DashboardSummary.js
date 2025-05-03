// src/components/dashboard/DashboardSummary.js
import React, { useState, useEffect } from 'react';
import '../styles/DashboardSummary.css';

const DashboardSummary = ({ userId }) => {
  const [summaryData, setSummaryData] = useState({
    tasksDue: 0,
    habitsToday: 0,
    upcomingEvents: 0,
    completedToday: 0,
    quote: { text: "", author: "" }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummaryData = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${userId}/dashboard-summary`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        
        const data = await response.json();
        setSummaryData(data);
      } catch (err) {
        console.error('Error fetching dashboard summary:', err);
        setError('Could not load dashboard data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummaryData();
    
    // Listen for updates
    const handleItemAdded = () => {
      fetchSummaryData();
    };
    
    window.addEventListener('item-added', handleItemAdded);
    
    return () => {
      window.removeEventListener('item-added', handleItemAdded);
    };
  }, [userId]);

  const formatDate = () => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString('en-US', options);
  };

  if (isLoading) {
    return (
      <div className="dashboard-summary loading">
        <div className="skeleton-loader date-skeleton"></div>
        <div className="summary-stats">
          <div className="stat-card">
            <div className="skeleton-loader icon-skeleton"></div>
            <div className="stat-info">
              <div className="skeleton-loader title-skeleton"></div>
              <div className="skeleton-loader subtitle-skeleton"></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="skeleton-loader icon-skeleton"></div>
            <div className="stat-info">
              <div className="skeleton-loader title-skeleton"></div>
              <div className="skeleton-loader subtitle-skeleton"></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="skeleton-loader icon-skeleton"></div>
            <div className="stat-info">
              <div className="skeleton-loader title-skeleton"></div>
              <div className="skeleton-loader subtitle-skeleton"></div>
            </div>
          </div>
        </div>
        <div className="skeleton-loader quote-skeleton"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-summary error">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-summary">
      <div className="date-display">
        <h2>{formatDate()}</h2>
        <div className="completion-badge">
          <span>{summaryData.completedToday}</span> completed today
        </div>
      </div>
      
      <div className="summary-stats">
        <div className="stat-card">
          <div className="stat-icon task-icon">
            <i className="fas fa-tasks"></i>
          </div>
          <div className="stat-info">
            <h3>{summaryData.tasksDue}</h3>
            <p>Tasks Due</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon habit-icon">
            <i className="fas fa-repeat"></i>
          </div>
          <div className="stat-info">
            <h3>{summaryData.habitsToday}</h3>
            <p>Habits Today</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon event-icon">
            <i className="fas fa-calendar"></i>
          </div>
          <div className="stat-info">
            <h3>{summaryData.upcomingEvents}</h3>
            <p>Upcoming Events</p>
          </div>
        </div>
      </div>
      
      {summaryData.quote && (
        <div className="motivation-quote">
          <blockquote>
            "{summaryData.quote.text}"
            {summaryData.quote.author && (
              <footer>- {summaryData.quote.author}</footer>
            )}
          </blockquote>
        </div>
      )}
    </div>
  );
};

export default DashboardSummary;
