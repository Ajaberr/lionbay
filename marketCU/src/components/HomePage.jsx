import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import '../App.css';
import DiscoverFeature from './DiscoverFeature';

// API Base URL Configuration
const API_BASE_URL = 'https://lionbay-api.onrender.com/api';

function HomePage() {
  const { isAuthenticated } = useAuth();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch featured products (only from admin users, limited to 6)
    const fetchFeaturedProducts = async () => {
      try {
        setLoading(true);
        // Get admin emails from the server
        const adminResponse = await axios.get(`${API_BASE_URL}/admin/emails`);
        const adminEmails = adminResponse.data.emails || [];
        
        if (adminEmails.length > 0) {
          // Get all products
          const productsResponse = await axios.get(`${API_BASE_URL}/products`);
          // Filter for products from admin users and limit to 3
          const adminProducts = productsResponse.data
            .filter(product => adminEmails.includes(product.seller_email))
            .slice(0, 3);
          
          setFeaturedProducts(adminProducts);
        } else {
          // Fallback to regular products if no admin emails found
          const response = await axios.get(`${API_BASE_URL}/products?limit=3`);
          setFeaturedProducts(response.data);
        }
      } catch (error) {
        console.error('Error fetching featured products:', error);
        // Fallback to regular products if there's an error
        try {
          const response = await axios.get(`${API_BASE_URL}/products?limit=3`);
          setFeaturedProducts(response.data);
        } catch (fallbackError) {
          console.error('Error fetching fallback products:', fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProducts();
  }, []);

  return (
    <div className="home-page">
      <div className="hero-section">
        <h1 style={{ color: 'white' }}>Welcome to LionBay</h1>
        <p>The marketplace that doesn't make you wait 84 years for your stuff. Get what you need from your neighbors - like, right now. No complicated signup - just your Columbia email and you're good to go!</p>
        <div className="cta-buttons">
          <Link to="/market" className="cta-button">Browse Items</Link>
          <Link to="/create-product" className="cta-button cta-secondary">Sell Something</Link>
        </div>
      </div>

      {/* Discover Feature Section */}
      <DiscoverFeature />

      {/* Featured Products Section */}
      <section className="featured-products">
        <h2>Featured Items</h2>
        {loading ? (
          <div className="loading">Loading featured items...</div>
        ) : featuredProducts.length > 0 ? (
          <>
            <div className="featured-products-grid">
              {featuredProducts.map(product => (
                <Link to={`/market/${product.id}`} key={product.id} className="product-card-link">
                  <div className="product-card">
                    <div className="product-image">
                      {product.image_path ? (
                        <img src={product.image_path} alt={product.name} />
                      ) : (
                        <div className="placeholder-image">No Image</div>
                      )}
                    </div>
                    <div className="product-details">
                      <h3 className="product-title">{product.name}</h3>
                      <div className="product-specs">
                        <p>Condition: {product.condition}</p>
                        <p>Category: {product.category}</p>
                      </div>
                      <div className="product-price">${parseFloat(product.price).toFixed(2)}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <Link to="/market" className="view-all-link">View All Products →</Link>
          </>
        ) : (
          <div className="no-products">No featured items available yet.</div>
        )}
      </section>

      <div className="features-section">
        <h2>Why We're Better Than Those Other Places</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-bolt"></i></div>
            <h3>It's Actually Fast</h3>
            <p>No waiting for shipping or dealing with mail center chaos. Unlike iBay, no need to pray your package actually arrives before next semester.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-money-bill-wave"></i></div>
            <h3>End of Semester Deals</h3>
            <p>When people dip for summer break, prices drop faster than GPAs during finals. Score dorm stuff for pennies while Headbook Marketplace still has people asking full price.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-comments"></i></div>
            <h3>No Sketchy Randos</h3>
            <p>Everyone here has a verified school email. Not like Slide Chat where that "college student" is actually a 45-year-old trying to sell you "slightly used" AirPods.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-leaf"></i></div>
            <h3>Login = Done in 10 Seconds</h3>
            <p>Just your Columbia email. No password to forget. No account to create. No "please enter a capital letter, 3 numbers, 2 special characters, and your astrological sign" nonsense.</p>
          </div>
        </div>
      </div>

      <div className="get-started-section">
        <h2>Stop Scrolling, Start Saving</h2>
        <p>Dorm stuff, textbooks, clothes, concert tickets - whatever you need, someone nearby probably has it. Enter your Columbia email, get verified in seconds, and start scoring deals immediately. No account setup headaches, just straight to the good stuff.</p>
        <Link to="/market" className="cta-button">Find Your Next Score</Link>
      </div>
    </div>
  );
}

export default HomePage; 