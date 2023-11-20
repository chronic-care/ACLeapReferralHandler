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

// Create a POST route for '/fhir/list' to accept FHIR List resources
app.post('/list', async (req, res) => {
    console.log("Received request body:", req.body);
    try {
        const fhirListResource = req.body; // Get the FHIR List resource from the request body
        console.log("Resource before validation:", JSON.stringify(fhirListResource, null, 2));
        validateFHIRListResource(fhirListResource); // Validate the FHIR List resource

        const accessToken = await getAzureADToken(); // Get the access token from Azure AD

        // Define the FHIR server URL (should be stored as an environment variable)
        const fhirServerURL = process.env.fhirServer_URL;
        // Send the List resource to the FHIR server
        const response = await axios.post(`${fhirServerURL}/List`, fhirListResource, {
            headers: {
                //'Content-Type': 'application/fhir+json', // Set content type as FHIR JSON
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}` // Set the authorization header
            }
        });

        // Log the FHIR server response
        console.log('FHIR server response:', JSON.stringify(response.data, null, 2));
        // Send back the FHIR server's response with a 201 status code
        return res.status(201).send(response.data);
    } catch (error) {
        // Log the error
        console.error('Error:', error);
        console.log("Error details:", JSON.stringify(error, null, 2));
        if (error.response) {
            // Send back the error response from the FHIR server
            return res.status(error.response.status).send({ message: 'FHIR Server Error', error: error.response.data });
        } else if (error.request) {
            // Handle no response received case
            return res.status(500).send({ message: 'No response received from FHIR Server', error: error.message });
        } else {
            // Handle other errors
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