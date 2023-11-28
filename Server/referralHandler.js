require('dotenv').config();
console.log(`Tenant ID: ${process.env.tenant_Id}`);
console.log(`Client ID: ${process.env.client_Id}`);
console.log(`Secret ID: ${process.env.client_Secret}`);
console.log(`Scope ID: ${process.env.ADscope}`);
console.log(`Token URL: ${process.env.token_Url}`);
console.log(`Server URL: ${process.env.fhirServer_URL}`);

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const getAzureADToken = require('./getAzureADToken');

const app = express();
app.use(cors());
app.use(express.json());

// validation function for the FHIR List resource
function validateFHIRListResource(resource) {
    if (!resource) {
        throw new Error('No resource payload provided.'); // Check if any resource is provided
    }
    if (resource.resourceType !== 'List') {
        throw new Error('Resource type must be List.'); // Ensure resource type is List
    }
    if (!resource.status || typeof resource.status !== 'string') {
        throw new Error('List status is required and must be a string.'); // Validate 'status' field
    }
    if (!resource.mode || typeof resource.mode !== 'string') {
        throw new Error('List mode is required and must be a string.'); // Validate 'mode' field
    }
    // Validate 'entry' array if it exists
    if (resource.entry && !Array.isArray(resource.entry)) {
        throw new Error('List entries must be an array if present.'); // Check 'entry' is an array
    }
    // Loop over each entry to validate further
    if (resource.entry) {
        resource.entry.forEach((entry, index) => {
            if (!entry.item || !entry.item.reference) {
                throw new Error(`Entry ${index} must have an item with a reference.`); // Each entry must have a 'reference'
            }
        });
    }
}

app.post('/list', async (req, res) => {
    console.log("Received request body:", req.body);
    try {
        const fhirListResource = req.body;
        console.log("Resource before validation:", JSON.stringify(fhirListResource, null, 2));
        validateFHIRListResource(fhirListResource);

        const accessToken = await getAzureADToken();
        const fhirServerURL = process.env.fhirServer_URL;

        // First, send the List resource to the FHIR server
        const postResponse = await axios.post(`${fhirServerURL}/List`, fhirListResource, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        console.log('FHIR server post response:', JSON.stringify(postResponse.data, null, 2));

        // Then, perform FHIR Queries for Each Patient ID
        const patientIds = fhirListResource.entry.map(entry => entry.item.reference.split('/')[1]);
        console.log("Extracted Patient IDs:", patientIds);
        let aggregatedResponse = [];
        for (const patientId of patientIds) {
            const queryUrl = `${fhirServerURL}/ServiceRequest?_count=1000&_format=json&_summary=data&patient=${patientId}&category=referrals&code=ZZZZZ,ZZZZZ-2&_include=ServiceRequest:*`;
            const queryResponse = await axios.get(queryUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            aggregatedResponse.push(queryResponse.data);
        }

        // Combine the post response and the aggregated query responses
        const combinedResponse = {
            postResponse: postResponse.data,
            queryResponses: aggregatedResponse
        };

        // Send back the combined response
        return res.status(200).send(combinedResponse);
    } catch (error) {
        console.error('Error:', error);
        console.log("Error details:", JSON.stringify(error, null, 2));
        if (error.response) {
            return res.status(error.response.status).send({ message: 'FHIR Server Error', error: error.response.data });
        } else if (error.request) {
            return res.status(500).send({ message: 'No response received from FHIR Server', error: error.message });
        } else {
            return res.status(500).send({ message: 'Error processing your request', error: error.message });
        }
    }
});


// Start the server on the specified port or default to 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`); // Log the server's running port
});





//DIR ROUTE:
//cd C:\Users\NoahGeorge\Desktop\referralHandler\ACLeap-Referral-Handler\client\src


//RUN APP:
//NODE referralHandler.js