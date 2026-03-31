import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { initDb, supabase as db } from './src/db/index.ts';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize DB
try {
  initDb();
} catch (err) {
  console.error('Failed to initialize database:', err);
}

const app = express();
const PORT = 3000;

app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ... (rest of the routes)

// Start Server
async function startServer() {
  try {
    // Vite Middleware
    if (process.env.NODE_ENV === 'production') {
      app.use(express.static(path.resolve(__dirname, 'dist')));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      });
    } else {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// User Onboarding
app.post('/api/users', async (req, res) => {
  try {
    const { name, birth_date, weight, target_weight, height, sex, goal, experience, constraints, availability, workout_duration, equipment, focus_areas } = req.body;
    const { data, error } = await db.from('users').insert([{
      name, birth_date, weight, target_weight: target_weight || null, height, sex, goal, experience, constraints, availability: JSON.stringify(availability), workout_duration: workout_duration || 60, equipment: equipment || 'gym', focus_areas: JSON.stringify(focus_areas || [])
    }]).select('id').single();
    if (error) throw error;
    res.json({ id: data.id });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update User
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, birth_date, weight, target_weight, height, sex, goal, experience, constraints, availability, workout_duration, equipment, focus_areas } = req.body;
    const { error } = await db.from('users').update({
      name, birth_date, weight, target_weight: target_weight || null, height, sex, goal, experience, constraints, availability: JSON.stringify(availability), workout_duration: workout_duration || 60, equipment: equipment || 'gym', focus_areas: JSON.stringify(focus_areas || [])
    }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Generate Avatar
app.post('/api/users/:id/avatar', async (req, res) => {
  try {
    const userId = req.params.id;
    const { data: user, error: userError } = await db.from('users').select('*').eq('id', userId).single();
    if (userError || !user) return res.status(404).json({ error: 'User not found' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const apiKey = process.env.USER_GEMINI_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({ error: 'API Key is missing or invalid. Por favor, configure sua chave no menu lateral.' });
    }

    // Calculate physical stats
    const age = new Date().getFullYear() - new Date(user.birth_date).getFullYear();
    const heightM = user.height;
    const bmi = user.weight / (heightM * heightM);
    const sexFactor = user.sex === 'male' ? 1 : 0;
    const bodyFat = (1.20 * bmi) + (0.23 * age) - (10.8 * sexFactor) - 5.4;

    let bodyType = 'average build';
    if (bodyFat < 10 && user.sex === 'male') bodyType = 'shredded, highly muscular';
    else if (bodyFat < 15 && user.sex === 'male') bodyType = 'athletic, lean';
    else if (bodyFat > 25 && user.sex === 'male') bodyType = 'overweight';
    else if (bodyFat < 18 && user.sex === 'female') bodyType = 'athletic, lean';
    else if (bodyFat > 32 && user.sex === 'female') bodyType = 'overweight';

    const leanMass = user.weight * (1 - (bodyFat / 100));

    const prompt = `A highly realistic, photorealistic, 8k resolution portrait of a ${user.sex === 'male' ? 'man' : 'woman'}, ${age} years old. 
    Physical traits: ${user.weight}kg, ${user.height}m tall, BMI ${bmi.toFixed(1)}, roughly ${bodyFat.toFixed(1)}% body fat, and ${leanMass.toFixed(1)}kg of lean muscle mass. 
    Body type: ${bodyType}. 
    Wearing modern gym workout clothes. 
    Cinematic lighting, hyper-detailed, lifelike skin textures, looking motivated and healthy.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    let base64Image = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (base64Image) {
      const { error: updateError } = await db.from('users').update({ avatar_url: base64Image }).eq('id', userId);
      if (updateError) throw updateError;
      res.json({ avatar_url: base64Image });
    } else {
      res.status(500).json({ error: 'Failed to generate image' });
    }
  } catch (error: any) {
    console.error('Avatar generation error:', error);
    
    // Handle 429 Quota Exceeded specifically
    const isQuotaExceeded = 
      error?.status === 429 || 
      error?.code === 429 ||
      (typeof error?.message === 'string' && error.message.includes('429')) ||
      (typeof error?.message === 'string' && error.message.includes('RESOURCE_EXHAUSTED'));

    if (isQuotaExceeded) {
      return res.status(429).json({ 
        error: 'Limite de cota do Gemini atingido.',
        details: 'Você excedeu a cota gratuita. Por favor, aguarde um momento ou configure sua própria chave de API nas configurações.'
      });
    }
    
    res.status(500).json({ error: 'Falha ao gerar avatar. Tente novamente mais tarde.' });
  }
});

// Get User
app.get('/api/users/:id', async (req, res) => {
  try {
    const { data: user, error } = await db.from('users').select('*').eq('id', req.params.id).single();
    if (user) {
      // Parse JSON fields
      if (user.availability) user.availability = JSON.parse(user.availability);
      res.json(user);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Generate Workout (AI)
app.post('/api/workouts/generate', async (req, res) => {
  const { userId } = req.body;
  
  try {
    const { data: user, error: userError } = await db.from('users').select('*').eq('id', userId).single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const apiKey = process.env.USER_GEMINI_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
    let workoutPlan;

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      console.warn('GEMINI_API_KEY missing/invalid. Using fallback workout.');
      workoutPlan = getFallbackWorkout(user);
    } else {
      try {
        const ai = new GoogleGenAI({ apiKey });
        
        // Fetch the most recent workout to avoid repetition
        const { data: previousWorkout } = await db.from('workouts').select('id').eq('user_id', userId).order('id', { ascending: false }).limit(1).single();
        let previousExercisesStr = '';
        if (previousWorkout) {
            const { data: prevExercises } = await db.from('exercises').select('name').eq('workout_id', previousWorkout.id);
            if (prevExercises && prevExercises.length > 0) {
                previousExercisesStr = prevExercises.map((e: any) => e.name).join(', ');
            }
        }
        
        // Parse availability if it's a string
        let availability = user.availability;
        try {
            if (typeof availability === 'string') {
                availability = JSON.parse(availability);
            }
        } catch (e) {
            availability = [];
        }

        // Map english days to Portuguese for the prompt
        const dayMap: Record<string, string> = {
            'sunday': 'Domingo',
            'monday': 'Segunda-feira',
            'tuesday': 'Terça-feira',
            'wednesday': 'Quarta-feira',
            'thursday': 'Quinta-feira',
            'friday': 'Sexta-feira',
            'saturday': 'Sábado'
        };

        const userDaysList = Array.isArray(availability) && availability.length > 0
            ? availability.map((d: string) => dayMap[d] || d)
            : ['Segunda-feira', 'Quarta-feira', 'Sexta-feira'];
            
        const userDaysString = userDaysList.join(', ');

        // Calculate target volume based on duration
        // Heuristic: ~5-7 minutes per exercise (3-4 sets + rest)
        const duration = user.workout_duration || 60;
        const targetExercises = Math.max(3, Math.floor(duration / 7)); // Min 3 exercises

        let equipmentStr = 'Academia Completa';
        if (user.equipment === 'home_equipment') equipmentStr = 'Em Casa (Com Equipamentos: Halteres, elásticos, etc)';
        if (user.equipment === 'home_bodyweight') equipmentStr = 'Em Casa (Apenas Peso do Corpo)';

        let focusAreasStr = 'Geral';
        try {
            const parsedFocus = JSON.parse(user.focus_areas || '[]');
            if (parsedFocus.length > 0) focusAreasStr = parsedFocus.join(', ');
        } catch(e) {}

        const prompt = `
          Atue como um personal trainer de elite mundial. Crie uma NOVA ficha de treino completa, moderna e altamente personalizada.
          Busque inspiração em diversas metodologias de treino comprovadas (hipertrofia, calistenia, funcional, etc) para garantir um treino único e eficiente.
          
          PERFIL DO ALUNO:
          - Nome: ${user.name}
          - Objetivo: ${user.goal}
          - Nível: ${user.experience}
          - Limitações: ${user.constraints || 'Nenhuma'}
          - Tempo Total por Treino: ${duration} minutos
          - Local/Equipamentos: ${equipmentStr}
          - Áreas de Foco: ${focusAreasStr}
          
          DISPONIBILIDADE (OBRIGATÓRIO):
          - O treino deve ser EXATAMENTE para estes dias: ${userDaysString}.
          - NÃO crie dias extras. NÃO crie dias genéricos (ex: "Treino A").
          - Use APENAS os nomes dos dias listados acima.
          
          VOLUME (OBRIGATÓRIO):
          - Para preencher ${duration} minutos, crie aproximadamente ${targetExercises} exercícios por dia.
          - Ajuste o número de séries e repetições para caber neste tempo.
          
          VARIAÇÃO E EXCLUSIVIDADE (MUITO IMPORTANTE):
          - O aluno reclamou que os treinos estão repetitivos. VOCÊ DEVE INOVAR.
          - Exercícios do treino anterior (NÃO REPITA A MAIORIA DELES): ${previousExercisesStr || 'Nenhum treino anterior registrado.'}
          - Traga exercícios diferentes, variações de pegada, ângulos diferentes, e métodos avançados (Drop-set, Rest-pause, Bi-set) se o nível for intermediário/avançado.
          - Random Seed: ${Math.random()}

          RESPOSTA JSON (SCHEMA ESTRITO):
          {
            "type": "string (ex: ABC - Foco em ${focusAreasStr})",
            "days": [
              {
                "name": "string (Deve ser UM dos dias: ${userDaysString})",
                "exercises": [
                  {
                    "name": "string (Nome específico e claro do exercício)",
                    "sets": number,
                    "reps": "string (ex: 10-12, ou Falha)",
                    "rest": "string (ex: 60s, 90s)",
                    "video_search_term": "string (Termo exato para buscar no YouTube)",
                    "instructions": "string (Dicas de execução, postura e respiração)",
                    "muscles_worked": "string (Músculos primários e secundários)"
                  }
                ]
              }
            ]
          }
        `;
    
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 1.0, // Max temperature for maximum variety
            topP: 0.95,
            topK: 64,
          }
        });
    
        let textResponse = response.text || '';
        // Clean up markdown formatting if present
        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(textResponse);
        
        // Validate structure
        if (!parsed || !parsed.type || !Array.isArray(parsed.days)) {
            console.warn('AI Workout Generation: Invalid structure. Using fallback.');
            workoutPlan = getFallbackWorkout(user);
        } else {
            workoutPlan = parsed;
        }
      } catch (aiError: any) {
        if (aiError.message?.includes('429') || aiError.message?.includes('RESOURCE_EXHAUSTED')) {
            console.warn('AI Workout Generation: Quota exceeded (429). Using fallback.');
        } else if (aiError.message?.includes('API key not valid') || aiError.status === 400 || aiError.status === 403) {
            console.warn('AI Workout Generation Skipped: Invalid API Key. Using fallback.');
        } else {
            console.error('AI Generation failed, using fallback:', aiError);
        }
        workoutPlan = getFallbackWorkout(user);
      }
    }

    // Delete existing workouts (and their exercises) for this user to ensure a fresh start
    
    // 1. Detach workout history to avoid FK constraint violations
    const { data: workoutsToDelete } = await db.from('workouts').select('id').eq('user_id', userId);
    if (workoutsToDelete && workoutsToDelete.length > 0) {
      const workoutIds = workoutsToDelete.map(w => w.id);
      await db.from('workout_history').update({ workout_id: null }).in('workout_id', workoutIds);
      await db.from('exercises').delete().in('workout_id', workoutIds);
      await db.from('workouts').delete().eq('user_id', userId);
    }

    // Save to DB
    const { data: workoutInfo, error: workoutError } = await db.from('workouts').insert([{ user_id: userId, type: workoutPlan.type || 'Treino Personalizado' }]).select('id').single();
    if (workoutError) throw workoutError;
    const workoutId = workoutInfo.id;

    const exercisesToInsert: any[] = [];
    workoutPlan.days.forEach((day: any) => {
      if (day && Array.isArray(day.exercises)) {
        day.exercises.forEach((ex: any, index: number) => {
          const videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.video_search_term || ex.name || 'exercício')}`;
          exercisesToInsert.push({
            workout_id: workoutId,
            day: day.name || 'Treino',
            name: ex.name || 'Exercício',
            sets: ex.sets || 3,
            reps: ex.reps || '10-12',
            rest: ex.rest || '60s',
            video_url: videoUrl,
            instructions: ex.instructions || "Instruções não disponíveis.",
            muscles_worked: ex.muscles_worked || "Geral",
            exercise_order: index
          });
        });
      }
    });
    
    if (exercisesToInsert.length > 0) {
      const { error: exerciseError } = await db.from('exercises').insert(exercisesToInsert);
      if (exerciseError) throw exerciseError;
    }

    res.json({ workoutId, plan: workoutPlan });

  } catch (error) {
    console.error('General Error in Generate Workout:', error);
    res.status(500).json({ error: 'Failed to generate workout' });
  }
});

function getFallbackWorkout(user: any) {
  // Parse availability
  let availability = user.availability;
  try {
      if (typeof availability === 'string') {
          availability = JSON.parse(availability);
      }
  } catch (e) {
      availability = [];
  }

  const dayMap: Record<string, string> = {
      'sunday': 'Domingo',
      'monday': 'Segunda-feira',
      'tuesday': 'Terça-feira',
      'wednesday': 'Quarta-feira',
      'thursday': 'Quinta-feira',
      'friday': 'Sexta-feira',
      'saturday': 'Sábado'
  };

  const userDays = Array.isArray(availability) && availability.length > 0
      ? availability.map((d: string) => dayMap[d] || d)
      : ['Segunda-feira', 'Quarta-feira', 'Sexta-feira'];

  const isBeginner = user.experience === 'beginner';
  const duration = user.workout_duration || 60;
  
  // Adjust volume slightly for duration (simple heuristic)
  const sets = duration < 45 ? 2 : 3;

  // Define pools of exercises
  const fullBodyExercises = [
    { name: "Agachamento Livre", sets: sets, reps: "12-15", rest: "60s", video_search_term: "agachamento livre execução", muscles_worked: "Quadríceps, Glúteos", instructions: "Mantenha a coluna reta e desça até 90 graus." },
    { name: "Flexão de Braço", sets: sets, reps: "10-12", rest: "60s", video_search_term: "flexão de braço iniciante", muscles_worked: "Peitoral, Tríceps", instructions: "Mantenha o core contraído." },
    { name: "Puxada Alta", sets: sets, reps: "12-15", rest: "60s", video_search_term: "puxada alta execução", muscles_worked: "Costas, Bíceps", instructions: "Puxe a barra em direção ao peito." },
    { name: "Desenvolvimento Halteres", sets: sets, reps: "12", rest: "60s", video_search_term: "desenvolvimento halteres sentado", muscles_worked: "Ombros", instructions: "Não deixe os cotovelos caírem muito." },
    { name: "Prancha Abdominal", sets: sets, reps: "30s", rest: "45s", video_search_term: "prancha abdominal execução", muscles_worked: "Core", instructions: "Corpo reto como uma tábua." },
    { name: "Afundo com Halteres", sets: sets, reps: "10 cada perna", rest: "60s", video_search_term: "afundo com halteres", muscles_worked: "Quadríceps, Glúteos", instructions: "Dê um passo à frente e desça o joelho de trás." },
    { name: "Remada Curvada", sets: sets, reps: "12", rest: "60s", video_search_term: "remada curvada barra", muscles_worked: "Costas", instructions: "Mantenha a lombar preservada." },
    { name: "Elevação Pélvica", sets: sets, reps: "15", rest: "60s", video_search_term: "elevação pélvica solo", muscles_worked: "Glúteos", instructions: "Contraia bem os glúteos no topo." }
  ];

  const upperExercises = [
    { name: "Supino Reto", sets: sets + 1, reps: "8-10", rest: "90s", video_search_term: "supino reto execução", muscles_worked: "Peitoral, Tríceps", instructions: "Desça a barra até o peito." },
    { name: "Remada Curvada", sets: sets + 1, reps: "8-10", rest: "90s", video_search_term: "remada curvada barra", muscles_worked: "Costas", instructions: "Puxe a barra em direção ao umbigo." },
    { name: "Desenvolvimento Militar", sets: sets, reps: "10-12", rest: "60s", video_search_term: "desenvolvimento militar", muscles_worked: "Ombros", instructions: "Empurre a barra acima da cabeça." },
    { name: "Elevação Lateral", sets: sets, reps: "12-15", rest: "60s", video_search_term: "elevação lateral halteres", muscles_worked: "Ombros laterais", instructions: "Eleve os braços até a altura dos ombros." },
    { name: "Tríceps Corda", sets: sets, reps: "12-15", rest: "60s", video_search_term: "triceps corda polia", muscles_worked: "Tríceps", instructions: "Estenda totalmente os cotovelos." },
    { name: "Rosca Direta", sets: sets, reps: "12-15", rest: "60s", video_search_term: "rosca direta barra", muscles_worked: "Bíceps", instructions: "Mantenha os cotovelos fixos ao lado do corpo." },
    { name: "Crucifixo Inclinado", sets: sets, reps: "12", rest: "60s", video_search_term: "crucifixo inclinado halteres", muscles_worked: "Peitoral Superior", instructions: "Abra os braços controlando o peso." },
    { name: "Puxada Frente Triângulo", sets: sets, reps: "12", rest: "60s", video_search_term: "puxada triangulo", muscles_worked: "Costas (Miolo)", instructions: "Puxe em direção ao peito estufado." }
  ];

  const lowerExercises = [
    { name: "Agachamento Livre", sets: sets + 1, reps: "8-10", rest: "120s", video_search_term: "agachamento livre", muscles_worked: "Quadríceps, Glúteos", instructions: "Desça quebrando a paralela se possível." },
    { name: "Leg Press 45", sets: sets, reps: "10-12", rest: "90s", video_search_term: "leg press 45 execução", muscles_worked: "Quadríceps", instructions: "Não estique totalmente os joelhos no topo." },
    { name: "Cadeira Extensora", sets: sets, reps: "12-15", rest: "60s", video_search_term: "cadeira extensora", muscles_worked: "Quadríceps isolado", instructions: "Segure 1 segundo no topo da contração." },
    { name: "Stiff", sets: sets + 1, reps: "10-12", rest: "90s", video_search_term: "stiff execução", muscles_worked: "Posterior de Coxa, Glúteos", instructions: "Mantenha as pernas semi-retas e desça o tronco." },
    { name: "Mesa Flexora", sets: sets, reps: "12", rest: "60s", video_search_term: "mesa flexora", muscles_worked: "Posterior de Coxa", instructions: "Contraia bem ao flexionar os joelhos." },
    { name: "Panturrilha em Pé", sets: sets + 1, reps: "15-20", rest: "45s", video_search_term: "panturrilha em pé maquina", muscles_worked: "Panturrilhas", instructions: "Faça o movimento completo, alongando bem embaixo." },
    { name: "Cadeira Abdutora", sets: sets, reps: "15", rest: "45s", video_search_term: "cadeira abdutora", muscles_worked: "Glúteo Médio", instructions: "Abra as pernas controlando a volta." }
  ];

  // Helper to get random items from array
  const getRandom = (arr: any[], n: number) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, n);
  };

  // Distribute workouts based on available days
  const days = userDays.map((dayName: string, index: number) => {
      let exercises;
      let focus = "";

      if (isBeginner) {
          exercises = getRandom(fullBodyExercises, 5); // Pick 5 random full body exercises
          focus = "Corpo Todo";
      } else {
          // Alternating Upper/Lower
          if (index % 2 === 0) {
              exercises = getRandom(upperExercises, 6); // Pick 6 random upper exercises
              focus = "Superiores";
          } else {
              exercises = getRandom(lowerExercises, 6); // Pick 6 random lower exercises
              focus = "Inferiores";
          }
      }

      return {
          name: `${dayName} - ${focus}`,
          exercises: exercises
      };
  });

  return {
      type: isBeginner ? "Full Body (Adaptativo)" : "AB - Rotativo",
      days: days
  };
}

// Get Workout
app.get('/api/workouts/:userId', async (req, res) => {
  try {
    // Get latest workout
    const { data: workout, error: workoutError } = await db.from('workouts').select('*').eq('user_id', req.params.userId).order('id', { ascending: false }).limit(1).single();
    if (!workout) return res.json(null);

    const { data: exercises, error: exercisesError } = await db.from('exercises').select('*').eq('workout_id', workout.id).order('day').order('exercise_order');
    if (!exercises) return res.json(null);

    // Group by day
    const days: any = {};
    exercises.forEach((ex: any) => {
      if (!days[ex.day]) {
        days[ex.day] = { name: ex.day, exercises: [] };
      }
      days[ex.day].exercises.push(ex);
    });

    res.json({
      ...workout,
      days: Object.values(days)
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workout' });
  }
});

// Daily Motivation
app.get('/api/motivation/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const today = new Date().toISOString().split('T')[0];

    // Check cache
    const { data: cached } = await db.from('motivation_cache').select('message').eq('user_id', userId).eq('date', today).single();
    if (cached) {
      return res.json({ message: cached.message });
    }

    const { data: user } = await db.from('users').select('name, goal').eq('id', userId).single();
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    const apiKey = process.env.USER_GEMINI_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        console.warn('GEMINI_API_KEY is missing or invalid. Returning fallback motivation.');
        return res.json({ message: "Vamos treinar hoje!" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Gere uma frase motivacional curta e inspiradora para ${user.name} que tem o objetivo de ${user.goal}. A frase deve ser direta e energizante.`;
    
    try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: prompt,
        });

        const message = response.text || "Vamos treinar hoje!";
        
        // Save to cache
        await db.from('motivation_cache').upsert([{ user_id: userId, message, date: today }]);

        res.json({ message });
    } catch (aiError: any) {
        if (aiError.message?.includes('429') || aiError.message?.includes('RESOURCE_EXHAUSTED')) {
            console.warn('Motivation Generation: Quota exceeded (429). Using fallback.');
            return res.json({ message: "Foco no objetivo! Cada treino conta." });
        }
        throw aiError;
    }
  } catch (error: any) {
    // Log less verbose error if it's an API key issue
    if (error.message?.includes('API key not valid') || error.status === 400) {
        console.warn('Motivation Generation Skipped: Invalid API Key. Using fallback.');
    } else {
        console.error('Motivation Error:', error);
    }
    // Fallback silently for motivation
    res.json({ message: "Vamos treinar hoje!" });
  }
});

// Complete Workout
app.post('/api/workouts/complete', async (req, res) => {
  try {
    const { userId, workoutId, dayName, duration } = req.body;
    const { error: insertError } = await db.from('workout_history').insert([{ user_id: userId, workout_id: workoutId, day_name: dayName, duration_minutes: duration || 60 }]);
    if (insertError) throw insertError;

    // Generate motivation
    let motivation = "Treino concluído! Você está um passo mais perto do seu objetivo.";
    try {
        const { data: user } = await db.from('users').select('name, goal').eq('id', userId).single();
        
        const apiKey = process.env.USER_GEMINI_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
        if (user && apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `O usuário ${user.name} acabou de completar um treino de ${dayName}. Gere uma frase curta (max 20 palavras) e muito empolgante de parabenização para aparecer na tela de sucesso.`;
            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-3.1-flash-lite-preview',
                    contents: prompt,
                });
                motivation = response.text || motivation;
            } catch (aiError: any) {
                if (aiError.message?.includes('429') || aiError.message?.includes('RESOURCE_EXHAUSTED')) {
                    console.warn('Workout Complete Motivation: Quota exceeded (429). Using fallback.');
                } else {
                    throw aiError;
                }
            }
        }
    } catch (e: any) {
        if (e.message?.includes('API key not valid') || e.status === 400 || e.status === 403) {
            console.warn("AI motivation skipped: Invalid API Key.");
        } else {
            console.error("AI motivation failed", e);
        }
    }

    res.json({ success: true, motivation });
  } catch (error) {
    console.error('Error completing workout:', error);
    res.status(500).json({ error: 'Failed to complete workout' });
  }
});

// Get Workout History
app.get('/api/history/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { data: history, error: historyError } = await db.from('workout_history')
      .select('id, day_name, completed_at, duration_minutes, workouts(type)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });
    if (historyError) throw historyError;
    
    // Format the response to match the previous SQLite join structure
    const formattedHistory = history.map((h: any) => ({
      id: h.id,
      day_name: h.day_name,
      completed_at: h.completed_at,
      duration_minutes: h.duration_minutes,
      workout_type: h.workouts?.type
    }));
    res.json(formattedHistory);
    return;
    res.json(history);
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get User Stats
app.get('/api/stats/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    // Count workouts completed this month
    // SQLite 'now' is UTC. We assume simple month matching.
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { count, error } = await db.from('workout_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('completed_at', `${currentMonth}-01T00:00:00.000Z`)
      .lte('completed_at', `${currentMonth}-31T23:59:59.999Z`);
    if (error) throw error;
    const result = { count: count || 0 };
    res.json({ workoutsCompletedMonth: result.count });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Progress Logs
app.post('/api/progress', async (req, res) => {
  try {
    const { userId, weight, measurements, photo } = req.body;
    const { error } = await db.from('progress_logs').insert([{
      user_id: userId,
      date: new Date().toISOString().split('T')[0],
      weight,
      measurements: JSON.stringify(measurements),
      photo: photo || null
    }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to log progress' });
  }
});

app.get('/api/progress/:userId', async (req, res) => {
  try {
    const { data: logs, error } = await db.from('progress_logs').select('*').eq('user_id', req.params.userId).order('date', { ascending: true });
    if (error) throw error;
    res.json(logs.map((log: any) => ({
      ...log,
      measurements: JSON.parse(log.measurements)
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Chat Endpoints
app.get('/api/chat/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { data: messages, error } = await db.from('chat_messages').select('*').eq('user_id', userId).order('created_at', { ascending: true });
    if (error) throw error;
    res.json(messages);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

app.post('/api/chat/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Save user message
    await db.from('chat_messages').insert([{ user_id: userId, role: 'user', content: message }]);

    // Fetch user profile and workout history for context
    const { data: user } = await db.from('users').select('*').eq('id', userId).single();
    
    const { data: history } = await db.from('workout_history').select('*').eq('user_id', userId).order('completed_at', { ascending: false }).limit(5);

    // Fetch previous chat messages for conversation context
    const { data: previousMessages } = await db.from('chat_messages').select('role, content').eq('user_id', userId).order('created_at', { ascending: true }).limit(20);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const apiKey = process.env.USER_GEMINI_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      const fallbackResponse = "Oi! Parece que a chave da API do Gemini não está configurada. Por favor, adicione sua chave nas configurações do AI Studio para que eu possa te ajudar com seus treinos!";
      await db.from('chat_messages').insert([{ user_id: userId, role: 'model', content: fallbackResponse }]);
      return res.json({ response: fallbackResponse });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    let historyContext = 'Nenhum treino registrado ainda.';
    if (history.length > 0) {
      historyContext = history.map(h => `- ${h.day_name} em ${new Date(h.completed_at).toLocaleDateString()}`).join('\n');
    }

    const systemInstruction = `Você é um personal trainer de elite, especialista em fisiologia do exercício e coach de alta performance. Seu nome é Coach AI.
Sua missão é transformar a vida do usuário através de treinos, hábitos saudáveis e mentalidade vencedora.
Aja com autoridade, conhecimento técnico profundo e empatia. Suas respostas devem ser elaboradas, inteligentes, embasadas e altamente personalizadas.

DIRETRIZES DE COMPORTAMENTO:
1. Profundidade e Qualidade: Não dê respostas superficiais. Quando sugerir algo, explique o "porquê" (a ciência, a biomecânica ou o benefício por trás da ação).
2. Visão Holística (Coach 360º): Vá além do exercício físico. Aborde disciplina, recuperação muscular, sono, hidratação, nutrição básica e superação de limites.
3. Cobrança e Responsabilidade: Analise o histórico do usuário. Se ele estiver consistente, elogie e eleve a barra (progressão de carga/intensidade). Se estiver procrastinando, cobre com firmeza e ofereça estratégias práticas para vencer a falta de tempo ou motivação.
4. Estrutura da Resposta: Use um tom motivador, profissional e inspirador. Escreva respostas ricas e bem estruturadas (use tópicos, negrito e parágrafos curtos para facilitar a leitura). Use emojis estrategicamente para dar energia à conversa.
5. Personalização Extrema: Baseie TODAS as suas orientações no objetivo, nível e realidade do usuário.

Informações do usuário:
Nome: ${user.name}
Objetivo: ${user.goal}
Experiência: ${user.experience}
Disponibilidade: ${user.availability}

Últimos treinos:
${historyContext}`;

    const chat = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        systemInstruction,
        temperature: 0.8,
      }
    });

    // Replay history to the chat
    for (const msg of previousMessages) {
      if (msg.role === 'user' && msg.content !== message) { // skip the current message as we'll send it next
        // We can't easily push to chat history in the new SDK without sending, 
        // so we'll just pass the history as context in the prompt if needed, or use contents array.
        // Actually, let's just use generateContent with contents array to simulate chat history.
      }
    }
    
    // Let's build the contents array instead of using chat.sendMessage to have full control over history
    const contents = previousMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    
    // Add current message if it's not already the last one in previousMessages (it is, because we just inserted it)
    // Wait, previousMessages includes the one we just inserted.
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.8,
      }
    });

    const aiResponse = response.text || 'Bora treinar!';

    // Save AI response
    await db.from('chat_messages').insert([{ user_id: userId, role: 'model', content: aiResponse }]);

    res.json({ response: aiResponse });
  } catch (error: any) {
    // Check if it's an API key error or quota error
    if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      console.warn('Chat generation: Quota exceeded (429). Using fallback.');
      const fallbackResponse = "Desculpe, atingimos o limite de mensagens por hoje. Vamos focar no treino agora e amanhã conversamos mais!";
      
      // Save the fallback response so the user sees it in the chat
      await db.from('chat_messages').insert([{ user_id: req.params.userId, role: 'model', content: fallbackResponse }]);
      
      return res.json({ response: fallbackResponse });
    } else if (error?.message?.includes('API key not valid') || error?.status === 400 || error?.status === 403) {
      console.warn('Chat generation skipped: Invalid API Key.');
      const fallbackResponse = "Ops! Parece que a chave da API do Gemini configurada é inválida. Por favor, verifique a chave nas configurações do AI Studio.";
      
      // Save the fallback response so the user sees it in the chat
      await db.from('chat_messages').insert([{ user_id: req.params.userId, role: 'model', content: fallbackResponse }]);
      
      return res.json({ response: fallbackResponse });
    }

    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Quota exceeded')) {
      console.warn('Chat generation skipped: Quota Exceeded.');
      const fallbackResponse = "Coach AI: Estou processando muitos treinos agora! Dê um minutinho e tente falar comigo novamente (Limite de uso da API atingido).";
      
      await db.from('chat_messages').insert([{ user_id: req.params.userId, role: 'model', content: fallbackResponse }]);
      
      return res.json({ response: fallbackResponse });
    }
    
    console.error('Chat generation error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

function calculateAge(birthDateString: string) {
  const today = new Date();
  const birthDate = new Date(birthDateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Vite Middleware moved to startServer function

startServer();