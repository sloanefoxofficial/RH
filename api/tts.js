// tts.js - Chatterbox API Integration
import axios from 'axios';

// 1. Point to your newly uploaded S3 file as the voice reference
const JUAN_VOICE_S3_URL = "https://lb293.s3.ap-southeast-2.amazonaws.com/audio.wav";

/**
 * Generates speech using Juan's cloned voice via Chatterbox AI
 * @param {string} textToSpeak - The text you want Juan's voice to say
 */
export async function generateJuanSpeech(textToSpeak) {
  try {
    const response = await axios.post(
      "https://gateway.pixazo.ai/chatterbox-text-to-speech/v1/chatterbox-text-to-speech-request", 
      {
        text: textToSpeak,
        audio_url: JUAN_VOICE_S3_URL, // <-- Your S3 URL goes here!
        exaggeration: 0.5,             // Controls how expressive/dramatic he sounds (0.0 to 1.0)
        temperature: 0.7,
        cfg: 0.5
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": process.env.CHATTERBOX_API_KEY // Put your Chatterbox API key in your .env
        }
      }
    );

    // Chatterbox returns a request ID because it processes the file asynchronously
    const requestId = response.data.request_id;
    console.log("Speech generation started! Request ID:", requestId);
    
    // Return the ID so your app can poll for the finished audio file
    return requestId;

  } catch (error) {
    console.error("Error generating Chatterbox TTS:", error);
    throw error;
  }
}
