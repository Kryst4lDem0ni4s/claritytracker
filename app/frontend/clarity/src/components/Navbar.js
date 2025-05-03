// src/components/layout/Navbar.js
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../App';
import '../styles/Navbar.css';

const Navbar = () => {
  const { username, logout } = useContext(AuthContext);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          Task Tracker
        </Link>
        
        <div className="navbar-right">
          <div className="user-info">
            <span className="username">{username}</span>
          </div>
          
          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
