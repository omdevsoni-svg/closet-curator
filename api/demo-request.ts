import type { VercelRequest, VercelResponse } from "@vercel/node";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const NOTIFY_EMAIL = process.env.DEMO_NOTIFY_EMAIL || "omdevsoni@gofynd.com";

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";
  return { url, key };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, company, message } = req.body || {};

  if (!name || !email || !company) {
    return res.status(400).json({ error: "Name, email, and company are required." });
  }

  // 1. Insert into Supabase
  const { url: sbUrl, key: sbKey } = getSupabaseConfig();
  let dbOk = false;
  try {
    const dbRes = await fetch(`${sbUrl}/rest/v1/demo_requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ name, email, company, message: message || null }),
    });
    dbOk = dbRes.ok;
    if (!dbOk) {
      console.error("Supabase insert failed:", dbRes.status, await dbRes.text());
    }
  } catch (e) {
    console.error("Supabase insert error:", e);
  }

  // 2. Send email notification via Resend
  let emailOk = false;
  if (RESEND_API_KEY) {
    try {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "StyleOS <onboarding@resend.dev>",
          to: [NOTIFY_EMAIL],
          subject: `New Demo Request from ${name} (${company})`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="background: linear-gradient(135deg, #7c3aed, #f59e0b); padding: 2px; border-radius: 16px;">
                <div style="background: #1a1a2e; border-radius: 14px; padding: 32px;">
                  <h1 style="color: #fff; font-size: 22px; margin: 0 0 4px;">New Demo Request</h1>
                  <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0 0 24px;">Someone wants to learn about StyleOS</p>

                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); font-size: 13px; width: 100px;">Name</td>
                      <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: #fff; font-size: 14px; font-weight: 500;">${name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); font-size: 13px;">Email</td>
                      <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: #fff; font-size: 14px;">
                        <a href="mailto:${email}" style="color: #a78bfa; text-decoration: none;">${email}</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); font-size: 13px;">Company</td>
                      <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08); color: #fff; font-size: 14px; font-weight: 500;">${company}</td>
                    </tr>
                    ${message ? `
                    <tr>
                      <td style="padding: 12px 0; color: rgba(255,255,255,0.5); font-size: 13px; vertical-align: top;">Message</td>
                      <td style="padding: 12px 0; color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.5;">${message}</td>
                    </tr>
                    ` : ""}
                  </table>

                  <div style="margin-top: 24px; padding: 16px; background: rgba(124, 58, 237, 0.1); border-radius: 10px; border: 1px solid rgba(124, 58, 237, 0.2);">
                    <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0;">
                      Reply directly to <a href="mailto:${email}" style="color: #a78bfa;">${email}</a> to follow up.
                    </p>
                  </div>
                </div>
              </div>
              <p style="color: #666; font-size: 11px; text-align: center; margin-top: 16px;">StyleOS by Impetus / Fynd</p>
            </div>
          `,
        }),
      });
      emailOk = emailRes.ok;
      if (!emailOk) {
        console.error("Resend email failed:", emailRes.status, await emailRes.text());
      }
    } catch (e) {
      console.error("Resend email error:", e);
    }
  } else {
    console.warn("RESEND_API_KEY not set — skipping email notification");
  }

  if (!dbOk) {
    return res.status(500).json({ error: "Failed to save request. Please try again." });
  }

  return res.status(200).json({
    success: true,
    emailSent: emailOk,
  });
}
