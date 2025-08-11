document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.getElementById('textInput');
    const generateBtn = document.getElementById('generateBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingMessage = document.getElementById('loadingMessage');
    const generatedFunction = document.getElementById('generatedFunction');
    const functionOutput = document.getElementById('functionOutput');
    const alternateOutput = document.getElementById('alternateOutput');
    const reasonOutput = document.getElementById('reasonOutput');
    const copyPrimaryBtn = document.getElementById('copyPrimaryBtn');
    const copyAlternateBtn = document.getElementById('copyAlternateBtn');
    const copyBothBtn = document.getElementById('copyBothBtn');
    const validatePrimaryBtn = document.getElementById('validatePrimaryBtn');
    const validateAlternateBtn = document.getElementById('validateAlternateBtn');
    const noCacheBtn = document.getElementById('noCacheBtn');
    const errorMessage = document.getElementById('errorMessage');
    
    // Store the last prompt for potential reuse with no_cache option
    let lastPrompt = '';
    
    // Loading animation messages
    const loadingMessages = [
        "Analyzing your request...",
        "Collecting function requirements...",
        "Designing function structure...",
        "Determining parameter types...",
        "Planning return values...",
        "Implementing function logic...",
        "Applying Stonebranch best practices...",
        "Generating alternative implementation...",
        "Creating documentation...",
        "Finalizing function code..."
    ];
    
    let loadingAnimationInterval;
    
    // Function to start the loading animation
    function startLoadingAnimation() {
        let messageIndex = 0;
        
        // Display the first message immediately
        loadingMessage.textContent = loadingMessages[messageIndex];
        
        // Set up interval to rotate through messages
        loadingAnimationInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            
            // Fade out current text, change it, then fade in
            loadingMessage.style.opacity = 0;
            
            setTimeout(() => {
                loadingMessage.textContent = loadingMessages[messageIndex];
                loadingMessage.style.opacity = 1;
            }, 500);
            
        }, 3000); // Change message every 3 seconds
    }
    
    // Function to stop the loading animation
    function stopLoadingAnimation() {
        clearInterval(loadingAnimationInterval);
        loadingMessage.textContent = '';
    }

    // Function to make the API call with optional no_cache parameter
    async function makeApiCall(text, useNoCache = false) {
        // Store the prompt for potential reuse
        lastPrompt = text;
        
        // Show loading indicator and start animation
        loadingIndicator.style.display = 'block';
        generatedFunction.style.display = 'none';
        errorMessage.style.display = 'none';
        startLoadingAnimation();
        
        // Hide the no cache button (will be shown again if needed)
        noCacheBtn.style.display = 'none';
        
        try {
            // Prepare request body
            const requestBody = { 
                prompt: text,
                action: 'generate'
            };
            
            // Add no_cache option if requested
            if (useNoCache) {
                requestBody.no_cache = true;
            }
            
            // Call the AWS Lambda function to generate the function
            const response = await fetch('https://shpu5bt5nc665d2myhsilw6i6u0xhrbu.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            
            const responseData = await response.json();
            
            // Hide loading indicator and stop animation
            loadingIndicator.style.display = 'none';
            stopLoadingAnimation();
            
            // Display the generated function, alternate function, and reason
            functionOutput.textContent = responseData.function;
            alternateOutput.textContent = responseData.alternate_function || 'None provided';
            reasonOutput.textContent = responseData.reason || 'No explanation provided';
            generatedFunction.style.display = 'block';
            
            // Check if the response came from cache and show the no_cache button if needed
            if (responseData.from_cache === true) {
                noCacheBtn.style.display = 'inline-block';
            } else {
                noCacheBtn.style.display = 'none';
            }
            
            return responseData;
        } catch (error) {
            console.error('Error generating function:', error);
            loadingIndicator.style.display = 'none';
            stopLoadingAnimation();
            showError('An error occurred while generating the function. Please try again later.');
            throw error;
        }
    }
    
    // Event listener for generate button
    generateBtn.addEventListener('click', async () => {
        const text = textInput.value.trim();
        
        if (!text) {
            showError('Please enter a description of the function you want to generate.');
            return;
        }
        
        await makeApiCall(text, false);
    });
    
    // Event listener for copy primary function button
    copyPrimaryBtn.addEventListener('click', () => {
        const functionText = functionOutput.textContent;
        
        navigator.clipboard.writeText(functionText)
            .then(() => {
                const originalText = copyPrimaryBtn.textContent;
                copyPrimaryBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyPrimaryBtn.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                showError('Failed to copy to clipboard. Please try again.');
            });
    });
    
    // Event listener for copy alternate function button
    copyAlternateBtn.addEventListener('click', () => {
        const alternateText = alternateOutput.textContent;
        
        navigator.clipboard.writeText(alternateText)
            .then(() => {
                const originalText = copyAlternateBtn.textContent;
                copyAlternateBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyAlternateBtn.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                showError('Failed to copy to clipboard. Please try again.');
            });
    });
    
    // Event listener for copy both functions button
    copyBothBtn.addEventListener('click', () => {
        const functionText = functionOutput.textContent;
        const alternateText = alternateOutput.textContent;
        const textToCopy = `Primary Function:\n${functionText}\n\nAlternate Function:\n${alternateText}`;
        
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                const originalText = copyBothBtn.textContent;
                copyBothBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBothBtn.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                showError('Failed to copy to clipboard. Please try again.');
            });
    });
    
    // Event listener for validate primary function button
    validatePrimaryBtn.addEventListener('click', () => {
        const functionText = functionOutput.textContent;
        console.log("Validate Primary - Function text:", functionText);
        console.log("Validate Primary - Text length:", functionText.length);
        
        if (functionText.trim().length === 0) {
            showError('No function content to validate. Please generate a function first.');
            return;
        }
        
        // Redirect to the validator page with the primary function text
        window.location.href = `index.html?function=${encodeURIComponent(functionText)}`;
    });
    
    // Event listener for validate alternate function button
    validateAlternateBtn.addEventListener('click', () => {
        const functionText = alternateOutput.textContent;
        console.log("Validate Alternate - Function text:", functionText);
        console.log("Validate Alternate - Text length:", functionText.length);
        
        if (functionText.trim().length === 0) {
            showError('No alternate function content to validate. Please generate a function first.');
            return;
        }
        
        // Redirect to the validator page with the alternate function text
        window.location.href = `index.html?function=${encodeURIComponent(functionText)}`;
    });
    
    // Event listener for no cache button
    noCacheBtn.addEventListener('click', async () => {
        if (lastPrompt) {
            await makeApiCall(lastPrompt, true);
        } else {
            showError('No previous prompt available to rerun.');
        }
    });
    
    // Function to show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    
    // Check if there's a function parameter in the URL (coming from validator page)
    const urlParams = new URLSearchParams(window.location.search);
    const functionParam = urlParams.get('function');
    
    if (functionParam) {
        textInput.value = functionParam;
    }
});
