# Stonebranch Function Validator and Generator

This application provides two main features:
1. **Function Validator**: Validates Stonebranch function syntax
2. **Function Generator**: Generates Stonebranch functions from text descriptions using Google AI Studio

## Setup

### Setting up the Google AI API Key

To use the Function Generator feature, you need to set up a Google AI Studio API key:

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add the API key to your Netlify environment variables:
   - Log in to your Netlify dashboard
   - Go to your site settings
   - Navigate to "Environment variables"
   - Add a new variable with the key `GOOGLE_AI_API_KEY` and your API key as the value

## Local Development

To run the application locally with Netlify Functions:

1. Install the Netlify CLI:
   ```
   npm install -g netlify-cli
   ```

2. Install the required dependencies:
   ```
   npm install node-fetch
   ```

3. Create a `.env` file in the root directory with your API key:
   ```
   GOOGLE_AI_API_KEY=your_api_key_here
   ```

4. Start the local development server:
   ```
   netlify dev
   ```

## Features

### Function Validator
- Validates Stonebranch function syntax
- Checks for balanced brackets and quotes
- Highlights errors in the input
- Provides detailed error messages

### Function Generator
- Generates Stonebranch functions from text descriptions
- Uses Google AI Studio to create functions
- Provides copy and validate options for generated functions

## Deployment

The application is deployed on Netlify. To deploy updates:

1. Push changes to your repository
2. Netlify will automatically build and deploy the changes

Alternatively, you can deploy manually using the Netlify CLI:
```
netlify deploy --prod
```

## Security

The Google AI API key is stored securely in Netlify environment variables and is not exposed to the client-side code. All API requests are made through Netlify Functions, which act as a secure proxy between the client and the Google AI API.
