export const proxyChat = async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'message is required' });
  }

  try {
    const response = await fetch(`${process.env.DOWNSTREAM_AI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DOWNSTREAM_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.DOWNSTREAM_AI_MODEL,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(502).json({ message: 'Downstream AI service error', detail: errorBody });
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    res.status(200).json({ reply });
  } catch (err) {
    res.status(502).json({ message: 'Failed to reach downstream AI service', error: err.message });
  }
};
