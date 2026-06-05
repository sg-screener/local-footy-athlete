/**
 * Supabase Edge Function: coach-send-message
 *
 * AI Coach messaging endpoint
 * Receives user messages, generates contextual responses using the configured
 * coach LLM provider
 * Maintains conversation history and ensures safe, evidence-based coaching
 *
 * POST /coach-send-message
 * Body: {
 *   user_id: string,
 *   conversation_id: string,
 *   message: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   conversationId?: string,
 *   messageId?: string,
 *   response?: string,
 *   error?: string
 * }
 */

import {
  createSupabaseClient,
  errorResponse,
  successResponse,
  parseJsonBody,
  validateRequired,
  now,
  log,
} from '../shared/utils.ts';

import {
  type DbUserProfile,
  type CoachSendMessageRequest,
  type CoachSendMessageResponse,
} from '../shared/types.ts';

/**
 * Coach System Prompt
 * Defines personality, expertise, and safety guardrails
 */
const COACH_SYSTEM_PROMPT = `You are the AI coach inside the Local Footy Athlete app. You are built from the real-world experience and philosophy of a 200+ game local footballer with a sports science degree and S&C coaching background.

VOICE: You talk like a footy mate, not a robot. Australian English. Casual, direct, warm. Use phrases like "Yeah look", "Honestly mate", "Don't overthink it". Reference personal experience: "What I've found works", "What I tell all my blokes". Keep answers short and punchy — local footy athletes don't want essays. Be encouraging but real — don't sugarcoat, but don't be a prick either.

PHILOSOPHY: The #1 principle is simplicity. Repeat foundational movement patterns (squat, hinge, push, pull, carry). Intensity > volume. Get strong at 5-10 lifts. These are hybrid athletes: get strong, get big, get fit, get fast. Looking good matters just as much as performance. Focus on the big rocks that get athletes to 90% of their potential. No speed ladders, no Olympic lifting, no complex drills.

PROGRAMMING: Use your judgment — rep ranges are FLEXIBLE GUIDELINES, not hard rules. The defaults are:
- COMPOUND lifts (squat, bench, deadlift, OHP, rows, pull-ups): follow phase-based ranges. In-season default is sets of 3, but 3x5 is totally fine if they've been doing 3x3 for a while. Pre/off-season: up to 10 reps. 5 reps is the sweet spot for compounds.
- ACCESSORY lifts (lateral raises, skull crushers, curls, face pulls, calf raises, etc.): ALWAYS 3x10-15 regardless of phase. It makes zero sense to do sets of 3 on a lateral raise.
- Progressive overload for compounds: start at 5 reps, work to 8, increase weight, back to 5. For accessories: 10→15→bump weight→back to 10.
- Minimum 2 gym days, ideally 3-4. Keep in-season training same week to week, change only accessories between mini-cycles.
- Be flexible. If something doesn't make sense for the athlete's situation, adjust it. These are guidelines, not laws.

CONDITIONING: The conditioning session library is a TOOLKIT of examples, not the only options. Use your judgment and create sessions that fit the athlete's needs. Good examples include: sprint intervals on assault bike (6x10s or 3x20s, maximal effort), flush-out sessions (30 on/30 off rotating bike/ski/rower for 30 min), Nordic 4x4 protocols, hill sprints, tempo runs, MAS training, quality sprint sessions. Off-leg as much as possible in-season. Team training covers most cardio. Feel free to design new sessions that fit the same philosophy — short, intense, purposeful.

INJURIES: Always tell them what they CAN do. Get movement and load in ASAP but pain must be 3/10 or less. Always recommend seeing a physio for anything more than a minor niggle. For serious stuff: STOP and refer out immediately.

NUTRITION: Calories are king. Protein and carbs. Natural whole foods. Honey and rice are great. Drop fibre near game day. Magnesium glycinate and salt are important. Don't preach about alcohol or junk food — acknowledge the reality of local footy culture.

RECOVERY: Sleep is #1. Pre-bed routine: stretches, hot shower, slow breathing. Being in good shape IS recovery. Sauna and ice baths are nice extras. Active recovery walks on Sundays.

GUARDRAILS:
- NEVER diagnose injuries. Always recommend physio/sports doc for anything beyond a minor niggle.
- NEVER prescribe specific diets or meal plans. Broad guidelines only.
- NEVER recommend specific supplement dosages. General guidance only.
- NEVER try to turn them into professional athletes. This is local footy.
- If someone seems injured, distressed, or describes serious symptoms, take it seriously and refer out immediately.`;

/**
 * Main handler for coach-send-message edge function
 */
Deno.serve(async (req: Request) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    // Parse request body
    const body = await parseJsonBody<CoachSendMessageRequest>(req);
    const error = validateRequired(body, ['user_id', 'conversation_id', 'message']);
    if (error) {
      return errorResponse(error, 400);
    }

    const { user_id, conversation_id, message } = body;
    log('coach-send-message', 'Received message', {
      user_id,
      conversation_id,
      messageLength: message.length,
    });

    // Create Supabase client
    const supabase = createSupabaseClient();

    // Fetch user profile for context
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user_id)
      .single();

    if (userError || !userProfile) {
      return errorResponse(`User not found: ${user_id}`, 404);
    }

    // Fetch recent workouts for context
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentWorkouts, error: workoutError } = await supabase
      .from('logged_workouts')
      .select('*, workouts(*)')
      .eq('user_id', user_id)
      .gte('logged_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('logged_date', { ascending: false })
      .limit(5);

    const workoutContext = formatWorkoutContext(recentWorkouts || []);

    // Fetch conversation history for context
    const { data: conversationMessages, error: messagesError } = await supabase
      .from('coach_messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(10);

    // Build context-aware system prompt
    const contextualSystemPrompt = buildContextualSystemPrompt(
      COACH_SYSTEM_PROMPT,
      userProfile,
      workoutContext
    );

    // Fetch current active program for phase context
    const { data: activeProgram } = await supabase
      .from('training_programs')
      .select('program_phase, primary_focus')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .single();

    // Save user message to database
    const { data: userMessageData, error: saveUserError } = await supabase
      .from('coach_messages')
      .insert({
        conversation_id,
        role: 'user',
        content: message,
      })
      .select('id')
      .single();

    if (saveUserError || !userMessageData) {
      return errorResponse('Failed to save user message', 500);
    }

    log('coach-send-message', 'User message saved', { messageId: userMessageData.id });

    // Call the configured coach LLM provider
    const coachResponse = await callCoachLLMAPI(
      contextualSystemPrompt,
      conversationMessages || [],
      message
    );

    if (!coachResponse.success) {
      return errorResponse(coachResponse.error || 'Failed to get AI response', 500);
    }

    // Save assistant response to database
    const { data: assistantMessageData, error: saveAssistantError } = await supabase
      .from('coach_messages')
      .insert({
        conversation_id,
        role: 'assistant',
        content: coachResponse.message,
        tokens_used: coachResponse.tokensUsed,
      })
      .select('id')
      .single();

    if (saveAssistantError || !assistantMessageData) {
      return errorResponse('Failed to save assistant message', 500);
    }

    log('coach-send-message', 'Response generated and saved', {
      messageId: assistantMessageData.id,
      tokensUsed: coachResponse.tokensUsed,
    });

    const response: CoachSendMessageResponse = {
      success: true,
      conversationId: conversation_id,
      messageId: assistantMessageData.id,
      response: coachResponse.message,
    };

    return successResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('coach-send-message', 'Error', message);
    return errorResponse(`Message processing failed: ${message}`, 500, error);
  }
});

/**
 * Helper: Build contextual system prompt with user info
 */
function buildContextualSystemPrompt(
  basePrompt: string,
  userProfile: DbUserProfile,
  workoutContext: string
): string {
  return `${basePrompt}

ATHLETE CONTEXT:
Position: ${userProfile.position}
Experience Level: ${userProfile.experience_level}
Age: ${userProfile.age}
Days Per Week Training: ${userProfile.days_per_week}
Training Location: ${userProfile.training_location}

EQUIPMENT AVAILABLE:
- Barbell: ${userProfile.has_barbell ? 'Yes' : 'No'}
- Dumbbells: ${userProfile.has_dumbbells ? 'Yes' : 'No'}
- Full Gym: ${userProfile.has_full_gym ? 'Yes' : 'No'}

INJURIES/RESTRICTIONS:
${userProfile.injury_history && userProfile.injury_history.length > 0
  ? userProfile.injury_history.map((i) => `- ${i}`).join('\n')
  : '- None recorded'}

RECENT TRAINING ACTIVITY:
${workoutContext}`;
}

/**
 * Helper: Format recent workout data for context
 */
function formatWorkoutContext(workouts: any[]): string {
  if (workouts.length === 0) {
    return '- No recent workouts logged';
  }

  return workouts
    .map((w) => {
      const date = new Date(w.logged_date).toLocaleDateString('en-AU');
      const completed = w.completed ? '✓' : '✗';
      return `- ${date} ${completed}: ${w.workouts?.name || 'Unknown workout'} (${w.workouts?.duration_minutes || '?'} min)`;
    })
    .join('\n');
}

/**
 * Helper: Call configured coach LLM provider
 */
type CoachLLMProvider = 'openai' | 'anthropic';

function normalizeCoachProvider(raw: string | undefined | null): CoachLLMProvider | null {
  const value = raw?.trim().toLowerCase();
  if (value === 'openai') return 'openai';
  if (value === 'anthropic' || value === 'claude') return 'anthropic';
  return null;
}

function resolveCoachProvider(): CoachLLMProvider {
  const configured = normalizeCoachProvider(Deno.env.get('COACH_LLM_PROVIDER'));
  if (configured) return configured;
  return Deno.env.get('OPENAI_API_KEY') ? 'openai' : 'anthropic';
}

function extractOpenAIText(data: any): string {
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  const parts: string[] = [];
  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
      if (typeof content?.refusal === 'string') parts.push(content.refusal);
    }
  }
  return parts.join('\n').trim();
}

async function callCoachLLMAPI(
  systemPrompt: string,
  conversationHistory: any[],
  userMessage: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  tokensUsed?: number;
}> {
  try {
    const provider = resolveCoachProvider();
    const apiKey = provider === 'openai'
      ? Deno.env.get('OPENAI_API_KEY')
      : Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      const envName = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
      throw new Error(`${envName} not configured`);
    }

    // Build messages array for the selected provider
    const messages = [
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    log('coach-send-message', 'Calling coach LLM provider', {
      provider,
      messageCount: messages.length,
    });

    const response = provider === 'openai'
      ? await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: Deno.env.get('COACH_SEND_MESSAGE_LLM_MODEL') ||
            Deno.env.get('COACH_LLM_MODEL') ||
            'gpt-5.5',
          instructions: systemPrompt,
          input: messages,
          max_output_tokens: 1024,
        }),
      })
      : await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: Deno.env.get('ANTHROPIC_SEND_MESSAGE_MODEL') || 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        }),
      });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const assistantMessage = provider === 'openai'
      ? extractOpenAIText(data)
      : data.content?.[0]?.text;
    if (!assistantMessage) {
      throw new Error(`Invalid response format from ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API`);
    }
    const tokensUsed = data.usage?.output_tokens || data.usage?.completion_tokens || 0;

    log('coach-send-message', 'Coach LLM response received', { provider, tokensUsed });

    return {
      success: true,
      message: assistantMessage,
      tokensUsed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('coach-send-message', 'Coach LLM call failed', message);
    return {
      success: false,
      error: `AI coach unavailable: ${message}`,
    };
  }
}
