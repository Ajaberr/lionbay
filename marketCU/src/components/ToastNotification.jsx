import { useState, useEffect } from 'react';
import '../styles/ToastNotification.css';

const ToastNotification = ({ message, type = 'success', duration = 7000, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) setTimeout(onClose, 400); // Allow animation to complete
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [duration, onClose]);

  const handleClose = () => {
    setVisible(false);
    if (onClose) setTimeout(onClose, 400);
  };

  // Use consistent styling with different icons for visual feedback
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <i className="fas fa-check"></i>;
      case 'error':
        return <i className="fas fa-exclamation"></i>;
      case 'info':
        return <i className="fas fa-info"></i>;
      case 'warning':
        return <i className="fas fa-bell"></i>;
      default:
        return <i className="fas fa-check"></i>;
    }
  };

  return (
    <div 
      className={`toast-notification ${type} ${visible ? 'visible' : 'hidden'}`}
      style={{animationDuration: `${duration}ms`}}
    >
      <div className="toast-content">
        <div className="toast-icon">
          {getIcon()}
        </div>
        <div className="toast-message">
          {message}
        </div>
      </div>
      <button className="toast-close" onClick={handleClose}>
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

export default ToastNotification; 