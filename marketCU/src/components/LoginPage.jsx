import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css';

// API Base URL Configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://lionbay-api.onrender.com/api'
  : 'http://localhost:3003/api';

function LoginPage({ setIsAuthenticated }) {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendCode = async (e) => {
    e.preventDefault();
    
    if (!email.endsWith('@columbia.edu')) {
      setErrorMessage('Only Columbia University emails are allowed');
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      const response = await axios.post(`${API_BASE_URL}/send-verification-code`, { email });
      if (response.data.message) {
        setCodeSent(true);
        setErrorMessage('');
        setVerificationCode(''); // Clear any previous code
      } else {
        setErrorMessage(response.data.error || 'Failed to send verification code');
      }
    } catch (error) {
      if (error.response?.status === 429) {
        const resetTime = new Date(error.response.data.resetTime);
        const minutes = Math.ceil((resetTime - new Date()) / 60000);
        setErrorMessage(`Too many attempts. Please try again in ${minutes} minutes.`);
      } else {
        setErrorMessage(error.response?.data?.error || 'Failed to send verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    
    // Validate code format
    if (!/^\d{6}$/.test(verificationCode)) {
      setErrorMessage('Please enter a valid 6-digit code');
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      console.log('Sending verification request with:', { email, verificationCode });
      const response = await axios.post(`${API_BASE_URL}/auth/verify-email`, { 
        email, 
        verificationCode
      });
      
      console.log('Server response:', response.data);
      
      if (response.data.token && response.data.user) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setIsAuthenticated(true);
        navigate('/market');
      } else {
        setErrorMessage('Invalid response from server. Please try again.');
      }
    } catch (error) {
      if (error.response?.status === 429) {
        const resetTime = new Date(error.response.data.resetTime);
        const minutes = Math.ceil((resetTime - new Date()) / 60000);
        setErrorMessage(`Too many attempts. Please try again in ${minutes} minutes.`);
      } else {
        console.error('Verification error details:', error.response?.data || error);
        setErrorMessage(error.response?.data?.error || 'Invalid or expired verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-container">
        <h1>Columbia Marketplace</h1>
        
        {!codeSent ? (
          <form onSubmit={handleSendCode}>
            <div className="form-group">
              <label htmlFor="email">Columbia Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="youremail@columbia.edu"
                required
              />
            </div>
            
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            
            <button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
            <div className="form-group">
              <label htmlFor="code">Verification Code</label>
              <input
                type="text"
                id="code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
              />
            </div>
            
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            
            <button type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            
            <button 
              type="button" 
              className="secondary-button"
              onClick={() => setCodeSent(false)}
              disabled={loading}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginPage; 