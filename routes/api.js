const express = require('express');
const ShopifyService = require('../services/shopify');
const router = express.Router();

// Helper function to extract phone number from order
function getPhoneNumber(order) {
  return order.customer?.phone || order.phone || order.billing_address?.phone || order.shipping_address?.phone || 'N/A';
}

// Store settings (in memory for now, later we'll use a database)
let appSettings = {
  searchDays: 14, // Default 14 days
  tagName: '🔴 DUPLICAT-CANCELED',
  tagColor: 'red',
  autoCancel: true, // Auto-cancel duplicate orders
  webhookEnabled: true
};

// Get app settings
router.get('/settings', (req, res) => {
  res.json({ success: true, settings: appSettings });
});

// Update app settings
router.post('/settings', (req, res) => {
  const { searchDays, tagName, tagColor } = req.body;
  
  if (searchDays) appSettings.searchDays = parseInt(searchDays);
  if (tagName) appSettings.tagName = tagName;
  if (tagColor) appSettings.tagColor = tagColor;
  
  res.json({ success: true, settings: appSettings });
});

// Find duplicates endpoint
router.post('/find-duplicates', async (req, res) => {
  try {
    const { searchDays, useMockData } = req.body;
    const days = searchDays || appSettings.searchDays;
    
    console.log(`🔍 Starting duplicate detection for last ${days} days...`);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    let allOrders = [];
    
    // Try to use real Shopify API if configured
    if (!useMockData && process.env.SHOPIFY_SHOP && process.env.SHOPIFY_ACCESS_TOKEN) {
      try {
        console.log('🛍️ Using real Shopify API...');
        const shopify = new ShopifyService(process.env.SHOPIFY_SHOP, process.env.SHOPIFY_ACCESS_TOKEN);
        
        // Test connection first
        const connectionTest = await shopify.testConnection();
        if (!connectionTest.success) {
          throw new Error(`Shopify connection failed: ${connectionTest.error}`);
        }
        
        // Get orders from the specified date range
        allOrders = await shopify.getOrdersSince(startDate);
        console.log(`📡 Fetched ${allOrders.length} orders from Shopify API`);
        
      } catch (apiError) {
        console.error('❌ Shopify API error, falling back to mock data:', apiError.message);
        allOrders = getMockOrders(); // Fallback to mock data
      }
    } else {
      console.log('🧪 Using mock data (API not configured or explicitly requested)...');
      allOrders = getMockOrders();
    }
    
    // Filter unfulfilled orders
    const unfulfilledOrders = allOrders.filter(order => 
      !order.fulfillment_status || order.fulfillment_status === 'unfulfilled'
    );
    
    // Filter orders from date range
    const recentOrders = allOrders.filter(order => {
      const orderDate = new Date(order.created_at);
      const isInRange = orderDate >= startDate && orderDate <= endDate;
      console.log(`📅 Order ${order.name}: ${orderDate.toLocaleDateString()} - ${isInRange ? 'INCLUDED' : 'EXCLUDED'}`);
      return isInRange;
    });
    
    console.log(`📦 Found ${unfulfilledOrders.length} unfulfilled orders:`, unfulfilledOrders.map(o => o.name));
    console.log(`📅 Found ${recentOrders.length} orders in last ${days} days:`, recentOrders.map(o => `${o.name} (${getPhoneNumber(o)})`));

function getMockOrders() {
  return [
    {
      id: '12345',
      name: '#1001',
      phone: '+40123456789',
      fulfillment_status: null, // unfulfilled
      created_at: new Date().toISOString(),
      customer: { phone: '+40123456789' }
    },
    {
      id: '12346', 
      name: '#1002',
      phone: '+40123456789',
      fulfillment_status: 'fulfilled',
      created_at: new Date(Date.now() - 1*24*60*60*1000).toISOString(), // 1 day ago
      customer: { phone: '+40123456789' }
    },
    {
      id: '12347',
      name: '#1003', 
      phone: '+40987654321',
      fulfillment_status: null,
      created_at: new Date().toISOString(),
      customer: { phone: '+40987654321' }
    },
    {
      id: '12348',
      name: '#1004',
      phone: '+40555999888', 
      fulfillment_status: null,
      created_at: new Date().toISOString(),
      customer: { phone: '+40555999888' }
    },
    {
      id: '12349',
      name: '#1005',
      phone: '+40555999888',
      fulfillment_status: 'fulfilled', 
      created_at: new Date(Date.now() - 3*24*60*60*1000).toISOString(), // 3 days ago
      customer: { phone: '+40555999888' }
    }
  ];
}
    
    // Find duplicates by phone number
    const duplicates = [];
    const phoneGroups = {};
    
    // Group orders by phone number
    recentOrders.forEach(order => {
      const phone = getPhoneNumber(order);
      console.log(`📞 Processing order ${order.name}: phone=${phone}, fulfillment=${order.fulfillment_status}`);
      if (phone && phone !== 'N/A') {
        if (!phoneGroups[phone]) {
          phoneGroups[phone] = [];
        }
        phoneGroups[phone].push(order);
      }
    });
    
    console.log(`📱 Phone groups:`, Object.keys(phoneGroups).map(phone => 
      `${phone}: ${phoneGroups[phone].length} orders`
    ));
    
    // Find phone numbers with multiple orders
    for (const [phone, orders] of Object.entries(phoneGroups)) {
      if (orders.length > 1) {
        // Find unfulfilled orders in this group
        const unfulfilledInGroup = orders.filter(order => 
          !order.fulfillment_status || order.fulfillment_status === 'unfulfilled' || order.fulfillment_status === null
        );
        
        if (unfulfilledInGroup.length > 0) {
          const otherOrders = orders.filter(order => order.id !== unfulfilledInGroup[0].id);
          
          duplicates.push({
            phone: phone,
            unfulfilledOrder: unfulfilledInGroup[0],
            duplicateOrders: otherOrders,
            duplicateOrderNumbers: otherOrders.map(o => o.name)
          });
        }
      }
    }
    
    console.log(`🚨 Found ${duplicates.length} duplicate phone numbers`);
    
    // Apply tags and notes if using real API
    if (!useMockData && process.env.SHOPIFY_SHOP && process.env.SHOPIFY_ACCESS_TOKEN && duplicates.length > 0) {
      console.log('🏷️ Applying tags and notes to duplicate orders...');
      const shopify = new ShopifyService(process.env.SHOPIFY_SHOP, process.env.SHOPIFY_ACCESS_TOKEN);
      
      for (const duplicate of duplicates) {
        try {
          const orderId = duplicate.unfulfilledOrder.id;
          const orderName = duplicate.unfulfilledOrder.name;
          
          console.log(`📱 Phone ${duplicate.phone}:`);
          console.log(`  - Unfulfilled: ${orderName}`);
          console.log(`  - Duplicates: ${duplicate.duplicateOrderNumbers.join(', ')}`);
          
          // Add tag
          await shopify.addTagsToOrder(orderId, appSettings.tagName);
          console.log(`  ✅ Added tag: "${appSettings.tagName}"`);
          
          // Add note
          const noteText = `MANUAL DUPLICATE DETECTION\nDuplicate găsite: ${duplicate.duplicateOrderNumbers.join(', ')}\nDetection time: ${new Date().toLocaleString()}\nStatus: CANCELED - Needs manual review`;
          await shopify.addNoteToOrder(orderId, noteText);
          console.log(`  ✅ Added note: "${noteText}"`);
          
          // Cancel order if auto-cancel is enabled
          if (appSettings.autoCancel) {
            const cancelNote = `Manual duplicate detection - matches orders: ${duplicate.duplicateOrderNumbers.join(', ')}`;
            await shopify.cancelOrder(orderId, {
              reason: 'other',
              email: false,
              refund: false,
              note: cancelNote
            });
            console.log(`  ❌ Order CANCELED automatically`);
          }
          
        } catch (error) {
          console.error(`  ❌ Error processing ${duplicate.unfulfilledOrder.name}:`, error.message);
        }
      }
    } else {
      // Log what we would do (mock mode or no duplicates)
      for (const duplicate of duplicates) {
        console.log(`📱 Phone ${duplicate.phone}:`);
        console.log(`  - Unfulfilled: ${duplicate.unfulfilledOrder.name}`);
        console.log(`  - Duplicates: ${duplicate.duplicateOrderNumbers.join(', ')}`);
        console.log(`  - Would add tag: "${appSettings.tagName}"`);
        console.log(`  - Would add note: "Duplicate găsite: ${duplicate.duplicateOrderNumbers.join(', ')}"`);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Scan completed! Found ${duplicates.length} orders with duplicate phone numbers.`,
      duplicatesFound: duplicates.length,
      details: duplicates.map(d => ({
        phone: d.phone,
        unfulfilledOrder: d.unfulfilledOrder.name,
        duplicates: d.duplicateOrderNumbers
      }))
    });
    
  } catch (error) {
    console.error('❌ Error finding duplicates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook endpoint for new orders  
router.post('/webhooks/orders/create', async (req, res) => {
  try {
    console.log('🔔 Received order creation webhook');
    console.log('📋 Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
    
    // Parse webhook data - req.body should already be parsed by express.json()
    const order = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    console.log(`📦 New order: ${order.name} (${order.id})`);
    
    if (!appSettings.webhookEnabled) {
      console.log('⚠️ Webhooks disabled, skipping processing');
      return res.status(200).send('OK');
    }

    // Only process unfulfilled orders
    if (order.fulfillment_status && order.fulfillment_status !== 'unfulfilled') {
      console.log(`⏭️ Skipping fulfilled order ${order.name}`);
      return res.status(200).send('OK');
    }

    // Check for duplicates for this new order
    const phone = getPhoneNumber(order);
    if (!phone || phone === 'N/A') {
      console.log(`📞 No phone number found for order ${order.name}, skipping`);
      return res.status(200).send('OK');
    }

    console.log(`🔍 Checking order ${order.name} for duplicates (phone: ${phone})`);
    console.log(`📅 Search date range: ${startDate.toISOString()} to ${new Date().toISOString()}`);
    console.log(`🔎 Will search in ${recentOrders ? 'existing' : 'fetching'} orders...`);

    // Get orders from last X days to check for duplicates
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - appSettings.searchDays);
    
    const shopify = new ShopifyService(process.env.SHOPIFY_SHOP, process.env.SHOPIFY_ACCESS_TOKEN);
    const recentOrders = await shopify.getOrdersSince(startDate);
    console.log(`📦 Found ${recentOrders.length} recent orders to check`);
    
    // Find orders with the same phone number (excluding the current order)
    const duplicateOrders = recentOrders.filter(existingOrder => {
      const existingPhone = getPhoneNumber(existingOrder);
      console.log(`📞 Comparing: ${phone} vs ${existingPhone} (Order: ${existingOrder.name})`);
      return existingOrder.id !== order.id && existingPhone === phone;
    });
    
    console.log(`🔍 After filtering: found ${duplicateOrders.length} duplicates`);

    if (duplicateOrders.length > 0) {
      console.log(`🚨 DUPLICATE DETECTED! Order ${order.name} matches ${duplicateOrders.length} existing orders`);
      
      const duplicateOrderNumbers = duplicateOrders.map(o => o.name);
      
      // Add tag
      await shopify.addTagsToOrder(order.id, appSettings.tagName);
      console.log(`✅ Tagged order ${order.name} with "${appSettings.tagName}"`);
      
      // Add note
      const noteText = `🚨 AUTOMATIC DUPLICATE DETECTION\nDuplicate găsite: ${duplicateOrderNumbers.join(', ')}\nDetection time: ${new Date().toLocaleString()}\nStatus: CANCELED - Needs manual review`;
      await shopify.addNoteToOrder(order.id, noteText);
      console.log(`✅ Added note to order ${order.name}`);
      
      // Cancel order
      if (appSettings.autoCancel) {
        const cancelNote = `Automatic duplicate detection - matches orders: ${duplicateOrderNumbers.join(', ')}`;
        await shopify.cancelOrder(order.id, {
          reason: 'other',
          email: false,
          refund: false,
          note: cancelNote
        });
        console.log(`❌ Order ${order.name} CANCELED automatically`);
      }
      
      console.log(`✅ Order ${order.name} processed successfully as duplicate`);
    } else {
      console.log(`✅ Order ${order.name} is clean - no duplicates found`);
    }

    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error.message);
    res.status(500).send('Error processing webhook');
  }
});

// Test Shopify API connection
router.get('/test-shopify', async (req, res) => {
  try {
    if (!process.env.SHOPIFY_SHOP || !process.env.SHOPIFY_ACCESS_TOKEN) {
      return res.json({
        success: false,
        message: 'Shopify credentials not configured',
        configured: false
      });
    }

    const shopify = new ShopifyService(process.env.SHOPIFY_SHOP, process.env.SHOPIFY_ACCESS_TOKEN);
    const result = await shopify.testConnection();
    
    res.json({
      success: result.success,
      message: result.success ? `Connected to ${result.shop.name}` : result.error,
      configured: true,
      shop: result.shop || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      configured: true
    });
  }
});

// Reopen canceled order (manual management)
router.post('/orders/:orderId/reopen', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { removeTag = true } = req.body;

    if (!process.env.SHOPIFY_SHOP || !process.env.SHOPIFY_ACCESS_TOKEN) {
      return res.status(400).json({ success: false, message: 'Shopify not configured' });
    }

    const shopify = new ShopifyService(process.env.SHOPIFY_SHOP, process.env.SHOPIFY_ACCESS_TOKEN);
    
    console.log(`🔄 Manually reopening canceled order ${orderId}`);
    
    // Reopen order
    await shopify.reopenOrder(orderId);
    
    // Remove duplicate tag if requested
    if (removeTag) {
      const order = await shopify.makeRequest(`/orders/${orderId}.json`);
      const currentTags = order.order.tags ? order.order.tags.split(', ') : [];
      const newTags = currentTags.filter(tag => tag !== appSettings.tagName);
      
      await shopify.updateOrder(orderId, {
        tags: newTags.join(', ')
      });
      
      console.log(`✅ Removed tag "${appSettings.tagName}" from order ${orderId}`);
    }
    
    // Add reopen note
    const reopenNote = `✅ MANUALLY REOPENED\nOrder reopened at: ${new Date().toLocaleString()}\nConsidered legitimate order, not a duplicate.`;
    await shopify.addNoteToOrder(orderId, reopenNote);
    
    console.log(`✅ Order ${orderId} reopened successfully`);

    res.json({ 
      success: true, 
      message: `Order ${orderId} reopened successfully`
    });
    
  } catch (error) {
    console.error('❌ Error reopening order:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get canceled duplicate orders (for dashboard management)
router.get('/orders/canceled-duplicates', async (req, res) => {
  try {
    if (!process.env.SHOPIFY_SHOP || !process.env.SHOPIFY_ACCESS_TOKEN) {
      return res.status(400).json({ success: false, message: 'Shopify not configured' });
    }

    const shopify = new ShopifyService(process.env.SHOPIFY_SHOP, process.env.SHOPIFY_ACCESS_TOKEN);
    
    // Get canceled orders
    const canceledOrders = await shopify.getCanceledOrders();
    
    // Filter orders that have our duplicate tag
    const duplicateCanceledOrders = canceledOrders.filter(order => {
      const tags = order.tags ? order.tags.split(', ') : [];
      return tags.includes(appSettings.tagName);
    });
    
    const formattedOrders = duplicateCanceledOrders.map(order => ({
      id: order.id,
      name: order.name,
      customer: (order.customer?.first_name || '') + ' ' + (order.customer?.last_name || ''),
      phone: getPhoneNumber(order),
      total_price: order.total_price,
      created_at: order.created_at,
      canceled_at: order.cancelled_at,
      cancel_reason: order.cancel_reason,
      tags: order.tags
    }));
    
    res.json({ 
      success: true, 
      canceledOrders: formattedOrders,
      count: formattedOrders.length
    });
    
  } catch (error) {
    console.error('❌ Error getting canceled duplicate orders:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint to verify API is working
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;