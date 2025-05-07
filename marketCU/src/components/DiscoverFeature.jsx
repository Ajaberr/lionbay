import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/DiscoverFeature.css';

const DiscoverFeature = () => {
  return (
    <div className="discover-feature-section">
      <div className="discover-feature-content">
        <div className="discover-feature-text">
          <h2>Swipe Your Way to Deals</h2>
          <div className="discover-feature-description">
            <p>Can't decide? Just swipe.</p>
            <p>Our discovery mode lets you browse Columbia listings like it's dating season — swipe right for "I want it," left for "nah."</p>
            <p>It's fast, low-effort, and tailored just for you.</p>
            <p>Low commitment, high reward.</p>
          </div>
          <Link className="discover-feature-button" to="/discover" data-discover="true">
            <span>Start Swiping</span>
            <i className="fas fa-chevron-right"></i>
          </Link>
        </div>
        <div className="discover-feature-visual">
          <div className="discover-cards-stack">
            <div className="discover-card-preview"></div>
            <div className="discover-card-preview"></div>
            <div className="discover-card-preview active"></div>
            <div className="discover-swipe-icons">
              <div className="swipe-icon-left">
                <i className="fas fa-times"></i>
              </div>
              <div className="swipe-icon-right">
                <i className="fas fa-heart"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscoverFeature; 