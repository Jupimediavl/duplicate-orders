const axios = require('axios');

class ShopifyService {
  constructor(shop, accessToken) {
    this.shop = shop;
    this.accessToken = accessToken;
    this.baseURL = `https://${shop}.myshopify.com/admin/api/2023-10`;
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`Shopify API Error: ${error.response?.status} - ${error.response?.statusText}`);
      console.error('Error details:', error.response?.data);
      throw error;
    }
  }

  async getOrders(params = {}) {
    const queryParams = new URLSearchParams({
      limit: 250, // Maximum allowed
      status: 'any', // Get all orders
      fields: 'id,name,phone,customer,billing_address,shipping_address,created_at,fulfillment_status,tags,note', // Include customer data
      ...params
    });

    console.log(`📡 Fetching orders: ${this.baseURL}/orders.json?${queryParams}`);
    const response = await this.makeRequest(`/orders.json?${queryParams}`);
    return response.orders || [];
  }

  async getUnfulfilledOrders() {
    console.log('📦 Fetching unfulfilled orders...');
    return await this.getOrders({
      fulfillment_status: 'unfulfilled'
    });
  }

  async getOrdersSince(date) {
    const isoDate = date.toISOString();
    console.log(`📅 Fetching orders since: ${isoDate}`);
    return await this.getOrders({
      created_at_min: isoDate
    });
  }

  async updateOrder(orderId, updates) {
    console.log(`📝 Updating order ${orderId}:`, updates);
    const response = await this.makeRequest(`/orders/${orderId}.json`, 'PUT', {
      order: updates
    });
    return response.order;
  }

  async addTagsToOrder(orderId, tags) {
    try {
      // First, get current order to preserve existing tags
      const response = await this.makeRequest(`/orders/${orderId}.json`);
      const currentOrder = response.order;
      
      const existingTags = currentOrder.tags ? currentOrder.tags.split(', ') : [];
      const newTags = Array.isArray(tags) ? tags : [tags];
      
      // Combine existing tags with new tags (avoid duplicates)
      const allTags = [...new Set([...existingTags, ...newTags])];
      const tagString = allTags.join(', ');
      
      console.log(`🏷️ Adding tags to order ${orderId}: ${newTags.join(', ')}`);
      
      return await this.updateOrder(orderId, {
        tags: tagString
      });
    } catch (error) {
      console.error(`❌ Error adding tags to order ${orderId}:`, error.message);
      throw error;
    }
  }

  async addNoteToOrder(orderId, note) {
    try {
      // Get current order to see existing notes
      const response = await this.makeRequest(`/orders/${orderId}.json`);
      const currentOrder = response.order;
      
      const existingNote = currentOrder.note || '';
      const newNote = existingNote ? `${existingNote}\n\n${note}` : note;
      
      console.log(`📝 Adding note to order ${orderId}: ${note}`);
      
      return await this.updateOrder(orderId, {
        note: newNote
      });
    } catch (error) {
      console.error(`❌ Error adding note to order ${orderId}:`, error.message);
      throw error;
    }
  }

  async holdOrder(orderId, reason = 'Duplicate order detected') {
    try {
      console.log(`⏸️ Putting order ${orderId} on HOLD: ${reason}`);
      
      // Create a risk assessment to hold the order
      const riskResponse = await this.makeRequest(`/orders/${orderId}/risks.json`, 'POST', {
        risk: {
          message: reason,
          recommendation: 'investigate',
          score: 1.0,
          source: 'External',
          cause_cancel: false,
          display: true
        }
      });
      
      console.log(`⏸️ Order ${orderId} put on HOLD successfully`);
      return riskResponse;
    } catch (error) {
      console.error(`❌ Error putting order ${orderId} on HOLD:`, error.message);
      throw error;
    }
  }

  async unholdOrder(orderId) {
    try {
      console.log(`▶️ Releasing order ${orderId} from HOLD`);
      
      // Get all risks for the order
      const risksResponse = await this.makeRequest(`/orders/${orderId}/risks.json`);
      const risks = risksResponse.risks || [];
      
      // Delete risks created by our app
      for (const risk of risks) {
        if (risk.source === 'External' && risk.message.includes('Duplicate')) {
          await this.makeRequest(`/orders/${orderId}/risks/${risk.id}.json`, 'DELETE');
          console.log(`🗑️ Removed risk ${risk.id} from order ${orderId}`);
        }
      }
      
      console.log(`▶️ Order ${orderId} released from HOLD successfully`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error releasing order ${orderId} from HOLD:`, error.message);
      throw error;
    }
  }

  async getOrderRisks(orderId) {
    try {
      const response = await this.makeRequest(`/orders/${orderId}/risks.json`);
      return response.risks || [];
    } catch (error) {
      console.error(`❌ Error getting risks for order ${orderId}:`, error.message);
      throw error;
    }
  }

  async cancelOrder(orderId, options = {}) {
    try {
      const {
        reason = 'other',
        email = false,
        refund = false,
        note = 'Canceled due to duplicate detection'
      } = options;

      console.log(`❌ Canceling order ${orderId}: ${note}`);
      
      const response = await this.makeRequest(`/orders/${orderId}/cancel.json`, 'POST', {
        reason: reason,
        email: email,
        refund: refund
      });
      
      console.log(`❌ Order ${orderId} canceled successfully`);
      return response;
    } catch (error) {
      console.error(`❌ Error canceling order ${orderId}:`, error.message);
      throw error;
    }
  }

  async reopenOrder(orderId) {
    try {
      console.log(`🔄 Reopening canceled order ${orderId}`);
      
      const response = await this.makeRequest(`/orders/${orderId}/open.json`, 'POST');
      
      console.log(`✅ Order ${orderId} reopened successfully`);
      return response;
    } catch (error) {
      console.error(`❌ Error reopening order ${orderId}:`, error.message);
      throw error;
    }
  }

  async getCanceledOrders(params = {}) {
    try {
      console.log('📋 Fetching canceled orders...');
      const queryParams = new URLSearchParams({
        status: 'cancelled',
        limit: 50,
        ...params
      });

      const response = await this.makeRequest(`/orders.json?${queryParams}`);
      return response.orders || [];
    } catch (error) {
      console.error('❌ Error getting canceled orders:', error.message);
      throw error;
    }
  }

  // Test connection
  async testConnection() {
    try {
      console.log('🔗 Testing Shopify connection...');
      const response = await this.makeRequest('/shop.json');
      console.log(`✅ Connected to shop: ${response.shop.name}`);
      return { success: true, shop: response.shop };
    } catch (error) {
      console.error('❌ Failed to connect to Shopify:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ShopifyService;