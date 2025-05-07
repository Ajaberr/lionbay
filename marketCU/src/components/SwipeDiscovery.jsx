import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { useCart } from '../App';
import ToastNotification from './ToastNotification';
import { buildApiUrl, API_BASE_URL } from '../config';
import '../styles/SwipeDiscovery.css';

const SwipeDiscovery = () => {
  const { authAxios, isAuthenticated, currentUser } = useAuth();
  const { updateCartCount } = useCart();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [swipedRight, setSwipedRight] = useState(() => {
    const saved = localStorage.getItem('swipedRight');
    return saved ? JSON.parse(saved) : [];
  });
  const [swipedLeft, setSwipedLeft] = useState(() => {
    const saved = localStorage.getItem('swipedLeft');
    return saved ? JSON.parse(saved) : [];
  });
  const [userPreferences, setUserPreferences] = useState({
    categories: {},
    priceRange: [0, Infinity],
    conditions: {}
  });
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

  // New state for swipe tracking
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeTimeoutRef = useRef(null);

  const [isFetching, setIsFetching] = useState(false);

  // Load products on component mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Only handle image preloading
  useEffect(() => {
    if (products.length > 0) {
      preloadImages();
    }
  }, [currentIndex, products]);

  // Update user preferences based on swipes
  const updateUserPreferences = (product, direction) => {
    setUserPreferences(prev => {
      const newPreferences = { ...prev };
      
      // Update category preferences
      if (!newPreferences.categories[product.category]) {
        newPreferences.categories[product.category] = { likes: 0, dislikes: 0 };
      }
      if (direction === 'right') {
        newPreferences.categories[product.category].likes += 1;
      } else {
        newPreferences.categories[product.category].dislikes += 1;
      }
      
      // Update price range preferences
      if (direction === 'right') {
        const currentMin = newPreferences.priceRange[0];
        const currentMax = newPreferences.priceRange[1];
        newPreferences.priceRange = [
          Math.min(currentMin, product.price),
          Math.max(currentMax, product.price)
        ];
      }
      
      // Update condition preferences
      if (!newPreferences.conditions[product.condition]) {
        newPreferences.conditions[product.condition] = { likes: 0, dislikes: 0 };
      }
      if (direction === 'right') {
        newPreferences.conditions[product.condition].likes += 1;
      } else {
        newPreferences.conditions[product.condition].dislikes += 1;
      }
      
      return newPreferences;
    });
  };

  // Score a product based on user preferences
  const scoreProduct = (product) => {
    let score = 0;
    
    // Category score
    const categoryPref = userPreferences.categories[product.category];
    if (categoryPref) {
      const totalSwipes = categoryPref.likes + categoryPref.dislikes;
      if (totalSwipes > 0) {
        score += (categoryPref.likes / totalSwipes) * 40; // Category contributes 40% to score
      }
    }
    
    // Price score
    const [minPrice, maxPrice] = userPreferences.priceRange;
    if (minPrice !== 0 && maxPrice !== Infinity) {
      const priceRange = maxPrice - minPrice;
      const pricePosition = (product.price - minPrice) / priceRange;
      // Prefer prices in the middle of the range
      score += (1 - Math.abs(pricePosition - 0.5)) * 30; // Price contributes 30% to score
    }
    
    // Condition score
    const conditionPref = userPreferences.conditions[product.condition];
    if (conditionPref) {
      const totalSwipes = conditionPref.likes + conditionPref.dislikes;
      if (totalSwipes > 0) {
        score += (conditionPref.likes / totalSwipes) * 30; // Condition contributes 30% to score
      }
    }
    
    return score;
  };

  // Sort products based on recommendation score
  const sortProductsByRecommendation = (products) => {
    return [...products].sort((a, b) => {
      const scoreA = scoreProduct(a);
      const scoreB = scoreProduct(b);
      return scoreB - scoreA; // Sort in descending order
    });
  };

  const getProductImageUrl = (product) => {
    if (!product || !product.image_path) {
      return null;
    }
    // Split by pipe symbol and get the first image URL
    const images = product.image_path.split('|').filter(img => img.trim());
    return images.length > 0 ? images[0] : product.image_path;
  };

  const fetchProducts = async (isRefresh = false) => {
    if (isFetching) return;
    
    try {
      setIsFetching(true);
      setError(null);
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || data.length === 0) {
        setError("No products available at the moment. Please check back later.");
        setLoading(false);
        setIsFetching(false);
        return;
      }
      
      // Filter out products:
      // 1. Products the user has already swiped on
      // 2. User's own products (using currentUser.userId)
      const filteredProducts = data.filter(product => {
        // Skip products user has already swiped on
        if (swipedRight.includes(product.id) || swipedLeft.includes(product.id)) {
          return false;
        }
        
        // Skip user's own products
        if (isAuthenticated && currentUser && product.seller_id === currentUser.userId) {
          console.log(`Filtering out user's own product: ${product.id}`);
          return false;
        }
        
        return true;
      });
      
      console.log(`Filtered ${data.length} products down to ${filteredProducts.length} available products`);
      
      if (filteredProducts.length === 0) {
        setError("You've already viewed all available products. Check back later for new listings!");
        setLoading(false);
        setIsFetching(false);
        return;
      }
      
      // Sort products by recommendation score
      const sortedProducts = sortProductsByRecommendation(filteredProducts);
      
      if (isRefresh) {
        // For refresh, only add completely new products
        const newProducts = sortedProducts.filter(newProduct => 
          !products.some(p => p.id === newProduct.id)
        );
        
        if (newProducts.length > 0) {
          // Preload images for new products before adding them
          newProducts.forEach(product => {
            const imgUrl = getProductImageUrl(product);
            if (imgUrl) {
              const img = new Image();
              img.src = imgUrl;
              img.onload = () => {
                console.log(`Preloaded image for new product ${product.id}: ${imgUrl}`);
              };
              img.onerror = () => {
                console.warn(`Failed to preload image for new product ${product.id}: ${imgUrl}`);
                // If image fails to load, update the product to use a placeholder
                product.image_path = null;
              };
            }
          });
          
          setProducts(prevProducts => [...prevProducts, ...newProducts]);
        }
      } else {
        // For initial load, set all products
        setProducts(sortedProducts);
        setCurrentIndex(0);
      }
      
      setLoading(false);
      setIsFetching(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products. Please try again later.');
      setLoading(false);
      setIsFetching(false);
    }
  };

  const handleSwipeLeft = (product) => {
    if (!product || isSwiping) return;
    
    setIsSwiping(true);
    updateUserPreferences(product, 'left');
    
    if (cardRef.current) {
      const direction = -1;
      const flyAwayDistance = direction * window.innerWidth * 1.5;
      const rotate = direction * 30; // Reduced rotation for more natural feel
      
      // Enhanced animation with better easing and scaling
      cardRef.current.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      cardRef.current.style.transform = `translateX(${flyAwayDistance}px) rotate(${rotate}deg) scale(0.85)`;
      cardRef.current.style.opacity = '0';
      
      // Smooth indicator fade
      const rightIndicator = document.querySelector('.swipe-right-indicator');
      const leftIndicator = document.querySelector('.swipe-left-indicator');
      if (rightIndicator) {
        rightIndicator.style.transition = 'opacity 0.3s ease';
        rightIndicator.style.opacity = '0';
      }
      if (leftIndicator) {
        leftIndicator.style.transition = 'opacity 0.3s ease';
        leftIndicator.style.opacity = '0';
      }
      
      // Handle the swipe after animation
      setTimeout(() => {
        setSwipedLeft(prev => {
          const newSwipedLeft = [...prev, product.id];
          localStorage.setItem('swipedLeft', JSON.stringify(newSwipedLeft));
          return newSwipedLeft;
        });
        
        setCurrentIndex(prev => prev + 1);
        setIsSwiping(false);
        
        // Reset card with smooth transition
        if (cardRef.current) {
          cardRef.current.style.transition = 'all 0.3s ease';
          cardRef.current.style.transform = '';
          cardRef.current.style.opacity = '1';
          cardRef.current.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.1), 0 3px 10px rgba(0, 0, 0, 0.05)';
          cardRef.current.style.border = 'none';
        }
      }, 600);
    }
  };

  const handleSwipeRight = async (product) => {
    if (!product || isSwiping) return;
    
    setIsSwiping(true);
    updateUserPreferences(product, 'right');
    
    if (cardRef.current) {
      const direction = 1;
      const flyAwayDistance = direction * window.innerWidth * 1.5;
      const rotate = direction * 30; // Reduced rotation for more natural feel
      
      // Enhanced animation with better easing and scaling
      cardRef.current.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      cardRef.current.style.transform = `translateX(${flyAwayDistance}px) rotate(${rotate}deg) scale(0.85)`;
      cardRef.current.style.opacity = '0';
      
      // Smooth indicator fade
      const rightIndicator = document.querySelector('.swipe-right-indicator');
      const leftIndicator = document.querySelector('.swipe-left-indicator');
      if (rightIndicator) {
        rightIndicator.style.transition = 'opacity 0.3s ease';
        rightIndicator.style.opacity = '0';
      }
      if (leftIndicator) {
        leftIndicator.style.transition = 'opacity 0.3s ease';
        leftIndicator.style.opacity = '0';
      }
      
      // Handle the swipe after animation
      setTimeout(async () => {
        try {
          // Add product to cart
          const cartResponse = await fetch(`${API_BASE_URL}/cart`, {
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

          if (!cartResponse.ok) {
            throw new Error(`HTTP error! Status: ${cartResponse.status}`);
          }

          // Update cart count
          if (updateCartCount) {
            updateCartCount();
          }

          setSwipedRight(prev => {
            const newSwipedRight = [...prev, product.id];
            localStorage.setItem('swipedRight', JSON.stringify(newSwipedRight));
            return newSwipedRight;
          });
          setLastSwipedProduct(product);
          setShowActionToast(true);
          
          setCurrentIndex(prev => prev + 1);
          setIsSwiping(false);
          
          // Reset card with smooth transition
          if (cardRef.current) {
            cardRef.current.style.transition = 'all 0.3s ease';
            cardRef.current.style.transform = '';
            cardRef.current.style.opacity = '1';
            cardRef.current.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.1), 0 3px 10px rgba(0, 0, 0, 0.05)';
            cardRef.current.style.border = 'none';
          }
        } catch (err) {
          console.error('Error adding to cart:', err);
          setToastMessage('Failed to add product to cart. Please try again.');
          setToastType('error');
          setShowToast(true);
          setIsSwiping(false);
        }
      }, 600);
    }
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
    
    if (Math.abs(currentX) > swipeThreshold && !isSwiping) {
      if (cardRef.current) {
        const direction = currentX > 0 ? 1 : -1;
        const flyAwayDistance = direction * window.innerWidth * 1.5;
        const rotate = direction * 30; // Reduced rotation for more natural feel
        
        // Enhanced animation with better easing and scaling
        cardRef.current.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        cardRef.current.style.transform = `translateX(${flyAwayDistance}px) rotate(${rotate}deg) scale(0.85)`;
        cardRef.current.style.opacity = '0';
        
        // Smooth indicator fade
        const rightIndicator = document.querySelector('.swipe-right-indicator');
        const leftIndicator = document.querySelector('.swipe-left-indicator');
        if (rightIndicator) {
          rightIndicator.style.transition = 'opacity 0.3s ease';
          rightIndicator.style.opacity = '0';
        }
        if (leftIndicator) {
          leftIndicator.style.transition = 'opacity 0.3s ease';
          leftIndicator.style.opacity = '0';
        }
        
        // Handle the swipe after animation
        setTimeout(() => {
          if (currentX > 0) {
            handleSwipeRight(products[currentIndex]);
          } else {
            handleSwipeLeft(products[currentIndex]);
          }
          setCurrentX(0);
        }, 300);
      }
    } else {
      // Not swiped far enough, return to center with smooth animation
      if (cardRef.current) {
        cardRef.current.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
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
      
      // Smooth indicator fade
      const rightIndicator = document.querySelector('.swipe-right-indicator');
      const leftIndicator = document.querySelector('.swipe-left-indicator');
      if (rightIndicator) {
        rightIndicator.style.transition = 'opacity 0.3s ease';
        rightIndicator.style.opacity = '0';
      }
      if (leftIndicator) {
        leftIndicator.style.transition = 'opacity 0.3s ease';
        leftIndicator.style.opacity = '0';
      }
    }
  };
  
  const handleContactSeller = async () => {
    if (!isAuthenticated) {
      return; // This will be handled by protectedAction
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
      const chatApiUrl = buildApiUrl('/chats');
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
      const cartApiUrl = buildApiUrl('/cart');
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
        const updateCartUrl = buildApiUrl(`/cart/${cartItem.id}`);
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

  const getCategoryPlaceholder = (category) => {
    // Map product categories to specific background colors
    const categoryColors = {
      'Electronics': '#e6f3ff',
      'Clothing': '#ffe6e6',
      'Books': '#f0e6ff',
      'Furniture': '#e6ffe6',
      'Home Goods': '#fff0e6',
      'Kitchen': '#ffe6f3',
      'Sports': '#e6fff0',
      'Hobbies': '#f3ffe6',
      'Musical Instruments': '#e6e6ff',
      'Art Supplies': '#ffe6ff',
      'Outdoor Gear': '#e6fff3',
      'Collectibles': '#fff3e6',
      'Accessories': '#f3e6ff',
      'Bags': '#e6ffec',
      'Games': '#ffe6ec',
      'Stationery': '#e6f0ff',
      'Home Decor': '#ffe6e0',
      'Home & Garden': '#e0ffe6',
      'Music': '#e6e0ff'
    };
    
    // If category exists in our mapping, use it, otherwise use a default color
    return categoryColors[category] || '#f3f4f6';
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
          img.onload = () => {
            console.log(`Preloaded image for product ${products[nextIndex].id}`);
          };
          img.onerror = () => {
            console.warn(`Failed to preload image for product ${products[nextIndex].id}`);
          };
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
        <div className="swipe-header-buttons">
          <button 
            className="refresh-btn" 
            onClick={() => {
              if (!isFetching) {
                fetchProducts(true);
              }
            }}
            disabled={isFetching}
          >
            {isFetching ? 'Refreshing...' : 'Refresh Products'}
          </button>
          <button 
            className="reset-btn" 
            onClick={() => {
              // Clear localStorage items
              localStorage.removeItem('swipedLeft');
              localStorage.removeItem('swipedRight');
              // Reset state
              setSwipedLeft([]);
              setSwipedRight([]);
              // Fetch products
              fetchProducts();
            }}
          >
            Reset Swipe History
          </button>
        </div>
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
                {getProductImageUrl(products[currentIndex]) ? (
                  <img 
                    src={getProductImageUrl(products[currentIndex])}
                    alt={products[currentIndex].name}
                    onLoad={() => setImageLoading(false)}
                    onError={() => setImageLoading(false)}
                  />
                ) : (
                  <div 
                    className="no-image-placeholder"
                    style={{ '--category-color': getCategoryPlaceholder(products[currentIndex].category) }}
                  >
                    <i className="fas fa-image"></i>
                    <span>No Image Available</span>
                  </div>
                )}
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