import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api-fetcher';
import '../App.css';
import DiscoverFeature from './DiscoverFeature';

export function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchFeaturedProducts() {
      try {
        // Fetch a limited set of products for the homepage
        const products = await API.getProducts();
        
        // Take only the first 4 products (or fewer if less are available)
        const featured = products.slice(0, 4);
        setFeaturedProducts(featured);
      } catch (error) {
        console.error('Error fetching featured products:', error);
        setError('Failed to load featured products');
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedProducts();
  }, []);

  return (
    <div className="home-page">
      <div className="hero-section">
        <div className="hero-content">
          <h1>Welcome to Lion Bay</h1>
          <p>The marketplace for Columbia University students.</p>
          <div className="hero-buttons">
            <Link to="/market" className="primary-button">Explore Products</Link>
            <Link to="/discover" className="secondary-button">Discover</Link>
          </div>
        </div>
      </div>

      {/* Discover Feature Section */}
      <DiscoverFeature />

      {/* Featured Products Section */}
      <section className="featured-products">
        <h2>Items That Don't Suck</h2>
        {loading ? (
          <div className="loading">Loading the good stuff...</div>
        ) : error ? (
          <div className="error">Error loading products: {error}</div>
        ) : featuredProducts.length > 0 ? (
          <>
            <div className="featured-products-grid">
              {featuredProducts.map(product => (
                <Link to={`/product/${product.id}`} key={product.id} className="product-card-link">
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
            <Link to="/market" className="view-all-link">See all the things →</Link>
          </>
        ) : (
          <div className="no-products">Nothing here yet. Be the first to sell something!</div>
        )}
      </section>

      <div className="features-section">
        <h2>Why Choose Lion Bay?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Columbia Verified</h3>
            <p>All users are verified Columbia University students, faculty, or staff.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📚</div>
            <h3>Campus-Focused</h3>
            <p>Find textbooks, dorm essentials, and more from fellow students.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>Direct Messaging</h3>
            <p>Easily chat with sellers and arrange pickups on campus.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💸</div>
            <h3>Student Prices</h3>
            <p>Find great deals from students who understand student budgets.</p>
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