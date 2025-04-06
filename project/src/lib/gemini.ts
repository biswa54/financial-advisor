import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Initialize Gemini AI with API key validation
const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error('Gemini API key is missing. Please check your .env file.');
}
const genAI = new GoogleGenerativeAI(apiKey);

export const getGeminiResponse = async (prompt, context) => {
  try {
    // Use a free and available model
    const model = genAI.getGenerativeModel({
      model: 'models/gemini-1.5-flash', // Updated model
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    const fullPrompt = `
      Context:
      ${context}
      
      User question:
      ${prompt}
      
      Please analyze the data and provide a clear, concise response focusing on relevant insights.
    `;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error getting Gemini response:', error);
    
    if (error.message.includes('API_KEY_INVALID')) {
      throw new Error('Invalid API key. Please check your API key configuration.');
    } else if (error.message.includes('models/gemini')) {
      throw new Error('The specified Gemini model is not available. Please check the model configuration.');
    }
    
    throw new Error('Failed to get AI response. Please try again later.');
  }
};
