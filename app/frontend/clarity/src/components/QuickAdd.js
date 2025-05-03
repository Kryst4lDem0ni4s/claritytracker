// src/components/common/QuickAdd.js
import React, { useState } from 'react';
import '../styles/QuickAdd.css';

const QuickAdd = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [itemType, setItemType] = useState('task');
  const [itemText, setItemText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!itemText.trim()) {
      setError('Please enter a title');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    let endpoint = '';
    let payload = {};

    // Prepare the request based on item type
    switch(itemType) {
      case 'task':
        endpoint = `/api/users/${userId}/tasks`;
        payload = { 
          title: itemText,
          description: '',
          due_date: null,
          completed: false
        };
        break;
      case 'habit':
        endpoint = `/api/users/${userId}/habits`;
        payload = { 
          title: itemText, 
          frequency: 'daily' 
        };
        break;
      case 'event':
        const today = new Date().toISOString().split('T')[0];
        endpoint = `/api/users/${userId}/calendar_events`;
        payload = { 
          title: itemText, 
          start_date: today,
          end_date: today
        };
        break;
      case 'note':
        endpoint = `/api/users/${userId}/notes`;
        payload = { content: itemText };
        break;
      default:
        setError('Invalid item type');
        setIsSubmitting(false);
        return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add item');
      }

      // Reset form state
      setItemText('');
      setIsOpen(false);
      
      // Notify parent components that an item was added
      window.dispatchEvent(new CustomEvent('item-added', { 
        detail: { type: itemType, data: await response.json() } 
      }));
      
    } catch (err) {
      console.error('Error adding item:', err);
      setError(err.message || 'Failed to add item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to close the form
  const handleClose = () => {
    setIsOpen(false);
    setItemText('');
    setError('');
  };

  return (
    <div className="quick-add-container">
      {!isOpen ? (
        <button 
          className="quick-add-button"
          onClick={() => setIsOpen(true)}
          aria-label="Quick add item"
        >
          <span className="icon-plus">+</span>
          <span>Quick Add</span>
        </button>
      ) : (
        <div className="quick-add-form-container">
          <form className="quick-add-form" onSubmit={handleSubmit}>
            <div className="form-header">
              <h3>Add New Item</h3>
              <button 
                type="button" 
                className="close-button"
                onClick={handleClose}
                disabled={isSubmitting}
                aria-label="Close form"
              >
                <span className="icon-close">×</span>
              </button>
            </div>
            
            <div className="form-type-selector">
              <button 
                type="button"
                className={`type-button ${itemType === 'task' ? 'active' : ''}`}
                onClick={() => setItemType('task')}
                disabled={isSubmitting}
              >
                <span className="icon-task"></span>
                Task
              </button>
              <button 
                type="button"
                className={`type-button ${itemType === 'habit' ? 'active' : ''}`}
                onClick={() => setItemType('habit')}
                disabled={isSubmitting}
              >
                <span className="icon-habit"></span>
                Habit
              </button>
              <button 
                type="button"
                className={`type-button ${itemType === 'event' ? 'active' : ''}`}
                onClick={() => setItemType('event')}
                disabled={isSubmitting}
              >
                <span className="icon-event"></span>
                Event
              </button>
              <button 
                type="button"
                className={`type-button ${itemType === 'note' ? 'active' : ''}`}
                onClick={() => setItemType('note')}
                disabled={isSubmitting}
              >
                <span className="icon-note"></span>
                Note
              </button>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="input-container">
              <input
                type="text"
                value={itemText}
                onChange={(e) => setItemText(e.target.value)}
                placeholder={`Enter new ${itemType}...`}
                className="item-input"
                required
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                className="cancel-button"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="submit-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="loading-spinner"></span>
                ) : (
                  `Add ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}`
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default QuickAdd;
