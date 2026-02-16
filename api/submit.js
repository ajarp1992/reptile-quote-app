const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, phone, description, photos } = req.body;

    // 1. Save quote to database
    const { data: quote, error: dbError } = await supabase
      .from('quotes')
      .insert([{ name, phone, description }])
      .select()
      .single();

    if (dbError) {
      console.error('DB Error:', dbError);
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    const quoteId = quote.id;
    const photoLinks = [];

    // 2. Upload photos to Supabase Storage
    if (photos && photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const buffer = Buffer.from(photo.data, 'base64');
        const ext = photo.type === 'image/png' ? 'png' : 'jpg';
        const filePath = `quote-${quoteId}/photo-${i + 1}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('quote-photos')
          .upload(filePath, buffer, {
            contentType: photo.type,
            upsert: true
          });

        if (uploadError) {
          console.error('Upload Error:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('quote-photos')
          .getPublicUrl(filePath);

        if (urlData && urlData.publicUrl) {
          photoLinks.push(urlData.publicUrl);
        }
      }

      // 3. Save photo URLs to database
      if (photoLinks.length > 0) {
        await supabase
          .from('quotes')
          .update({ photo_urls: photoLinks })
          .eq('id', quoteId);
      }
    }

    // 4. Send Pushover notification
    let message = `New Quote #${quoteId}\nName: ${name}\nPhone: ${phone}`;
    if (description) message += `\nProject: ${description}`;
    if (photoLinks.length > 0) {
      message += `\n\nPhotos (${photoLinks.length}):`;
      photoLinks.forEach((link, i) => {
        message += `\nPhoto ${i + 1}: ${link}`;
      });
    }

    await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: process.env.PUSHOVER_TOKEN,
        user: process.env.PUSHOVER_USER,
        message: message,
        sound: 'cashregister',
        priority: 1,
        title: 'Rep-Tile Quote Request'
      })
    });

    return res.status(200).json({ success: true, quoteId });

  } catch (err) {
    console.error('Server Error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};
