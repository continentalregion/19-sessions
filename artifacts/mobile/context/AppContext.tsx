import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

import i18n from "@/lib/i18n";
import type { TrainingGoal } from "@/constants/circuits";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/constants/translations";
import { setSpeechLanguage } from "@/utils/speech";

const GOAL_STORAGE_KEY = "training_goal_profile";
const LANGUAGE_STORAGE_KEY = "app_language";
const GOAL_CHANGE_LOCK_DAYS = 30;

interface TrainingGoalProfile {
  goal: TrainingGoal;
  setAt: string; // ISO date
}

interface AppContextValue {
  isReady: boolean;
  goal: TrainingGoal | null;
  goalSetAt: Date | null;
  setGoal: (goal: TrainingGoal) => Promise<void>;
  canChangeGoal: boolean;
  nextGoalChangeDate: Date | null;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function isSupportedLanguage(value: string | null): value is SupportedLanguage {
  return !!value && (SUPPORTED_LANGUAGES as string[]).includes(value);
}

const isWeb = Platform.OS === "web";

async function getPersistedLanguage(): Promise<string | null> {
  if (isWeb) return AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  return SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
}

async function setPersistedLanguage(lang: SupportedLanguage): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    return;
  }
  await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, lang);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState<TrainingGoalProfile | null>(null);
  const [language, setLanguageState] = useState<SupportedLanguage>("it");

  useEffect(() => {
    (async () => {
      try {
        const [storedProfile, storedLanguage] = await Promise.all([
          AsyncStorage.getItem(GOAL_STORAGE_KEY),
          getPersistedLanguage(),
        ]);

        if (storedProfile) {
          setProfile(JSON.parse(storedProfile) as TrainingGoalProfile);
        }

        const resolvedLanguage = isSupportedLanguage(storedLanguage)
          ? storedLanguage
          : "it";
        setLanguageState(resolvedLanguage);
        i18n.changeLanguage(resolvedLanguage);
        setSpeechLanguage(resolvedLanguage);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setGoal = async (goal: TrainingGoal) => {
    const next: TrainingGoalProfile = { goal, setAt: new Date().toISOString() };
    setProfile(next);
    await AsyncStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(next));
  };

  const setLanguage = async (lang: SupportedLanguage) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    setSpeechLanguage(lang);
    await setPersistedLanguage(lang);
  };

  const value = useMemo<AppContextValue>(() => {
    const goalSetAt = profile ? new Date(profile.setAt) : null;
    let canChangeGoal = true;
    let nextGoalChangeDate: Date | null = null;

    if (goalSetAt) {
      const nextChange = new Date(goalSetAt);
      nextChange.setDate(nextChange.getDate() + GOAL_CHANGE_LOCK_DAYS);
      if (nextChange.getTime() > Date.now()) {
        canChangeGoal = false;
        nextGoalChangeDate = nextChange;
      }
    }

    return {
      isReady,
      goal: profile?.goal ?? null,
      goalSetAt,
      setGoal,
      canChangeGoal,
      nextGoalChangeDate,
      language,
      setLanguage,
    };
  }, [isReady, profile, language]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
