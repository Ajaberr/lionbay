import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import '../App.css';
import DiscoverFeature from './DiscoverFeature';
import { API_BASE_URL } from '../config';

function HomePage() {
  const { isAuthenticated } = useAuth();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Apply fade-in animations to elements as they scroll into view
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.animate-on-scroll').forEach(item => {
      observer.observe(item);
    });
    
    return () => {
      document.querySelectorAll('.animate-on-scroll').forEach(item => {
        observer.unobserve(item);
      });
    };
  }, []);

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
        <div className="hero-content">
          <h1 className="slide-in-left">Welcome to <span className="highlight">LionBay</span></h1>
          <p className="slide-in-right">The marketplace built by Columbia students, for Columbia students. Zero commission, zero hassle, and instant connections with your campus community.</p>
          <div className="cta-buttons fade-in">
            <Link to="/market" className="cta-button">Browse Items</Link>
            <Link to="/create-product" className="cta-button cta-secondary">Sell Something</Link>
          </div>
        </div>
      </div>

      {/* Discover Feature Section */}
      <DiscoverFeature />

      {/* How LionBay Works Section */}
      <section className="how-it-works-section animate-on-scroll">
        <h2>How LionBay Works</h2>
        <div className="steps-container">
          <div className="step-card">
            <div className="step-icon">
              <i className="fas fa-user-plus"></i>
              <div className="step-number">1</div>
            </div>
            <h3>Sign Up in Seconds</h3>
            <p>Just verify your Columbia email - no passwords, no lengthy forms. One click and you're in.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">
              <i className="fas fa-tag"></i>
              <div className="step-number">2</div>
            </div>
            <h3>List or Browse</h3>
            <p>Post items you want to sell or browse what others are offering right on campus.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">
              <i className="fas fa-comments"></i>
              <div className="step-number">3</div>
            </div>
            <h3>Connect & Chat</h3>
            <p>Message through our secure chat and arrange to meet on campus for exchange.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">
              <i className="fas fa-handshake"></i>
              <div className="step-number">4</div>
            </div>
            <h3>Quick Transactions</h3>
            <p>Meet in person, inspect items, and complete your transaction right away.</p>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="featured-products animate-on-scroll">
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

      <div className="features-section animate-on-scroll">
        <h2>Why LionBay is Better</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-bolt"></i></div>
            <h3>Instant Exchanges</h3>
            <p>Skip the shipping and tracking anxiety. Meet on campus, get what you need immediately, and avoid mail center delays altogether.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-money-bill-wave"></i></div>
            <h3>Zero Commission</h3>
            <p>Keep 100% of what you earn. Unlike other marketplaces that take a cut, LionBay is free - built by students, for students.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-user-shield"></i></div>
            <h3>Columbia-Verified Only</h3>
            <p>Everyone here has a verified Columbia email, creating a trusted community where you know exactly who you're dealing with.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-sign-in-alt"></i></div>
            <h3>Seamless Access</h3>
            <p>Just your Columbia email. No password to remember, no complex account setup, and no unnecessary personal information required.</p>
          </div>
        </div>
      </div>

      <div className="get-started-section animate-on-scroll">
        <h2>Join Your Campus Marketplace</h2>
        <p>From textbooks and electronics to dorm essentials and concert tickets - connect with fellow Columbia students for hassle-free exchanges. Verify with your email and start exploring campus deals in seconds.</p>
        <Link to="/market" className="cta-button pulse-animation">Find Campus Deals</Link>
      </div>
    </div>
  );
}

export default HomePage; 