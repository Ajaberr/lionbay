import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useMessages } from './App';
import './Chat.css';
import { io } from 'socket.io-client';
import { SOCKET_URL } from './config';
import { formatDistanceToNow } from 'date-fns';
import ToastNotification from './components/ToastNotification';

function Chat() {
  const { chatId } = useParams();
  const { authAxios, currentUser, isAuthenticated } = useAuth();
  const { resetUnreadCount, updateUnreadCount } = useMessages();
  const navigate = useNavigate();
  
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  
  // Track window resize for responsive handling
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Connect to socket when component mounts
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    
    const token = localStorage.getItem('token');
    
    // Initialize socket
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log('Socket connected');
      setSocketConnected(true);
      
      // Join this specific chat room
      newSocket.emit('join_chat', chatId);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setSocketConnected(false);
    });
    
    newSocket.on('typing', (data) => {
      if (data.chatId === chatId && data.userId !== currentUser.userId) {
        setOtherUserTyping(true);
        
        // Clear the typing indicator after 3 seconds
        setTimeout(() => {
          setOtherUserTyping(false);
        }, 3000);
      }
    });
    
    newSocket.on('message_received', (message) => {
      if (message.chat_id === chatId) {
        setMessages(prevMessages => [...prevMessages, message]);
        
        // Mark received message as read immediately since chat is open
        markMessageAsRead(message.id);
      }
    });
    
    setSocket(newSocket);
    
    // Cleanup on unmount
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
      
      // Clear typing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [chatId, isAuthenticated, currentUser]);
  
  // Reset unread count for this specific chat when opening
  useEffect(() => {
    if (chatId && resetUnreadCount) {
      // Only reset unread for this specific chat, not all chats
      resetUnreadCount(chatId);
    }
    
    // Update last read time on server
    const updateLastReadTime = async () => {
      if (!isAuthenticated || !chatId) return;
      
      try {
        await authAxios.put(`/chats/${chatId}/read`);
        console.log('Updated last read time on server');
      } catch (error) {
        console.error('Error updating last read time:', error);
      }
    };
    
    updateLastReadTime();
    
    // When leaving chat, refresh the global unread count
    return () => {
      if (updateUnreadCount) {
        updateUnreadCount();
      }
    };
  }, [chatId, resetUnreadCount, updateUnreadCount, isAuthenticated, authAxios]);
  
  // Fetch chat details and messages
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchChatAndMessages = async () => {
      try {
        setLoading(true);
        
        // Fetch chat details
        const chatResponse = await authAxios.get(`/chats/${chatId}`);
        setChat(chatResponse.data);
        
        // Fetch messages
        const messagesResponse = await authAxios.get(`/chats/${chatId}/messages`);
        setMessages(messagesResponse.data);
        
        // Mark all messages as read
        markAllMessagesAsRead();
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching chat:', error);
        setError('Failed to load the chat. Please try again.');
        setLoading(false);
      }
    };
    
    fetchChatAndMessages();
  }, [chatId, isAuthenticated, authAxios]);
  
  // Scroll to bottom of messages when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Focus input when chat loads
  useEffect(() => {
    if (!loading && chat && inputRef.current && !isMobile) {
      inputRef.current.focus();
    }
  }, [loading, chat, isMobile]);
  
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    try {
      // Make sure we're using the correct API URL
      console.log('Sending via REST API');
      const response = await authAxios.post(`/chats/${chatId}/messages`, {
        content: newMessage
      });
      
      // Add the new message to the messages array
      setMessages([...messages, response.data]);
      
      // Clear the message input
      setNewMessage('');
      
      // If using socket, emit message
      if (socket && socketConnected) {
        socket.emit('send_message', {
          chatId,
          message: {
            content: response.data.content
          }
        });
      }
      
      // Focus the input again after sending
      if (inputRef.current && !isMobile) {
        inputRef.current.focus();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setToastMessage('Failed to send message. Please try again.');
      setToastType('error');
      setShowToast(true);
    }
  };
  
  // Mark messages as read
  const markAllMessagesAsRead = async () => {
    if (!isAuthenticated || !currentUser) return;
    
    try {
      // Mark all unread messages in this chat as read
      await authAxios.put(`/chats/${chatId}/read`);
      
      // Update local message state to reflect this
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          if (msg.sender_id !== currentUser.userId && !msg.is_read) {
            return { ...msg, is_read: true };
          }
          return msg;
        })
      );
      
      // Reset unread count for this specific chat
      if (resetUnreadCount) {
        resetUnreadCount(chatId);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };
  
  // Mark a specific message as read
  const markMessageAsRead = async (messageId) => {
    if (!isAuthenticated || !currentUser) return;
    
    try {
      // Mark specific message as read
      await authAxios.put(`/messages/${messageId}/read`);
      
      // Update local message state
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          if (msg.id === messageId) {
            return { ...msg, is_read: true };
          }
          return msg;
        })
      );
      
      // Reset unread count for this specific chat
      if (resetUnreadCount) {
        resetUnreadCount(chatId);
      }
    } catch (error) {
      console.error(`Error marking message ${messageId} as read:`, error);
    }
  };
  
  const handleTyping = () => {
    if (!socket || !socketConnected) return;
    
    if (!typing) {
      setTyping(true);
      socket.emit('typing', { chatId, userId: currentUser.userId });
    }
    
    // Clear previous timeout
    if (typingTimeout) clearTimeout(typingTimeout);
    
    // Set a timeout to stop typing indicator after 3 seconds
    const timeout = setTimeout(() => {
      setTyping(false);
    }, 3000);
    
    setTypingTimeout(timeout);
  };
  
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  };
  
  const isFromCurrentUser = (message) => {
    return message.sender_id === currentUser?.userId;
  };
  
  // Group messages by date
  const groupMessagesByDate = () => {
    const groups = [];
    let currentDay = null;
    let currentMessages = [];
    
    messages.forEach(message => {
      const messageDate = new Date(message.created_at);
      const messageDay = messageDate.toDateString();
      
      if (messageDay !== currentDay) {
        if (currentMessages.length > 0) {
          groups.push({
            date: currentDay,
            messages: currentMessages
          });
        }
        currentDay = messageDay;
        currentMessages = [message];
      } else {
        currentMessages.push(message);
      }
    });
    
    if (currentMessages.length > 0) {
      groups.push({
        date: currentDay,
        messages: currentMessages
      });
    }
    
    return groups;
  };
  
  const formatDateForDisplay = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };
  
  // Handle key press for sending message with Enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };
  
  if (loading) {
    return (
      <div className="chat-page">
        <div className="chat-container loading">
          <div className="loading-spinner"></div>
          <p>Loading conversation...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="chat-page">
        <div className="chat-container error">
          <p>{error}</p>
          <button onClick={() => navigate('/chats')} className="back-button-error">
            <i className="fas fa-arrow-left"></i> Back to Messages
          </button>
        </div>
      </div>
    );
  }
  
  if (!chat) {
    return (
      <div className="chat-page">
        <div className="chat-container error">
          <p>Chat not found or you don't have permission to view it.</p>
          <button onClick={() => navigate('/chats')} className="back-button-error">
            <i className="fas fa-arrow-left"></i> Back to Messages
          </button>
        </div>
      </div>
    );
  }
  
  // Determine if user is buyer or seller
  const isSeller = currentUser?.userId === chat.seller_id;
  const otherUserName = isSeller ? chat.buyer_email : chat.seller_email;
  const messageGroups = groupMessagesByDate();
  
  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <Link to="/chats" className="back-button">
            <i className="fas fa-arrow-left"></i>
          </Link>
          
          <div className="chat-header-info">
            <img 
              src={chat.product_image || 'https://via.placeholder.com/50x50'} 
              alt={chat.product_name} 
              className="chat-item-thumbnail"
            />
            <div className="chat-header-text">
              <h2>{otherUserName}</h2>
              <p className="chat-header-product">{chat.product_name}</p>
            </div>
          </div>
          
          <div className="chat-header-actions">
            {isSeller ? (
              <span className="chat-role seller">Seller</span>
            ) : (
              <span className="chat-role buyer">Buyer</span>
            )}
          </div>
        </div>
        
        <div className="messages-container" ref={chatContainerRef}>
          {messages.length === 0 ? (
            <div className="no-messages">
              <i className="fas fa-comments no-messages-icon"></i>
              <p>No messages yet. Start the conversation!</p>
              <p className="no-messages-hint">Send a message below to communicate about this item</p>
            </div>
          ) : (
            <>
              {messageGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="message-group">
                  <div className="message-date-separator">
                    <span>{formatDateForDisplay(group.date)}</span>
                  </div>
                  
                  {group.messages.map((message, messageIndex) => {
                    const isCurrentUserMessage = isFromCurrentUser(message);
                    const isGrouped = messageIndex > 0 && 
                      isFromCurrentUser(group.messages[messageIndex - 1]) === isCurrentUserMessage;
                    
                    return (
                      <div 
                        key={message.id} 
                        className={`message ${isCurrentUserMessage ? 'sent' : 'received'} ${isGrouped ? 'grouped' : ''}`}
                      >
                        <div className="message-content">
                          {message.content}
                          <span className="message-time">
                            {formatTimestamp(message.created_at)}
                            {isCurrentUserMessage && message.is_read && 
                              <span className="message-read-status">
                                <i className="fas fa-check-double"></i>
                              </span>
                            }
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              
              {otherUserTyping && (
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        
        <form className="message-input-container" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              handleTyping();
              handleKeyPress(e);
            }}
            placeholder="Type a message..."
            className="message-input"
            ref={inputRef}
          />
          <button 
            type="submit" 
            className="send-button" 
            disabled={!newMessage.trim()}
            aria-label="Send message"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </form>
        
        {!socketConnected && (
          <div className="socket-status">
            <i className="fas fa-exclamation-triangle"></i>
            Connection issue - some features may be unavailable
          </div>
        )}
      </div>
      
      {showToast && (
        <ToastNotification
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}

export default Chat; 