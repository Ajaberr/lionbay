import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import '../App.css';
import DiscoverFeature from './DiscoverFeature';
import { API_BASE_URL } from '../config';
import { getCategoryIcon } from '../App';

function HomePage() {
  const { isAuthenticated } = useAuth();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFaqIndex, setOpenFaqIndex] = useState(null); // State for accordion

  const faqsData = [
    {
      q: "Who can use LionBay?",
      a: "Only verified Columbia University students can post, buy, and message. It's 100% campus-only."
    },
    {
      q: "Does LionBay take any commission?",
      a: "Nope. Zero fees. You keep every dollar of what you sell."
    },
    {
      q: "How do I pay or get paid?",
      a: "You can use Zelle, Apple Pay, cash, or Stripe — it's up to you and the other person."
    },
    {
      q: "Is it safe?",
      a: "Yes — LionBay is closed to verified Columbia students only. No randoms."
    },
    {
      q: "Can I meet in person?",
      a: "Totally. Most students meet on campus spots like Butler, Lerner, or dorm lobbies."
    }
  ];
  
  // Helper function to get the first image from a pipe-delimited string
  const getFirstImage = (imagePath) => {
    if (!imagePath) return "/api/placeholder/300/300";
    
    // Split by pipe symbol and get the first image URL
    const images = imagePath.split('|').filter(img => img.trim());
    return images.length > 0 ? images[0] : imagePath || "/api/placeholder/300/300";
  };

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
          const productsResponse = await axios.get(`${API_BASE_URL}/products?limit=50`);
          // Filter for products from admin users without limiting the number
          const adminProducts = productsResponse.data
            .filter(product => adminEmails.includes(product.seller_email));
          
          setFeaturedProducts(adminProducts);
        } else {
          // Fallback to regular products if no admin emails found
          const response = await axios.get(`${API_BASE_URL}/products?limit=12`);
          setFeaturedProducts(response.data);
        }
      } catch (error) {
        console.error('Error fetching featured products:', error);
        // Fallback to regular products if there's an error
        try {
          const response = await axios.get(`${API_BASE_URL}/products?limit=12`);
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
            <p>Meet in person, exchange items & payment (e.g., Venmo, Zelle, cash directly to the seller). Buyer confirms, seller verifies. Like rideshare apps!</p>
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
                        <>
                          <img 
                            src={getFirstImage(product.image_path)} 
                            alt={product.name} 
                            loading="eager" 
                            onLoad={(e) => {
                              e.target.classList.add('loaded');
                              const placeholder = e.target.nextElementSibling;
                              if (placeholder) {
                                placeholder.style.display = 'none';
                              }
                            }}
                            className="product-img"
                          />
                          <div className="image-loading-placeholder">
                            <div className="loading-spinner small"></div>
                          </div>
                        </>
                      ) : (
                        <div className="placeholder-image">No Image</div>
                      )}
                      {product.condition && (
                        <div className="product-badge" data-condition={product.condition}>{product.condition}</div>
                      )}
                    </div>
                    <div className="product-details">
                      <h3 className="product-title">{product.name}</h3>
                      <div className="product-category">
                        <span>{getCategoryIcon(product.category)}</span> {product.category}
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
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-walking"></i></div>
            <h3>Ultra-Convenient</h3>
            <p>Everything is right here on campus. No need to travel far—find what you need within a short walk from your dorm or class.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><i className="fas fa-recycle"></i></div>
            <h3>Sustainable & Smart</h3>
            <p>Reduce waste by buying and selling pre-loved items within the community. It's good for your wallet and the planet.</p>
          </div>
        </div>
      </div>

      <div className="get-started-section animate-on-scroll">
        <h2>Join Your Campus Marketplace</h2>
        <p>From textbooks and electronics to dorm essentials and concert tickets - connect with fellow Columbia students for hassle-free exchanges. Verify with your email and start exploring campus deals in seconds.</p>
        <Link to="/market" className="cta-button pulse-animation">Find Campus Deals</Link>
      </div>

      {/* FAQs Section */}
      <section className="faqs-section animate-on-scroll">
        <h2>Frequently Asked Questions</h2>
        <div className="faqs-container">
          {faqsData.map((faq, index) => (
            <div key={index} className="faq-item">
              <button
                className={`faq-question ${openFaqIndex === index ? 'open' : ''}`}
                onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                aria-expanded={openFaqIndex === index}
                aria-controls={`faq-answer-${index}`}
              >
                <span>{faq.q}</span>
                <span className="faq-icon">
                  <i className={`fas ${openFaqIndex === index ? 'fa-minus' : 'fa-plus'}`}></i>
                </span>
              </button>
              <div
                id={`faq-answer-${index}`}
                className={`faq-answer ${openFaqIndex === index ? 'open' : ''}`}
              >
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

export default HomePage; 