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

// whitelist for allowed origins
const whitelist = ['https://acleapreferralhandler.azure-api.net','https://referralhandler.azurewebsites.net','http://localhost:3001','https://emrconnect.org', 'https://aphh.emrconnect.org:9443']; 

// Configure CORS options
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // To allow cookies and sessions
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
};

// Apply CORS with the specified options
app.use(cors(corsOptions));

// Use express.json() to parse JSON payloads
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

// Helper function to create a Task object
function createTaskObject(serviceRequestReference, patientId) {
    return {
        "resourceType": "Task",
        "meta": {
            "profile": [
                "http://hl7.org/fhir/us/sdoh-clinicalcare/StructureDefinition/SDOHCC-TaskForReferralManagement"
            ]
        },
        "status": "requested",
        "intent": "order",
        "code": {
            "coding": [
                {
                    "system": "http://hl7.org/fhir/CodeSystem/task-code",
                    "code": "fulfill",
                    "display": "Fulfill the service request"
                }
            ]
        },
        "focus": { "reference": serviceRequestReference },
        "for": { "reference": `Patient/${patientId}` },
        "authoredOn": new Date().toISOString(),
        "requester": {
            "reference": "Practitioner/example-practitioner",
            "display": "Dr. Example"
        }
        
    };
}

app.post('/list', async (req, res) => {
    console.log("Received request body:", req.body);
    try {
        const fhirListResource = req.body;
        console.log("Resource before validation:", JSON.stringify(fhirListResource, null, 2));
        validateFHIRListResource(fhirListResource);

        const accessToken = await getAzureADToken();
        const fhirServerURL = process.env.fhirServer_URL;
        
        // Post the List resource to the FHIR server
        const postResponse = await axios.post(`${fhirServerURL}/List`, fhirListResource, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
        });
        
        // Query for each Patient ID
        const queryPromises = fhirListResource.entry.map(entry => {
            const patientId = entry.item.reference.split('/')[1];
            const queryUrl = `${fhirServerURL}/ServiceRequest?patient=${patientId}&...`; 
            return axios.get(queryUrl, {
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
            }).then(response => response.data).catch(error => {
                console.error('Failed to get query response:', error);
                return null; 
            });
        });
        
        const queryResponses = await Promise.all(queryPromises);
        
        // Create a Task for each ServiceRequest
        const taskPromises = fhirListResource.entry.map(entry => {
            const serviceRequestReference = entry.item.reference;
            const patientId = serviceRequestReference.split('/')[1];
            const task = createTaskObject(serviceRequestReference, patientId); 
            
            return axios.post(`${fhirServerURL}/Task`, task, {
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
            }).then(response => response.data).catch(error => {
                console.error('Failed to create task:', error);
                return null; 
            });
        });
        
        const taskResponses = await Promise.all(taskPromises);
        
        // Combine the responses into one object to send back
        const combinedResponse = {
            postResponse: postResponse.data,
            queryResponses: queryResponses.filter(response => response != null),
            taskResponses: taskResponses.filter(response => response != null)
        };

        // Send back the combined response
        res.status(200).json(combinedResponse);
    } catch (error) {
        console.error('Error:', error);
        console.log("Error details:", JSON.stringify(error, null, 2));
        if (error.response) {
            res.status(error.response.status).send({ message: 'FHIR Server Error', error: error.response.data });
        } else if (error.request) {
            res.status(500).send({ message: 'No response received from FHIR Server', error: error.message });
        } else {
            res.status(500).send({ message: 'Error processing your request', error: error.message });
        }
    }
});

app.get('/ping', async (req, res) => {
    res.status(200).json({"Message" : " Get method Confirmation"});
}
);

// Start the server on the specified port or default to 3000
const port = process.env.PORT;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`); // Log the server's running port
});