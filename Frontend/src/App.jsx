import { useEffect, useState, useRef } from 'react';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5020';

function App() {
  const [cakes, setCakes] = useState([]);
  const [fullyBookedDates, setFullyBookedDates] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState('storefront');
  const [adminTab, setAdminTab] = useState('dashboard'); // 'dashboard' | 'cakes' | 'orders'
  const [activeTooltip, setActiveTooltip] = useState(null); // for charts

  // --- Auth State ---
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('admin_token') || null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // --- Cart State ---
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cake_cart') || '[]'); } catch { return []; }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartCheckout, setIsCartCheckout] = useState(false);
  const [addedToCartId, setAddedToCartId] = useState(null);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.cake.price) * item.quantity), 0);

  // --- Suggestions State ---
  const [suggestionName, setSuggestionName] = useState('');
  const [suggestionEmail, setSuggestionEmail] = useState('');
  const [suggestionContent, setSuggestionContent] = useState('');
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [suggestionSuccess, setSuggestionSuccess] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionFormOpen, setIsSuggestionFormOpen] = useState(false);

  // Helper: fetch with admin Bearer token
  const authFetch = (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'Authorization': `Bearer ${adminToken}`
      }
    });
  };

  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginForm.username, password: loginForm.password })
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('admin_token', data.token);
        setAdminToken(data.token);
        setIsLoginModalOpen(false);
        setLoginForm({ username: '', password: '' });
        setViewMode('admin');
        fetchOrders();
        fetchSuggestions();
      } else {
        setLoginError('Invalid username or password. Please try again.');
      }
    } catch {
      setLoginError('Network error. Could not reach the server.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    setAdminToken(null);
    setViewMode('storefront');
  };

  const openAdminPortal = () => {
    if (adminToken) {
      setViewMode('admin');
      fetchOrders();
      fetchSuggestions();
    } else {
      setLoginError('');
      setLoginForm({ username: '', password: '' });
      setIsLoginModalOpen(true);
    }
  };

  // --- Cart Functions ---
  const addToCart = (cake) => {
    setCart(prev => {
      const existing = prev.find(item => item.cake.id === cake.id);
      const updated = existing
        ? prev.map(item => item.cake.id === cake.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...prev, { cake, quantity: 1 }];
      try { localStorage.setItem('cake_cart', JSON.stringify(updated)); } catch {}
      return updated;
    });
    setAddedToCartId(cake.id);
    setTimeout(() => setAddedToCartId(null), 1500);
  };

  const removeFromCart = (cakeId) => {
    setCart(prev => {
      const updated = prev.filter(item => item.cake.id !== cakeId);
      try { localStorage.setItem('cake_cart', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const updateCartQty = (cakeId, qty) => {
    if (qty < 1) { removeFromCart(cakeId); return; }
    setCart(prev => {
      const updated = prev.map(item => item.cake.id === cakeId ? { ...item, quantity: qty } : item);
      try { localStorage.setItem('cake_cart', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const clearCart = () => {
    setCart([]);
    try { localStorage.removeItem('cake_cart'); } catch {}
  };

  const openCartCheckout = () => {
    setIsCartOpen(false);
    setIsCartCheckout(true);
    setOrderingCake(null);
    setOrderForm({ customerName: '', customerEmail: '', customerPhone: '', isWhatsApp: false, fulfillmentDate: '', deliveryMethod: 'Collection', deliveryAddress: '', customDescription: '' });
    setIsOrderModalOpen(true);
  };

  // --- Admin Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '', price: '', description: '', categoryId: 1, image: null, imagePreviewUrl: '' 
  });

  // --- Order Modal State ---
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderingCake, setOrderingCake] = useState(null);
  const [orderForm, setOrderForm] = useState({
      customerName: '', customerEmail: '', customerPhone: '', isWhatsApp: false,
      fulfillmentDate: '', deliveryMethod: 'Collection', deliveryAddress: '', customDescription: ''
  });

  // --- Track Modal State ---
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [trackOrderId, setTrackOrderId] = useState('');
  const [trackResult, setTrackResult] = useState(null);
  const [trackError, setTrackError] = useState('');

  // --- Contact Modal State ---
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const fetchCakes = () => {
    fetch(`${API_BASE_URL}/api/cakes`)
      .then(res => res.json())
      .then(data => {
        setCakes(data.length === 0 ? [] : data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Backend error:", err);
        setLoading(false);
      });
  };

  const fetchBookedDates = () => {
      fetch(`${API_BASE_URL}/api/orders/booked-dates`)
      .then(res => res.json())
      .then(data => setFullyBookedDates(data))
      .catch(err => console.error(err));
  };

  const fetchOrders = () => {
      authFetch(`${API_BASE_URL}/api/orders`)
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(err => console.error(err));
  };

  const fetchSuggestions = () => {
      authFetch(`${API_BASE_URL}/api/suggestions`)
      .then(res => res.json())
      .then(data => setSuggestions(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchCakes();
    fetchBookedDates();
    if (adminToken) {
      fetchOrders();
      fetchSuggestions();
    }
  }, [adminToken]);

  // --------------- ADMIN LOGIC ---------------
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData({ ...formData, image: file, imagePreviewUrl: URL.createObjectURL(file) });
    }
  };

  const openAddModal = (categoryId = 1) => {
    setEditingId(null);
    setFormData({ name: '', price: '', description: '', categoryId: categoryId, image: null, imagePreviewUrl: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (cake) => {
    setEditingId(cake.id);
    setFormData({
      name: cake.name, price: cake.price || '', description: cake.description || '',
      categoryId: cake.categoryId || 1, image: null,
      imagePreviewUrl: cake.imageUrl ? `${API_BASE_URL}${cake.imageUrl}` : ''
    });
    setIsModalOpen(true);
  };

  const closeAndResetModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '', price: '', description: '', categoryId: 1, image: null, imagePreviewUrl: '' });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteCake = async (id) => {
    if (window.confirm("Are you sure you want to permanently delete this cake?")) {
      try {
        const response = await authFetch(`${API_BASE_URL}/api/cakes/${id}`, { method: 'DELETE' });
        if (response.ok) {
          setCakes(cakes.filter(cake => cake.id !== id));
        } else alert("Failed to delete cake.");
      } catch (err) {
        alert("Network error.");
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const uploadData = new FormData();
    uploadData.append("name", formData.name);
    uploadData.append("price", formData.price || 0);
    uploadData.append("description", formData.description);
    uploadData.append("categoryId", formData.categoryId);
    if (formData.image) uploadData.append("image", formData.image);

    try {
      const isEditing = editingId !== null;
      const url = isEditing ? `${API_BASE_URL}/api/cakes/${editingId}` : `${API_BASE_URL}/api/cakes`;
      const response = await authFetch(url, { method: isEditing ? 'PUT' : 'POST', body: uploadData });

      if (response.ok) {
        fetchCakes(); 
        closeAndResetModal();
      } else alert("Failed to save cake.");
    } catch (err) {
      alert("Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
      try {
          const res = await authFetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
          });
          if (res.ok) {
              setOrders(orders.map(o => {
                  if (o.id === orderId) {
                      const updatedItems = o.orderItems.map(oi => ({ ...oi, status: newStatus }));
                      return { ...o, status: newStatus, orderItems: updatedItems };
                  }
                  return o;
              }));
          } else {
              alert("Failed to update status");
          }
      } catch {
          alert("Network Error");
      }
  };

  const handleItemStatusChange = async (orderId, itemId, newStatus) => {
      try {
          const res = await authFetch(`${API_BASE_URL}/api/orders/${orderId}/items/${itemId}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
          });
          if (res.ok) {
              setOrders(orders.map(o => {
                  if (o.id === orderId) {
                      const updatedItems = o.orderItems.map(oi => 
                          oi.id === itemId ? { ...oi, status: newStatus } : oi
                      );
                      
                      let computedOrderStatus = o.status;
                      const allCompleted = updatedItems.every(oi => oi.status === 'Completed');
                      const allPending = updatedItems.every(oi => oi.status === 'Order Received');
                      
                      if (allCompleted) {
                          computedOrderStatus = 'Completed';
                      } else if (allPending) {
                          computedOrderStatus = 'Order Received';
                      } else {
                          computedOrderStatus = 'Baking';
                      }

                      if (computedOrderStatus !== o.status) {
                          authFetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: computedOrderStatus })
                          }).catch(err => console.error("Failed to sync overall status", err));
                      }

                      return { ...o, orderItems: updatedItems, status: computedOrderStatus };
                  }
                  return o;
              }));
          } else {
              alert("Failed to update item status");
          }
      } catch {
          alert("Network Error");
      }
  };


  const handleResponseChange = async (orderId, adminResponse) => {
      try {
          const res = await authFetch(`${API_BASE_URL}/api/orders/${orderId}/response`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ response: adminResponse })
          });
          if (res.ok) {
              setOrders(orders.map(o => o.id === orderId ? { ...o, adminResponse } : o));
          } else {
              alert("Failed to save response");
          }
      } catch {
          alert("Network Error");
      }
  };

  const handleSuggestionSubmit = async (e) => {
    e.preventDefault();
    if (!suggestionName.trim() || !suggestionContent.trim()) return;
    setIsSubmittingSuggestion(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: suggestionName,
          customerEmail: suggestionEmail || null,
          content: suggestionContent
        })
      });
      if (res.ok) {
        setSuggestionSuccess(true);
        setSuggestionName('');
        setSuggestionEmail('');
        setSuggestionContent('');
        setTimeout(() => setSuggestionSuccess(false), 5000);
      } else {
        alert("Failed to submit suggestion. Please try again.");
      }
    } catch {
      alert("Network Error. Please try again.");
    } finally {
      setIsSubmittingSuggestion(false);
    }
  };

  const handleDeleteSuggestion = async (id) => {
    if (!window.confirm("Are you sure you want to dismiss this customer feedback?")) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/suggestions/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSuggestions(suggestions.filter(s => s.id !== id));
      } else {
        alert("Failed to delete suggestion.");
      }
    } catch {
      alert("Network Error");
    }
  };

  // --------------- ORDER TRACKING ---------------
  const handleTrackOrder = async (e) => {
    e.preventDefault();
    setTrackError('');
    setTrackResult(null);
    try {
        const res = await fetch(`${API_BASE_URL}/api/orders/${trackOrderId}`);
        if (res.ok) {
            const data = await res.json();
            setTrackResult(data);
        } else {
            setTrackError("Order not found! Please verify your Order ID.");
        }
    } catch (err) {
        setTrackError("Network error checking order. Backend may be offline.");
    }
  };


  // --------------- ORDER PLACEMENT ---------------
  const openOrderModal = (cake) => {
      setOrderingCake(cake);
      setOrderForm({ customerName: '', customerEmail: '', customerPhone: '', isWhatsApp: false, fulfillmentDate: '', deliveryMethod: 'Collection', deliveryAddress: '', customDescription: '' });
      setIsOrderModalOpen(true);
  };

  const openCustomOrderModal = () => {
      setOrderingCake({ id: 0, name: 'Custom Cake Request', price: 0 });
      setOrderForm({ customerName: '', customerEmail: '', customerPhone: '', isWhatsApp: false, fulfillmentDate: '', deliveryMethod: 'Collection', deliveryAddress: '', customDescription: '' });
      setIsOrderModalOpen(true);
  };

  const handleOrderChange = (e) => {
    const { name, value, type, checked } = e.target;
    setOrderForm({ ...orderForm, [name]: type === 'checkbox' ? checked : value });
  };

  const handleDateChange = (e) => {
      const selectedDate = e.target.value;
      if (fullyBookedDates.includes(selectedDate)) {
          alert('Sorry! We are fully booked on this date. Please choose another date to avoid delays.');
          setOrderForm({ ...orderForm, fulfillmentDate: '' });
      } else {
          setOrderForm({ ...orderForm, fulfillmentDate: selectedDate });
      }
  };

  const submitOrder = async (e) => {
      e.preventDefault();
      setIsSubmitting(true);
      
      try {
          const body = isCartCheckout
            ? {
                customerName: orderForm.customerName,
                customerEmail: orderForm.customerEmail,
                customerPhone: orderForm.customerPhone,
                isWhatsApp: orderForm.isWhatsApp,
                items: cart.map(item => ({ cakeId: item.cake.id, quantity: item.quantity })),
                fulfillmentDate: orderForm.fulfillmentDate,
                deliveryMethod: orderForm.deliveryMethod,
                deliveryAddress: orderForm.deliveryAddress
              }
            : {
                customerName: orderForm.customerName,
                customerEmail: orderForm.customerEmail,
                customerPhone: orderForm.customerPhone,
                isWhatsApp: orderForm.isWhatsApp,
                cakeId: orderingCake.id,
                customDescription: orderForm.customDescription,
                quantity: 1,
                fulfillmentDate: orderForm.fulfillmentDate,
                deliveryMethod: orderForm.deliveryMethod,
                deliveryAddress: orderForm.deliveryAddress
              };

          const res = await fetch(`${API_BASE_URL}/api/orders/place`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });

          if (res.ok) {
              const resultingOrder = await res.json();
              alert(`Success! We've received your order.\n\nIMPORTANT: Your tracking Order ID is: #${resultingOrder.id}`);
              setIsOrderModalOpen(false);
              if (isCartCheckout) { clearCart(); setIsCartCheckout(false); }
              fetchBookedDates();
              fetchOrders();
          } else {
              alert("Server rejected order. Please check inputs.");
          }
      } catch (err) {
          alert("Network error. Backend might be down.");
      } finally {
          setIsSubmitting(false);
      }
  };

  // --------------- RENDERS ---------------
  const renderStorefront = () => (
    <main>
      <section className="hero" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '3.8rem', marginBottom: '16px' }}>
          Taste the <span className="text-accent">Extraordinary</span>
        </h1>
        <p className="text-muted" style={{ fontSize: '1.2rem', maxWidth: '650px', margin: '0 auto', lineHeight: '1.6' }}>
          Handcrafted, beautifully designed cakes delivered straight to your door. Browse our signature collection and find your perfect slice.
        </p>
      </section>

      <section style={{ marginTop: '72px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '48px', fontSize: '2rem' }}>Shop our <span className="text-accent">Collection</span></h2>

        {loading ? (
          <p className="text-muted" style={{ textAlign: 'center' }}>Loading fresh cakes...</p>
        ) : (
          <div className="card-grid">
            {cakes.map(cake => (
              <div key={cake.id} className="cake-item">
                <div className="cake-liquid-img" style={{ 
                    backgroundImage: cake.imageUrl ? `url(${API_BASE_URL}${cake.imageUrl})` : 'none',
                    animationDelay: `-${(cake.id || 1) * 1.3}s`
                  }}>
                  {!cake.imageUrl && <div className="no-img-icon">🍰</div>}
                </div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', fontWeight: '600' }}>{cake.name}</h3>
                <div className="price-tag" style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>K{parseFloat(cake.price).toFixed(2)}</div>
                <p className="text-muted" style={{ fontSize: '0.9rem', margin: '0 0 20px 0', lineHeight: '1.5', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}>
                  {cake.description}
                </p>
                <div style={{ textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn-primary"
                      style={{ padding: '12px 28px', fontSize: '0.95rem', borderRadius: '4px', minWidth: '140px', transition: 'all 0.2s', background: addedToCartId === cake.id ? '#25a86e' : undefined }}
                      onClick={() => addToCart(cake)}
                    >
                      {addedToCartId === cake.id ? '✓ Added!' : '🛒 Add to Cart'}
                    </button>
                    <button className="btn-secondary" style={{ padding: '12px 20px', fontSize: '0.95rem', borderRadius: '4px' }} onClick={() => openOrderModal(cake)}>
                      Order Now
                    </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '80px', padding: '48px', background: 'rgba(201, 156, 110, 0.1)', borderRadius: '16px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '16px' }}>Need Something <span className="text-accent">Unique?</span></h2>
            <p className="text-muted" style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 32px auto', lineHeight: '1.6' }}>
                Have a specific design, flavor, or theme in mind? Our master bakers can bring your wildest cake dreams to life. Describe what you're looking for, and we'll craft a custom masterpiece for you.
            </p>
            <button className="btn-primary" style={{ padding: '16px 40px', fontSize: '1.1rem' }} onClick={openCustomOrderModal}>
                Request Custom Cake
            </button>
        </div>

        {/* Suggestion Box Section */}
        <div style={{ 
          marginTop: '64px', 
          background: 'rgba(255, 255, 255, 0.65)', 
          border: '1px solid var(--glass-border)', 
          boxShadow: 'var(--glass-shadow)', 
          borderRadius: '16px', 
          padding: '40px',
          backdropFilter: 'blur(10px)',
          textAlign: 'left'
        }}>
          <div style={{ textAlign: 'center', marginBottom: isSuggestionFormOpen ? '16px' : '0' }}>
            <h2 style={{ fontSize: '1.85rem', marginBottom: '8px' }}>Got a <span className="text-accent">Suggestion?</span></h2>
            <p className="text-muted" style={{ fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto', lineHeight: '1.5' }}>
              We'd love to hear your thoughts! Tell us what flavors, designs, or improvements you want to see.
            </p>
            
            {!isSuggestionFormOpen && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                <div 
                  className="jumping-icon-container" 
                  onClick={() => setIsSuggestionFormOpen(true)}
                >
                  <span className="jumping-icon">📥</span>
                  <span className="jumping-text">Click to Suggest</span>
                </div>
              </div>
            )}
          </div>

          {isSuggestionFormOpen && (
            <div style={{ animation: 'fadeIn 0.3s ease-out', marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button 
                  type="button"
                  className="btn-secondary" 
                  onClick={() => setIsSuggestionFormOpen(false)}
                  style={{ padding: '6px 16px', fontSize: '0.8rem', borderRadius: '6px' }}
                >
                  ✕ Close Form
                </button>
              </div>

              {suggestionSuccess ? (
                <div style={{ 
                  background: 'rgba(37, 211, 102, 0.08)', 
                  border: '1px solid rgba(37, 211, 102, 0.3)', 
                  borderRadius: '12px', 
                  padding: '24px', 
                  color: '#25D366', 
                  textAlign: 'center',
                  fontWeight: '500',
                  animation: 'fadeIn 0.3s ease-out'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>💖</div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.15rem' }}>Thank you for your feedback!</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>Your suggestion has been received. Our bakers appreciate your ideas!</p>
                </div>
              ) : (
                <form onSubmit={handleSuggestionSubmit} style={{ maxWidth: '560px', margin: '0 auto' }}>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                      <label>Your Name <span style={{ color: '#e06c6c' }}>*</span></label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Enter your name" 
                        value={suggestionName} 
                        onChange={e => setSuggestionName(e.target.value)} 
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                      <label>Email Address <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.8rem' }}>(Optional)</span></label>
                      <input 
                        type="email" 
                        placeholder="Enter your email" 
                        value={suggestionEmail} 
                        onChange={e => setSuggestionEmail(e.target.value)} 
                      />
                    </div>
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '24px', marginTop: '16px' }}>
                    <label>Your Suggestion <span style={{ color: '#e06c6c' }}>*</span></label>
                    <textarea 
                      required 
                      placeholder="Tell us what's on your mind (e.g. flavor ideas, layout improvements)..." 
                      value={suggestionContent} 
                      onChange={e => setSuggestionContent(e.target.value)}
                      style={{ minHeight: '100px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button type="submit" className="btn-primary" disabled={isSubmittingSuggestion} style={{ padding: '12px 36px', fontSize: '0.95rem' }}>
                      {isSubmittingSuggestion ? 'Submitting...' : '✉️ Send Suggestion'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

      </section>
    </main>
  );

  const getTabStyle = (tabName) => ({
      padding: '8px 24px',
      fontSize: '0.95rem',
      background: adminTab === tabName ? 'var(--accent-color)' : 'transparent',
      color: adminTab === tabName ? 'white' : 'var(--accent-color)',
      borderColor: 'var(--accent-color)',
      cursor: 'pointer',
      borderRadius: '8px',
      border: '1px solid',
  });

  const renderDashboard = () => {
    // Calculations
    const totalOrdersCount = orders.length;
    const completedOrdersCount = orders.filter(o => o.status === 'Completed').length;
    const activeOrdersCount = orders.filter(o => o.status === 'Order Received' || o.status === 'Payment Confirmed' || o.status === 'Baking').length;
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);
    const totalCakesSold = orders.reduce((sum, o) => 
      sum + o.orderItems.reduce((oiSum, oi) => oiSum + (oi.quantity || 0), 0)
    , 0);
    
    const fulfillmentRate = totalOrdersCount > 0 
      ? Math.round((completedOrdersCount / totalOrdersCount) * 100) 
      : 0;

    const hasRealData = totalOrdersCount > 0;

    // Process Daily Revenue
    const dailyRevenueMap = {};
    orders.forEach(o => {
      const dateStr = new Date(o.orderDate || o.fulfillmentDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      dailyRevenueMap[dateStr] = (dailyRevenueMap[dateStr] || 0) + parseFloat(o.totalAmount || 0);
    });

    const sortedDates = [];
    orders.forEach(o => {
      const dateStr = new Date(o.orderDate || o.fulfillmentDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (!sortedDates.includes(dateStr)) {
        sortedDates.push(dateStr);
      }
    });

    // Last 7 days
    const chartDates = sortedDates.slice(-7);
    let revenueData = chartDates.map(date => ({
      date,
      amount: dailyRevenueMap[date] || 0
    }));

    if (!hasRealData) {
      revenueData = [
        { date: 'May 30', amount: 120 },
        { date: 'May 31', amount: 350 },
        { date: 'Jun 1', amount: 240 },
        { date: 'Jun 2', amount: 480 },
        { date: 'Jun 3', amount: 310 },
        { date: 'Jun 4', amount: 620 },
        { date: 'Jun 5', amount: 450 }
      ];
    }

    // Process Cake Popularity
    const popularityMap = {};
    orders.forEach(o => {
      o.orderItems.forEach(oi => {
        const name = oi.cake?.name || 'Unknown';
        popularityMap[name] = (popularityMap[name] || 0) + (oi.quantity || 0);
      });
    });

    let popularityData = Object.entries(popularityMap).map(([name, qty]) => ({ name, qty }));
    popularityData.sort((a, b) => b.qty - a.qty);
    popularityData = popularityData.slice(0, 5);

    if (!hasRealData) {
      popularityData = [
        { name: 'Chocolate Fudge Cake', qty: 15 },
        { name: 'Red Velvet Cake', qty: 12 },
        { name: 'Vanilla Caramel Drizzle', qty: 9 },
        { name: 'Signature Cookies', qty: 8 },
        { name: 'Custom Cake Request', qty: 5 }
      ];
    }

    // Delivery vs Collection Donut Chart Math
    let deliveryCount = orders.filter(o => o.deliveryMethod === 'Delivery').length;
    let collectionCount = orders.filter(o => o.deliveryMethod === 'Collection').length;

    if (!hasRealData) {
      deliveryCount = 18;
      collectionCount = 27;
    }

    const totalSplit = deliveryCount + collectionCount;
    const collectionPct = totalSplit > 0 ? Math.round((collectionCount / totalSplit) * 100) : 0;
    const deliveryPct = totalSplit > 0 ? Math.round((deliveryCount / totalSplit) * 100) : 0;

    const radius = 60;
    const circumference = 2 * Math.PI * radius; // ~377
    const collectionStrokeLength = totalSplit > 0 ? (collectionCount / totalSplit) * circumference : 0;
    const deliveryStrokeLength = totalSplit > 0 ? (deliveryCount / totalSplit) * circumference : 0;

    // Fulfillment breakdown
    let pendingCount = orders.filter(o => o.status === 'Order Received').length;
    let paymentCount = orders.filter(o => o.status === 'Payment Confirmed').length;
    let bakingCount = orders.filter(o => o.status === 'Baking').length;
    let completedCount = orders.filter(o => o.status === 'Completed').length;

    if (!hasRealData) {
      pendingCount = 5;
      paymentCount = 2;
      bakingCount = 10;
      completedCount = 30;
    }
    const totalStatusCount = pendingCount + paymentCount + bakingCount + completedCount;

    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
        {!hasRealData && (
          <div style={{
            background: 'rgba(201, 156, 110, 0.1)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            padding: '16px 24px',
            marginBottom: '32px',
            color: 'var(--text-main)',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontWeight: '500'
          }}>
            <span>💡</span>
            <span><strong>Viewing Demo Analytics</strong>: There are currently no placed orders. Here is a simulated view of your bakery's growth path!</span>
          </div>
        )}

        {/* 1. KPI Cards */}
        <div className="dashboard-metrics-grid">
          <div className="glass-panel kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Gross Sales</span>
              <span className="kpi-card-icon">💰</span>
            </div>
            <div className="kpi-card-value">K{totalRevenue.toFixed(2)}</div>
            <div className="kpi-card-subtitle">
              <span className="kpi-trend-badge up">↑ 12%</span>
              <span>vs last month</span>
            </div>
          </div>

          <div className="glass-panel kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Active Orders</span>
              <span className="kpi-card-icon">⚡</span>
            </div>
            <div className="kpi-card-value">{activeOrdersCount}</div>
            <div className="kpi-card-subtitle">
              <span>Currently baking or pending</span>
            </div>
          </div>

          <div className="glass-panel kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Cakes Sold</span>
              <span className="kpi-card-icon">🎂</span>
            </div>
            <div className="kpi-card-value">{totalCakesSold}</div>
            <div className="kpi-card-subtitle">
              <span className="kpi-trend-badge up">↑ 8%</span>
              <span>this week</span>
            </div>
          </div>

          <div className="glass-panel kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Fulfillment Rate</span>
              <span className="kpi-card-icon">✓</span>
            </div>
            <div className="kpi-card-value">{fulfillmentRate}%</div>
            <div className="kpi-card-subtitle">
              <span>Completed orders ratio</span>
            </div>
          </div>
        </div>

        {/* 2. Charts Grid */}
        <div className="dashboard-charts-grid">
          {/* Revenue Area/Line Chart */}
          <div className="glass-panel chart-panel">
            <div className="chart-header">
              <h3 className="chart-title">Revenue Trend</h3>
              <div className="chart-legend">
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: 'var(--accent-color)' }}></span>
                  <span>Daily Sales (K)</span>
                </div>
              </div>
            </div>

            <div className="chart-svg-container" style={{ height: '220px' }}>
              {/* Tooltip Overlay */}
              {activeTooltip && (
                <div 
                  className="chart-tooltip" 
                  style={{ 
                    left: `${activeTooltip.x - 50}px`, 
                    top: `${activeTooltip.y - 65}px`, 
                    opacity: 1 
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>{activeTooltip.date}</span>
                  <span style={{ color: 'var(--accent-color)' }}>K{activeTooltip.amount.toFixed(2)}</span>
                </div>
              )}

              <svg viewBox="0 0 500 200" width="100%" height="100%" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                  const maxRevenue = Math.max(...revenueData.map(d => d.amount), 100);
                  const val = maxRevenue * pct;
                  const y = 170 - pct * 150;
                  return (
                    <g key={idx}>
                      <line x1="40" y1={y} x2="480" y2={y} stroke="rgba(201,156,110,0.15)" strokeDasharray="4 4" />
                      <text x="35" y={y + 4} textAnchor="end" style={{ fontSize: '0.65rem', fill: 'var(--text-muted)' }}>
                        K{val.toFixed(0)}
                      </text>
                    </g>
                  );
                })}

                {/* Draw Area & Line Paths */}
                {(() => {
                  const maxRevenue = Math.max(...revenueData.map(d => d.amount), 100);
                  const getY = (val) => 170 - (val / maxRevenue) * 150;
                  const getX = (index) => 40 + (index / (revenueData.length - 1)) * 440;
                  const points = revenueData.map((d, idx) => `${getX(idx)},${getY(d.amount)}`);
                  const linePath = `M ${points.join(' L ')}`;
                  const areaPath = `${linePath} L ${getX(revenueData.length - 1)},170 L ${getX(0)},170 Z`;

                  return (
                    <>
                      {/* Gradient Area */}
                      <path d={areaPath} fill="url(#chartGradient)" />

                      {/* Smooth caramel line */}
                      <path d={linePath} fill="none" stroke="var(--accent-color)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                      {/* Data dots */}
                      {revenueData.map((d, idx) => {
                        const cx = getX(idx);
                        const cy = getY(d.amount);
                        return (
                          <circle
                            key={idx}
                            cx={cx}
                            cy={cy}
                            r="5"
                            fill="#ffffff"
                            stroke="var(--accent-color)"
                            strokeWidth="2.5"
                            className="chart-dot"
                            onMouseEnter={(e) => {
                              setActiveTooltip({
                                x: cx,
                                y: cy,
                                date: d.date,
                                amount: d.amount
                              });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                          />
                        );
                      })}
                    </>
                  );
                })()}

                {/* X Axis labels */}
                {revenueData.map((d, idx) => {
                  const x = 40 + (idx / (revenueData.length - 1)) * 440;
                  return (
                    <text key={idx} x={x} y="190" textAnchor="middle" style={{ fontSize: '0.7rem', fill: 'var(--text-muted)' }}>
                      {d.date}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Cake Popularity Horizontal Bar Chart */}
          <div className="glass-panel chart-panel">
            <div className="chart-header">
              <h3 className="chart-title">Top Cake Types (Qty Sold)</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
              {popularityData.map((d, idx) => {
                const maxQty = Math.max(...popularityData.map(item => item.qty), 1);
                const widthPct = (d.qty / maxQty) * 100;
                
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '500' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{d.name}</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{d.qty} sold</span>
                    </div>
                    {/* Bar track */}
                    <div style={{ background: 'rgba(201, 156, 110, 0.1)', height: '10px', borderRadius: '5px', width: '100%', overflow: 'hidden' }}>
                      <div 
                        className="chart-bar" 
                        style={{ 
                          height: '100%', 
                          width: `${widthPct}%`, 
                          background: 'linear-gradient(90deg, #d6aa7c, #c99c6e)', 
                          borderRadius: '5px' 
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 3 - Donut Chart + Fulfillment Progress Indicators */}
        <div className="dashboard-charts-grid">
          {/* Delivery Split Donut Chart */}
          <div className="glass-panel chart-panel" style={{ minHeight: '300px' }}>
            <div className="chart-header">
              <h3 className="chart-title">Fulfillment Method</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', flexWrap: 'wrap', flex: 1 }}>
              {/* Donut SVG */}
              <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                <svg width="200" height="200" viewBox="0 0 200 200">
                  {/* Collection Slice */}
                  <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="transparent"
                    stroke="var(--accent-color)"
                    strokeWidth="20"
                    strokeDasharray={`${collectionStrokeLength} ${circumference - collectionStrokeLength}`}
                    strokeDashoffset="0"
                    transform="rotate(-90 100 100)"
                    className="donut-segment"
                  />
                  {/* Delivery Slice */}
                  <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="transparent"
                    stroke="var(--text-main)"
                    strokeWidth="20"
                    strokeDasharray={`${deliveryStrokeLength} ${circumference - deliveryStrokeLength}`}
                    strokeDashoffset={-collectionStrokeLength}
                    transform="rotate(-90 100 100)"
                    className="donut-segment"
                  />
                  {/* Center Text */}
                  <text x="100" y="98" textAnchor="middle" style={{ fontSize: '1.6rem', fontWeight: '750', fill: 'var(--text-main)' }}>
                    {totalSplit}
                  </text>
                  <text x="100" y="118" textAnchor="middle" style={{ fontSize: '0.75rem', fontWeight: '600', fill: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total Orders
                  </text>
                </svg>
              </div>

              {/* Legends */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '160px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: 'var(--accent-color)', display: 'inline-block' }}></span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Collection ({collectionPct}%)</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{collectionCount} order{collectionCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: 'var(--text-main)', display: 'inline-block' }}></span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Home Delivery ({deliveryPct}%)</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{deliveryCount} order{deliveryCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fulfillment Status Metrics */}
          <div className="glass-panel chart-panel" style={{ minHeight: '300px' }}>
            <div className="chart-header">
              <h3 className="chart-title">Fulfillment Progress</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, justifyContent: 'center' }}>
              {/* Pending Status Progress */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '500' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: 'var(--text-muted)' }}>●</span> Order Received</span>
                  <span style={{ fontWeight: 'bold' }}>{pendingCount} ({totalStatusCount > 0 ? Math.round((pendingCount / totalStatusCount) * 100) : 0}%)</span>
                </div>
                <div style={{ background: 'rgba(201, 156, 110, 0.1)', height: '12px', borderRadius: '6px', width: '100%', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalStatusCount > 0 ? (pendingCount / totalStatusCount) * 100 : 0}%`, background: '#8c7f73', borderRadius: '6px' }} />
                </div>
              </div>

              {/* Payment Confirmed Status Progress */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '500' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: '#f5a623' }}>●</span> Payment Confirmed</span>
                  <span style={{ fontWeight: 'bold' }}>{paymentCount} ({totalStatusCount > 0 ? Math.round((paymentCount / totalStatusCount) * 100) : 0}%)</span>
                </div>
                <div style={{ background: 'rgba(201, 156, 110, 0.1)', height: '12px', borderRadius: '6px', width: '100%', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalStatusCount > 0 ? (paymentCount / totalStatusCount) * 100 : 0}%`, background: '#f5a623', borderRadius: '6px' }} />
                </div>
              </div>

              {/* Baking Status Progress */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '500' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: 'var(--accent-color)' }}>●</span> Baking & Preparing</span>
                  <span style={{ fontWeight: 'bold' }}>{bakingCount} ({totalStatusCount > 0 ? Math.round((bakingCount / totalStatusCount) * 100) : 0}%)</span>
                </div>
                <div style={{ background: 'rgba(201, 156, 110, 0.1)', height: '12px', borderRadius: '6px', width: '100%', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalStatusCount > 0 ? (bakingCount / totalStatusCount) * 100 : 0}%`, background: 'var(--accent-color)', borderRadius: '6px' }} />
                </div>
              </div>

              {/* Completed Status Progress */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '500' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: '#25D366' }}>●</span> Completed & Picked Up</span>
                  <span style={{ fontWeight: 'bold' }}>{completedCount} ({totalStatusCount > 0 ? Math.round((completedCount / totalStatusCount) * 100) : 0}%)</span>
                </div>
                <div style={{ background: 'rgba(201, 156, 110, 0.1)', height: '12px', borderRadius: '6px', width: '100%', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalStatusCount > 0 ? (completedCount / totalStatusCount) * 100 : 0}%`, background: '#25D366', borderRadius: '6px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdmin = () => (
    <main>
      <section className="hero" style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '3.2rem', marginBottom: '16px' }}>
          Manage the Future of <span className="text-accent">Baking</span>
        </h1>
        <p className="text-muted" style={{ fontSize: '1.2rem', maxWidth: '600px', lineHeight: '1.6' }}>
          Welcome to the centralized dashboard. Add inventory, process orders, and organize with lightning-fast speeds.
        </p>
      </section>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <button style={getTabStyle('dashboard')} onClick={() => setAdminTab('dashboard')}>📈 Analytics Dashboard</button>
          <button style={getTabStyle('cakes')} onClick={() => setAdminTab('cakes')}>🎂 Inventory & Cakes</button>
          <button style={getTabStyle('orders')} onClick={() => setAdminTab('orders')}>📋 Customer Orders ({orders.length})</button>
          <button style={getTabStyle('suggestions')} onClick={() => setAdminTab('suggestions')}>💬 Customer Feedback ({suggestions.length})</button>
      </div>

      {adminTab === 'dashboard' && renderDashboard()}

      {adminTab === 'suggestions' && (
          <section style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2>Customer <span className="text-accent">Suggestions &amp; Feedback</span></h2>
                  <button className="btn-secondary" onClick={fetchSuggestions} style={{ padding: '6px 16px', fontSize: '0.85rem' }}>🔄 Refresh</button>
              </div>

              {suggestions.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No suggestions have been submitted by customers yet.
                  </div>
              ) : (
                  <div className="suggestions-grid">
                      {suggestions.map(s => (
                          <div key={s.id} className="suggestion-card">
                              <div>
                                  <div className="suggestion-card-header">
                                      <div>
                                          <div className="suggestion-card-name">{s.customerName}</div>
                                          {s.customerEmail && (
                                              <a href={`mailto:${s.customerEmail}`} className="suggestion-card-email" style={{ textDecoration: 'none' }}>
                                                  ✉️ {s.customerEmail}
                                              </a>
                                          )}
                                      </div>
                                      <div className="suggestion-card-date">
                                          {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                  </div>
                                  <div className="suggestion-card-content">
                                      "{s.content}"
                                  </div>
                              </div>
                              <div className="suggestion-card-actions">
                                  <button 
                                      className="btn-secondary btn-danger" 
                                      onClick={() => handleDeleteSuggestion(s.id)}
                                      style={{ padding: '6px 16px', fontSize: '0.8rem', borderRadius: '6px' }}
                                  >
                                      Dismiss
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </section>
      )}

      {adminTab === 'cakes' && (() => {
        const cakeItems = cakes.filter(c => c.categoryId === 1 || c.categoryId === 0 || !c.categoryId);
        const cookieItems = cakes.filter(c => c.categoryId === 2);
        
        return (
          <section>
            {/* Cakes Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2>Available <span className="text-accent">Cakes</span></h2>
              <button className="btn-primary" onClick={() => openAddModal(1)}>+ New Cake</button>
            </div>

            {loading ? (
              <p className="text-muted" style={{ marginTop: '20px' }}>Scanning inventory...</p>
            ) : (
              <>
                {cakeItems.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', marginBottom: '48px' }}>
                    No cakes in inventory. Click "+ New Cake" to add one!
                  </div>
                ) : (
                  <div className="card-grid" style={{ marginTop: '0', marginBottom: '64px' }}>
                    {cakeItems.map(cake => (
                      <div key={cake.id} className="cake-item">
                        <div className="cake-liquid-img" style={{ 
                            backgroundImage: cake.imageUrl ? `url(${API_BASE_URL}${cake.imageUrl})` : 'none',
                            animationDelay: `-${(cake.id || 1) * 1.3}s`
                          }}>
                          {!cake.imageUrl && <div className="no-img-icon">🍰</div>}
                        </div>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.15rem', fontWeight: '600' }}>{cake.name}</h3>
                        <div className="price-tag" style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 'bold' }}>K{parseFloat(cake.price).toFixed(2)}</div>
                        <p className="text-muted" style={{ fontSize: '0.85rem', margin: '0 0 16px 0', lineHeight: '1.4', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}>
                          {cake.description}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button className="btn-secondary" onClick={() => openEditModal(cake)} style={{ padding: '6px 20px', fontSize: '0.85rem', borderRadius: '4px' }}>Edit</button>
                            <button className="btn-secondary btn-danger" onClick={() => handleDeleteCake(cake.id)} style={{ padding: '6px 20px', fontSize: '0.85rem', borderRadius: '4px' }}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Cookies Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '48px' }}>
              <h2>Available <span className="text-accent">Cookies</span></h2>
              <button className="btn-primary" onClick={() => openAddModal(2)}>+ New Cookie</button>
            </div>

            {loading ? (
              <p className="text-muted" style={{ marginTop: '20px' }}>Scanning inventory...</p>
            ) : (
              <>
                {cookieItems.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No cookies in inventory. Click "+ New Cookie" to add one!
                  </div>
                ) : (
                  <div className="card-grid" style={{ marginTop: '0' }}>
                    {cookieItems.map(cookie => (
                      <div key={cookie.id} className="cake-item">
                        <div className="cake-liquid-img" style={{ 
                            backgroundImage: cookie.imageUrl ? `url(${API_BASE_URL}${cookie.imageUrl})` : 'none',
                            animationDelay: `-${(cookie.id || 1) * 1.3}s`
                          }}>
                          {!cookie.imageUrl && <div className="no-img-icon">🍪</div>}
                        </div>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.15rem', fontWeight: '600' }}>{cookie.name}</h3>
                        <div className="price-tag" style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 'bold' }}>K{parseFloat(cookie.price).toFixed(2)}</div>
                        <p className="text-muted" style={{ fontSize: '0.85rem', margin: '0 0 16px 0', lineHeight: '1.4', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}>
                          {cookie.description}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button className="btn-secondary" onClick={() => openEditModal(cookie)} style={{ padding: '6px 20px', fontSize: '0.85rem', borderRadius: '4px' }}>Edit</button>
                            <button className="btn-secondary btn-danger" onClick={() => handleDeleteCake(cookie.id)} style={{ padding: '6px 20px', fontSize: '0.85rem', borderRadius: '4px' }}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        );
      })()}

      {adminTab === 'orders' && (
          <section>
              <h2>Active <span className="text-accent">Orders</span></h2>
              <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', marginTop: '24px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                      <thead>
                          <tr style={{ background: 'rgba(201, 156, 110, 0.15)', borderBottom: '1px solid var(--glass-border)' }}>
                              <th style={{ padding: '16px 24px', color: 'var(--text-main)' }}>ID</th>
                              <th style={{ padding: '16px 24px', color: 'var(--text-main)' }}>Customer info</th>
                              <th style={{ padding: '16px 24px', color: 'var(--text-main)' }}>Order Items</th>
                              <th style={{ padding: '16px 24px', color: 'var(--text-main)' }}>Target Date</th>
                              <th style={{ padding: '16px 24px', color: 'var(--text-main)' }}>Method</th>
                              <th style={{ padding: '16px 24px', color: 'var(--text-main)' }}>Status Update</th>
                          </tr>
                      </thead>
                      <tbody>
                          {orders.length === 0 && (
                              <tr><td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>No orders have been placed yet.</td></tr>
                          )}
                          {orders.map(order => (
                              <tr key={order.id} style={{ borderBottom: '1px solid var(--glass-border)', background: order.status === 'Completed' ? 'rgba(37, 211, 102, 0.05)' : 'transparent' }}>
                                  <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>#{order.id}</td>
                                  <td style={{ padding: '16px 24px' }}>
                                      <div style={{ fontWeight: '500' }}>{order.customer?.firstName}</div>
                                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.customer?.phoneNumber} {order.customer?.isWhatsApp && <span style={{ color: '#25D366', fontWeight: 'bold' }}>WA✔️</span>}</div>
                                  </td>
                                  <td style={{ padding: '16px 24px' }}>
                                      {/* All cart items for this order */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {order.orderItems.map((oi, idx) => (
                                          <div key={oi.id ?? idx}>
                                            {/* Item header: number pill + name + qty badge */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontWeight: 600 }}>
                                              {order.orderItems.length > 1 && (
                                                <span style={{
                                                  background: 'rgba(201,156,110,0.2)', color: 'var(--accent-color)',
                                                  borderRadius: '50%', width: '20px', height: '20px',
                                                  fontSize: '0.7rem', fontWeight: 'bold', flexShrink: 0,
                                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                                                }}>{idx + 1}</span>
                                              )}
                                              <span>{oi.cake?.name}</span>
                                              {oi.quantity > 1 && (
                                                <span style={{ background: 'rgba(201,156,110,0.15)', color: 'var(--accent-color)', borderRadius: '4px', padding: '1px 6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                  ×{oi.quantity}
                                                </span>
                                              )}
                                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                                K{(parseFloat(oi.unitPrice) * oi.quantity).toFixed(2)}
                                              </span>
                                            </div>
                                            {/* Item status select */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', marginLeft: order.orderItems.length > 1 ? '26px' : '0' }}>
                                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
                                              <select 
                                                  value={oi.status || 'Order Received'} 
                                                  onChange={(e) => handleItemStatusChange(order.id, oi.id, e.target.value)}
                                                  style={{ 
                                                      padding: '4px 8px', borderRadius: '6px', 
                                                      border: `1px solid ${oi.status === 'Completed' ? '#25D366' : 'rgba(201, 156, 110, 0.4)'}`, 
                                                      background: '#ffffff', color: 'var(--text-main)', 
                                                      fontSize: '0.8rem', fontWeight: '600', outline: 'none', cursor: 'pointer' 
                                                  }}
                                              >
                                                  <option value="Order Received">Order Received</option>
                                                  <option value="Payment Confirmed">Payment Confirmed</option>
                                                  <option value="Baking">Baking</option>
                                                  <option value="Completed">Completed</option>
                                              </select>
                                            </div>
                                            {/* Custom cake reply box */}
                                            {oi.cake?.name === 'Custom Cake Request' && (
                                              <div style={{ margin: '6px 0 0 0', padding: '10px 12px', background: 'rgba(201,156,110,0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
                                                <p style={{ margin: '0 0 8px 0', fontStyle: 'italic', color: 'var(--text-main)' }}>"{oi.cake?.description}"</p>
                                                <input
                                                  type="text"
                                                  placeholder={order.adminResponse ? 'Update your reply...' : 'Reply to customer...'}
                                                  defaultValue={order.adminResponse || ''}
                                                  onBlur={(e) => handleResponseChange(order.id, e.target.value)}
                                                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}
                                                />
                                                {order.adminResponse && <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#25D366' }}>Reply attached</div>}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                      {/* Order total */}
                                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 'bold', marginTop: '10px', borderTop: order.orderItems.length > 1 ? '1px dashed rgba(201,156,110,0.3)' : 'none', paddingTop: order.orderItems.length > 1 ? '8px' : '0' }}>
                                        {order.orderItems.length > 1 && <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>Total: </span>}
                                        K{parseFloat(order.totalAmount).toFixed(2)}
                                      </div>
                                  </td>
                                  <td style={{ padding: '16px 24px' }}>{new Date(order.fulfillmentDate).toLocaleDateString()}</td>
                                  <td style={{ padding: '16px 24px', fontSize: '0.9rem' }}>
                                      {order.deliveryMethod}
                                      {order.deliveryMethod === 'Delivery' && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.deliveryAddress}</div>}
                                  </td>
                                  <td style={{ padding: '16px 24px' }}>
                                      <select 
                                          value={order.status} 
                                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                          style={{ 
                                              padding: '8px 12px', borderRadius: '8px', 
                                              border: `1px solid ${order.status === 'Completed' ? '#25D366' : 'rgba(201,156,110,0.4)'}`, 
                                              background: '#ffffff', color: 'var(--text-main)', 
                                              fontWeight: '600', outline: 'none', cursor: 'pointer' 
                                          }}
                                      >
                                          <option value="Order Received">Order Received</option>
                                          <option value="Payment Confirmed">Payment Confirmed</option>
                                          <option value="Baking">Baking</option>
                                          <option value="Completed">Completed</option>
                                      </select>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </section>
      )}
    </main>
  );

  return (
    <>
      <header>
        <h2>iCakes <span className="text-accent">&amp; Cookies</span></h2>
        <nav style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {viewMode === 'admin' ? (
             <>
               <button className="btn-secondary" onClick={() => setViewMode('storefront')}>View Storefront</button>
               <button className="btn-secondary" style={{ color: '#e06c6c', borderColor: '#e06c6c' }} onClick={handleLogout}>Logout</button>
             </>
          ) : (
             <>
               <button className="btn-secondary" onClick={() => { setIsTrackModalOpen(true); setTrackResult(null); setTrackOrderId(''); }}>Track Order</button>
               <button
                 className="btn-secondary"
                 onClick={() => setIsCartOpen(true)}
                 style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}
               >
                 🛒 Cart
                 {cartItemCount > 0 && (
                   <span style={{
                     background: 'var(--accent-color)', color: 'white',
                     borderRadius: '50%', width: '20px', height: '20px',
                     fontSize: '0.7rem', fontWeight: 'bold',
                     display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                   }}>{cartItemCount}</span>
                 )}
               </button>
               <button className="btn-secondary" onClick={openAdminPortal}>Admin Portal</button>
             </>
          )}
        </nav>
      </header>

      {viewMode === 'storefront' ? renderStorefront() : renderAdmin()}

      <footer style={{
          marginTop: '64px',
          padding: '48px 24px',
          borderTop: '1px solid var(--glass-border)',
          background: 'rgba(255, 255, 255, 0.3)',
          textAlign: 'center',
          color: 'var(--text-muted)'
      }}>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '8px' }}>iCakes <span className="text-accent">& Cookies</span></h3>
          <p style={{ fontSize: '0.95rem', marginBottom: '24px' }}>Baked with love. Delivered with care to your front door.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '0.9rem', fontWeight: '500' }}>
              <span style={{ cursor: 'pointer' }}>Privacy Policy</span>
              <span style={{ cursor: 'pointer' }}>Terms of Service</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setIsContactModalOpen(true)}>Contact Us</span>
          </div>
          <p style={{ fontSize: '0.8rem', marginTop: '32px', opacity: 0.7 }}>
             &copy; {new Date().getFullYear()} iCakes & Cookies. All rights reserved.
          </p>
      </footer>

      {/* Admin Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
             <h2 style={{ marginBottom: '24px' }}>
              {editingId ? 'Edit' : 'Add'} <span className="text-accent">{editingId ? (formData.categoryId === 2 ? 'Cookie' : 'Cake') : (formData.categoryId === 2 ? 'New Cookie' : 'New Cake')}</span>
            </h2>
            <form onSubmit={handleFormSubmit}>
              <div className="form-group" style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div className="upload-circle"
                  style={{ backgroundImage: formData.imagePreviewUrl ? `url(${formData.imagePreviewUrl})` : 'none', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} 
                  onClick={() => fileInputRef.current.click()}>
                  {!formData.imagePreviewUrl && <span>📷</span>}
                </div>
                <label style={{cursor: 'pointer', color: 'var(--accent-color)'}} onClick={() => fileInputRef.current.click()}>
                  {formData.imagePreviewUrl 
                    ? (formData.categoryId === 2 ? 'Change Cookie Image' : 'Change Cake Image') 
                    : (formData.categoryId === 2 ? 'Upload Cookie Image' : 'Upload Cake Image')}
                </label>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
              </div>
              <div className="form-group">
                <label>{formData.categoryId === 2 ? 'Cookie Name' : 'Cake Name'}</label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  placeholder={formData.categoryId === 2 ? 'e.g., Chocolate Chip' : 'e.g., Midnight Caramel'} 
                  value={formData.name} 
                  onChange={handleInputChange} 
                />
              </div>
              <div className="form-group">
                <label>Price (K)</label>
                <input type="number" name="price" step="0.01" required placeholder="29.99" value={formData.price} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  name="description" 
                  placeholder={formData.categoryId === 2 ? 'Briefly describe what makes this cookie delicious...' : 'Briefly describe what makes this cake awesome...'} 
                  value={formData.description} 
                  onChange={handleInputChange} 
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeAndResetModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting 
                    ? 'Saving...' 
                    : (editingId ? 'Save Changes' : (formData.categoryId === 2 ? 'Add Cookie' : 'Add Cake'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 🛒 Cart Modal */}
      {isCartOpen && (
        <div className="modal-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '540px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Your <span className="text-accent">Cart</span> 🛒</h2>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
            </div>

            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🛒</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '24px' }}>Your cart is empty.</p>
                <button className="btn-primary" onClick={() => setIsCartOpen(false)}>Browse Cakes</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  {cart.map(item => (
                    <div key={item.cake.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px', background: '#faf9f6', borderRadius: '12px',
                      border: '1px solid rgba(201,156,110,0.2)'
                    }}>
                      {/* Cake thumbnail */}
                      <div style={{
                        width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
                        backgroundImage: item.cake.imageUrl ? `url(${API_BASE_URL}${item.cake.imageUrl})` : 'none',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        background: item.cake.imageUrl ? undefined : 'rgba(201,156,110,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem'
                      }}>
                        {!item.cake.imageUrl && '🍰'}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.cake.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 'bold' }}>K{parseFloat(item.cake.price).toFixed(2)} each</div>
                      </div>
                      {/* Qty stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button onClick={() => updateCartQty(item.cake.id, item.quantity - 1)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(201,156,110,0.4)', background: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                        <button onClick={() => updateCartQty(item.cake.id, item.quantity + 1)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(201,156,110,0.4)', background: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                      {/* Subtotal */}
                      <div style={{ fontWeight: 'bold', fontSize: '0.95rem', minWidth: '64px', textAlign: 'right' }}>
                        K{(parseFloat(item.cake.price) * item.quantity).toFixed(2)}
                      </div>
                      {/* Remove */}
                      <button onClick={() => removeFromCart(item.cake.id)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e06c6c', fontSize: '1.1rem', flexShrink: 0, padding: '4px' }}>✕</button>
                    </div>
                  ))}
                </div>

                {/* Order Summary */}
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <span>{cartItemCount} item{cartItemCount !== 1 ? 's' : ''}</span>
                    <span>Subtotal</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    <span>Total</span>
                    <span className="text-accent">K{cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="form-actions" style={{ marginTop: 0 }}>
                  <button className="btn-secondary" onClick={() => { clearCart(); }}>Clear Cart</button>
                  <button className="btn-secondary" onClick={() => setIsCartOpen(false)}>Continue Shopping</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={openCartCheckout}>Checkout →</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Customer Order Modal */}
      {isOrderModalOpen && (isCartCheckout || orderingCake) && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ marginBottom: '8px' }}>Place <span className="text-accent">Order</span></h2>
            <p className="text-muted" style={{ marginBottom: '24px', fontSize: '0.9rem' }}>
              {isCartCheckout
                ? <span>Checking out <strong>{cartItemCount} item{cartItemCount !== 1 ? 's' : ''}</strong> — Total: <strong>K{cartTotal.toFixed(2)}</strong></span>
                : <span>Ordering: <strong>{orderingCake?.name}</strong> {orderingCake?.id !== 0 && `(K${parseFloat(orderingCake?.price || 0).toFixed(2)})`}</span>
              }
            </p>
            
            <form onSubmit={submitOrder}>
              {!isCartCheckout && orderingCake?.id === 0 && (
                  <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label>Describe Your Custom Cake <span style={{ color: '#e06c6c' }}>*</span></label>
                    <textarea 
                        name="customDescription" 
                        required 
                        placeholder="I am looking for a 3-tier chocolate cake with vanilla frosting, themed around Dinosaurs..." 
                        value={orderForm.customDescription} 
                        onChange={handleOrderChange} 
                        style={{ minHeight: '120px' }}
                    />
                  </div>
              )}

              <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Your Name</label>
                    <input type="text" name="customerName" required placeholder="Jane Doe" value={orderForm.customerName} onChange={handleOrderChange} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Phone Number</label>
                    <input type="tel" name="customerPhone" required placeholder="+260..." value={orderForm.customerPhone} onChange={handleOrderChange} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <input type="checkbox" name="isWhatsApp" checked={orderForm.isWhatsApp} onChange={handleOrderChange} style={{ width: 'auto', margin: 0, cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>This number is on WhatsApp</span>
                    </div>
                  </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input type="email" name="customerEmail" required placeholder="jane@example.com" value={orderForm.customerEmail} onChange={handleOrderChange} />
              </div>

              <div className="form-group">
                <label>Fulfillment Date <span style={{ color: '#e06c6c' }}>*</span></label>
                <input 
                    type="date" 
                    name="fulfillmentDate" 
                    required 
                    min={new Date().toISOString().split('T')[0]} // Cannot order in the past
                    value={orderForm.fulfillmentDate} 
                    onChange={handleDateChange} 
                />
                {fullyBookedDates.length > 0 && (
                   <p style={{ fontSize: '0.8rem', color: '#e06c6c', marginTop: '6px' }}>
                      <strong>Fully Booked (Do Not Select): </strong> 
                      {fullyBookedDates.join(', ')}
                   </p>
                )}
              </div>
              
              <div className="form-group">
                <label>Pickup or Delivery?</label>
                <select 
                    name="deliveryMethod" 
                    value={orderForm.deliveryMethod} 
                    onChange={handleOrderChange}
                    style={{ background: '#faf9f6', border: '1px solid rgba(201, 156, 110, 0.4)', borderRadius: '8px', padding: '12px', fontSize: '1rem', color: 'var(--text-main)', outline: 'none' }}
                >
                    <option value="Collection">Self Collection (Free)</option>
                    <option value="Delivery">Home Delivery</option>
                </select>
              </div>

              {orderForm.deliveryMethod === 'Delivery' && (
                  <div className="form-group">
                    <label>Delivery Address</label>
                    <textarea name="deliveryAddress" required placeholder="Enter full street address and city..." value={orderForm.deliveryAddress} onChange={handleOrderChange} />
                  </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => { setIsOrderModalOpen(false); setIsCartCheckout(false); }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting || !orderForm.fulfillmentDate}>
                    {isSubmitting ? 'Processing...' : 'Confirm Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Track Order Modal */}
      {isTrackModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ marginBottom: '8px' }}>Track <span className="text-accent">Order</span></h2>
            <p className="text-muted" style={{ marginBottom: '24px', fontSize: '0.9rem' }}>
              Enter your Order ID below to view its current status.
            </p>
            
            <form onSubmit={handleTrackOrder} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <input 
                    type="number" 
                    required 
                    placeholder="Order ID (e.g. 1)" 
                    value={trackOrderId} 
                    onChange={e => setTrackOrderId(e.target.value)}
                    style={{ flex: 1, padding: '12px', border: '1px solid rgba(201, 156, 110, 0.4)', borderRadius: '8px', background: '#faf9f6', outline: 'none' }}
                />
                <button type="submit" className="btn-primary" style={{ padding: '0 24px' }}>Search</button>
            </form>

            {trackError && <p style={{ color: '#e06c6c', marginBottom: '16px' }}>{trackError}</p>}
            
            {trackResult && (
                <div style={{ background: '#faf9f6', padding: '16px', borderRadius: '8px', border: '1px solid rgba(201, 156, 110, 0.2)', marginBottom: '16px' }}>
                    <h3 style={{ marginTop: 0 }}>Order #{trackResult.id}</h3>
                    <p style={{ margin: '8px 0', fontSize: '0.95rem' }}><strong>Customer:</strong> {trackResult.customer?.firstName}</p>
                    <div style={{ margin: '12px 0' }}>
                        <strong>Items Ordered:</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                            {trackResult.orderItems.map((oi, idx) => (
                                <div key={oi.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.5)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(201, 156, 110, 0.1)' }}>
                                    <div style={{ textAlign: 'left' }}>
                                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{oi.cake?.name}</span>
                                        {oi.quantity > 1 && <span style={{ color: 'var(--accent-color)', marginLeft: '6px', fontWeight: 'bold' }}>×{oi.quantity}</span>}
                                    </div>
                                    <span style={{ 
                                        fontSize: '0.8rem', 
                                        fontWeight: 'bold', 
                                        padding: '2px 8px', 
                                        borderRadius: '4px',
                                        background: oi.status === 'Completed' ? 'rgba(37, 211, 102, 0.1)' : oi.status === 'Baking' ? 'rgba(201, 156, 110, 0.1)' : 'rgba(0,0,0,0.05)',
                                        color: oi.status === 'Completed' ? '#25D366' : oi.status === 'Baking' ? 'var(--accent-color)' : 'var(--text-muted)'
                                    }}>
                                        {oi.status || 'Order Received'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <p style={{ margin: '8px 0', fontSize: '0.95rem' }}><strong>Date Needed:</strong> {new Date(trackResult.fulfillmentDate).toLocaleDateString()}</p>
                    
                    {trackResult.adminResponse && (
                        <div style={{ margin: '16px 0', padding: '16px', background: 'rgba(201, 156, 110, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--accent-color)' }}>
                            <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>Message from iCakes:</p>
                            <p style={{ margin: 0, fontSize: '0.95rem', fontStyle: 'italic', color: 'var(--text-main)' }}>"{trackResult.adminResponse}"</p>
                        </div>
                    )}
                    
                    <div style={{ marginTop: '24px' }}>
                        <p style={{ fontWeight: 'bold', marginBottom: '12px' }}>Production Status:</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f4eadd', padding: '12px', borderRadius: '8px' }}>
                            <span style={{ fontWeight: trackResult.status.toLowerCase() === 'order received' ? 'bold' : 'normal', color: trackResult.status.toLowerCase() === 'order received' ? 'var(--accent-color)' : 'var(--text-muted)' }}>1. Order Received</span>
                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                            <span style={{ fontWeight: trackResult.status.toLowerCase() === 'baking' ? 'bold' : 'normal', color: trackResult.status.toLowerCase() === 'baking' ? 'var(--accent-color)' : 'var(--text-muted)' }}>2. Baking</span>
                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                            <span style={{ fontWeight: trackResult.status.toLowerCase() === 'completed' ? 'bold' : 'normal', color: trackResult.status.toLowerCase() === 'completed' ? 'var(--accent-color)' : 'var(--text-muted)' }}>3. Completed</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="form-actions" style={{ marginTop: '0' }}>
              <button type="button" className="btn-secondary" onClick={() => setIsTrackModalOpen(false)}>Close Window</button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Info Modal */}
      {isContactModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '16px' }}>Contact <span className="text-accent">Us</span></h2>
            <p className="text-muted" style={{ marginBottom: '32px', fontSize: '1rem', lineHeight: '1.6' }}>
              We'd love to hear from you! Reach out using the information below:
            </p>
            
            <div style={{ background: '#faf9f6', padding: '24px', borderRadius: '12px', border: '1px solid rgba(201, 156, 110, 0.2)', marginBottom: '32px' }}>
                <p style={{ margin: '0 0 16px 0', fontSize: '1.2rem' }}>
                    <strong style={{ color: 'var(--text-main)' }}>Phone / WhatsApp:</strong> <br/>
                    <a
                      href="https://wa.me/260975586410"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#25D366', textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="22" height="22" fill="#25D366">
                        <path d="M16 0C7.163 0 0 7.163 0 16c0 2.824.737 5.473 2.027 7.776L0 32l8.443-2.012A15.93 15.93 0 0 0 16 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm0 29.333a13.267 13.267 0 0 1-6.755-1.843l-.484-.287-5.012 1.194 1.222-4.877-.317-.5A13.267 13.267 0 1 1 16 29.333zm7.273-9.93c-.397-.199-2.35-1.159-2.715-1.292-.364-.132-.63-.199-.895.199-.266.397-1.027 1.292-1.26 1.558-.232.265-.465.298-.862.1-.397-.2-1.677-.618-3.194-1.972-1.18-1.053-1.976-2.352-2.208-2.75-.232-.397-.025-.611.175-.809.18-.178.397-.465.596-.697.199-.232.265-.397.397-.662.132-.265.066-.497-.033-.696-.1-.199-.895-2.158-1.227-2.955-.323-.776-.65-.671-.895-.683l-.762-.013c-.265 0-.696.1-1.06.497-.364.397-1.392 1.36-1.392 3.317 0 1.957 1.425 3.848 1.624 4.113.199.265 2.806 4.283 6.8 6.004.951.41 1.692.655 2.27.839.954.303 1.822.26 2.509.158.765-.114 2.35-.96 2.682-1.888.332-.928.332-1.724.232-1.888-.099-.165-.364-.265-.762-.464z"/>
                      </svg>
                      0975 586 410
                    </a>
                </p>
                <p style={{ margin: 0, fontSize: '1.2rem' }}>
                    <strong style={{ color: 'var(--text-main)' }}>Email Address:</strong> <br/> 
                    <a href="mailto:iCakesandcookies@gmail.com" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 'bold' }}>iCakesandcookies@gmail.com</a>
                </p>
            </div>

            <div className="form-actions" style={{ justifyContent: 'center', marginTop: '0' }}>
              <button type="button" className="btn-primary" onClick={() => setIsContactModalOpen(false)}>Close Window</button>
            </div>
          </div>
        </div>
      )}
      {/* Admin Login Modal */}
      {isLoginModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔐</div>
              <h2 style={{ marginBottom: '8px' }}>Admin <span className="text-accent">Login</span></h2>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>Enter your credentials to access the admin portal.</p>
            </div>

            <form onSubmit={handleAdminLoginSubmit}>
              <div className="form-group">
                <label>Username</label>
                <input
                  id="admin-username"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Enter admin username"
                  value={loginForm.username}
                  onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter admin password"
                    value={loginForm.password}
                    onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: '12px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '1.1rem', color: 'var(--text-muted)', padding: '4px',
                      lineHeight: 1, display: 'flex', alignItems: 'center'
                    }}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {loginError && (
                <div style={{
                  background: 'rgba(224, 108, 108, 0.1)',
                  border: '1px solid rgba(224, 108, 108, 0.4)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  color: '#e06c6c',
                  fontSize: '0.9rem'
                }}>
                  ⚠️ {loginError}
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsLoginModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isLoggingIn}>
                  {isLoggingIn ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}

export default App;
