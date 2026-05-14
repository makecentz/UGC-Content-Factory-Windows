import { generateVoiceover } from "@/lib/openai";

export async function generateKidsVoiceover(text: string, provider: string, voice: string) {
  if (provider === "elevenlabs") {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is missing. Add it to .env.local and restart the dev server.");
    const voiceId = process.env.ELEVENLABS_VOICE_ID || voice;
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true }
      })
    });
    if (!response.ok) throw new Error(`ElevenLabs voiceover failed: ${response.status} ${await response.text()}`);
    return Buffer.from(await response.arrayBuffer());
  }

  return generateVoiceover(text, voice);
}
