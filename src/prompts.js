/**
 * AI Prompts for Expo Upgrade functionality
 */

/**
 * Generate Gemini prompt for expo doctor resolution
 * @param {string} errorLog - The expo doctor error log
 * @param {Object} packageJson - The current package.json content
 * @returns {string} The formatted prompt for Gemini AI
 */
function generateGeminiExpoDoctorPrompt(errorLog, packageJson) {
    return `I'm getting an error when running "npx expo doctor" in my Expo project. Here's the error:
${errorLog}

and the package.json is:
${JSON.stringify(packageJson, null, 2)}

CRITICAL INSTRUCTIONS:
1. Look for ALL lines in the error that say "expected version: X.Y.Z" 
2. Update EVERY package to use the EXACT version specified in the error
3. Remove any packages that the error says should not be installed directly (like expo-modules-core)
4. Keep all other packages that are not mentioned in the error
5. Ignore Untested on New Architecture: message and all the dependencies that are mentioned in that section.

For example, if the error says:
- expo@53.0.17 - expected version: 53.0.19
- expo-build-properties@0.13.1 - expected version: ~0.14.8
- @expo/vector-icons@14.0.2 - expected version: ^14.1.0

Then update the package.json to use:
- "expo": "53.0.19"
- "expo-build-properties": "~0.14.8" 
- "@expo/vector-icons": "^14.1.0"

IMPORTANT: Do NOT keep old versions. Use ONLY the versions specified in the error log. Do Not update devDependencies. When updating versions, remove ~ and ^.

Your response should be in JSON format with the following structure:
{
    "data": "package.json JSON content",
    "status": "success" or "error"
}

IMPORTANT: Set status to "success" ONLY if after applying the package.json updates, there would be NO remaining errors when running "npx expo doctor". If there would still be errors after the updates, set status to "error". Ignore the "Untested on New Architecture" section when analyzing remaining errors.`;
}

/**
 * Generate Ollama prompt for expo doctor resolution
 * @param {string} errorLog - The expo doctor error log
 * @param {Object} packageJson - The current package.json content
 * @returns {string} The formatted prompt for Ollama AI
 */
function generateOllamaExpoDoctorPrompt(errorLog, packageJson) {
    return `I'm getting an error when running "npx expo doctor" in my Expo project. Here's the error:
${errorLog}

and the package.json is:
${JSON.stringify(packageJson, null, 2)}

CRITICAL INSTRUCTIONS:
1. Look for ALL lines in the error that say "expected version: X.Y.Z" 
2. Update EVERY package to use the EXACT version specified in the error
3. Remove any packages that the error says should not be installed directly (like expo-modules-core)
4. Keep all other packages that are not mentioned in the error
5. Ignore Untested on New Architecture: message and all the dependencies that are mentioned in that section.

For example, if the error says:
- expo@53.0.17 - expected version: 53.0.19
- expo-build-properties@0.13.1 - expected version: ~0.14.8
- @expo/vector-icons@14.0.2 - expected version: ^14.1.0

Then update the package.json to use:
- "expo": "53.0.19"
- "expo-build-properties": "~0.14.8" 
- "@expo/vector-icons": "^14.1.0"

IMPORTANT: Do NOT keep old versions. Use ONLY the versions specified in the error log. Do Not update devDependencies. When updating versions, remove ~ and ^.

Your response should be in JSON format with the following structure:
{
    "data": "package.json JSON content",
    "status": "success" or "error"
}

IMPORTANT: Set status to "success" ONLY if after applying the package.json updates, there would be NO remaining errors when running "npx expo doctor". If there would still be errors after the updates, set status to "error". Ignore the "Untested on New Architecture" section when analyzing remaining errors.`;
}

/**
 * Generate Ollama format schema for expo doctor resolution
 * @returns {Object} The JSON schema format for Ollama structured output
 */
function generateOllamaExpoDoctorFormat() {
    return {
        type: "object",
        properties: {
            data: {
                type: "object",
                description: "The updated package.json content as a JSON object"
            },
            status: {
                type: "string",
                description: "Status of the operation, should be 'success'"
            }
        },
        required: ["data", "status"]
    };
}

module.exports = {
    generateGeminiExpoDoctorPrompt,
    generateOllamaExpoDoctorPrompt,
    generateOllamaExpoDoctorFormat
}; 