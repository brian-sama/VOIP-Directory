/**
 * Yeastar PBX API Integration Service
 * 
 * This service connects to your Yeastar PBX API to fetch real-time
 * extension registration status.
 * 
 * Configuration via .env:
 *   YEASTAR_API_URL=http://192.168.x.x:8088
 *   YEASTAR_API_USERNAME=api
 *   YEASTAR_API_PASSWORD=your_password
 */

const axios = require('axios');

class YeastarService {
    constructor() {
        this.baseUrl = process.env.YEASTAR_API_URL || '';
        this.username = process.env.YEASTAR_API_USERNAME || 'api';
        this.password = process.env.YEASTAR_API_PASSWORD || '';
        this.token = null;
        this.tokenExpiry = null;
        this.enabled = !!this.baseUrl;

        if (!this.enabled) {
            console.log('[Yeastar Service] Not configured. Set YEASTAR_API_URL in .env to enable.');
        }
    }

    /**
     * Authenticate with Yeastar API and get access token
     */
    async authenticate() {
        if (!this.enabled) return false;

        // Check if token is still valid (with 1 minute buffer)
        if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
            return true;
        }

        try {
            const response = await axios.post(`${this.baseUrl}/api/v2.0.0/login`, {
                username: this.username,
                password: this.password
            }, {
                timeout: 5000
            });

            if (response.data && response.data.token) {
                this.token = response.data.token;
                // Token typically valid for 30 minutes
                this.tokenExpiry = Date.now() + (30 * 60 * 1000);
                console.log('[Yeastar Service] Authentication successful');
                return true;
            }

            console.error('[Yeastar Service] Authentication failed: No token received');
            return false;
        } catch (err) {
            console.error('[Yeastar Service] Authentication error:', err.message);
            return false;
        }
    }

    /**
     * Get all extensions with their registration status from Yeastar
     * Returns a Map of extension_number -> status object
     */
    async getAllExtensionStatuses() {
        if (!this.enabled) {
            return new Map();
        }

        const authenticated = await this.authenticate();
        if (!authenticated) {
            return new Map();
        }

        try {
            const response = await axios.get(`${this.baseUrl}/api/v2.0.0/extension/list`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                params: {
                    page: 1,
                    page_size: 500  // Adjust based on your extension count
                },
                timeout: 10000
            });

            const statusMap = new Map();

            if (response.data && response.data.data) {
                for (const ext of response.data.data) {
                    statusMap.set(String(ext.number), {
                        registered: ext.status === 'registered' || ext.status === 'Registered',
                        sipStatus: ext.status === 'registered' || ext.status === 'Registered'
                            ? 'Registered'
                            : 'Unregistered',
                        ip: ext.ip_addr || null
                    });
                }
            }

            console.log(`[Yeastar Service] Fetched status for ${statusMap.size} extensions`);
            return statusMap;
        } catch (err) {
            console.error('[Yeastar Service] Error fetching extensions:', err.message);
            return new Map();
        }
    }

    /**
     * Check if Yeastar integration is enabled and working
     */
    async healthCheck() {
        if (!this.enabled) {
            return { enabled: false, connected: false, message: 'Not configured' };
        }

        const authenticated = await this.authenticate();
        return {
            enabled: true,
            connected: authenticated,
            message: authenticated ? 'Connected to Yeastar PBX' : 'Authentication failed'
        };
    }
}

// Export singleton instance
module.exports = new YeastarService();
