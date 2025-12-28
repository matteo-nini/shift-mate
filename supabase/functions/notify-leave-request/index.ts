import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyLeaveRequest {
  user_id: string;
  request_type: string;
  start_date: string;
  end_date: string;
  status: 'approved' | 'rejected';
  review_notes?: string;
  reviewer_name?: string;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  ferie: 'Ferie',
  permesso: 'Permesso',
  malattia: 'Malattia',
  altro: 'Altro',
};

const handler = async (req: Request): Promise<Response> => {
  console.log("notify-leave-request function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, request_type, start_date, end_date, status, review_notes, reviewer_name }: NotifyLeaveRequest = await req.json();
    
    console.log("Notifying user:", user_id, "about leave request status:", status);

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

    const formattedStartDate = new Date(start_date).toLocaleDateString("it-IT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const formattedEndDate = new Date(end_date).toLocaleDateString("it-IT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const userName = profile.full_name || profile.username || "Utente";
    const requestTypeLabel = REQUEST_TYPE_LABELS[request_type] || request_type;
    const isApproved = status === 'approved';
    const statusLabel = isApproved ? 'Approvata' : 'Rifiutata';
    const statusColor = isApproved ? '#22C55E' : '#EF4444';
    const statusEmoji = isApproved ? '✅' : '❌';

    const emailResponse = await resend.emails.send({
      from: "Turni <onboarding@resend.dev>",
      to: [profile.email],
      subject: `Richiesta ${requestTypeLabel} ${statusLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f7fa; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: ${statusColor}; padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">
                ${statusEmoji} Richiesta ${statusLabel}
              </h1>
            </div>
            <div style="padding: 32px;">
              <p style="color: #333; font-size: 16px; margin-bottom: 24px;">
                Ciao <strong>${userName}</strong>,
              </p>
              <p style="color: #555; font-size: 15px; margin-bottom: 24px;">
                La tua richiesta di <strong>${requestTypeLabel.toLowerCase()}</strong> è stata <strong style="color: ${statusColor};">${statusLabel.toLowerCase()}</strong>.
              </p>
              <div style="background: #f8f9fc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                  <span style="font-size: 24px; margin-right: 12px;">📋</span>
                  <div>
                    <p style="color: #888; font-size: 12px; margin: 0; text-transform: uppercase;">Tipo Richiesta</p>
                    <p style="color: #333; font-size: 16px; margin: 4px 0 0 0; font-weight: 600;">${requestTypeLabel}</p>
                  </div>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                  <span style="font-size: 24px; margin-right: 12px;">📅</span>
                  <div>
                    <p style="color: #888; font-size: 12px; margin: 0; text-transform: uppercase;">Periodo</p>
                    <p style="color: #333; font-size: 16px; margin: 4px 0 0 0; font-weight: 600;">
                      ${formattedStartDate}${start_date !== end_date ? ` - ${formattedEndDate}` : ''}
                    </p>
                  </div>
                </div>
                ${reviewer_name ? `
                <div style="display: flex; align-items: center; ${review_notes ? 'margin-bottom: 16px;' : ''}">
                  <span style="font-size: 24px; margin-right: 12px;">👤</span>
                  <div>
                    <p style="color: #888; font-size: 12px; margin: 0; text-transform: uppercase;">Revisionato da</p>
                    <p style="color: #333; font-size: 16px; margin: 4px 0 0 0; font-weight: 600;">${reviewer_name}</p>
                  </div>
                </div>
                ` : ''}
                ${review_notes ? `
                <div style="display: flex; align-items: flex-start;">
                  <span style="font-size: 24px; margin-right: 12px;">📝</span>
                  <div>
                    <p style="color: #888; font-size: 12px; margin: 0; text-transform: uppercase;">Note</p>
                    <p style="color: #333; font-size: 14px; margin: 4px 0 0 0;">${review_notes}</p>
                  </div>
                </div>
                ` : ''}
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
    console.error("Error in notify-leave-request function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
