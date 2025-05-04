import React from 'react';
import '../Chat.css';

const Todo = ({ onDelete, onComplete, isSeller, paymentCompleted }) => {
  // Prevent event propagation to parent container
  const handleButtonClick = (event, callback) => {
    event.stopPropagation();
    event.preventDefault();
    callback();
  };
  
  return (
    <div className="chat-todo-actions" onClick={(e) => e.stopPropagation()}>
      {/* Only show complete payment button for sellers and when payment isn't completed */}
      {isSeller && !paymentCompleted && (
        <button 
          onClick={(e) => handleButtonClick(e, onComplete)}
          className="todo-button complete-button"
          aria-label="Complete payment"
        >
          <i className="fas fa-check-circle"></i>
          <span>Complete</span>
        </button>
      )}

      {/* Always show delete button */}
      <button 
        onClick={(e) => handleButtonClick(e, onDelete)}
        className="todo-button delete-button"
        aria-label="Delete chat"
      >
        <i className="fas fa-trash-alt"></i>
        <span>Delete</span>
      </button>
    </div>
  );
};

export default Todo; 