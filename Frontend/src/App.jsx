import { useEffect, useState, useRef } from 'react';
import './index.css';

function App() {
  const [cakes, setCakes] = useState([]);
  const [fullyBookedDates, setFullyBookedDates] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState('storefront');
  const [adminTab, setAdminTab] = useState('cakes'); // 'cakes' | 'orders'

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
    fetch('http://localhost:5020/api/cakes')
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
      fetch('http://localhost:5020/api/orders/booked-dates')
      .then(res => res.json())
      .then(data => setFullyBookedDates(data))
      .catch(err => console.error(err));
  };

  const fetchOrders = () => {
      fetch('http://localhost:5020/api/orders')
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchCakes();
    fetchBookedDates();
    fetchOrders();
  }, []);

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

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', price: '', description: '', categoryId: 1, image: null, imagePreviewUrl: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (cake) => {
    setEditingId(cake.id);
    setFormData({
      name: cake.name, price: cake.price || '', description: cake.description || '',
      categoryId: cake.categoryId || 1, image: null,
      imagePreviewUrl: cake.imageUrl ? `http://localhost:5020${cake.imageUrl}` : ''
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
        const response = await fetch(`http://localhost:5020/api/cakes/${id}`, { method: 'DELETE' });
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
      const url = isEditing ? `http://localhost:5020/api/cakes/${editingId}` : 'http://localhost:5020/api/cakes';
      const response = await fetch(url, { method: isEditing ? 'PUT' : 'POST', body: uploadData });

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
          const res = await fetch(`http://localhost:5020/api/orders/${orderId}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
          });
          if (res.ok) {
              setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
          } else {
              alert("Failed to update status");
          }
      } catch {
          alert("Network Error");
      }
  };

  const handleResponseChange = async (orderId, adminResponse) => {
      try {
          const res = await fetch(`http://localhost:5020/api/orders/${orderId}/response`, {
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

  // --------------- ORDER TRACKING ---------------
  const handleTrackOrder = async (e) => {
    e.preventDefault();
    setTrackError('');
    setTrackResult(null);
    try {
        const res = await fetch(`http://localhost:5020/api/orders/${trackOrderId}`);
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
          const res = await fetch('http://localhost:5020/api/orders/place', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
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
              })
          });

          if (res.ok) {
              const resultingOrder = await res.json();
              alert(`Success! We've received your order.\n\nIMPORTANT: Your tracking Order ID is: #${resultingOrder.id}`);
              setIsOrderModalOpen(false);
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
                    backgroundImage: cake.imageUrl ? `url(http://localhost:5020${cake.imageUrl})` : 'none',
                    animationDelay: `-${(cake.id || 1) * 1.3}s`
                  }}>
                  {!cake.imageUrl && <div className="no-img-icon">🍰</div>}
                </div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', fontWeight: '600' }}>{cake.name}</h3>
                <div className="price-tag" style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>K{parseFloat(cake.price).toFixed(2)}</div>
                <p className="text-muted" style={{ fontSize: '0.9rem', margin: '0 0 20px 0', lineHeight: '1.5', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}>
                  {cake.description}
                </p>
                <div style={{ textAlign: 'center' }}>
                    <button className="btn-primary" style={{ padding: '12px 32px', fontSize: '1rem', borderRadius: '4px', maxWidth: '200px' }} onClick={() => openOrderModal(cake)}>
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

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
          <button style={getTabStyle('cakes')} onClick={() => setAdminTab('cakes')}>Inventory & Cakes</button>
          <button style={getTabStyle('orders')} onClick={() => setAdminTab('orders')}>Customer Orders ({orders.length})</button>
      </div>

      {adminTab === 'cakes' && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Available <span className="text-accent">Cakes</span></h2>
              <button className="btn-primary" onClick={openAddModal}>+ New Cake</button>
            </div>

            {loading ? (
              <p className="text-muted" style={{ marginTop: '20px' }}>Scanning inventory...</p>
            ) : (
              <div className="card-grid">
                {cakes.map(cake => (
                  <div key={cake.id} className="cake-item">
                    <div className="cake-liquid-img" style={{ 
                        backgroundImage: cake.imageUrl ? `url(http://localhost:5020${cake.imageUrl})` : 'none',
                        animationDelay: `-${(cake.id || 1) * 1.3}s`
                      }}>
                      {!cake.imageUrl && <div className="no-img-icon">🎂</div>}
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
          </section>
      )}

      {adminTab === 'orders' && (
          <section>
              <h2>Active <span className="text-accent">Orders</span></h2>
              <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', marginTop: '24px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                      <thead>
                          <tr style={{ background: 'rgba(201, 156, 110, 0.15)', borderBottom: '1px solid var(--glass-border)' }}>
                              <th style={{ padding: '16px 24px', color: 'var(--text-main)' }}>ID</th>
                              <th style={{ padding: '16px 24px', color: 'var(--text-main)' }}>Customer info</th>
                              <th style={{ padding: '16px 24px', color: 'var(--text-main)' }}>Order Item</th>
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
                                      <div style={{ fontWeight: 600 }}>{order.orderItems[0]?.cake?.name}</div>
                                      {order.orderItems[0]?.cake?.name === 'Custom Cake Request' && (
                                          <div style={{ margin: '8px 0', padding: '12px', background: 'rgba(201,156,110,0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
                                              <p style={{ margin: '0 0 8px 0', fontStyle: 'italic', color: 'var(--text-main)' }}>"{order.orderItems[0]?.cake?.description}"</p>
                                              
                                              <input 
                                                type="text" 
                                                placeholder={order.adminResponse ? "Update your reply..." : "Reply to customer..."}
                                                defaultValue={order.adminResponse || ''}
                                                onBlur={(e) => handleResponseChange(order.id, e.target.value)}
                                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}
                                              />
                                              {order.adminResponse && <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#25D366' }}>Reply attached</div>}
                                          </div>
                                      )}
                                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginTop: '8px' }}>K{parseFloat(order.totalAmount).toFixed(2)}</div>
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
                                          <option value="Pending">Pending</option>
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
        <h2>iCakes <span className="text-accent">& Cookies</span></h2>
        <nav style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {viewMode === 'admin' ? (
             <button className="btn-secondary" onClick={() => setViewMode('storefront')}>View Storefront</button>
          ) : (
             <>
               <button className="btn-secondary" onClick={() => { setIsTrackModalOpen(true); setTrackResult(null); setTrackOrderId(''); }}>Track Order</button>
               <span style={{ fontWeight: 'bold', color: 'var(--text-main)', marginRight: '8px' }}>🛒 Cart (0)</span>
               <button className="btn-secondary" onClick={() => setViewMode('admin')}>Admin Portal</button>
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
            <h2 style={{ marginBottom: '24px' }}>{editingId ? 'Edit' : 'Add'} <span className="text-accent">{editingId ? 'Cake' : 'New Cake'}</span></h2>
            <form onSubmit={handleFormSubmit}>
              <div className="form-group" style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div className="upload-circle"
                  style={{ backgroundImage: formData.imagePreviewUrl ? `url(${formData.imagePreviewUrl})` : 'none', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} 
                  onClick={() => fileInputRef.current.click()}>
                  {!formData.imagePreviewUrl && <span>📷</span>}
                </div>
                <label style={{cursor: 'pointer', color: 'var(--accent-color)'}} onClick={() => fileInputRef.current.click()}>
                  {formData.imagePreviewUrl ? 'Change Cake Image' : 'Upload Cake Image'}
                </label>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
              </div>
              <div className="form-group">
                <label>Cake Name</label>
                <input type="text" name="name" required placeholder="e.g., Midnight Caramel" value={formData.name} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Price (K)</label>
                <input type="number" name="price" step="0.01" required placeholder="29.99" value={formData.price} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea name="description" placeholder="Briefly describe what makes this cake awesome..." value={formData.description} onChange={handleInputChange} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeAndResetModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Cake')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Order Modal */}
      {isOrderModalOpen && orderingCake && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ marginBottom: '8px' }}>Place <span className="text-accent">Order</span></h2>
            <p className="text-muted" style={{ marginBottom: '24px', fontSize: '0.9rem' }}>
              Ordering: <strong>{orderingCake.name}</strong> {orderingCake.id !== 0 && `(K${parseFloat(orderingCake.price).toFixed(2)})`}
            </p>
            
            <form onSubmit={submitOrder}>
              {orderingCake.id === 0 && (
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
                <button type="button" className="btn-secondary" onClick={() => setIsOrderModalOpen(false)}>Cancel</button>
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
                    <p style={{ margin: '8px 0', fontSize: '0.95rem' }}><strong>Cake:</strong> {trackResult.orderItems[0]?.cake?.name}</p>
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
                            <span style={{ fontWeight: trackResult.status.toLowerCase() === 'pending' ? 'bold' : 'normal', color: trackResult.status.toLowerCase() === 'pending' ? 'var(--accent-color)' : 'var(--text-muted)' }}>1. Pending</span>
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
                    <a href="tel:0975586410" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 'bold' }}>0975586410</a>
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

    </>
  );
}

export default App;
