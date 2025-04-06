const fetch = require('node-fetch');

// This function will handle the API communication with Google AI Studio
exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: { 'Allow': 'POST' }
    };
  }

  try {
    // Parse the request body
    const { prompt } = JSON.parse(event.body);
    
    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    // Get the API key from environment variables
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    // Create the prompt for generating a Stonebranch function
    const fullPrompt = `Generate a Stonebranch function based on the following description. 
    The function should follow proper syntax with curly braces, parentheses, and quotes.
    Make sure to include appropriate error handling and comments.
    
    Description: ${prompt}
    
    Please provide only the function code without any additional explanation.`;

    // Make the API request to Google AI Studio
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google AI API error:', errorData);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Error from Google AI API', details: errorData })
      };
    }

    const data = await response.json();
    
    // Extract the function code from the response
    let functionCode = '';
    
    if (data.candidates && data.candidates.length > 0 && 
        data.candidates[0].content && data.candidates[0].content.parts && 
        data.candidates[0].content.parts.length > 0) {
      
      functionCode = data.candidates[0].content.parts[0].text;
      
      // Clean up the response to extract just the function code
      // Remove markdown code blocks if present
      functionCode = functionCode.replace(/```[\w]*\n/g, '').replace(/```$/g, '');
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to generate function' })
      };
    }

    // Return the generated function
    return {
      statusCode: 200,
      body: JSON.stringify({ function: functionCode })
    };
  } catch (error) {
    console.error('Function generation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
    };
  }
};
