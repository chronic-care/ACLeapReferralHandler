require('dotenv').config();
const axios = require('axios');
const makeFHIRRequest = require('./referralHandler');
 
 
async function getAthenaADToken() {
    try {
      const apimUrl = 'https://acleapreferralhandler.azure-api.net/test2/token';
      const subscriptionKey = process.env.athenaSubscription_KEY;
 
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