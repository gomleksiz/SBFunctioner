document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.getElementById('textInput');
    const generateBtn = document.getElementById('generateBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const generatedFunction = document.getElementById('generatedFunction');
    const functionOutput = document.getElementById('functionOutput');
    const copyBtn = document.getElementById('copyBtn');
    const validateBtn = document.getElementById('validateBtn');
    const errorMessage = document.getElementById('errorMessage');

    // Event listener for generate button
    generateBtn.addEventListener('click', async () => {
        const text = textInput.value.trim();
        
        if (!text) {
            showError('Please enter a description of the function you want to generate.');
            return;
        }
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        generatedFunction.style.display = 'none';
        errorMessage.style.display = 'none';
        
        try {
            // Call the Netlify function to generate the function
            const response = await fetch('/.netlify/functions/generate-function', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: text }),
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
            
            // Display the generated function
            functionOutput.textContent = data.function;
            generatedFunction.style.display = 'block';
        } catch (error) {
            console.error('Error generating function:', error);
            loadingIndicator.style.display = 'none';
            showError('An error occurred while generating the function. Please try again later.');
        }
    });
    
    // Event listener for copy button
    copyBtn.addEventListener('click', () => {
        const functionText = functionOutput.textContent;
        
        navigator.clipboard.writeText(functionText)
            .then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                showError('Failed to copy to clipboard. Please try again.');
            });
    });
    
    // Event listener for validate button
    validateBtn.addEventListener('click', () => {
        const functionText = functionOutput.textContent;
        
        // Redirect to the validator page with the function text
        window.location.href = `index.html?function=${encodeURIComponent(functionText)}`;
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
