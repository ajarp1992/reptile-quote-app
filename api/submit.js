export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { name, phone, description, photos } = req.body;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (supabaseUrl && supabaseKey) {
      await fetch(`${supabaseUrl}/rest/v1/quotes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          name: name,
          phone: phone,
          description: description || "",
          photo_count: photos || 0,
          created_at: new Date().toISOString(),
        }),
      });
    }

    const pushoverToken = process.env.PUSHOVER_TOKEN;
    const pushoverUser = process.env.PUSHOVER_USER;

    if (pushoverToken && pushoverUser) {
      await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: pushoverToken,
          user: pushoverUser,
          title: "New Quote Request!",
          message: `Name: ${name}\nPhone: ${phone}\nProject: ${description || "(no description)"}`,
          sound: "cashregister",
          priority: 1,
        }),
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Submit error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
