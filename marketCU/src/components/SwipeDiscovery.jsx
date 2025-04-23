import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { useCart } from '../App';
import ToastNotification from './ToastNotification';
import '../styles/SwipeDiscovery.css';

const SwipeDiscovery = () => {
  const { authAxios, isAuthenticated, currentUser } = useAuth();
  const { updateCartCount } = useCart();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [swipedRight, setSwipedRight] = useState([]);
  const [swipedLeft, setSwipedLeft] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('');
  const [showContactModal, setShowContactModal] = useState(false);
  const [showActionToast, setShowActionToast] = useState(false);
  const [lastSwipedProduct, setLastSwipedProduct] = useState(null);
  const [error, setError] = useState(null);
  const cardRef = useRef(null);
  const actionToastRef = useRef(null);
  const actionToastTimerRef = useRef(null);
  const swipeThreshold = 100; // Minimum distance to trigger a swipe
  
  // Track drag state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  
  // Animation states
  const [confetti, setConfetti] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Load products on component mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Check if we need to load more products when running low
  useEffect(() => {
    if (!loading && products.length > 0 && currentIndex >= products.length - 2) {
      // Instead of recommendations, just fetch more products
      console.log("Running low on products, fetching more...");
      fetchProducts();
    }
    
    // Preload the next few images
    if (products.length > 0) {
      preloadImages();
    }
  }, [currentIndex, products, loading]);

  const fetchProducts = async () => {
    try {
      setError(null);
      setLoading(true);
      
      console.log("Attempting to fetch products...");
      console.log("Auth token:", localStorage.getItem('token') ? "Token exists" : "No token found");
      
      // Use the full API URL instead of relative path
      const apiUrl = 'http://localhost:3001/api/products';
      console.log("Fetching from:", apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Products fetched:", data.length);
      console.log("Sample product:", data.length > 0 ? JSON.stringify(data[0]) : "No products");
      
      if (!data || data.length === 0) {
        setError("No products available at the moment. Please check back later.");
        setLoading(false);
        return;
      }
      
      // Simple filtering - just exclude products already swiped
      const filteredProducts = data.filter(product => 
        !swipedRight.includes(product.id) && 
        !swipedLeft.includes(product.id) &&
        // If user is logged in, exclude their own products
        (!currentUser || product.seller_id !== currentUser.userId)
      );
      
      console.log("Filtered products:", filteredProducts.length);
      
      if (filteredProducts.length === 0) {
        setError("You've already viewed all available products. Check back later for new listings!");
      } else {
        // Add to existing products rather than replacing
        setProducts(prevProducts => {
          // Combine previous and new products, removing duplicates
          const combinedProducts = [...prevProducts];
          
          filteredProducts.forEach(newProduct => {
            if (!combinedProducts.some(p => p.id === newProduct.id)) {
              combinedProducts.push(newProduct);
            }
          });
          
          console.log("Total products after combining:", combinedProducts.length);
          return combinedProducts;
        });
        
        // Only reset index if we didn't have products before
        if (products.length === 0) {
          setCurrentIndex(0);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      let errorMessage = 'Failed to load products. Please try again later.';
      
      setError(errorMessage);
      setToastMessage(errorMessage);
      setToastType('error');
      setShowToast(true);
      setLoading(false);
    }
  };

  const handleSwipeLeft = (product) => {
    if (!product) return;
    
    // Add animation class
    if (cardRef.current) {
      cardRef.current.classList.add('swiping-left');
      // Remove the class after animation completes
      setTimeout(() => {
        cardRef.current.classList.remove('swiping-left');
      }, 600);
    }
    
    setSwipedLeft(prev => [...prev, product.id]);
    setCurrentIndex(prev => prev + 1);
  };

  const handleSwipeRight = async (product) => {
    if (!product) return;
    
    // Add animation class
    if (cardRef.current) {
      cardRef.current.classList.add('swiping-right');
      // Remove the class after animation completes
      setTimeout(() => {
        cardRef.current.classList.remove('swiping-right');
      }, 600);
    }
    
    setSwipedRight(prev => [...prev, product.id]);
    setLastSwipedProduct(product);
    
    try {
      // Add to cart with CART_ONLY type
      const apiUrl = 'http://localhost:3001/api/cart';
      console.log("Adding to cart:", product.id);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          product_id: product.id,
          cart_type: 'CART_ONLY'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      // Update cart count without showing toast
      console.log("Product added to cart successfully, updating cart count");
      if (updateCartCount) {
        // Make sure to await the update
        await updateCartCount();
        console.log("Cart count updated");
      } else {
        console.warn("updateCartCount function not available");
      }
      
      // Show action toast instead of modal
      setShowActionToast(true);
      
      // Set a timer to auto-dismiss the toast after 5 seconds
      if (actionToastTimerRef.current) {
        clearTimeout(actionToastTimerRef.current);
      }
      
      actionToastTimerRef.current = setTimeout(() => {
        dismissActionToast();
      }, 5000);
      
    } catch (err) {
      console.error('Error adding to cart:', err);
      // Only show toast for errors
      setToastMessage('Failed to add to cart. Please try again.');
      setToastType("error");
      setShowToast(true);
    }
    
    // Move to the next card
    setCurrentIndex(prev => prev + 1);
  };

  // Handle mouse/touch events for dragging
  const handleDragStart = (e) => {
    if (e.type === 'touchstart') {
      // Don't prevent default for touchstart to allow scrolling
      setIsDragging(true);
      setStartX(e.touches[0].clientX);
    } else {
      e.preventDefault(); // Prevent default for mouse to avoid text selection
      setIsDragging(true);
      setStartX(e.clientX);
    }
    setCurrentX(0); // Reset current drag distance
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    
    if (e.type === 'touchmove') {
      // Prevent scrolling when dragging a card
      e.preventDefault();
      const deltaX = e.touches[0].clientX - startX;
      setCurrentX(deltaX);
    } else {
      const deltaX = e.clientX - startX;
      setCurrentX(deltaX);
    }
    
    if (cardRef.current) {
      // Calculate rotation based on swipe distance (more natural feel)
      const rotate = Math.min(Math.max(currentX * 0.05, -12), 12); // Limit rotation to -12/+12 degrees
      const dampenedX = currentX * 0.85; // Dampen the movement for more control
      const scale = Math.min(1 + Math.abs(currentX) * 0.0008, 1.05); // Slight scale effect
      
      // Apply transformation with smooth animation
      cardRef.current.style.transition = currentX !== 0 ? 'none' : 'transform 0.3s ease';
      cardRef.current.style.transform = `translateX(${dampenedX}px) rotate(${rotate}deg) scale(${scale})`;
      
      // Get indicator elements safely
      const rightIndicator = document.querySelector('.swipe-right-indicator');
      const leftIndicator = document.querySelector('.swipe-left-indicator');
      
      // Change opacity and styling based on swipe direction with smoother transitions
      if (currentX > 0) {
        // Swiping right - like/green
        const opacity = Math.min(Math.abs(currentX) / 120, 1);
        cardRef.current.style.boxShadow = `0 ${10 + opacity * 15}px ${20 + opacity * 20}px rgba(91, 217, 103, ${opacity * 0.25})`;
        if (rightIndicator) rightIndicator.style.opacity = opacity;
        if (leftIndicator) leftIndicator.style.opacity = 0;
        
        // Add subtle green border glow
        cardRef.current.style.border = `1px solid rgba(91, 217, 103, ${opacity * 0.7})`;
        
      } else if (currentX < 0) {
        // Swiping left - nope/red
        const opacity = Math.min(Math.abs(currentX) / 120, 1);
        cardRef.current.style.boxShadow = `0 ${10 + opacity * 15}px ${20 + opacity * 20}px rgba(255, 87, 87, ${opacity * 0.25})`;
        if (leftIndicator) leftIndicator.style.opacity = opacity;
        if (rightIndicator) rightIndicator.style.opacity = 0;
        
        // Add subtle red border glow
        cardRef.current.style.border = `1px solid rgba(255, 87, 87, ${opacity * 0.7})`;
        
      } else {
        // Neutral position
        cardRef.current.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.1), 0 3px 10px rgba(0, 0, 0, 0.05)';
        cardRef.current.style.border = 'none';
        if (rightIndicator) rightIndicator.style.opacity = 0;
        if (leftIndicator) leftIndicator.style.opacity = 0;
      }
    }
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    
    if (Math.abs(currentX) > swipeThreshold) {
      // Swipe was strong enough to register
      if (cardRef.current) {
        // Make the card fly off in the direction of the swipe
        const direction = currentX > 0 ? 1 : -1;
        const flyAwayDistance = direction * window.innerWidth * 1.5;
        const rotate = direction * 45; // More dramatic rotation
        
        // Animate card flying away with easing
        cardRef.current.style.transition = 'transform 0.8s cubic-bezier(0.165, 0.84, 0.44, 1), opacity 0.8s ease';
        cardRef.current.style.transform = `translateX(${flyAwayDistance}px) rotate(${rotate}deg) scale(0.8)`;
        cardRef.current.style.opacity = '0';
        
        // Reset indicators
        const rightIndicator = document.querySelector('.swipe-right-indicator');
        const leftIndicator = document.querySelector('.swipe-left-indicator');
        if (rightIndicator) rightIndicator.style.opacity = 0;
        if (leftIndicator) leftIndicator.style.opacity = 0;
        
        // Handle the swipe action after animation
        setTimeout(() => {
          if (currentX > 0) {
            handleSwipeRight(products[currentIndex]);
          } else {
            handleSwipeLeft(products[currentIndex]);
          }
          // Reset card position
          setCurrentX(0);
          if (cardRef.current) {
            cardRef.current.style.transition = '';
            cardRef.current.style.transform = '';
            cardRef.current.style.opacity = '1';
            cardRef.current.style.boxShadow = '';
            cardRef.current.style.border = 'none';
          }
        }, 300);
      } else {
        // Card ref not available, handle swipe immediately
        if (currentX > 0) {
          handleSwipeRight(products[currentIndex]);
        } else {
          handleSwipeLeft(products[currentIndex]);
        }
        setCurrentX(0);
      }
    } else {
      // Not swiped far enough, return to center with animation
      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.5s ease, border 0.5s ease';
        cardRef.current.style.transform = '';
        cardRef.current.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.1), 0 3px 10px rgba(0, 0, 0, 0.05)';
        cardRef.current.style.border = 'none';
        
        // Reset after animation completes
        setTimeout(() => {
          if (cardRef.current) {
            cardRef.current.style.transition = '';
          }
          setCurrentX(0);
        }, 500);
      } else {
        setCurrentX(0);
      }
      
      // Reset indicators with fade
      const rightIndicator = document.querySelector('.swipe-right-indicator');
      const leftIndicator = document.querySelector('.swipe-left-indicator');
      if (rightIndicator) {
        rightIndicator.style.transition = 'opacity 0.3s ease';
        rightIndicator.style.opacity = 0;
      }
      if (leftIndicator) {
        leftIndicator.style.transition = 'opacity 0.3s ease';
        leftIndicator.style.opacity = 0;
      }
    }
  };
  
  const handleContactSeller = async () => {
    if (!isAuthenticated || !lastSwipedProduct) {
      setShowActionToast(false);
      return;
    }

    try {
      // Check if user is trying to contact themselves
      if (currentUser.userId === lastSwipedProduct.seller_id) {
        setToastMessage("Cannot contact yourself as the seller.");
        setToastType("error");
        setShowToast(true);
        dismissActionToast();
        return;
      }
      
      // Create or get chat for this product
      const chatApiUrl = 'http://localhost:3001/api/chats';
      console.log("Creating chat for product:", lastSwipedProduct.id);
      
      const chatResponse = await fetch(chatApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          product_id: lastSwipedProduct.id,
          seller_id: lastSwipedProduct.seller_id
        })
      });
      
      if (!chatResponse.ok) {
        throw new Error(`HTTP error! Status: ${chatResponse.status}`);
      }
      
      const chatData = await chatResponse.json();
      
      // First get cart items to find the one with this product
      const cartApiUrl = 'http://localhost:3001/api/cart';
      const cartResponse = await fetch(cartApiUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!cartResponse.ok) {
        throw new Error(`HTTP error! Status: ${cartResponse.status}`);
      }
      
      const cartData = await cartResponse.json();
      const cartItem = cartData.find(item => item.product_id === lastSwipedProduct.id);
      
      if (cartItem) {
        // Update the cart item to CONTACTED type
        const updateCartUrl = `http://localhost:3001/api/cart/${cartItem.id}`;
        const updateResponse = await fetch(updateCartUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            cart_type: 'CONTACTED',
            chat_id: chatData.id
          })
        });
        
        if (!updateResponse.ok) {
          console.warn("Failed to update cart item type, but continuing...");
        }
      }
      
      // Show success toast
      setToastMessage("Seller contacted successfully.");
      setToastType("success");
      setShowToast(true);
      
      // Close action toast
      dismissActionToast();
      
      // Navigate to chat after a short delay
      setTimeout(() => {
        navigate(`/chats/${chatData.id}`);
      }, 1000);
      
    } catch (err) {
      console.error('Error contacting seller:', err);
      setToastMessage('Failed to contact seller. Please try again.');
      setToastType("error");
      setShowToast(true);
      dismissActionToast();
    }
  };
  
  const dismissActionToast = () => {
    if (actionToastRef.current) {
      actionToastRef.current.classList.add('hiding');
      setTimeout(() => {
        setShowActionToast(false);
      }, 300);
    } else {
      setShowActionToast(false);
    }
    
    if (actionToastTimerRef.current) {
      clearTimeout(actionToastTimerRef.current);
      actionToastTimerRef.current = null;
    }
  };

  const getProductImageUrl = (product) => {
    // Check if the product has a valid image path
    if (!product.image_path || product.image_path === '') {
      // If not, use a category-specific placeholder
      return getCategoryPlaceholder(product.category);
    }
    
    // If the image path is a full URL, use it directly
    if (product.image_path.startsWith('http')) {
      return product.image_path;
    }
    
    // Otherwise, append it to the API base URL
    return `http://localhost:3001${product.image_path}`;
  };

  const getCategoryPlaceholder = (category) => {
    // Map product categories to specific placeholder images using Unsplash
    const categoryImages = {
      'Electronics': 'https://source.unsplash.com/random/800x600/?electronics',
      'Clothing': 'https://source.unsplash.com/random/800x600/?clothing',
      'Books': 'https://source.unsplash.com/random/800x600/?books',
      'Furniture': 'https://source.unsplash.com/random/800x600/?furniture',
      'Home Goods': 'https://source.unsplash.com/random/800x600/?home',
      'Kitchen': 'https://source.unsplash.com/random/800x600/?kitchen',
      'Sports': 'https://source.unsplash.com/random/800x600/?sports',
      'Hobbies': 'https://source.unsplash.com/random/800x600/?hobby',
      'Musical Instruments': 'https://source.unsplash.com/random/800x600/?music',
      'Art Supplies': 'https://source.unsplash.com/random/800x600/?art',
      'Outdoor Gear': 'https://source.unsplash.com/random/800x600/?outdoor',
      'Collectibles': 'https://source.unsplash.com/random/800x600/?collectible',
      'Accessories': 'https://source.unsplash.com/random/800x600/?accessories',
      'Bags': 'https://source.unsplash.com/random/800x600/?bag',
      'Games': 'https://source.unsplash.com/random/800x600/?games',
      'Stationery': 'https://source.unsplash.com/random/800x600/?stationery',
      'Home Decor': 'https://source.unsplash.com/random/800x600/?decor',
      'Home & Garden': 'https://source.unsplash.com/random/800x600/?garden',
      'Music': 'https://source.unsplash.com/random/800x600/?music'
    };
    
    // If category exists in our mapping, use it, otherwise use a generic product image
    return categoryImages[category] || `https://source.unsplash.com/random/800x600/?${category.toLowerCase()}` || 'https://source.unsplash.com/random/800x600/?product';
  };

  // Preload the next few product images for smoother experience
  const preloadImages = () => {
    // Preload the next 3 images if they exist
    for (let i = 1; i <= 3; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < products.length) {
        const imgUrl = getProductImageUrl(products[nextIndex]);
        if (imgUrl) {
          const img = new Image();
          img.src = imgUrl;
        }
      }
    }
  };

  // Reset image loading state when currentIndex changes
  useEffect(() => {
    setImageLoading(true);
  }, [currentIndex]);

  // Render component
  return (
    <div className="swipe-discovery-container">
      <div className="swipe-header">
        <h1>Swipe and Shop</h1>
        <p>Swipe right on items you like, left on those you don't</p>
      </div>
      
      <div className="swipe-area">
        {loading ? (
          <div className="loading">
            <p>Loading products...</p>
          </div>
        ) : error ? (
          <div className="no-more-products">
            <p>{error}</p>
            <button className="refresh-btn" onClick={fetchProducts}>
              Try Again
            </button>
          </div>
        ) : products.length === 0 || currentIndex >= products.length ? (
          <div className="no-more-products">
            <h2>No More Products</h2>
            <p>You've seen all available products for now.</p>
            <button className="refresh-btn" onClick={fetchProducts}>
              Refresh
            </button>
          </div>
        ) : (
          <>
            <div 
              className="swipe-card"
              ref={cardRef}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              onMouseMove={isDragging ? handleDragMove : null}
              onTouchMove={isDragging ? handleDragMove : null}
              onMouseUp={handleDragEnd}
              onTouchEnd={handleDragEnd}
              onMouseLeave={isDragging ? handleDragEnd : null}
            >
              <div className="swipe-indicators">
                <div className="swipe-indicator swipe-left-indicator">
                  <span className="indicator-icon">✕</span>
                  <span className="indicator-text">NOPE</span>
                </div>
                
                <div className="swipe-indicator swipe-right-indicator">
                  <span className="indicator-icon">♥</span>
                  <span className="indicator-text">LIKE</span>
                </div>
              </div>
              
              <div className="swipe-product-image">
                {imageLoading && (
                  <div className="image-loading-placeholder">
                    <div className="loading-spinner"></div>
                  </div>
                )}
                <img 
                  src={getProductImageUrl(products[currentIndex])} 
                  alt={products[currentIndex].name}
                  onLoad={() => setImageLoading(false)}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getCategoryPlaceholder(products[currentIndex].category);
                    setImageLoading(false);
                  }}
                />
              </div>
              <div className="swipe-product-details">
                <h3 className="swipe-product-title">{products[currentIndex].name}</h3>
                <p className="swipe-product-price">${parseFloat(products[currentIndex].price).toLocaleString()}</p>
                <div className="swipe-product-meta">
                  <span className="swipe-product-category">{products[currentIndex].category}</span>
                  <span className="swipe-product-condition">{products[currentIndex].condition}</span>
                </div>
              </div>
            </div>
            
            <div className="swipe-buttons">
              <button className="swipe-btn swipe-left" onClick={() => handleSwipeLeft(products[currentIndex])}>
                <i className="fas fa-times"></i>
                <span className="sr-only">Reject Item</span>
              </button>
              <button className="swipe-btn swipe-right" onClick={() => handleSwipeRight(products[currentIndex])}>
                <i className="fas fa-heart"></i>
                <span className="sr-only">Like Item</span>
              </button>
            </div>
          </>
        )}
        
        {loadingMore && <div className="loading-more">Loading more products...</div>}
      </div>
      
      {/* Replace contact modal with action toast */}
      {showActionToast && lastSwipedProduct && (
        <div 
          className={`action-toast ${showActionToast ? 'show' : ''}`}
          ref={actionToastRef}
        >
          <div className="action-toast-header">
            <h4 className="action-toast-title">Added to Cart</h4>
            <button className="dismiss-toast" onClick={dismissActionToast}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="action-toast-content">
            <span className="action-toast-product">{lastSwipedProduct.name}</span> was added to your cart.
          </div>
          <div className="action-toast-buttons">
            <button 
              className="toast-btn contact-seller-toast-btn"
              onClick={handleContactSeller}
            >
              Contact Seller
            </button>
            <button 
              className="toast-btn add-to-cart-toast-btn"
              onClick={dismissActionToast}
            >
              Continue Shopping
            </button>
          </div>
          <div className="action-toast-progress"></div>
        </div>
      )}
      
      {/* Toast notification */}
      {showToast && (
        <ToastNotification
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};

export default SwipeDiscovery; 