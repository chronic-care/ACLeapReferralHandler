import React, { useState } from 'react';
import axios from 'axios';

const ReferralForm = () => {
    const [listInput, setListInput] = useState('');
    const [confirmation, setConfirmation] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e) => {
        console.log("Input changed:", e.target.value);
        setListInput(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const parsedInput = JSON.parse(listInput);
            console.log("Parsed input:", parsedInput);
            // backend endpoint URL
            const endpoint = 'https://referralhandlerserverside.azurewebsites.net';
            console.log("Attempting to post to URL:", endpoint);
            //const endpoint = '/list';
            const response = await axios.post(endpoint, JSON.parse(listInput), {
                //headers: { 'Content-Type': 'application/fhir+json' },
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                
            });
            console.log("Axios response:", response);
            setConfirmation(response.data);
        } catch (error) {
            console.log("Error in handleSubmit:", error);
            setConfirmation(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <h2>Send FHIR List</h2>
            <form onSubmit={handleSubmit}>
                <textarea
                    value={listInput}
                    onChange={handleInputChange}
                    rows="10"
                    cols="50"
                    placeholder="Paste the FHIR List JSON here"
                />
                <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Send List'}
                </button>
            </form>
            {confirmation && (
                <div>
                    <h3>Confirmation</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <h4>Post Response:</h4>
                            <pre style={{ background: '#f0f0f0', padding: '10px' }}>
                                {JSON.stringify(confirmation.postResponse, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <h4>Query Responses:</h4>
                            <pre style={{ background: '#f0f0f0', padding: '10px' }}>
                                {JSON.stringify(confirmation.queryResponses, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
};

export default ReferralForm;