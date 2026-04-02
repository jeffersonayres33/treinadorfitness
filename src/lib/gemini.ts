import { GoogleGenAI, Type } from '@google/genai';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateWorkout(user: any) {
  const prompt = `
    Crie um plano de treino semanal em JSON para:
    - Nome: ${user.name}
    - Objetivo: ${user.goal}
    - Nível: ${user.experience}
    - Disponibilidade: ${user.availability}
    - Duração: ${user.workout_duration} min
    - Equipamento: ${user.equipment}
    - Foco: ${user.focus_areas}
    - Restrições: ${user.constraints || 'Nenhuma'}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: "Você é um personal trainer de elite. Sua única função é gerar treinos estruturados em formato JSON estrito, sempre em Português do Brasil (pt-BR). Seja conciso nas instruções dos exercícios. Não inclua saudações, notas ou explicações fora do JSON.",
      temperature: 0.4,
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

  try {
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Failed to parse Gemini response:", response.text);
    throw new Error("Erro ao processar o treino gerado. Por favor, tente novamente.");
  }
}

export async function generateMealPlan(user: any, preferences: any) {
  const prompt = `
    Crie um cardápio nutricional em JSON para:
    - Objetivo: ${preferences.goal || user.goal}
    - Tipo de Refeição: ${preferences.mealType} (ex: marmita congelada, fresca)
    - Dias: ${preferences.days} dias
    - Restrições: ${user.constraints || 'Nenhuma'}
    - Peso atual: ${user.weight}kg
    - Altura: ${user.height}m
    
    Se o tipo for "marmita congelada" ou similar, inclua instruções de congelamento e tempo máximo de validade no freezer.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: "Você é um nutricionista de elite. Sua única função é gerar cardápios e listas de compras em formato JSON estrito, sempre em Português do Brasil (pt-BR). Não inclua saudações, notas ou explicações fora do JSON.",
      temperature: 0.4,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          days: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.INTEGER },
                meals: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, description: "Ex: Café da Manhã, Almoço" },
                      name: { type: Type.STRING },
                      ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                      instructions: { type: Type.STRING },
                      freezing_info: { type: Type.STRING, description: "Instruções de congelamento se aplicável" },
                      macros: {
                        type: Type.OBJECT,
                        properties: {
                          calories: { type: Type.INTEGER },
                          protein: { type: Type.INTEGER },
                          carbs: { type: Type.INTEGER },
                          fat: { type: Type.INTEGER }
                        }
                      }
                    },
                    required: ['type', 'name', 'ingredients', 'instructions']
                  }
                }
              },
              required: ['day', 'meals']
            }
          },
          shopping_list: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item: { type: Type.STRING },
                quantity: { type: Type.STRING },
                category: { type: Type.STRING }
              },
              required: ['item', 'quantity', 'category']
            }
          }
        },
        required: ['days', 'shopping_list']
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Failed to parse Gemini response:", response.text);
    throw new Error("Erro ao processar o cardápio gerado. Por favor, tente novamente.");
  }
}
