import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyShiftRequest {
  user_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("notify-shift function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, shift_date, start_time, end_time, notes }: NotifyShiftRequest = await req.json();
    
    console.log("Notifying user:", user_id, "about shift on", shift_date);

    // Get user profile with email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, username")
      .eq("id", user_id)
      .single();

    if (profileError || !profile?.email) {
      console.log("User email not found, skipping notification");
      return new Response(
        JSON.stringify({ success: false, reason: "no_email" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const formattedDate = new Date(shift_date).toLocaleDateString("it-IT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const userName = profile.full_name || profile.username || "Utente";

    const emailResponse = await resend.emails.send({
      from: "Turni <onboarding@resend.dev>",
      to: [profile.email],
      subject: `Nuovo turno assegnato - ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #2962FF 0%, #6C5CE7 100%); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Nuovo Turno Assegnato</h1>
            </div>
            <div style="padding: 32px;">
              <p style="color: #333; font-size: 16px; margin-bottom: 24px;">
                Ciao <strong>${userName}</strong>,
              </p>
              <p style="color: #555; font-size: 15px; margin-bottom: 24px;">
                Ti è stato assegnato un nuovo turno di lavoro:
              </p>
              <div style="background: #f8f9fc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                  <span style="font-size: 24px; margin-right: 12px;">📅</span>
                  <div>
                    <p style="color: #888; font-size: 12px; margin: 0; text-transform: uppercase;">Data</p>
                    <p style="color: #333; font-size: 16px; margin: 4px 0 0 0; font-weight: 600;">${formattedDate}</p>
                  </div>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: ${notes ? "16px" : "0"};">
                  <span style="font-size: 24px; margin-right: 12px;">⏰</span>
                  <div>
                    <p style="color: #888; font-size: 12px; margin: 0; text-transform: uppercase;">Orario</p>
                    <p style="color: #333; font-size: 16px; margin: 4px 0 0 0; font-weight: 600;">${start_time.slice(0, 5)} - ${end_time.slice(0, 5)}</p>
                  </div>
                </div>
                ${notes ? `
                <div style="display: flex; align-items: flex-start;">
                  <span style="font-size: 24px; margin-right: 12px;">📝</span>
                  <div>
                    <p style="color: #888; font-size: 12px; margin: 0; text-transform: uppercase;">Note</p>
                    <p style="color: #333; font-size: 14px; margin: 4px 0 0 0;">${notes}</p>
                  </div>
                </div>
                ` : ""}
              </div>
              <p style="color: #888; font-size: 13px; text-align: center;">
                Accedi all'app per visualizzare tutti i dettagli.
              </p>
            </div>
            <div style="background: #f8f9fc; padding: 16px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #888; font-size: 12px; margin: 0;">
                Questa è un'email automatica. Non rispondere a questo messaggio.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in notify-shift function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
