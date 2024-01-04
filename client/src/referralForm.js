import React, { useState } from 'react';
import axios from 'axios';

const ReferralForm = () => {
    const [listInput, setListInput] = useState('');
    const [confirmation, setConfirmation] = useState(null);
    const [tasks, setTasks] = useState(null); // State to store tasks
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e) => {
        setListInput(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const parsedInput = JSON.parse(listInput);
            const endpoint = 'http://localhost:3000/list';
            const response = await axios.post(endpoint, parsedInput, {
                headers: { 'Content-Type': 'application/json' },
            });

            // Assuming response.data contains 'postResponse', 'queryResponses', and 'taskResponses'
            setConfirmation({
                postResponse: response.data.postResponse,
                queryResponses: response.data.queryResponses,
            });
            setTasks(response.data.taskResponses); // Save the tasks in state
        } catch (error) {
            console.error("Error in handleSubmit:", error);
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        {tasks && (
                            <div>
                                <h4>Task Responses:</h4>
                                <pre style={{ background: '#f0f0f0', padding: '10px' }}>
                                    {JSON.stringify(tasks, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReferralForm;
