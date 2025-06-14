import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { io } from 'socket.io-client';
import '../styles/HelpChatWidget.css';
import '../Chat.css'
import '../styles/App.css';
import '../App.css';
import helpIcon from '../assets/help.svg';


const SOCKET_URL = 'https://lionbay-api.onrender.com';

const HelpChatWidget = () => {
  const { currentUser, authAxios } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (!currentUser) return;

    const token = localStorage.getItem('token');
    const newSocket = io(SOCKET_URL, {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to help chat socket');
    });

    newSocket.on('admin_response', (response) => {
      // Only increment unread counter if chat is not open and message is truly new
      const isNewMessage = !localStorage.getItem(`msg_seen_${response.id}`);
      
     
      
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
  }, [currentUser, isOpen]);

  // Load persisted messages on component mount and fetch new ones when chat is opened
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
        fetchMessages();

        // Reset unread counter when opening
        
        // Mark all messages as seen
        const savedMessages = JSON.parse(localStorage.getItem('helpChatMessages') || '[]');
        savedMessages.forEach(msg => {
          if (msg.is_from_admin) {
            localStorage.setItem(`msg_seen_${msg.id}`, 'true');
          }
        });
        
        // Focus input field when opening
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 300);
      }
    }
  }, [isOpen, currentUser]);

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
        <div className="help-chat-box">
          <div className="help-chat-header">
            <h3>LionBay Support</h3>
            <button 
              className="help-chat-close" 
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="help-chat-messages">
            {messages.length === 0 && !loading && (
              <div className="help-chat-welcome">
                <p>👋 Hi there! How can we help?</p>
                <p>Our LionBay admin team is here to assist. Ask us anything, report an issue, or share your suggestions for improving the platform!</p>
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
        className={`help-chat-button ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Help Chat"
      >
        {isOpen ? (
          <span className="close-icon">×</span>
        ) : (
          <img src={helpIcon} alt="Help" className="help-icon-svg" />
        )}
      </button>
      {!isOpen && <span className="help-text-label">Help?</span>}
    </div>
  );
};

export default HelpChatWidget; 