require('dotenv').config();
const axios = require('axios');


async function getAzureADToken() {
    // Replace hardcoded values with environment variables
    const tenantId = process.env.tenant_Id;
    const clientId = process.env.client_Id;
    const clientSecret = process.env.client_Secret;
    const scope = process.env.ADscope;
    
    // Use the environment variable for the token URL
    const tokenUrl = process.env.token_url;
    
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