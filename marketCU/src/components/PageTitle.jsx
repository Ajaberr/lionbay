import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

// API Base URL is now imported from config file
// This will use the updated domain automatically

const PageTitle = () => {
  const location = useLocation();
  const [productName, setProductName] = useState(null);
  
  // Fetch product name for product detail pages
  useEffect(() => {
    const getProductName = async () => {
      if (location.pathname.startsWith('/market/')) {
        try {
          const productId = location.pathname.split('/')[2];
          const response = await axios.get(`${API_BASE_URL}/products/${productId}`);
          if (response.data && response.data.name) {
            setProductName(response.data.name);
          }
        } catch (error) {
          console.error('Error fetching product name for title:', error);
        }
      }
    };
    
    getProductName();
  }, [location.pathname]);
  
  useEffect(() => {
    // Set the base title
    let title = 'Lion Bay';
    
    // Add page-specific titles based on the current route
    switch (true) {
      case location.pathname === '/':
        title = 'Login | Lion Bay';
        break;
      case location.pathname === '/home':
        title = 'Home | Lion Bay';
        break;
      case location.pathname === '/market':
        title = 'Buy Stuff | Lion Bay';
        break;
      case location.pathname === '/create-product':
        title = 'Sell Your Stuff | Lion Bay';
        break;
      case location.pathname === '/chats':
        title = 'Messages | Lion Bay';
        break;
      case location.pathname.startsWith('/chats/'):
        title = 'Chat | Lion Bay';
        break;
      case location.pathname.startsWith('/market/'):
        title = productName ? `${productName} | Lion Bay` : 'Product Details | Lion Bay';
        break;
      case location.pathname === '/admin':
        title = 'Admin Zone | Lion Bay';
        break;
      default:
        title = 'Lion Bay';
    }
    
    // Update the document title
    document.title = title;
  }, [location, productName]);
  
  // This component doesn't render anything
  return null;
};

export default PageTitle; 