const axios = require('axios');

/**
 * Common function to interact with Ollama API
 * @param {string} baseUrl - The Ollama API base URL (default: http://localhost:11434)
 * @param {string} userPrompt - The user's prompt/message
 * @param {string} systemPrompt - The system prompt/context (optional)
 * @param {string} modelName - The model name to use (default: llama3.2)
 * @param {Object} format - Structured output format (optional)
 * @returns {Promise<string>} The text response from the model
 */
async function callOllamaAPI(baseUrl = 'http://localhost:11434', userPrompt, systemPrompt = null, modelName = 'llama3.2', format = null) {
    try {
        // Validate inputs
        if (!userPrompt || !userPrompt.trim()) {
            throw new Error('User prompt is required');
        }

        // Prepare the request payload
        const requestBody = {
            model: modelName,
            prompt: userPrompt,
            stream: false
        };

        // Add system prompt if provided
        if (systemPrompt && systemPrompt.trim()) {
            requestBody.system = systemPrompt;
        }

        // Add structured output format if provided
        if (format) {
            requestBody.format = format;
        }

        // Make the API request
        const response = await axios.post(
            `${baseUrl}/api/generate`,
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.response;

    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            throw new Error(`Ollama API request failed: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            // The request was made but no response was received
            throw new Error(`Ollama API request failed: No response received - ${error.message}`);
        } else {
            // Something happened in setting up the request that triggered an Error
            throw new Error(`Ollama API call failed: ${error.message}`);
        }
    }
}

/**
 * Simplified function for basic Ollama API calls
 * @param {string} prompt - The prompt to send to the model
 * @param {string} modelName - The model name to use (default: llama3.2)
 * @param {string} baseUrl - The Ollama API base URL (default: http://localhost:11434)
 * @param {Object} format - Structured output format (optional)
 * @returns {Promise<string>} The text response from the model
 */
async function ollama(prompt, modelName = 'llama3.2', baseUrl = 'http://localhost:11434', format = null) {
    return callOllamaAPI(baseUrl, prompt, null, modelName, format);
}

module.exports = {
    callOllamaAPI,
    ollama
}; 