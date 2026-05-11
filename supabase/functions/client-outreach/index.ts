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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables')
    }

    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // 1. Get services due in the next 7 days that haven't been outreached yet
    const today = new Date()
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(today.getDate() + 7)

    const { data: services, error: fetchError } = await supabaseClient
      .from('services')
      .select(`
        id,
        type,
        next_due,
        plate,
        cars!inner (
          make,
          model,
          year,
          clients!inner (
            id,
            name,
            phone
          )
        )
      `)
      .lte('next_due', sevenDaysFromNow.toISOString())
      .gte('next_due', today.toISOString())
      .is('_last_outreach_at', null)

    if (fetchError) throw fetchError

    const results = []

    for (const service of services) {
      const client = service.cars.clients
      const car = service.cars
      
      // 2. Generate personalized message using Gemini
      const prompt = `
        You are a friendly service advisor at "AutoShift Showroom".
        Create a personalized service reminder for a client.
        
        Details:
        Client Name: ${client.name}
        Car: ${car.year} ${car.make} ${car.model}
        Service Type: ${service.type}
        Next Due Date: ${new Date(service.next_due).toLocaleDateString()}
        
        Instructions:
        - Be professional but warm.
        - Reference the specific car and service.
        - Encourage them to book an appointment soon.
        - Keep it under 160 characters (suitable for SMS/WhatsApp).
        - Don't use placeholders; use the real names.
      `

      const result = await model.generateContent(prompt)
      const response = await result.response
      const message = response.text()

      // 3. Send via Twilio (Optional: Uncomment to enable)
      /*
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
      const twilioFrom = Deno.env.get('TWILIO_FROM_NUMBER')
      
      if (twilioAccountSid && twilioAuthToken) {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`
        const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`)
        
        await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: client.phone,
            From: twilioFrom,
            Body: message
          })
        })
      }
      */

      // 4. Log the outreach
      const { error: logError } = await supabaseClient
        .from('outreach_logs')
        .insert({
          service_id: service.id,
          client_id: client.id, // Note: Need to make sure client ID is available. 
          // Wait, service.cars.clients might not return ID unless specified.
          status: 'sent',
          generated_message: message,
          metadata: { service_type: service.type, car: `${car.make} ${car.model}` }
        })

      if (logError) {
        console.error(`Error logging outreach for ${service.id}:`, logError)
      } else {
        // 4. Update the service record to prevent duplicates
        await supabaseClient
          .from('services')
          .update({ _last_outreach_at: new Date().toISOString() })
          .eq('id', service.id)
          
        results.push({ serviceId: service.id, status: 'success', message })
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, details: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
