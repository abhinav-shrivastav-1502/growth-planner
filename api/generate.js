export default async function handler(req, res) {
  // Allow requests from any origin (CORS fix)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product, goal, segment, channel, constraint } = req.body;

  if (!product || !goal || !segment) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const userMsg = [
    'Product: ' + product,
    'Growth Goal: ' + goal,
    'User Segment: ' + segment,
    channel    ? 'Channel: '    + channel    : '',
    constraint ? 'Constraint: ' + constraint : ''
  ].filter(Boolean).join('\n');

  const systemPrompt = `You are a senior growth marketing strategist. Respond ONLY with valid JSON, no markdown, no extra text.

Return this exact JSON structure:
{"hypothesis":"If we [action] then [segment] will [outcome] because [reason]","primary_metric":"...","secondary_metrics":["...","...","..."],"control":"...","variant":"...","messaging_copy":{"control_headline":"...","variant_headline":"...","variant_cta":"..."},"confidence_level":"High","confidence_reason":"..."}

Be specific and actionable. Apply relevant market context (e.g. India: EMI sensitivity, WhatsApp behaviour, regional social proof).`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Store your Groq API key in Vercel environment variables as GROQ_API_KEY
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg }
        ]
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json({ error: err?.error?.message || 'Groq API error' });
    }

    const data  = await groqRes.json();
    const raw   = data.choices?.[0]?.message?.content?.trim() || '';
    const clean = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();

    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
