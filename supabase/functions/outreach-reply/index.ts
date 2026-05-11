import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { Body, From } = await req.json() // Mocking Twilio payload structure

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not set')

    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // 1. Identify the client by phone number
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('id, name')
      .eq('phone', From)
      .single()

    if (clientError || !client) {
      console.error('Client not found for phone:', From)
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 })
    }

    // 2. Use AI to interpret the reply
    const prompt = `
      A client named ${client.name} replied to a service reminder.
      Reply Text: "${Body}"
      
      Categorize this reply into one of these actions:
      - "CONFIRM": They want to book the appointment.
      - "RESCHEDULE": They want a different time.
      - "CANCEL": They are not interested.
      - "UNKNOWN": Anything else.
      
      Respond only with the category name.
    `

    const result = await model.generateContent(prompt)
    const category = (await result.response).text().trim().toUpperCase()

    let responseMessage = "Thank you for your reply."

    if (category === 'CONFIRM') {
      // 3. Create a tentative appointment
      await supabaseClient.from('appointments').insert({
        client_id: client.id,
        status: 'pending',
        type: 'General Service',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0] // Default to tomorrow
      })
      responseMessage = `Great news, ${client.name}! We've penciled you in for tomorrow. Our team will call to confirm the exact time.`
    } else if (category === 'RESCHEDULE') {
      responseMessage = `No problem! When would work best for you?`
    }

    // In a real app, you would send this responseMessage back via Twilio here.

    return new Response(
      JSON.stringify({ success: true, category, reply: responseMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
