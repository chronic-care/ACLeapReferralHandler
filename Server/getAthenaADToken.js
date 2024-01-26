require('dotenv').config();
const axios = require('axios');
 
 
async function getAthenaADToken() {
    try {
      const apimUrl = 'https://acleapreferralhandler.azure-api.net/test2/token';
      const subscriptionKey = 'fbc46f8ac8ac42d7b7f00f6c73fb6ba5';
 
      const response = await axios.get(apimUrl, {
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey
        }
      });
 
      if (response.status === 200 && response.data.accessToken) {
        const data = response.data.accessToken;
        return data;
      } 
      else {
        console.error('Authentication failed.');
      }
    } catch (error) {
      console.error('Error when calling APIM:', error);
    }
  }
 
 
module.exports = getAthenaADToken;