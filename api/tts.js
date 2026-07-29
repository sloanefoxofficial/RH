export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Missing text parameter' });
  }

  try {
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        reference_id: process.env.JUAN_VOICE_ID,
        format: 'mp3',
        mp3_bitrate: 128,
        latency: 'normal'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fish Audio API error:', errorText);
      return res.status(response.status).json({ error: 'Failed to generate speech' });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);

  } catch (error) {
    console.error('TTS Server Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
