require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const getAzureADToken = require('./getAzureADToken');
const getAthenaADToken = require('./getAthenaADToken');

const app = express();

// whitelist for allowed origins
const whitelist = ['https://acleapreferralhandler.azure-api.net', 'https://referralhandler.azurewebsites.net', 'http://localhost:3001', 'https://emrconnect.org', 'https://aphh.emrconnect.org:9443', 'https://referralhandlerserverside.azurewebsites.net'];

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

async function makeFHIRRequest(task) {
    try {
        const fhirServerURL = process.env.fhirServer_URL;
        const accessToken = await getAzureADToken();

        console.log("fhirServerURL", fhirServerURL);
        console.log("accessToken", accessToken);

        const response = await axios.post(`${fhirServerURL}/Task`, task, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        console.log("Task created successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error('Failed to create task:', error.response?.data || error.message);
        return null;
    }
}



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
function getPractitionerDetails(queryJson, patientIdEntry, serviceRequestIdEntry) {
    const requesterReference = queryJson.entry.map(entry => entry.resource?.requester?.reference).find(reference => reference);

    if (requesterReference) {
        const practitionerId = requesterReference.split('/')[1];

        const requesterPractitioner = queryJson.entry.find(entry =>
            entry.fullUrl.includes(practitionerId) && entry.resource.resourceType === 'Practitioner'
        )?.resource;

        if (requesterPractitioner) {
            const requesterPractitionerId = requesterPractitioner.id;
            const requesterPractitionerName = `${requesterPractitioner.name[0]?.given?.join(' ') || ''} ${requesterPractitioner.name[0]?.family || ''} ${requesterPractitioner.name[0]?.suffix?.join(' ') || ''}`;
            
            //Lets make Task Object here
            createTaskObject(patientIdEntry, serviceRequestIdEntry, requesterPractitionerId, requesterPractitionerName)
        } else {
            console.log("Requester Practitioner not found in the queryJson.");
        }
    } else {
        console.log("Requester reference not found in any entry.");
    }
}

function createTaskObject(patientId, serviceRequestReference, requesterPractitionerId, requesterPractitionerName) {
    const task= {
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
        "focus": { 
            "reference": serviceRequestReference.item.reference
        },
        "for": { 
            "reference": patientId.item.reference
        },
        "authoredOn": new Date().toISOString(),
        "requester": {
            "reference": `Practitioner/${requesterPractitionerId}`,
            "display": requesterPractitionerName
        },
        "businessStatus": {
            "text": "Received"
        },
        "owner": {
            "reference": "PractitionerRole/example-practitionerRole",
            "display": "Dr. Onwers"
        },
    };
    console.log("task", task);
    makeFHIRRequest(task);
    return task
}

app.post('/list', async (req, res) => {
    // console.log("Received request body:", req.body);
    try {
        const fhirListResource = req.body;
        // console.log("Resource before validation:", JSON.stringify(fhirListResource, null, 2));
        validateFHIRListResource(fhirListResource);

        const athenaAccessToken = await getAthenaADToken();
        console.log("athenaAccessToken", athenaAccessToken);
        const athenaFhirUrl = process.env.athenafhir_URL;
        const subscriptionKey = process.env.athenaSubscription_KEY;
        
        // Query for each Patient ID
        const queryPromises = fhirListResource.entry.map(async entry => {   
        
            // Extract patient ID and service request ID from the first and second entries
            const patientIdEntry = fhirListResource.entry.find(entry => entry.item.reference.includes('Patient'));
            const serviceRequestIdEntry = fhirListResource.entry.find(entry => entry.item.reference.includes('ServiceRequest'));

            const patientId = patientIdEntry ? patientIdEntry.item.reference.split('/')[1] : null;
            const serviceRequestId = serviceRequestIdEntry ? serviceRequestIdEntry.item.reference.split('/')[1] : null;

            // Construct URL based on patient ID and service request ID
            const queryUrl = `${athenaFhirUrl}/ServiceRequest?patient=${patientId}&_id=${serviceRequestId}`;
            console.log("Query URL:", queryUrl);
        
            try {
                if (queryUrl) {
                    const response = await axios.get(queryUrl, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${athenaAccessToken}`,
                            'Ocp-Apim-Subscription-Key': subscriptionKey
                        }
                    });
                    const queryJson = response.data
                    getPractitionerDetails(queryJson, patientIdEntry, serviceRequestIdEntry);
                    // console.log("queryJson", queryJson);
                    return queryJson;
                } else {
                    console.log("Not a Patient or ServiceRequest entry. Skipping query.");
                    return null;
                }
            } catch (error) {
                console.error('Failed to get query response:', error);
                return null;
            }
        });
        // console.log(queryPromises);
        const queryResponses = await Promise.all(queryPromises);
        res.status(200).json({ message: 'Success', queryResponses});

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
    res.status(200).json({ "Message": " Get method Confirmation" });
}
);

// Start the server on the specified port or default to 3000
const port = process.env.PORT;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`); // Log the server's running port
    // bToken = getAthenaADToken();
    // console.log('this is a message', bToken);

});
