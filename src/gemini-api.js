const axios = require('axios');

/**
 * Common function to interact with Gemini API
 * @param {string} geminiKey - The Gemini API key
 * @param {string} userPrompt - The user's prompt/message
 * @param {string} systemPrompt - The system prompt/context (optional)
 * @param {string} modelId - The model ID to use (default: gemini-2.0-flash-lite)
 * @param {string} apiMethod - The API method to use (default: generateContent)
 * @returns {Promise<string>} The text response from the model
 */
async function callGeminiAPI(geminiKey, userPrompt, systemPrompt = null, modelId = 'gemini-2.0-flash-lite', apiMethod = 'generateContent') {
    try {
        // Validate inputs
        if (!geminiKey || !geminiKey.trim()) {
            throw new Error('Gemini API key is required');
        }
        
        if (!userPrompt || !userPrompt.trim()) {
            throw new Error('User prompt is required');
        }

        // Prepare the request payload matching the bash script structure
        const requestBody = {
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: userPrompt
                        }
                    ]
                }
            ],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        // Add system prompt if provided
        if (systemPrompt && systemPrompt.trim()) {
            requestBody.contents.unshift({
                role: "system",
                parts: [
                    {
                        text: systemPrompt
                    }
                ]
            });
        }

        // Make the API request using the same URL structure as the bash script
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${apiMethod}?key=${geminiKey.trim()}`,
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract the text content from the response
        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            const candidate = response.data.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                return candidate.content.parts[0].text;
            }
        }
        
        throw new Error('Invalid response format from Gemini API');

    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            throw new Error(`Gemini API request failed: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            // The request was made but no response was received
            throw new Error(`Gemini API request failed: No response received - ${error.message}`);
        } else {
            // Something happened in setting up the request that triggered an Error
            throw new Error(`Gemini API call failed: ${error.message}`);
        }
    }
}

/**
 * Simplified function for basic Gemini API calls
 * @param {string} geminiKey - The Gemini API key
 * @param {string} prompt - The prompt to send to the model
 * @returns {Promise<string>} The text response from the model
 */
async function gemini(geminiKey, prompt) {
    return callGeminiAPI(geminiKey, prompt);
}

module.exports = {
    callGeminiAPI,
    gemini
}; 