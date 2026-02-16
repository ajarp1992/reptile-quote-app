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

    let quoteId = null;
    let photoUrls = [];

    if (supabaseUrl && supabaseKey) {
      const quoteRes = await fetch(`${supabaseUrl}/rest/v1/quotes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          name: name,
          phone: phone,
          description: description || "",
          photo_count: photos ? photos.length : 0,
          created_at: new Date().toISOString(),
        }),
      });

      const quoteData = await quoteRes.json();
      if (quoteData && quoteData.length > 0) {
        quoteId = quoteData[0].id;
      }

      if (quoteId && photos && photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          const ext = photo.type === "image/png" ? "png" : "jpg";
          const fileName = `quote-${quoteId}/photo-${i + 1}.${ext}`;

          const binaryStr = atob(photo.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let j = 0; j < binaryStr.length; j++) {
            bytes[j] = binaryStr.charCodeAt(j);
          }

          await fetch(`${supabaseUrl}/storage/v1/object/quote-photos/${fileName}`, {
            method: "POST",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": photo.type,
            },
            body: bytes,
          });

          photoUrls.push(`${supabaseUrl}/storage/v1/object/public/quote-photos/${fileName}`);
        }

        await fetch(`${supabaseUrl}/rest/v1/quotes?id=eq.${quoteId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            photo_urls: photoUrls,
          }),
        });
      }
    }

    const pushoverToken = process.env.PUSHOVER_TOKEN;
    const pushoverUser = process.env.PUSHOVER_USER;

    if (pushoverToken && pushoverUser) {
      let message = `Name: ${name}\nPhone: ${phone}\nProject: ${description || "(none)"}`;

      if (photoUrls.length > 0) {
        message += `\n\n${photoUrls.length} photo(s) attached:`;
        message += `\n${photoUrls[0]}`;
      }

      const pushBody = {
        token: pushoverToken,
        user: pushoverUser,
        title: `Quote #${quoteId || "new"} - ${name}`,
        message: message,
        sound: "cashregister",
        priority: 1,
        html: 1,
      };

      if (photoUrls.length > 0) {
        pushBody.url = photoUrls[0];
        pushBody.url_title = `View all ${photoUrls.length} photo(s)`;
      }

      await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pushBody),
      });
    }

    return res.status(200).json({ success: true, quoteId: quoteId });
  } catch (err) {
    console.error("Submit error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
