import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userProfile, healthData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a friendly, expert AI Health Assistant for a Smart Health Monitoring app. 

User Profile:
- Age: ${userProfile?.age || 'unknown'}
- Weight: ${userProfile?.weight || 'unknown'} kg
- Height: ${userProfile?.height || 'unknown'} cm
- Gender: ${userProfile?.gender || 'unknown'}
- Activity Level: ${userProfile?.activityLevel || 'unknown'}
- Health Goal: ${userProfile?.healthGoal || 'unknown'}

Current Health Data:
- Steps today: ${healthData?.stepsToday || 0}
- Calories consumed: ${healthData?.caloriesConsumed || 0} kcal
- Water consumed: ${healthData?.waterConsumed || 0} ml
- Heart rate: ${healthData?.heartRate || 'not measured'} BPM
- Foods scanned today: ${healthData?.foodsScanned?.length || 0}

Your capabilities:
1. Give personalized diet and nutrition advice
2. Suggest exercises and activities
3. Provide water intake recommendations
4. Analyze eating patterns
5. Give motivational health tips
6. Answer health and wellness questions
7. Warn about unhealthy patterns

Keep responses concise, friendly, and actionable. Use emojis sparingly for engagement. Always consider the user's health goal and current data when giving advice.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("health-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
