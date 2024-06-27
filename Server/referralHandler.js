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

//Here we are pushing the task to Azure FHIR server
async function makeFHIRRequestForTask(task) {
    try {
        const fhirServerURL = process.env.fhirServer_URL;
        const accessToken = await getAzureADToken();
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

//check if the task exists with the service request
//creates the task if it doesnot exists
async function checkTasks(queryJson, patientIdEntry, serviceRequestIdEntry){
    const patientId = patientIdEntry.item.reference.split('/')[1];
    const serviceRequestId = serviceRequestIdEntry.item.reference.split('/')[1];

        const fhirServerURL = process.env.fhirServer_URL;
        const accessToken = await getAzureADToken();
        const baseUrl = `${fhirServerURL}/Task`;
        const queryUrl = `${baseUrl}?focus:ServiceRequest=${serviceRequestId}`;
        console.log("queryUrl for checking task", queryUrl)

        try {
            const response = await axios.get(queryUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            const doesServiceRequestExist = response.data.entry && response.data.entry.some(task => {
                const taskServiceRequestId = task.resource.focus?.reference?.split('/')[1];
                console.log("doesServiceRequestExist", taskServiceRequestId);
                console.log("serviceRequestId", serviceRequestId)
                return taskServiceRequestId === serviceRequestId;
            });
            console.log("doesServiceRequestExist", doesServiceRequestExist);
            return doesServiceRequestExist;
        }catch (error) {
            console.error('Failed to query tasks:', error.response?.data || error.message);
            return false;
        }
}

//push patient to azure fhir server
async function makeFHIRRequestForPatient(patientData, patientId){
    try {
        const fhirServerURL = process.env.fhirServer_URL;
        const accessToken = await getAzureADToken();
        const response = await axios.put(`${fhirServerURL}/Patient/${patientId}`, patientData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Failed to create/update Patient in Azure FHIR server:', error.response?.data || error.message);
        return null;
    }
}

//push service request to azure fhir server
async function makeFHIRRequestForServiceRequest(serviceRequestData, serviceRequestId){
    try {
        const fhirServerURL = process.env.fhirServer_URL;
        const accessToken = await getAzureADToken();
        const response = await axios.put(`${fhirServerURL}/ServiceRequest/${serviceRequestId}`, serviceRequestData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Failed to create/update Service Request:', error.response?.data || error.message);
        return null;
    }
}

//push practicnor details to azure fhir server
async function makeFHIRRequestForPractitioner(practitionerData, practitionerId) {
    try {
        const fhirServerURL = process.env.fhirServer_URL;
        const accessToken = await getAzureADToken();
        const response = await axios.put(`${fhirServerURL}/Practitioner/${practitionerId}`, practitionerData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Failed to create/update Practitioner:', error.response?.data || error.message);
        return null;
    }
}
//push the created bundle to the Azure FHIR Server
async function makeFHIRRequestForBundle(bundle) {
    try {
        const fhirServerURL = process.env.fhirServer_URL;
        const accessToken = await getAzureADToken();
        const response = await axios.post(`${fhirServerURL}/Bundle`, bundle, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Failed to create Bundle:', error.response?.data || error.message);
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
async function getPractitionerDetails(queryJson, patientIdEntry, serviceRequestIdEntry) {
    const requesterReference = queryJson.entry.map(entry => entry.resource?.requester?.reference).find(reference => reference);
    const performerReference = queryJson.entry.map(entry => entry.resource?.performer?.[0]?.reference).find(reference => reference);

    // Process requester if exists
    if (requesterReference) {
        const practitionerId = requesterReference.split('/')[1];

        const requesterPractitioner = queryJson.entry.find(entry =>
            entry.fullUrl.includes(practitionerId) && entry.resource.resourceType === 'Practitioner'
        )?.resource;

        makeFHIRRequestForPractitioner(requesterPractitioner, practitionerId);
        if (requesterPractitioner) {
            const requesterPractitionerId = requesterPractitioner.id;
            const requesterPractitionerName = `${requesterPractitioner.name[0]?.given?.join(' ') || ''} ${requesterPractitioner.name[0]?.family || ''} ${requesterPractitioner.name[0]?.suffix?.join(' ') || ''}`;

            const value = await checkTasks(queryJson, patientIdEntry, serviceRequestIdEntry);
            //Lets make Task Object here
            if (!value){
                createTaskObject(patientIdEntry, serviceRequestIdEntry, requesterPractitionerId, requesterPractitionerName)
            }
        } else {
            console.log("Requester Practitioner not found in the queryJson.");
        }
    } else {
        console.log("Requester reference not found in any entry.");
    }

    // Process performer if exists
    if (performerReference) {
        const practitionerId = performerReference.split('/')[1];

        const performerPractitioner = queryJson.entry.find(entry =>
            entry.fullUrl.includes(practitionerId) && entry.resource.resourceType === 'Practitioner'
        )?.resource;

        makeFHIRRequestForPractitioner(performerPractitioner, practitionerId);

        if (performerPractitioner) {
            const performerPractitionerId = performerPractitioner.id;
            const performerPractitionerName = `${performerPractitioner.name[0]?.given?.join(' ') || ''} ${performerPractitioner.name[0]?.family || ''} ${performerPractitioner.name[0]?.suffix?.join(' ') || ''}`;

            const value = await checkTasks(queryJson, patientIdEntry, serviceRequestIdEntry);
            if (!value) {
                createTaskObject(patientIdEntry, serviceRequestIdEntry, performerPractitionerId, performerPractitionerName);
            }
        } else {
            console.log("Performer Practitioner not found in the queryJson.");
        }
    } else {
        console.log("Performer reference not found in any entry.");
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
    makeFHIRRequestForTask(task);
    return task
}

app.post('/list', async (req, res) => {
    try {
        const fhirListResource = req.body;
        validateFHIRListResource(fhirListResource);

        const athenaAccessToken = await getAthenaADToken();
        const athenaFhirUrl = process.env.athenafhir_URL;
        const subscriptionKey = process.env.athenaSubscription_KEY;

        // Extract patient ID and service request ID from the first and second entries
        const patientIdEntry = fhirListResource.entry.find(entry => entry.item.reference.includes('Patient'));
        const serviceRequestIdEntry = fhirListResource.entry.find(entry => entry.item.reference.includes('ServiceRequest'));

        const patientId = patientIdEntry ? patientIdEntry.item.reference.split('/')[1] : null;
        const serviceRequestId = serviceRequestIdEntry ? serviceRequestIdEntry.item.reference.split('/')[1] : null;

        // Construct URL based on patient ID and service request ID
        const queryUrl = `${athenaFhirUrl}/ServiceRequest?patient=${patientId}&_id=${serviceRequestId}`;

        // Execute the query once
        const response = await axios.get(queryUrl, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${athenaAccessToken}`,
                'Ocp-Apim-Subscription-Key': subscriptionKey
            }
        });
        // Extracted response data
        const queryJsonArray = response.data;
        
        const serviceRequestData = queryJsonArray.entry.find(entry => entry.resource.resourceType === 'ServiceRequest')?.resource;
        makeFHIRRequestForServiceRequest(serviceRequestData, serviceRequestId);
        
        const patientData = queryJsonArray.entry.find(entry => entry.resource.resourceType === 'Patient')?.resource;
        makeFHIRRequestForPatient(patientData, patientId);

        getPractitionerDetails(queryJsonArray, patientIdEntry, serviceRequestIdEntry);        
        makeFHIRRequestForBundle(queryJsonArray);

        res.status(200).json({ message: 'Success', queryResponses: queryJsonArray });
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
});