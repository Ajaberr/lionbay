import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Chat.css';
import { useAuth } from './AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useMessages } from './App';

function ChatsList() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const { authAxios, currentUser } = useAuth();
  const { resetUnreadCount } = useMessages();
  const navigate = useNavigate();

  useEffect(() => {
    fetchChats();
    
    // Reset unread count when viewing chat list
    resetUnreadCount();
    
    // Poll for new chats periodically
    const interval = setInterval(fetchChats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchChats = async () => {
    try {
      const response = await authAxios.get('/chats');
      
      // Sort chats by last message time (newest first)
      const sortedChats = response.data.sort((a, b) => {
        const timeA = a.last_message_at ? new Date(a.last_message_at) : new Date(0);
        const timeB = b.last_message_at ? new Date(b.last_message_at) : new Date(0);
        return timeB - timeA;
      });
      
      setChats(sortedChats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async (chatId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      try {
        await authAxios.delete(`/chats/${chatId}`);
        setChats(chats.filter(chat => chat.id !== chatId));
      } catch (error) {
        console.error('Error deleting chat:', error);
      }
    }
  };

  const handleChatClick = (chatId) => {
    navigate(`/chats/${chatId}`);
  };

  // Format the timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  };

  // Determine if message is unread 
  const isUnread = (chat) => {
    if (!chat.last_message || !chat.last_message_sender_id) return false;
    return chat.last_message_sender_id !== currentUser.userId && chat.unread_count > 0;
  };

  // Get the user role in this chat (buyer or seller)
  const getUserRole = (chat) => {
    if (chat.seller_id === currentUser.userId) {
      return 'seller';
    } else {
      return 'buyer';
    }
  };

  // Get the other party's name in the chat
  const getContactName = (chat) => {
    const role = getUserRole(chat);
    return role === 'seller' ? chat.buyer_email : chat.seller_email;
  };

  // Truncate text for display
  const truncateText = (text, maxLength = 40) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Loading state
  if (loading) {
    return (
      <div className="chats-list-page">
        <h1>Messages</h1>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chats-list-page">
      <div className="chats-header">
        <h1>Messages</h1>
        
        <div className="role-legend">
          <div className="legend-item">
            <span className="role-dot seller"></span>
            <span>You're the seller</span>
          </div>
          <div className="legend-item">
            <span className="role-dot buyer"></span>
            <span>You're the buyer</span>
          </div>
        </div>
        
        <div className="expiration-notice">
          <i className="fas fa-info-circle"></i>
          <span>Messages are automatically deleted after 30 days of inactivity</span>
        </div>
      </div>
      
      {chats.length > 0 ? (
        <div className="chats-list">
          {chats.map(chat => (
            <div key={chat.id} className="chat-item-container">
              <div 
                className={`chat-item ${getUserRole(chat)}-chat ${isUnread(chat) ? 'unread' : ''}`}
                onClick={() => handleChatClick(chat.id)}
              >
                <div className="chat-item-image">
                  <img src={chat.product_image || 'https://via.placeholder.com/100x100'} alt={chat.product_name} />
                  <div className={`role-badge ${getUserRole(chat)}`}>
                    {getUserRole(chat) === 'seller' ? 'S' : 'B'}
                  </div>
                </div>
                
                <div className="chat-item-details">
                  <div className="chat-item-header">
                    <h3 className="chat-contact-name">{getContactName(chat)}</h3>
                    <span className="chat-time">{formatTimestamp(chat.last_message_at)}</span>
                  </div>
                  
                  <p className="chat-item-title">{truncateText(chat.product_name)}</p>
                  
                  {chat.last_message ? (
                    <p className="chat-last-message">
                      {chat.last_message_sender_id === currentUser.userId ? 
                        <span className="message-sender">You: </span> : ''}
                      {truncateText(chat.last_message)}
                    </p>
                  ) : (
                    <p className="chat-last-message">No messages yet</p>
                  )}
                </div>
                
                {isUnread(chat) && 
                  <div className="unread-badge">
                    {chat.unread_count > 9 ? '9+' : chat.unread_count}
                  </div>
                }
              </div>
              
              <button 
                className="delete-chat-button" 
                onClick={(e) => deleteChat(chat.id, e)}
                aria-label="Delete chat"
              >
                <i className="fas fa-trash-alt"></i>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-chats">
          <i className="fas fa-comments no-chats-icon"></i>
          <p>You don't have any active conversations</p>
          <Link to="/marketplace" className="browse-button">Browse Marketplace</Link>
        </div>
      )}
    </div>
  );
}

export default ChatsList; 