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
    setErrorMessage('');
    setLoading(true);

    if (!email.endsWith('@columbia.edu')) {
      setErrorMessage('Please use a Columbia University email address');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/send-verification-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const resetTime = new Date(data.reset_time);
          const now = new Date();
          const minutesLeft = Math.ceil((resetTime - now) / 60000);
          setErrorMessage(`Too many attempts. Please try again in ${minutesLeft} minutes.`);
        } else {
          setErrorMessage(data.error || 'Failed to send verification code');
        }
        return;
      }

      setVerificationCode('');
      setCodeSent(true);
    } catch (err) {
      setErrorMessage('Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    if (!/^\d{6}$/.test(verificationCode)) {
      setErrorMessage('Verification code must be 6 digits');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const resetTime = new Date(data.reset_time);
          const now = new Date();
          const minutesLeft = Math.ceil((resetTime - now) / 60000);
          setErrorMessage(`Too many attempts. Please try again in ${minutesLeft} minutes.`);
        } else {
          setErrorMessage(data.error || 'Failed to verify code');
        }
        return;
      }

      // Store the token and user data
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Redirect to home page
      window.location.href = '/';
    } catch (err) {
      setErrorMessage('Failed to verify code. Please try again.');
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