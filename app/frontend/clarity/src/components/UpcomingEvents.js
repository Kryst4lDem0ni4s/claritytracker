// src/components/calendar/UpcomingEvents.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/UpcomingEvents.css';

const UpcomingEvents = ({ userId }) => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/${userId}/upcoming-events`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch upcoming events');
        }
        
        const data = await response.json();
        setEvents(data);
      } catch (err) {
        console.error('Error fetching upcoming events:', err);
        setError('Could not load upcoming events. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
    
    // Listen for updates
    const handleItemAdded = (e) => {
      if (e.detail.type === 'event') {
        fetchEvents();
      }
    };
    
    window.addEventListener('item-added', handleItemAdded);
    
    return () => {
      window.removeEventListener('item-added', handleItemAdded);
    };
  }, [userId]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const isToday = (dateString) => {
    const today = new Date();
    const eventDate = new Date(dateString);
    return today.toDateString() === eventDate.toDateString();
  };

  const isTomorrow = (dateString) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const eventDate = new Date(dateString);
    return tomorrow.toDateString() === eventDate.toDateString();
  };

  const getRelativeDay = (dateString) => {
    if (isToday(dateString)) return 'Today';
    if (isTomorrow(dateString)) return 'Tomorrow';
    return formatDate(dateString);
  };

  if (isLoading) {
    return (
      <div className="upcoming-events-container loading">
        <div className="skeleton-loader header-skeleton"></div>
        <div className="events-list-skeleton">
          <div className="skeleton-loader event-item-skeleton"></div>
          <div className="skeleton-loader event-item-skeleton"></div>
          <div className="skeleton-loader event-item-skeleton"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="upcoming-events-container error">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="upcoming-events-container">
      <div className="upcoming-events-header">
        <h3>Upcoming Events</h3>
        <Link to="/calendar" className="view-all-events">View All</Link>
      </div>
      
      {events.length === 0 ? (
        <div className="no-events">
          <p>No upcoming events</p>
          <Link to="/calendar" className="add-event-btn">Add Event</Link>
        </div>
      ) : (
        <div className="events-list">
          {events.map(event => (
            <div key={event.id} className={`event-item ${isToday(event.start_date) ? 'today' : ''}`}>
              <div className="event-date">
                <div className="date-badge">
                  <span className="month">{formatDate(event.start_date).split(' ')[0]}</span>
                  <span className="day">{new Date(event.start_date).getDate()}</span>
                </div>
              </div>
              <div className="event-details">
                <h4 className="event-title">{event.title}</h4>
                <div className="event-time">
                  <span className="relative-day">{getRelativeDay(event.start_date)}</span>
                  {event.start_time && (
                    <span className="time">{formatTime(event.start_time)}</span>
                  )}
                </div>
                {event.location && (
                  <div className="event-location">
                    <i className="location-icon"></i>
                    <span>{event.location}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {events.length > 0 && (
            <Link to="/calendar" className="calendar-link">
              Open Calendar
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default UpcomingEvents;
