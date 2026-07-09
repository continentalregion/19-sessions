import { Feather } from "@expo/vector-icons";
import {
  useCreatePricingCheckout,
  useCreatePricingPortalSession,
  useGetPricingState,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/constants/translations";

const STATUS_LABEL_KEY: Record<string, string> = {
  active: "pricing.statusActive",
  past_due: "pricing.statusPastDue",
  canceled: "pricing.statusCanceled",
  incomplete: "pricing.statusIncomplete",
};

function SubscriptionSection() {
  const colors = useColors();
  const { t } = useTranslation();

  const { data, isLoading, error } = useGetPricingState();
  const checkoutMutation = useCreatePricingCheckout();
  const portalMutation = useCreatePricingPortalSession();

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, paddingVertical: 20 }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>
          {t("pricing.loadError")}
        </Text>
      </View>
    );
  }

  const isActive = data.subscriptionStatus === "active";
  const statusKey = data.subscriptionStatus
    ? STATUS_LABEL_KEY[data.subscriptionStatus] ?? "pricing.statusIncomplete"
    : "pricing.statusNone";

  const handleSubscribe = async () => {
    try {
      const session = await checkoutMutation.mutateAsync();
      await WebBrowser.openBrowserAsync(session.url);
    } catch {
      Alert.alert(t("pricing.openError"));
    }
  };

  const handleManage = async () => {
    try {
      const session = await portalMutation.mutateAsync();
      await WebBrowser.openBrowserAsync(session.url);
    } catch {
      Alert.alert(t("pricing.openError"));
    }
  };

  const pending = checkoutMutation.isPending || portalMutation.isPending;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {t("pricing.levelLabel")}
        </Text>
        <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
          {data.displayLevel}
        </Text>
      </View>
      <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {t("pricing.priceLabel")}
        </Text>
        <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
          €{data.priceEur}
          {t("pricing.perMonth")}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{t(statusKey)}</Text>
      </View>
      <Pressable
        testID="pricing-action"
        disabled={pending}
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (isActive) {
            await handleManage();
          } else {
            await handleSubscribe();
          }
        }}
        style={[
          styles.changeGoalButton,
          { backgroundColor: colors.accent, opacity: pending ? 0.6 : 1 },
        ]}
      >
        {pending ? (
          <ActivityIndicator color={colors.accentForeground} />
        ) : (
          <Text style={[styles.changeGoalText, { color: colors.accentForeground }]}>
            {t(isActive ? "pricing.manage" : "pricing.subscribe")}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function formatDate(date: Date, lang: SupportedLanguage) {
  const localeMap: Record<SupportedLanguage, string> = {
    it: "it-IT",
    en: "en-US",
    es: "es-ES",
    zh: "zh-CN",
  };
  return date.toLocaleDateString(localeMap[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function SettingsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const {
    goal,
    canChangeGoal,
    nextGoalChangeDate,
    language,
    setLanguage,
  } = useApp();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t("settings.language")}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {SUPPORTED_LANGUAGES.map((lang, i) => {
          const isSelected = lang === language;
          return (
            <Pressable
              key={lang}
              testID={`language-${lang}`}
              onPress={async () => {
                await Haptics.selectionAsync();
                await setLanguage(lang);
              }}
              style={[
                styles.row,
                i !== SUPPORTED_LANGUAGES.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                {LANGUAGE_LABELS[lang]}
              </Text>
              {isSelected && (
                <Feather name="check" size={18} color={colors.primary} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 24 }]}>
        {t("settings.goal")}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>
            {t("settings.current")}
          </Text>
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
            {goal ? t(`onboarding.goals.${goal}.title`) : "-"}
          </Text>
        </View>
      </View>

      {canChangeGoal ? (
        <Pressable
          testID="change-goal"
          onPress={() => router.push("/onboarding")}
          style={[styles.changeGoalButton, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.changeGoalText, { color: colors.accentForeground }]}>
            {t("settings.changeGoal")}
          </Text>
        </Pressable>
      ) : (
        nextGoalChangeDate && (
          <Text style={[styles.lockedText, { color: colors.mutedForeground }]}>
            {t("settings.lockedMessage", {
              date: formatDate(nextGoalChangeDate, language),
            })}
          </Text>
        )
      )}

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 24 }]}>
        {t("pricing.sectionLabel")}
      </Text>
      <SubscriptionSection />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 140,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  rowValue: {
    fontSize: 14,
  },
  changeGoalButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  changeGoalText: {
    fontSize: 15,
    fontWeight: "700",
  },
  lockedText: {
    marginTop: 16,
    fontSize: 13.5,
    lineHeight: 18,
  },
});
