require('dotenv').config();
const axios = require('axios');
require('dotenv').config();

async function getAzureADToken() {
    // Replace hardcoded values with environment variables
    const tenantId = process.env.TENANT_ID;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const scope = process.env.SCOPE;
    
    // Use the environment variable for the token URL
    const tokenUrl = process.env.TOKEN_URL;
    
    const tokenRequestData = new URLSearchParams();
    tokenRequestData.append('client_id', clientId);
    tokenRequestData.append('scope', scope);
    tokenRequestData.append('client_secret', clientSecret);
    tokenRequestData.append('grant_type', 'client_credentials');
    
    try {
        const tokenResponse = await axios.post(tokenUrl, tokenRequestData.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        return tokenResponse.data.access_token;
    } catch (error) {
        console.error('Error obtaining token from Azure AD:', error);
        throw new Error('Failed to obtain access token');
    }
}

module.exports = getAzureADToken;