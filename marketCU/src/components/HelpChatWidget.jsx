import { useState, useEffect, useRef } from 'react';
import { useAuth, useMessages } from '../App';
import { io } from 'socket.io-client';
import '../styles/HelpChatWidget.css';
import { SOCKET_URL } from '../config';

// Remove hardcoded SOCKET_URL since we're importing it from config
// const SOCKET_URL = 'https://lionbay-api.onrender.com';

const HelpChatWidget = () => {
  const { currentUser, authAxios } = useAuth();
  const { setHasUnreadMessages } = useMessages();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatBoxRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (!currentUser) return;

    const token = localStorage.getItem('token');
    console.log('Connecting to socket server at:', SOCKET_URL);
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'] // Try websocket first, then fallback to polling
    });

    newSocket.on('connect', () => {
      console.log('Connected to help chat socket');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    newSocket.on('admin_response', (response) => {
      // Only increment unread counter if chat is not open and message is truly new
      const isNewMessage = !localStorage.getItem(`msg_seen_${response.id}`);
      
      if (!isOpen && isNewMessage) {
        setHasUnreadMessages(true);
      }
      
      setMessages(prev => {
        // Check if this message already exists by ID
        if (prev.some(m => m.id === response.id)) return prev;
        
        // Also check for duplicates with similar content and timestamps (within 2 seconds)
        const duplicates = prev.filter(m => 
          m.message === response.message && 
          m.is_from_admin === response.is_from_admin &&
          Math.abs(new Date(m.created_at) - new Date(response.created_at)) < 2000
        );
        
        if (duplicates.length > 0) return prev;
        
        // Save to localStorage for persistence
        const updatedMessages = [...prev, response];
        localStorage.setItem('helpChatMessages', JSON.stringify(updatedMessages));
        return updatedMessages;
      });
    });

    newSocket.on('help_message_sent', (confirmation) => {
      // Just for confirmation, we already added the message to UI
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [currentUser, isOpen, setHasUnreadMessages]);

  // Toggle chat open/closed 
  const toggleChat = () => {
    if (isOpen && chatBoxRef.current) {
      // Add animation class for closing if needed
      chatBoxRef.current.style.animation = 'slideOut 0.3s ease forwards';
      
      // Delay the state change to allow animation to complete
      setTimeout(() => {
        setIsOpen(false);
      }, 250);
    } else {
      // If it's closed and we're opening it
      setIsOpen(true);
    }
  };

  // Load messages when chat is opened
  useEffect(() => {
    if (isOpen && currentUser) {
      fetchMessages();
      
      // Focus input field after a short delay
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 300);
    }
  }, [isOpen, currentUser]);

  // Load persisted messages on component mount
  useEffect(() => {
    if (currentUser) {
      // Load messages from localStorage first
      try {
        const savedMessages = localStorage.getItem('helpChatMessages');
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages));
        }
      } catch (error) {
        console.error('Error loading saved messages:', error);
      }
      
      if (isOpen) {
        // Reset unread counter when opening
        setHasUnreadMessages(false);
        
        // Mark all messages as seen
        const savedMessages = JSON.parse(localStorage.getItem('helpChatMessages') || '[]');
        savedMessages.forEach(msg => {
          if (msg.is_from_admin) {
            localStorage.setItem(`msg_seen_${msg.id}`, 'true');
          }
        });
      }
    }
  }, [isOpen, currentUser, setHasUnreadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await authAxios.get('/admin/help-messages');
      // Make sure we're getting an array of messages
      const messagesData = Array.isArray(response.data) ? response.data : [];
      
      // Merge with existing messages, avoiding duplicates
      setMessages(prev => {
        const merged = [...prev];
        messagesData.forEach(newMsg => {
          // Check if message already exists
          const exists = merged.some(m => 
            m.id === newMsg.id || 
            (m.message === newMsg.message && 
             m.is_from_admin === newMsg.is_from_admin &&
             Math.abs(new Date(m.created_at) - new Date(newMsg.created_at)) < 2000)
          );
          
          if (!exists) {
            merged.push(newMsg);
          }
        });
        
        // Sort by timestamp
        merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        // Save to localStorage
        localStorage.setItem('helpChatMessages', JSON.stringify(merged));
        return merged;
      });
    } catch (error) {
      console.error('Error fetching help messages:', error);
      // Set empty array on error to prevent UI issues
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    try {
      // Generate temporary ID for optimistic UI update
      const tempId = `temp-${Date.now()}`;
      
      // Optimistically add message to UI
      const newMessage = {
        id: tempId,
        message,
        user_id: currentUser.userId,
        is_from_admin: false,
        created_at: new Date().toISOString(),
        // For UI purposes
        pending: true
      };
      
      setMessages(prev => {
        const updatedMessages = [...prev, newMessage];
        localStorage.setItem('helpChatMessages', JSON.stringify(updatedMessages));
        return updatedMessages;
      });
      setMessage('');

      // Send via socket
      socket.emit('send_help_message', { message });

      // Also send via REST for reliability
      try {
        const response = await authAxios.post('/admin/help-messages', { message });
        
        // Replace temp message with real one
        setMessages(prev => {
          const updated = prev.map(msg => 
            msg.id === tempId ? { ...response.data, pending: false } : msg
          );
          localStorage.setItem('helpChatMessages', JSON.stringify(updated));
          return updated;
        });
      } catch (error) {
        console.error('Error sending help message via REST:', error);
        // Keep socket-only message, but mark as sent
        setMessages(prev => {
          const updated = prev.map(msg => 
            msg.id === tempId ? { ...msg, pending: false } : msg
          );
          localStorage.setItem('helpChatMessages', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (error) {
      console.error('Error sending help message:', error);
      
      // Mark message as failed
      setMessages(prev => {
        const updated = prev.map(msg => 
          msg.pending ? { ...msg, failed: true, pending: false } : msg
        );
        localStorage.setItem('helpChatMessages', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const retryFailedMessage = (failedMessage) => {
    // Remove the failed message
    setMessages(prev => prev.filter(msg => msg.id !== failedMessage.id));
    
    // Set the message back in the input
    setMessage(failedMessage.message);
    
    // Focus input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Auto-resize textarea based on content
  const adjustTextareaHeight = (e) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  return (
    <div className="help-chat-container">
      {isOpen && (
        <div className="help-chat-box" ref={chatBoxRef}>
          <div className="help-chat-header">
            <h3>Columbia Support</h3>
            <button 
              className="help-chat-close" 
              onClick={toggleChat}
            >
              ×
            </button>
          </div>
          <div className="help-chat-messages">
            {messages.length === 0 && !loading && (
              <div className="help-chat-welcome">
                <p>👋 Hi there! Need help with something?</p>
                <p>Our Columbia University team is here to assist you with anything marketplace-related.</p>
              </div>
            )}
            
            {loading && (
              <div className="help-chat-loading">
                <p>Loading messages...</p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`help-chat-message ${msg.is_from_admin ? 'admin' : 'user'} ${msg.pending ? 'pending' : ''} ${msg.failed ? 'failed' : ''}`}
              >
                <div className="help-chat-message-content">
                  {msg.message}
                  {msg.failed && (
                    <button 
                      className="help-chat-retry" 
                      onClick={() => retryFailedMessage(msg)}
                    >
                      Retry
                    </button>
                  )}
                </div>
                <div className="help-chat-message-time">
                  {formatTime(msg.created_at)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="help-chat-input-container">
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                adjustTextareaHeight(e);
              }}
              onFocus={adjustTextareaHeight}
              placeholder="Type your message here..."
              className="help-chat-input"
              ref={inputRef}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <button 
              type="submit" 
              className="help-chat-send"
              disabled={!message.trim()}
              aria-label="Send message"
            >
            </button>
          </form>
        </div>
      )}
      
      <button 
        className={`help-chat-button ${isOpen ? 'active' : ''}`}
        onClick={toggleChat}
        aria-label="Help Chat"
        style={{ backgroundColor: isOpen ? "#15376c" : "#1c4587" }}
      >
        {isOpen ? '×' : '?'}
      </button>
    </div>
  );
};

export default HelpChatWidget; 