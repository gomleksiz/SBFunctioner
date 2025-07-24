document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.getElementById('textInput');
    const explainBtn = document.getElementById('explainBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const explanationResult = document.getElementById('explanationResult');
    const explanationOutput = document.getElementById('explanationOutput');
    const copyBtn = document.getElementById('copyBtn');
    const errorMessage = document.getElementById('errorMessage');

    // Event listener for explain button
    explainBtn.addEventListener('click', async () => {
        const text = textInput.value.trim();
        
        if (!text) {
            showError('Please enter a function to explain.');
            return;
        }
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        explanationResult.style.display = 'none';
        errorMessage.style.display = 'none';
        
        try {
            // Call the AWS Lambda function to explain the function
            const response = await fetch('https://shpu5bt5nc665d2myhsilw6i6u0xhrbu.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    prompt: text,
                    action: 'explain'
                })
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            
            const responseData = await response.json();
            
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
            
            // Display the explanation
            explanationOutput.textContent = responseData.explanation || 'No explanation provided.';
            explanationResult.style.display = 'block';
        } catch (error) {
            console.error('Error explaining function:', error);
            loadingIndicator.style.display = 'none';
            showError('An error occurred while explaining the function. Please try again later.');
        }
    });
    
    // Event listener for copy button
    copyBtn.addEventListener('click', () => {
        const explanationText = explanationOutput.textContent;
        
        navigator.clipboard.writeText(explanationText)
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
    
    // Function to show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    
    // Check if there's a function parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const functionParam = urlParams.get('function');
    
    if (functionParam) {
        textInput.value = functionParam;
    }
});
