import React, { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  Spinner,
  TextField,
  Frame,
  Toast
} from '@shopify/polaris';

function App() {
  const [settings, setSettings] = useState({ searchDays: 14 });
  const [loading, setLoading] = useState(false);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [duplicatesCount, setDuplicatesCount] = useState(0);

  // Load settings on app start
  useEffect(() => {
    loadSettings();
  }, []);

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
        showToast('Settings saved successfully!');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Error saving settings');
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
        setDuplicatesCount(data.duplicatesFound);
        showToast(`Found ${data.duplicatesFound} duplicate orders`);
      }
    } catch (error) {
      console.error('Error finding duplicates:', error);
      showToast('Error finding duplicates');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    setToastActive(true);
  };

  const handleSettingsChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Frame>
      <Page
        title="Duplicates Detector"
        subtitle="Find and manage duplicate orders by phone number"
      >
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd">Settings</Text>
                
                <TextField
                  label="Search Period (days)"
                  type="number"
                  value={settings.searchDays.toString()}
                  onChange={(value) => handleSettingsChange('searchDays', parseInt(value) || 14)}
                  helpText="Number of days to look back for comparing orders"
                  min={1}
                  max={365}
                />

                <InlineStack gap="200">
                  <Button 
                    variant="primary" 
                    onClick={saveSettings}
                    loading={loading}
                  >
                    Save Settings
                  </Button>
                  <Button onClick={loadSettings}>
                    Reset
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd">Find Duplicates</Text>
                
                <Text>
                  This will compare unfulfilled orders with all orders from the last {settings.searchDays} days based on phone numbers.
                </Text>

                <Banner status="info">
                  <p>
                    <strong>What this will do:</strong>
                    <br />• Find unfulfilled orders with matching phone numbers
                    <br />• Add "DUPLICAT" tag to newer orders
                    <br />• Add notes with duplicate order numbers
                  </p>
                </Banner>

                <Button 
                  variant="primary" 
                  size="large"
                  onClick={findDuplicates}
                  loading={loading}
                >
                  {loading ? <Spinner size="small" /> : null}
                  Find Duplicates
                </Button>

                {duplicatesCount > 0 && (
                  <Banner status="success">
                    Found {duplicatesCount} duplicate orders!
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {toastActive && (
          <Toast
            content={toastMessage}
            onDismiss={() => setToastActive(false)}
          />
        )}
      </Page>
    </Frame>
  );
}

export default App;