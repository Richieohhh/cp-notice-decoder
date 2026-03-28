export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { noticeNumber } = req.body;
  if (!noticeNumber) return res.status(400).json({ error: 'Missing noticeNumber' });

  const systemPrompt = `You are a senior IRS tax resolution specialist with deep expertise in CP notice interpretation. A CPA has submitted a CP notice number. Return ONLY valid JSON — no preamble, no markdown fences.

Return this exact structure:
{
  "notice_number": "CP[XX]",
  "headline": "One sentence: what the IRS is claiming or doing",
  "severity": "Low" or "Medium" or "High" or "Critical",
  "severity_reason": "One sentence explaining why",
  "what_it_means": "2-3 plain-English sentences. No jargon.",
  "deadline_days": 30,
  "deadline_label": "e.g. 30 days from notice date",
  "deadline_consequence": "One sentence: what happens if they miss it",
  "escalation_risk_score": 65,
  "escalation_risk_description": "2 sentences on escalation risk",
  "action_steps": ["Step 1", "Step 2", "Step 3"],
  "beyond_cpa_scope": true,
  "scope_note": "One sentence or null",
  "client_explanation": "3-4 sentences written for the taxpayer in plain English.",
  "irs_program": "Name of specific IRS unit or program",
  "common_mistake": "The number 1 error CPAs make with this notice"
}

escalation_risk_score is 0-100.
If not a real IRS CP notice return: {"error": "unrecognized_notice", "message": "Brief explanation"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Decode this IRS CP notice: ${noticeNumber}` }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: 'API error', detail: err });
    }

    const data = await response.json();
    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
