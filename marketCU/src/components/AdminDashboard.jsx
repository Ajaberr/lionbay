import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { io } from 'socket.io-client';
import '../styles/AdminDashboard.css';
import { SOCKET_URL } from '../config';

const AdminDashboard = () => {
  const { currentUser, authAxios } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [helpMessages, setHelpMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState(null);

  // Verify admin status
  useEffect(() => {
    console.log("Current user in AdminDashboard:", currentUser);
    
    // Add explicit check for admin status and redirect if not admin
    if (currentUser && !currentUser.isAdmin) {
      console.error("User is not an admin, redirecting to home");
      setError("You do not have admin privileges.");
      navigate('/');
      return;
    }
    
    if (!currentUser) {
      console.error("No user logged in, redirecting to login");
      navigate('/login');
      return;
    }
  }, [currentUser, navigate]);

  // Initialize socket connection for admin
  useEffect(() => {
    if (!currentUser || !currentUser.isAdmin) return;

    const token = localStorage.getItem('token');
    console.log('Admin connecting to socket server at:', SOCKET_URL);
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'] // Try websocket first, then fallback to polling
    });

    newSocket.on('connect', () => {
      console.log('Admin connected to socket');
    });
    
    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    newSocket.on('new_help_message', (message) => {
      setHelpMessages(prev => {
        // Check if this message already exists by ID
        if (prev.some(m => m.id === message.id)) return prev;
        
        // Also check for duplicates with similar content and timestamps (within 2 seconds)
        const duplicates = prev.filter(m => 
          m.message === message.message && 
          m.is_from_admin === message.is_from_admin &&
          Math.abs(new Date(m.created_at) - new Date(message.created_at)) < 2000
        );
        
        if (duplicates.length > 0) return prev;
        
        return [message, ...prev];
      });
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [currentUser]);

  // Fetch dashboard data on load
  useEffect(() => {
    if (!currentUser) return;

    fetchDashboardData();
    if (activeTab === 'support') {
      fetchHelpMessages();
    }
  }, [currentUser, activeTab]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await authAxios.get('/admin/dashboard');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHelpMessages = async () => {
    try {
      const response = await authAxios.get('/admin/help-messages');
      
      if (response.data.conversations) {
        // We received the admin-formatted response with conversations
        
        // Process messages with deduplication
        const existingIds = new Set();
        const uniqueMessages = [];
        
        response.data.allMessages.forEach(msg => {
          // Check by ID
          if (existingIds.has(msg.id)) return;
          
          // Check for similar messages with close timestamps
          const similarMessage = uniqueMessages.find(m =>
            m.message === msg.message &&
            m.is_from_admin === msg.is_from_admin &&
            m.user_id === msg.user_id &&
            (m.to_user_id === msg.to_user_id) &&
            Math.abs(new Date(m.created_at) - new Date(msg.created_at)) < 2000
          );
          
          if (!similarMessage) {
            uniqueMessages.push(msg);
            existingIds.add(msg.id);
          }
        });
        
        setHelpMessages(uniqueMessages);
        
        // If we don't have a selected user yet and there are conversations, select the first one
        if (!selectedUser && response.data.conversations.length > 0) {
          setSelectedUser(response.data.conversations[0].userId);
        }
      } else {
        // Regular user response format - apply same deduplication
        const existingIds = new Set();
        const uniqueMessages = [];
        
        response.data.forEach(msg => {
          // Check by ID
          if (existingIds.has(msg.id)) return;
          
          // Check for similar messages with close timestamps
          const similarMessage = uniqueMessages.find(m =>
            m.message === msg.message &&
            m.is_from_admin === msg.is_from_admin &&
            m.user_id === msg.user_id &&
            (m.to_user_id === msg.to_user_id) &&
            Math.abs(new Date(m.created_at) - new Date(msg.created_at)) < 2000
          );
          
          if (!similarMessage) {
            uniqueMessages.push(msg);
            existingIds.add(msg.id);
          }
        });
        
        setHelpMessages(uniqueMessages);
      }
    } catch (error) {
      console.error('Error fetching help messages:', error);
    }
  };

  const handleSendResponse = async (e) => {
    e.preventDefault();
    if (!response.trim() || !selectedUser || !socket) return;

    try {
      // Send via socket
      socket.emit('send_admin_response', { 
        message: response, 
        to_user_id: selectedUser 
      });

      // Send via REST API
      await authAxios.post('/admin/respond-help', {
        message: response,
        to_user_id: selectedUser
      });

      // Clear input
      setResponse('');
      
      // Refresh messages
      await fetchHelpMessages();
    } catch (error) {
      console.error('Error sending admin response:', error);
    }
  };

  // Auto-resize textarea based on content
  const adjustTextareaHeight = (e) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  const handleLookupVerificationCode = async () => {
    if (!verificationEmail) return;
    
    try {
      const response = await authAxios.get(`/admin/verification-code/${verificationEmail}`);
      setVerificationCode(response.data.verificationCode || 'No active code found');
    } catch (error) {
      console.error('Error fetching verification code:', error);
      setVerificationCode('User not found or no active code');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + 
           date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  return (
    <div className="admin-dashboard">
      {error && (
        <div className="admin-error-message">
          <p>{error}</p>
        </div>
      )}
      
      {loading && !error ? (
        <div className="admin-loading">
          <p>Loading admin dashboard...</p>
        </div>
      ) : (
        currentUser && currentUser.isAdmin && (
          <>
            <h1>Admin Dashboard</h1>
            <div className="admin-info">
              <p>Logged in as: {currentUser.email}</p>
            </div>
            
            <div className="admin-tabs">
              <button 
                className={activeTab === 'overview' ? 'active' : ''} 
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={activeTab === 'support' ? 'active' : ''} 
                onClick={() => setActiveTab('support')}
              >
                Support
              </button>
              <button 
                className={activeTab === 'tools' ? 'active' : ''} 
                onClick={() => setActiveTab('tools')}
              >
                Admin Tools
              </button>
            </div>
            
            <div className="admin-content">
              {activeTab === 'overview' && dashboardData && (
                <div className="admin-overview">
                  <h1>Dashboard Overview</h1>
                  
                  <div className="admin-stats-grid">
                    <div className="admin-stat-card">
                      <h3>Users</h3>
                      <div className="admin-stat-number">{dashboardData.stats.users.total_users}</div>
                      <div className="admin-stat-subtext">
                        +{dashboardData.stats.users.new_users_last_week} new this week
                      </div>
                    </div>
                    
                    <div className="admin-stat-card">
                      <h3>Products</h3>
                      <div className="admin-stat-number">{dashboardData.stats.products.total_products}</div>
                      <div className="admin-stat-subtext">
                        +{dashboardData.stats.products.new_products_last_week} new this week
                      </div>
                    </div>
                    
                    <div className="admin-stat-card">
                      <h3>Chats</h3>
                      <div className="admin-stat-number">{dashboardData.stats.chats.total_chats}</div>
                      <div className="admin-stat-subtext">
                        +{dashboardData.stats.chats.new_chats_last_week} new this week
                      </div>
                    </div>
                    
                    <div className="admin-stat-card">
                      <h3>Messages</h3>
                      <div className="admin-stat-number">{dashboardData.stats.messages.total_messages}</div>
                      <div className="admin-stat-subtext">
                        +{dashboardData.stats.messages.new_messages_last_week} new this week
                      </div>
                    </div>
                  </div>
                  
                  <div className="admin-recent-section">
                    <h2>Recent Users</h2>
                    <div className="admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Verified</th>
                            <th>Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.recentUsers.map(user => (
                            <tr key={user.id}>
                              <td>{user.email}</td>
                              <td>{user.email_verified ? '✓' : '✗'}</td>
                              <td>{formatDate(user.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="admin-recent-section">
                    <h2>Recent Products</h2>
                    <div className="admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Price</th>
                            <th>Category</th>
                            <th>Seller</th>
                            <th>Posted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.recentProducts.map(product => (
                            <tr key={product.id}>
                              <td>{product.name}</td>
                              <td>${parseFloat(product.price).toFixed(2)}</td>
                              <td>{product.category}</td>
                              <td>{product.seller_email}</td>
                              <td>{formatDate(product.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'support' && (
                <div className="admin-support">
                  <h1>Customer Support</h1>
                  
                  <div className="admin-support-container">
                    <div className="admin-support-users">
                      <h3>Support Conversations</h3>
                      
                      {helpMessages.length === 0 ? (
                        <div className="admin-support-empty">
                          No support conversations yet.
                        </div>
                      ) : (
                        <div className="admin-support-user-list">
                          {/* Get unique user IDs */}
                          {[...new Set(helpMessages.map(msg => 
                            msg.is_from_admin ? msg.to_user_id : msg.user_id
                          ))].map(userId => {
                            // Get messages for this user (both from and to)
                            const userMessages = helpMessages.filter(msg => 
                              msg.user_id === userId || 
                              (msg.is_from_admin && msg.to_user_id === userId)
                            );
                            
                            // Find a user message to get the email
                            const userMsg = userMessages.find(msg => !msg.is_from_admin && msg.user_id === userId);
                            
                            // If we can't find a message from the user, use the first admin message to this user
                            const adminMsg = userMessages.find(msg => msg.is_from_admin && msg.to_user_id === userId);
                            
                            const userEmail = userMsg ? userMsg.user_email : 
                                           (adminMsg ? adminMsg.to_user_email : 'Unknown User');
                            
                            // Get latest message
                            const latestMessage = [...userMessages].sort((a, b) => 
                              new Date(b.created_at) - new Date(a.created_at)
                            )[0];
                            
                            // Skip if we don't have a proper conversation
                            if (!latestMessage) return null;
                            
                            return (
                              <div 
                                key={userId}
                                className={`admin-support-user-item ${selectedUser === userId ? 'active' : ''}`}
                                onClick={() => setSelectedUser(userId)}
                              >
                                <div className="admin-support-user-email">{userEmail}</div>
                                <div className="admin-support-preview">
                                  {latestMessage.message.substring(0, 40)}
                                  {latestMessage.message.length > 40 ? '...' : ''}
                                </div>
                                <div className="admin-support-time">
                                  {formatDate(latestMessage.created_at)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div className="admin-support-chat">
                      {selectedUser ? (
                        <>
                          <div className="admin-support-chat-header">
                            <h3>
                              {
                                helpMessages.find(msg => 
                                  !msg.is_from_admin && msg.user_id === selectedUser
                                )?.user_email || 
                                'User'
                              }
                            </h3>
                          </div>
                          
                          <div className="admin-support-messages">
                            {helpMessages
                              .filter(msg => 
                                msg.user_id === selectedUser || 
                                (msg.is_from_admin && msg.to_user_id === selectedUser)
                              )
                              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                              .map(msg => (
                                <div 
                                  key={msg.id}
                                  className={`admin-support-message ${msg.is_from_admin ? 'admin' : 'user'}`}
                                >
                                  <div className="admin-support-message-content">
                                    {msg.message}
                                  </div>
                                  <div className="admin-support-message-time">
                                    {formatDate(msg.created_at)}
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                          
                          <div className="admin-support-input">
                            <textarea
                              value={response}
                              onChange={(e) => {
                                setResponse(e.target.value);
                                adjustTextareaHeight(e);
                              }}
                              placeholder="Type your response..."
                              className="admin-support-input-field"
                              disabled={!selectedUser}
                              onKeyDown={(e) => {
                                // Submit on Enter (without Shift)
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendResponse(e);
                                }
                              }}
                              onFocus={adjustTextareaHeight}
                              rows={1}
                            />
                            <button
                              className="admin-support-send"
                              onClick={handleSendResponse}
                              disabled={!selectedUser || !response.trim()}
                              aria-label="Send response"
                            >
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="admin-support-no-selection">
                          <p>Select a conversation from the left to respond.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'tools' && (
                <div className="admin-tools">
                  <h1>Admin Tools</h1>
                  
                  <div className="admin-tools-container">
                    <div className="admin-tools-item">
                      <h3>Verification Tools</h3>
                      <p>Enter a user's email to fetch their current verification code:</p>
                      
                      <div className="admin-verification-form">
                        <input
                          type="email"
                          value={verificationEmail}
                          onChange={(e) => setVerificationEmail(e.target.value)}
                          placeholder="user@columbia.edu"
                          className="admin-verification-input"
                        />
                        <button 
                          onClick={handleLookupVerificationCode}
                          className="admin-verification-button"
                        >
                          Lookup Code
                        </button>
                      </div>
                      
                      {verificationCode && (
                        <div className="admin-verification-result">
                          <strong>Verification Code:</strong> {verificationCode}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
};

export default AdminDashboard; 