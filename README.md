# Duplicates Detector - Shopify App

A Shopify app that detects duplicate orders based on phone numbers and automatically tags them for easy management.

## Features

- 🔍 **Smart Detection**: Compares unfulfilled orders with orders from the last X days
- 📱 **Phone Number Matching**: Identifies duplicates based on customer phone numbers  
- 🏷️ **Auto Tagging**: Automatically adds "DUPLICAT" tags to newer duplicate orders
- 📝 **Detailed Notes**: Adds order numbers of found duplicates to order notes
- ⚙️ **Configurable**: Dashboard to set search period (days)

## Setup

### Prerequisites
- Node.js 18+
- Shopify CLI
- Shopify Partner account

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd web/frontend && npm install
   ```

3. Create a Shopify app in your Partner Dashboard

4. Configure environment variables in `.env`:
   ```
   SHOPIFY_API_KEY=your_api_key
   SHOPIFY_API_SECRET=your_api_secret
   SCOPES=read_orders,write_orders,read_customers,write_customers
   HOST=localhost:3000
   ```

5. Update `shopify.app.toml` with your app details

### Development

```bash
npm run dev
```

This will start both the backend server and frontend development server.

## How It Works

1. **Configuration**: Set the number of days to look back (default: 14 days)
2. **Detection**: Click "Find Duplicates" to scan unfulfilled orders
3. **Comparison**: App compares phone numbers with orders from the specified period
4. **Tagging**: Duplicate orders get tagged with "DUPLICAT" 
5. **Notes**: Order notes are updated with duplicate order numbers

## API Endpoints

- `GET /api/settings` - Get app settings
- `POST /api/settings` - Update app settings  
- `POST /api/find-duplicates` - Run duplicate detection
- `GET /api/health` - Health check

## Future Features

- Custom tag names and colors
- Multiple comparison criteria (phone + email, phone + name, etc.)
- Advanced filtering options
- Detailed reporting and statistics
- Email notifications
- Auto-hold duplicate orders

## License

ISC License - REDUXIO SRL