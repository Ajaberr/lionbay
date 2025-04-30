import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css';

// API Base URL Configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://lionbay-api.onrender.com'
  : 'http://localhost:3003';

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

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (!email.endsWith('@columbia.edu')) {
      setErrorMessage('Please use a Columbia University email address');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/send-verification-code`, { email });
      setVerificationCode('');
      setCodeSent(true);
      setErrorMessage('');
    } catch (err) {
      if (err.response?.status === 429) {
        const resetTime = new Date(err.response.data.reset_time);
        const now = new Date();
        const minutesLeft = Math.ceil((resetTime - now) / 60000);
        setErrorMessage(`Too many attempts. Please try again in ${minutesLeft} minutes.`);
      } else {
        setErrorMessage(err.response?.data?.error || 'Failed to send verification code');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    // Validate verification code format
    if (!/^\d{6}$/.test(verificationCode)) {
      setErrorMessage('Verification code must be 6 digits');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/verify-email`, {
        email,
        verificationCode
      });

      // Store the token and user data
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Update authentication state
      setIsAuthenticated(true);
      
      // Redirect to home page
      navigate('/');
    } catch (err) {
      if (err.response?.status === 429) {
        const resetTime = new Date(err.response.data.reset_time);
        const now = new Date();
        const minutesLeft = Math.ceil((resetTime - now) / 60000);
        setErrorMessage(`Too many attempts. Please try again in ${minutesLeft} minutes.`);
      } else {
        setErrorMessage(err.response?.data?.error || 'Failed to verify code');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Render your form components here */}
    </div>
  );
}

export default LoginPage;