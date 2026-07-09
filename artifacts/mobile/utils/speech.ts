import * as Speech from "expo-speech";

import { SPEECH_LOCALES, type SupportedLanguage } from "@/constants/translations";

let currentLanguage: SupportedLanguage = "it";

export function setSpeechLanguage(lang: SupportedLanguage) {
  currentLanguage = lang;
}

export function speak(text: string) {
  Speech.stop();
  Speech.speak(text, {
    language: SPEECH_LOCALES[currentLanguage],
    pitch: 1,
    rate: 1,
  });
}

export function stopSpeech() {
  Speech.stop();
}
