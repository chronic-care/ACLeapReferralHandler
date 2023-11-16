import React, { useState } from 'react';
import axios from 'axios';

const ReferralForm = () => {
    const [listInput, setListInput] = useState('');
    const [confirmation, setConfirmation] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e) => {
        setListInput(e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // backend endpoint URL
            const endpoint = 'http://localhost:3000/fhir/list';
            const response = await axios.post(endpoint, JSON.parse(listInput), {
                headers: { 'Content-Type': 'application/fhir+json' },
            });
            setConfirmation(response.data);
        } catch (error) {
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
                    <pre>{JSON.stringify(confirmation, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

export default ReferralForm;