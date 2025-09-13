const express = require('express');
const cors = require('cors');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', require('./routes/api'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth callback route
app.get('/auth/callback', (req, res) => {
  // For now, just redirect to main app
  res.redirect('/?shop=' + (req.query.shop || 'test-dupli.myshopify.com'));
});

// Main app route - serves the dashboard
app.get('/', (req, res) => {
  // Check if we have shop parameter (from Shopify)
  const shop = req.query.shop || 'test-dupli.myshopify.com';
  
  const html = `
    <html>
      <head>
        <title>Duplicates Detector</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="https://unpkg.com/@shopify/app-bridge@3"></script>
        <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <style>
          body { 
            margin: 0; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f6f6f7;
          }
          .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px;
          }
          .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .btn {
            padding: 12px 24px;
            background: #008060;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          }
          .btn:hover { background: #006b4f; }
          .btn:disabled { 
            background: #ccc; 
            cursor: not-allowed; 
          }
          .input {
            padding: 8px 12px;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            font-size: 14px;
          }
          .alert {
            padding: 15px;
            border-radius: 4px;
            margin-top: 15px;
          }
          .alert-success {
            background: #e8f5e8;
            border: 1px solid #4caf50;
            color: #2e7d32;
          }
          .alert-error {
            background: #ffebee;
            border: 1px solid #f44336;
            color: #c62828;
          }
          .info-box {
            background: #f0f8ff;
            border: 1px solid #b3d9ff;
            border-radius: 4px;
            padding: 15px;
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <div id="root"></div>
        <script type="text/babel">
          const { useState, useEffect } = React;
          
          // Initialize Shopify App Bridge
          const urlParams = new URLSearchParams(window.location.search);
          const shop = urlParams.get('shop') || '` + shop + `';
          
          let app;
          if (window.ShopifyAppBridge && shop) {
            try {
              app = window.ShopifyAppBridge.createApp({
                apiKey: 'f7e5ea65bc5904db9b38f8f46099cb2c',
                host: btoa(shop).replace(/=/g, ''),
                forceRedirect: true
              });
            } catch (e) {
              console.log('App Bridge init failed, running standalone');
            }
          }
          
          function App() {
            const [settings, setSettings] = useState({ searchDays: 14 });
            const [loading, setLoading] = useState(false);
            const [message, setMessage] = useState('');
            const [canceledOrders, setCanceledOrders] = useState([]);
            const [loadingOrders, setLoadingOrders] = useState(false);
            const [activeTab, setActiveTab] = useState('scan');
            
            const loadSettings = async () => {
              try {
                const response = await fetch('/api/settings');
                const data = await response.json();
                if (data.success) {
                  setSettings(data.settings);
                }
              } catch (error) {
                console.error('Error loading settings:', error);
              }
            };
            
            const saveSettings = async () => {
              try {
                setLoading(true);
                const response = await fetch('/api/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(settings)
                });
                
                const data = await response.json();
                if (data.success) {
                  setMessage('Settings saved successfully!');
                  setTimeout(() => setMessage(''), 3000);
                }
              } catch (error) {
                setMessage('Error saving settings');
                setTimeout(() => setMessage(''), 3000);
              } finally {
                setLoading(false);
              }
            };
            
            const findDuplicates = async () => {
              try {
                setLoading(true);
                const response = await fetch('/api/find-duplicates', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ searchDays: settings.searchDays })
                });
                
                const data = await response.json();
                if (data.success) {
                  setMessage(\`Found \${data.duplicatesFound} duplicate orders\`);
                  setTimeout(() => setMessage(''), 5000);
                }
              } catch (error) {
                setMessage('Error finding duplicates');
                setTimeout(() => setMessage(''), 3000);
              } finally {
                setLoading(false);
              }
            };
            
            const loadCanceledOrders = async () => {
              try {
                setLoadingOrders(true);
                const response = await fetch('/api/orders/canceled-duplicates');
                const data = await response.json();
                if (data.success) {
                  setCanceledOrders(data.canceledOrders);
                }
              } catch (error) {
                console.error('Error loading canceled orders:', error);
                showToast('Error loading canceled orders');
              } finally {
                setLoadingOrders(false);
              }
            };

            const reopenOrder = async (orderId, orderName) => {
              try {
                setLoading(true);
                const response = await fetch(\`/api/orders/\${orderId}/reopen\`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ removeTag: true })
                });
                
                const data = await response.json();
                if (data.success) {
                  showToast(\`Order \${orderName} reopened successfully!\`);
                  // Refresh the canceled orders list
                  await loadCanceledOrders();
                } else {
                  showToast('Error reopening order');
                }
              } catch (error) {
                console.error('Error reopening order:', error);
                showToast('Error reopening order');
              } finally {
                setLoading(false);
              }
            };

            const showToast = (msg) => {
              setMessage(msg);
              setTimeout(() => setMessage(''), 3000);
            };

            useEffect(() => {
              loadSettings();
              if (activeTab === 'management') {
                loadCanceledOrders();
              }
            }, [activeTab]);
            
            return (
              <div className="container">
                <div className="card">
                  <h1 style={{margin: '0 0 10px 0', color: '#1a1a1a'}}>🔍 Duplicates Detector</h1>
                  <p style={{margin: '0 0 20px 0', color: '#666'}}>Find and manage duplicate orders by phone number</p>
                  
                  <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
                    <button 
                      onClick={() => setActiveTab('scan')}
                      className="btn"
                      style={{
                        background: activeTab === 'scan' ? '#008060' : '#f6f6f7',
                        color: activeTab === 'scan' ? 'white' : '#666'
                      }}
                    >
                      🔍 Scan & Settings
                    </button>
                    <button 
                      onClick={() => setActiveTab('management')}
                      className="btn"
                      style={{
                        background: activeTab === 'management' ? '#008060' : '#f6f6f7',
                        color: activeTab === 'management' ? 'white' : '#666'
                      }}
                    >
                      📋 Manage Canceled Orders
                    </button>
                  </div>
                </div>
                
                {activeTab === 'scan' ? (
                  <div className="grid">
                    <div className="card">
                      <h3 style={{margin: '0 0 20px 0'}}>⚙️ Settings</h3>
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{display: 'block', marginBottom: '8px', fontWeight: '500'}}>
                          Search Period (days):
                        </label>
                        <input 
                          type="number" 
                          value={settings.searchDays}
                          onChange={(e) => setSettings({...settings, searchDays: parseInt(e.target.value) || 14})}
                          className="input"
                          min="1" max="365"
                          style={{width: '100px'}}
                        />
                        <div style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
                          Number of days to look back for comparing orders
                        </div>
                      </div>
                      <button 
                        onClick={saveSettings}
                        disabled={loading}
                        className="btn"
                      >
                        {loading ? '💾 Saving...' : '💾 Save Settings'}
                      </button>
                    </div>
                    
                    <div className="card">
                      <h3 style={{margin: '0 0 20px 0'}}>🔍 Find Duplicates</h3>
                      <p style={{margin: '0 0 15px 0'}}>
                        Compare unfulfilled orders with orders from the last <strong>{settings.searchDays} days</strong>.
                      </p>
                      
                      <div className="info-box">
                        <strong>📋 What this will do:</strong><br/>
                        • Find unfulfilled orders with matching phone numbers<br/>
                        • Add "DUPLICAT" tag to newer orders<br/>
                        • Add notes with duplicate order numbers
                      </div>
                      
                      <button 
                        onClick={findDuplicates}
                        disabled={loading}
                        className="btn"
                        style={{fontSize: '16px', padding: '15px 30px'}}
                      >
                        {loading ? '🔄 Finding...' : '🔍 Find Duplicates'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card">
                    <h3 style={{margin: '0 0 20px 0'}}>📋 Canceled Duplicate Orders</h3>
                    
                    <div style={{marginBottom: '20px'}}>
                      <button 
                        onClick={loadCanceledOrders}
                        disabled={loadingOrders}
                        className="btn"
                      >
                        {loadingOrders ? '🔄 Loading...' : '🔄 Refresh List'}
                      </button>
                    </div>
                    
                    {loadingOrders ? (
                      <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
                        Loading canceled orders...
                      </div>
                    ) : canceledOrders.length === 0 ? (
                      <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
                        <div style={{fontSize: '48px', marginBottom: '10px'}}>🎉</div>
                        No canceled duplicate orders found.
                      </div>
                    ) : (
                      <div style={{overflowX: 'auto'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse'}}>
                          <thead>
                            <tr style={{background: '#f6f6f7'}}>
                              <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Order</th>
                              <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Customer</th>
                              <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Phone</th>
                              <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Total</th>
                              <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd'}}>Canceled</th>
                              <th style={{padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd'}}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {canceledOrders.map(order => (
                              <tr key={order.id} style={{borderBottom: '1px solid #eee'}}>
                                <td style={{padding: '12px'}}>
                                  <strong>{order.name}</strong>
                                </td>
                                <td style={{padding: '12px'}}>
                                  {order.customer || 'N/A'}
                                </td>
                                <td style={{padding: '12px'}}>
                                  {order.phone || 'N/A'}
                                </td>
                                <td style={{padding: '12px'}}>
                                  ${order.total_price}
                                </td>
                                <td style={{padding: '12px'}}>
                                  {new Date(order.canceled_at).toLocaleDateString()}
                                </td>
                                <td style={{padding: '12px', textAlign: 'center'}}>
                                  <button
                                    onClick={() => reopenOrder(order.id, order.name)}
                                    disabled={loading}
                                    className="btn"
                                    style={{
                                      background: '#28a745',
                                      fontSize: '12px',
                                      padding: '6px 12px'
                                    }}
                                  >
                                    {loading ? '🔄' : '✅ Reopen'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
                
                {message && (
                  <div className={\`alert \${message.includes('Error') ? 'alert-error' : 'alert-success'}\`}>
                    {message}
                  </div>
                )}
                
                <div className="card" style={{marginTop: '30px', background: '#f8f9fa'}}>
                  <h4 style={{margin: '0 0 10px 0'}}>🚀 Status</h4>
                  <p style={{margin: 0, color: '#28a745'}}>
                    ✅ App is running successfully! Dashboard is functional.
                  </p>
                </div>
              </div>
            );
          }
          
          ReactDOM.render(<App />, document.getElementById('root'));
        </script>
      </body>
    </html>
  `;
  
  res.send(html);
});

// For Vercel serverless, export the app instead of listening
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Duplicates Detector running on port ${PORT}`);
    console.log(`📱 Dashboard: http://localhost:${PORT}`);
  });
} else {
  console.log('🚀 Running in Vercel serverless mode');
}

module.exports = app;