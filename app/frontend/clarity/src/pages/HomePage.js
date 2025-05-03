// src/pages/HomePage.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardSummary from '../components/dashboard/DashboardSummary';
import ContributionGraph from '../components/habits/ContributionGraph';
import RecentTasks from '../components/tasks/RecentTasks';
import UpcomingEvents from '../components/calendar/UpcomingEvents';
import QuickAdd from '../components/common/QuickAdd';
import GoalProgress from '../components/goals/GoalProgress';
import '../styles/HomePage.css';

const HomePage = () => {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const userId = localStorage.getItem('userId') || 1; // Get from localStorage after login

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${userId}/profile`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }
        
        const data = await response.json();
        setUserData(data);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Could not load your dashboard. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
    
    // Listen for updates that might affect user data
    const handleItemAdded = () => {
      fetchUserData();
    };
    
    window.addEventListener('item-added', handleItemAdded);
    
    return () => {
      window.removeEventListener('item-added', handleItemAdded);
    };
  }, [userId]);

  if (isLoading) {
    return (
      <div className="home-container loading">
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-container error">
        <div className="error-message">
          <h2>Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <header className="welcome-header">
        <div className="welcome-text">
          <h1>Welcome back, {userData.name}</h1>
          <p className="date-display">{new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>
        <QuickAdd userId={userId} />
      </header>

      <div className="dashboard-grid">
        <div className="dashboard-summary-wrapper">
          <DashboardSummary userId={userId} />
        </div>
        
        <section className="contribution-section">
          <div className="section-header">
            <h2>Your Activity</h2>
          </div>
          <ContributionGraph userId={userId} />
        </section>
        
        <section className="tasks-section">
          <div className="section-header">
            <h2>Tasks Due Soon</h2>
            <Link to="/tasks" className="view-all">View All</Link>
          </div>
          <RecentTasks userId={userId} />
        </section>
        
        <section className="calendar-section">
          <div className="section-header">
            <h2>Upcoming Events</h2>
            <Link to="/calendar" className="view-all">View All</Link>
          </div>
          <UpcomingEvents userId={userId} />
        </section>
        
        <section className="goals-section">
          <div className="section-header">
            <h2>Goal Progress</h2>
            <Link to="/goals" className="view-all">View All</Link>
          </div>
          <GoalProgress userId={userId} />
        </section>
      </div>

      <nav className="feature-navigation">
        <h2 className="features-heading">Features</h2>
        <div className="feature-grid">
          <Link to="/tasks" className="feature-card">
            <div className="feature-icon icon-tasks">
              <i className="fas fa-tasks"></i>
            </div>
            <div className="feature-content">
              <h3>Tasks</h3>
              <p>Manage your to-dos and projects</p>
            </div>
          </Link>
          
          <Link to="/habits" className="feature-card">
            <div className="feature-icon icon-habits">
              <i className="fas fa-repeat"></i>
            </div>
            <div className="feature-content">
              <h3>Habits</h3>
              <p>Track daily routines and build consistency</p>
            </div>
          </Link>
          
          <Link to="/goals" className="feature-card">
            <div className="feature-icon icon-goals">
              <i className="fas fa-bullseye"></i>
            </div>
            <div className="feature-content">
              <h3>Goals</h3>
              <p>Set and track your long-term objectives</p>
            </div>
          </Link>
          
          <Link to="/notes" className="feature-card">
            <div className="feature-icon icon-notes">
              <i className="fas fa-sticky-note"></i>
            </div>
            <div className="feature-content">
              <h3>Notes</h3>
              <p>Capture and organize your thoughts</p>
            </div>
          </Link>
          
          <Link to="/todo" className="feature-card">
            <div className="feature-icon icon-todo">
              <i className="fas fa-check-square"></i>
            </div>
            <div className="feature-content">
              <h3>To-Do Lists</h3>
              <p>Sync with Microsoft To-Do</p>
            </div>
          </Link>
          
          <Link to="/calendar" className="feature-card">
            <div className="feature-icon icon-calendar">
              <i className="fas fa-calendar-alt"></i>
            </div>
            <div className="feature-content">
              <h3>Calendar</h3>
              <p>View and manage your schedule</p>
            </div>
          </Link>
          
          <Link to="/projects" className="feature-card">
            <div className="feature-icon icon-projects">
              <i className="fas fa-project-diagram"></i>
            </div>
            <div className="feature-content">
              <h3>Projects</h3>
              <p>Plan and organize complex work</p>
            </div>
          </Link>
          
          <Link to="/analytics" className="feature-card">
            <div className="feature-icon icon-analytics">
              <i className="fas fa-chart-line"></i>
            </div>
            <div className="feature-content">
              <h3>Analytics</h3>
              <p>Visualize your productivity data</p>
            </div>
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default HomePage;
