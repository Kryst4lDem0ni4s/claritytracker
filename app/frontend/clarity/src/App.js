// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import TasksPage from './pages/TasksPage';
import HabitsPage from './pages/HabitsPage';
import GoalsPage from './pages/GoalsPage';
import NotesPage from './pages/NotesPage';
import TodoPage from './pages/TodoPage';
import CalendarPage from './pages/CalendarPage';
import ProjectsPage from './pages/ProjectsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import './App.css';

// Auth context to manage user state across the app
export const AuthContext = React.createContext();

// Main App component
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in on app load
  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    const storedUsername = localStorage.getItem('username');
    
    if (storedUserId && storedUsername) {
      setUserId(storedUserId);
      setUsername(storedUsername);
      setIsAuthenticated(true);
    }
    
    setIsLoading(false);
  }, []);

  // Login function
  const login = (userData) => {
    localStorage.setItem('userId', userData.id);
    localStorage.setItem('username', userData.username);
    setUserId(userData.id);
    setUsername(userData.username);
    setIsAuthenticated(true);
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    setUserId(null);
    setUsername('');
    setIsAuthenticated(false);
  };

  // Auth context value
  const authContextValue = {
    isAuthenticated,
    userId,
    username,
    login,
    logout
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <Router>
        <div className="app-container">
          {isAuthenticated && <Navbar />}
          <div className={`content-wrapper ${!isAuthenticated ? 'full-width' : ''}`}>
            {isAuthenticated && <Sidebar />}
            <main className="main-content">
              <Routes>
                {/* Public route */}
                <Route path="/login" element={
                  isAuthenticated ? <Navigate to="/" /> : <LoginPage />
                } />
                
                {/* Protected routes */}
                <Route path="/" element={
                  isAuthenticated ? <HomePage /> : <Navigate to="/login" />
                } />
                
                <Route path="/tasks" element={
                  isAuthenticated ? <TasksPage /> : <Navigate to="/login" />
                } />
                
                <Route path="/habits" element={
                  isAuthenticated ? <HabitsPage /> : <Navigate to="/login" />
                } />
                
                <Route path="/goals" element={
                  isAuthenticated ? <GoalsPage /> : <Navigate to="/login" />
                } />
                
                <Route path="/notes" element={
                  isAuthenticated ? <NotesPage /> : <Navigate to="/login" />
                } />
                
                <Route path="/todo" element={
                  isAuthenticated ? <TodoPage /> : <Navigate to="/login" />
                } />
                
                <Route path="/calendar" element={
                  isAuthenticated ? <CalendarPage /> : <Navigate to="/login" />
                } />
                
                <Route path="/projects" element={
                  isAuthenticated ? <ProjectsPage /> : <Navigate to="/login" />
                } />
                
                <Route path="/analytics" element={
                  isAuthenticated ? <AnalyticsPage /> : <Navigate to="/login" />
                } />
                
                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
