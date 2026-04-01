import { GoogleGenAI, Type } from '@google/genai';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateWorkout(user: any) {
  const prompt = `
    You are an expert personal trainer. Create a weekly workout plan for the following user:
    - Name: ${user.name}
    - Goal: ${user.goal}
    - Experience Level: ${user.experience}
    - Availability: ${user.availability}
    - Workout Duration: ${user.workout_duration} minutes
    - Equipment Available: ${user.equipment}
    - Focus Areas: ${user.focus_areas}
    - Constraints/Injuries: ${user.constraints || 'None'}
    
    Return a JSON object with a "workouts" array. Each workout should have:
    - "day": e.g., "Monday", "Wednesday"
    - "name": e.g., "Upper Body Strength"
    - "exercises": an array of objects with "name", "sets" (number), "reps" (string), "rest" (string), "instructions" (string), "muscles_worked" (string).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          workouts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                name: { type: Type.STRING },
                exercises: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      sets: { type: Type.INTEGER },
                      reps: { type: Type.STRING },
                      rest: { type: Type.STRING },
                      instructions: { type: Type.STRING },
                      muscles_worked: { type: Type.STRING },
                    },
                    required: ['name', 'sets', 'reps', 'rest', 'instructions', 'muscles_worked'],
                  },
                },
              },
              required: ['day', 'name', 'exercises'],
            },
          },
        },
        required: ['workouts'],
      },
    },
  });

  return JSON.parse(response.text || '{}');
}

export async function generateMotivation(user: any) {
  const prompt = `
    You are an encouraging and expert personal trainer. 
    Write a short, highly motivating, personalized daily message (max 2 sentences) for your client:
    - Name: ${user.name}
    - Goal: ${user.goal}
    - Experience: ${user.experience}
    
    Make it energetic and specific to their goal. Do not use hashtags.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text || 'You can do this! Keep pushing towards your goals today!';
}

export async function generateAvatar(user: any) {
  const prompt = `A stylized, energetic profile avatar for a fitness app user. 
    They are focused on ${user.goal}. 
    The style should be modern, clean, 3D illustration, vibrant colors, energetic vibe. 
    No text in the image.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "512px"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error('Failed to generate avatar');
}

export async function chatWithCoach(user: any, history: any[], message: string) {
  const systemInstruction = `
    You are an expert, motivating personal trainer named "Coach AI".
    Your client is:
    - Name: ${user.name}
    - Goal: ${user.goal}
    - Experience: ${user.experience}
    - Constraints: ${user.constraints || 'None'}
    
    Provide concise, actionable, and encouraging fitness and nutrition advice.
    Keep responses relatively short (1-3 paragraphs) as this is a chat interface.
  `;

  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction,
    },
  });

  // Replay history (skip the first system-like message if needed, or just send all)
  // Gemini chat expects alternating user/model messages. 
  // For simplicity, we'll just send the latest message with context if history is complex, 
  // or properly format the history.
  
  // Since we don't have a direct way to set history in ai.chats.create easily without formatting,
  // we'll use generateContent with concatenated history for simplicity and robustness.
  
  const conversation = history.map(msg => `${msg.role === 'user' ? 'Client' : 'Coach'}: ${msg.content}`).join('\n');
  const fullPrompt = `
    ${systemInstruction}
    
    Previous conversation:
    ${conversation}
    
    Client: ${message}
    Coach:
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: fullPrompt,
  });

  return response.text || 'I am here to help!';
}
