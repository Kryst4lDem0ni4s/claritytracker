// src/components/habits/ContributionGraph.js
import React, { useState, useEffect } from 'react';
import '../styles/ContributionGraph.css';

const ContributionGraph = ({ userId }) => {
  const [graphData, setGraphData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchHabitData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch habit completion data from the API
        const response = await fetch(`/api/users/${userId}/habit-activity`);
        
        if (!response.ok) {
          // If the endpoint doesn't exist yet or returns an error, generate empty data
          const today = new Date();
          const oneYearAgo = new Date(today);
          oneYearAgo.setFullYear(today.getFullYear() - 1);
          
          // Generate empty data for the past year
          const emptyData = [];
          let currentDate = new Date(oneYearAgo);
          
          while (currentDate <= today) {
            emptyData.push({
              date: currentDate.toISOString().split('T')[0],
              count: 0
            });
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          setGraphData(emptyData);
          setIsLoading(false);
          return;
        }
        
        const data = await response.json();
        setGraphData(data);
      } catch (err) {
        console.error('Error fetching habit data:', err);
        setError('Failed to load activity data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchHabitData();
  }, [userId]);
  
  const getColorClass = (count) => {
    if (count === 0) return 'activity-level-0';
    if (count === 1) return 'activity-level-1';
    if (count === 2) return 'activity-level-2';
    if (count === 3) return 'activity-level-3';
    return 'activity-level-4';
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const renderGraph = () => {
    if (graphData.length === 0) {
      return <p className="no-data">No activity data available yet.</p>;
    }
    
    // Group by week for display
    const weeks = [];
    let currentWeek = [];
    
    // Get day of week (0 = Sunday, 6 = Saturday)
    const firstDate = new Date(graphData[0]?.date);
    const firstDayOfWeek = firstDate.getDay();
    
    // Fill in blanks at the beginning
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }
    
    graphData.forEach((day, index) => {
      const dayDate = new Date(day.date);
      const dayOfWeek = dayDate.getDay();
      
      currentWeek.push(day);
      
      if (dayOfWeek === 6 || index === graphData.length - 1) {
        // Fill in blanks at the end of the last week
        if (index === graphData.length - 1 && dayOfWeek < 6) {
          for (let i = dayOfWeek + 1; i <= 6; i++) {
            currentWeek.push(null);
          }
        }
        
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });
    
    // Extract month labels
    const months = [];
    let currentMonth = -1;
    
    graphData.forEach(day => {
      const date = new Date(day.date);
      const month = date.getMonth();
      
      if (month !== currentMonth) {
        months.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          index: months.length
        });
        currentMonth = month;
      }
    });
    
    return (
      <div className="contribution-graph">
        <div className="graph-months">
          {months.map((month, index) => (
            <span 
              key={index} 
              className="month-label"
              style={{ 
                gridColumnStart: Math.ceil((month.index * 4.3) + 1)
              }}
            >
              {month.month}
            </span>
          ))}
        </div>
        
        <div className="graph-days">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>
        
        <div className="graph-cells">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="graph-week">
              {week.map((day, dayIndex) => (
                <div 
                  key={dayIndex} 
                  className={`graph-cell ${day ? getColorClass(day.count) : 'cell-empty'}`}
                  title={day ? `${formatDate(day.date)}: ${day.count} activities` : ''}
                />
              ))}
            </div>
          ))}
        </div>
        
        <div className="graph-legend">
          <span>Less</span>
          <div className="legend-cells">
            <div className="graph-cell activity-level-0"></div>
            <div className="graph-cell activity-level-1"></div>
            <div className="graph-cell activity-level-2"></div>
            <div className="graph-cell activity-level-3"></div>
            <div className="graph-cell activity-level-4"></div>
          </div>
          <span>More</span>
        </div>
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <div className="contribution-graph-container loading">
        <div className="loading-spinner"></div>
        <p>Loading activity data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="contribution-graph-container error">
        <p className="error-message">{error}</p>
        <button 
          className="retry-button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="contribution-graph-container">
      <h3>Your Activity Heatmap</h3>
      {renderGraph()}
    </div>
  );
};

export default ContributionGraph;
