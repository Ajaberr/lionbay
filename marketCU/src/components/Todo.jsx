import React from 'react';
import '../Chat.css';

const Todo = ({ onDelete, onComplete, showCompleteButton, paymentCompleted }) => {
  // Prevent event propagation to parent container
  const handleButtonClick = (event, callback) => {
    event.stopPropagation();
    event.preventDefault();
    callback();
  };
  
  return (
    <div className="chat-todo-actions" onClick={(e) => e.stopPropagation()}>
      {/* Show complete payment button based on showCompleteButton prop and when payment isn't completed */}
      {showCompleteButton && !paymentCompleted && (
        <button 
          onClick={(e) => handleButtonClick(e, onComplete)}
          className="todo-button complete-button"
          aria-label="Complete payment"
        >
          <i className="fas fa-check-circle"></i>
          <span>Complete</span>
        </button>
      )}

      {/* "Cancel Deal" button */}
      <button 
        onClick={(e) => handleButtonClick(e, onDelete)}
        className="todo-button delete-button"
        aria-label="Cancel deal"
      >
        <i className="fas fa-times-circle"></i>
        <span>Cancel</span>
      </button>
    </div>
  );
};

export default Todo; 