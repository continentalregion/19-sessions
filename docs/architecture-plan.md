# 19 Sessions BOSU — Piano architetturale complessivo

Stato: **IN BUILD.** Questo documento è la fonte di verità sulle decisioni architetturali
già implementate e in corso. Aggiornato a luglio 2026.

Contesto prodotto: terzo prodotto sotto TRANTADS LTD (CRN 17298502), separato da SGI e
TrantAds. App mobile fitness con validazione allenamenti BOSU tramite Health Connect
(Android) / HealthKit (iOS), abbinata a un meccanismo di pricing incentivante basato sul
conteggio sessioni mensile.

## 1. Stack mobile

- Expo React Native + EAS dev build (richiesto per `react-native-health-connect` /
  `react-native-health` — non disponibili in Expo Go).
- **Session validation**: `react-native-health-connect` (Android, ExerciseSession) +
  `react-native-health` (iOS, getAnchoredWorkouts). La validazione camera/pose
  estimation/accelerometro è stata **definitivamente rimossa** in Phase 2.
- Localizzazione: `react-i18next`, 4 lingue (it/en/es/zh).

## 2. Backend

- Express 5 + Drizzle ORM + PostgreSQL (Replit managed).
- Clerk per auth (token di sessione verificato server-side su tutte le route protette).

## 3. Struttura sessione di allenamento

- Ogni sessione è un **circuito fisso** di esercizi BOSU (stessa sequenza per tutti gli
  utenti, non randomizzata né adattiva in questa fase).
- Durata minima per considerare la sessione **valida**: **15 minuti** di attività fisica
  continua rilevata da Health Connect/HealthKit (ExerciseSession o HKWorkout con
  duration ≥ 900s, trovata nella finestra temporale della sessione).
- L'app guida l'utente attraverso il circuito con feedback live (voce/testo localizzato
  in 4 lingue via expo-speech/TTS).

  **Definizione definitiva dei 4 circuiti fissi** (implementata in
  `artifacts/mobile/constants/circuits.ts`). Le durate sono calibrate per principianti:

  - **Circuiti "standard"** (Muscle Tone, Posture): lavoro **3 min (180s)** per
    esercizio, pausa **30s** tra esercizi, riscaldamento/defaticamento **3 min (180s)**.
    Totale: 8 × (180+30) + 180 = 1860s = **~31 min**.
  - **Circuiti "cardio"** (Cardio General, Weight Loss): lavoro **170s** per esercizio,
    pausa **25s** tra esercizi, riscaldamento/defaticamento **4 min (240s)**. Totale:
    8 × (170+25) + 240 = 1800s = **~30 min**.

  ### Circuito 1 — Muscle Tone (tono muscolare), ~31 min totali

  | # | Esercizio | Durata lavoro | Pausa | Categoria |
  |---|---|---|---|---|
  | 1 | Squat su BOSU | 180s | 30s | Forza arti inferiori |
  | 2 | Push-up su BOSU | 180s | 30s | Forza arti superiori |
  | 3 | Affondi alternati su BOSU | 180s | 30s | Forza arti inferiori |
  | 4 | Plank con mani su BOSU | 180s | 30s | Core/equilibrio |
  | 5 | Glute bridge su BOSU | 180s | 30s | Forza arti inferiori |
  | 6 | Push-up + rotazione | 180s | 30s | Forza arti superiori |
  | 7 | Squat jump su BOSU | 180s | 30s | Forza/cardio |
  | 8 | Side plank su BOSU | 180s | 30s | Core/equilibrio |
  | — | Riscaldamento + defaticamento | 180s | — | — |

  ### Circuito 2 — Posture (postura), ~31 min totali

  | # | Esercizio | Durata lavoro | Pausa | Categoria |
  |---|---|---|---|---|
  | 1 | Bird-dog su BOSU | 180s | 30s | Core/equilibrio |
  | 2 | Plank frontale su BOSU | 180s | 30s | Core |
  | 3 | Squat isometrico con reach overhead | 180s | 30s | Postura/forza |
  | 4 | Single-leg stand su BOSU | 180s | 30s | Equilibrio |
  | 5 | Superman su BOSU | 180s | 30s | Postura/schiena |
  | 6 | Wall angel + BOSU squat | 180s | 30s | Postura spalle |
  | 7 | Side plank con rotazione | 180s | 30s | Core/equilibrio |
  | 8 | Cat-cow su BOSU | 180s | 30s | Mobilità |
  | — | Riscaldamento + defaticamento | 180s | — | — |

  ### Circuito 3 — Cardio General, ~30 min totali

  | # | Esercizio | Durata lavoro | Pausa | Categoria |
  |---|---|---|---|---|
  | 1 | Step-up su BOSU | 170s | 25s | Cardio |
  | 2 | Mountain climber su BOSU | 170s | 25s | Cardio |
  | 3 | Squat jump su BOSU | 170s | 25s | Cardio/forza |
  | 4 | Burpee con BOSU | 170s | 25s | Cardio |
  | 5 | Affondi laterali dinamici | 170s | 25s | Cardio/forza |
  | 6 | Plank jack su BOSU | 170s | 25s | Cardio/core |
  | 7 | Squat + press overhead | 170s | 25s | Cardio/forza |
  | 8 | High knees vicino a BOSU | 170s | 25s | Cardio |
  | — | Riscaldamento + defaticamento | 240s | — | — |

  ### Circuito 4 — Weight Loss (dimagrimento), ~30 min totali

  | # | Esercizio | Durata lavoro | Pausa | Categoria |
  |---|---|---|---|---|
  | 1 | Squat jump su BOSU | 170s | 25s | Cardio/forza |
  | 2 | Push-up su BOSU | 170s | 25s | Forza |
  | 3 | Mountain climber su BOSU | 170s | 25s | Cardio |
  | 4 | Affondi alternati dinamici | 170s | 25s | Forza/cardio |
  | 5 | Burpee con BOSU | 170s | 25s | Cardio |
  | 6 | Plank + toccata spalla | 170s | 25s | Core/cardio |
  | 7 | Step-up veloce | 170s | 25s | Cardio |
  | 8 | Glute bridge + leg extension | 170s | 25s | Forza |
  | — | Riscaldamento + defaticamento | 240s | — | — |

  Nomi esercizio e categorie sono la fonte di verità definitiva, già tradotti nelle 4
  lingue (it/en/es/zh) in `artifacts/mobile/constants/translations.ts`.

## 4. Validazione sessione — Health Connect (Android) / HealthKit (iOS)

- La validazione si basa su dati di salute del dispositivo, **non** su camera o
  accelerometro (entrambi rimossi definitivamente in Phase 2).
- **Android** (`lib/health.android.ts`): `react-native-health-connect`,
  `readRecords('ExerciseSession')` — cerca un record con startTime/endTime che si
  sovrapponga alla finestra della sessione e durata ≥ 15 min (900s).
- **iOS** (`lib/health.ios.ts`): `react-native-health`, `getAnchoredWorkouts` con
  `HKWorkoutQueriedSampleType.duration` — cerca un HKWorkout nell'intervallo di 2h
  precedente l'ora di completamento con duration ≥ 900s.
- **Web/Expo Go** (`lib/health.ts`): fallback che restituisce sempre `isValid: false` —
  validazione health non disponibile fuori da EAS dev build.
- Il flag `isValid` è impostato client-side e trusted server-side al salvataggio
  (nessuna verifica server indipendente in questa fase).
- `healthSource`: `"health_connect"` | `"healthkit"` | `"none"` (salvato nel DB
  per analisi futura).

## 5. Schema dati (implementato)

- `workout_sessions`: `id`, `user_id`, `training_goal`
  (`muscle_tone`|`posture`|`cardio_general`|`weight_loss`), `duration_seconds`,
  `is_valid`, `created_at`, `health_source`.
- `pricing_state`: `user_id`, `current_level` (0–10), `last_month_completed`,
  `subscription_started_at`, `updated_at`.
- `subscriptions`: gestita lato Stripe (via `stripe-replit-sync`), nessun duplicato
  locale.

## 6. Logica pricing — lookup diretto sessioni→livello

**Sostituisce il vecchio sistema advance/regress a 12 livelli.** Non ci sono più
`cycleMonthCounter`, `avgReliabilityScoreMonth` né regole di avanzamento/regressione.

- **11 livelli** (0–10), valutati ogni mese in modo **indipendente** dal conteggio
  sessioni valide del mese precedente.
- Tabella `sessionsToLevel(n)`:

  | Sessioni valide mese | Livello | Prezzo/mese |
  |---|---|---|
  | ≤ 8 | 0 | €250 |
  | 9 | 1 | €139 |
  | 10 | 2 | €79 |
  | 11 | 3 | €47 |
  | 12 | 4 | €30 |
  | 13 | 5 | €21 |
  | 14 | 6 | €16 |
  | 15 | 7 | €13 |
  | 16 | 8 | €12 |
  | 17 | 9 | €11 |
  | ≥ 18 | 10 | €10 |

- `displayLevel = currentLevel + 1` (1–11 per UI).
- Ogni mese, `POST /api/pricing/cycle-all` (cron, gated da `x-cron-secret`) conta le
  sessioni valide del mese precedente per ciascun utente → `sessionsToLevel(n)` →
  aggiorna `pricing_state.current_level` → sincronizza il prezzo su Stripe.
- Nessun ciclo annuale di reset: ogni mese è valutato statelessly.
- Stripe: 1 prodotto, 11 prezzi mensili EUR con `metadata.level` 0–10.
  Seed via `pnpm --filter @workspace/scripts run seed-pricing-products`.

## 7. Compliance — testo disclaimer prezzi (definitivo, Phase 2)

Testo da mostrare all'utente prima della sottoscrizione (tradotto nelle 4 lingue):

> ## Come funziona il prezzo del tuo abbonamento
>
> 19 Sessions BOSU ha un prezzo mensile che cambia in base a quante sessioni valide
> completi ogni mese. Il prezzo viene ricalcolato ogni mese in modo indipendente — non
> è una progressione cumulativa, ogni mese parte dal conteggio reale delle tue sessioni.
>
> ### La regola
>
> Il prezzo del mese successivo dipende da quante sessioni valide (≥ 15 minuti,
> verificate tramite Health Connect o HealthKit) hai completato nel mese corrente.
>
> ### I livelli di prezzo
>
> | Sessioni/mese | Livello | Prezzo/mese |
> |---|---|---|
> | ≤ 8 | 1 | €250 |
> | 9 | 2 | €139 |
> | 10 | 3 | €79 |
> | 11 | 4 | €47 |
> | 12 | 5 | €30 |
> | 13 | 6 | €21 |
> | 14 | 7 | €16 |
> | 15 | 8 | €13 |
> | 16 | 9 | €12 |
> | 17 | 10 | €11 |
> | ≥ 18 | 11 | €10 |
>
> ### Puoi cancellare quando vuoi
>
> - Nessun vincolo di durata minima.
> - Hai 14 giorni dalla prima iscrizione per un rimborso completo (diritto di recesso).
>
> *Ultimo aggiornamento: luglio 2026.*

## Stato implementazione ad oggi (Phase 2 completa — luglio 2026)

### Fatto (Phase 1)
- Setup Expo + EAS, schema Drizzle, logica dei 4 circuiti fissi, onboarding obiettivo
  (goal picker, lock 30 giorni), localizzazione it/en/es/zh (UI + TTS),
  session runner con timer lavoro/riposo.
- Backend completo pricing/Stripe: state machine, checkout, portal, cron cycle-all.
- Fix IDOR: autenticazione Clerk reale su `/api/pricing/*` e `/api/sessions`.

### Fatto (Phase 2 — luglio 2026)
- **Rimozione completa** camera, pose estimation (MoveNet/TFLite/fast-tflite),
  accelerometro, `vision-camera-resize-plugin`, `react-native-fast-tflite`,
  `PoseCameraView.tsx`, `usePoseModel`, `useAccelerometerMonitor`, e tutti i file
  collegati (8 file eliminati).
- **Health Connect (Android) + HealthKit (iOS)** come unica fonte di validazione
  sessione (durata ≥ 15 min). Platform-specific bundler picks up
  `health.android.ts` / `health.ios.ts` automaticamente.
- **Nuovo route `POST /api/sessions`** in `artifacts/api-server/src/routes/sessions.ts`
  — salva sessione completata per utente autenticato Clerk.
- **Pricing rewritten**: da advance/regress 12 livelli → lookup diretto 11 livelli
  (0–10). `sessionsToLevel(n)` stateless. Rimossi `cycleMonthCounter`,
  `avgReliabilityScoreMonth`, `doubleAdvancedCount`, `resetCount`.
- DB migrato: rimossi 6 colonne camera + 2 colonne pricing; aggiunta `healthSource`.
- OpenAPI spec aggiornata, codegen rieseguito, tutti i typecheck clean (api-server,
  mobile, scripts — zero errori).
- Seed script aggiornato per 11 prezzi EUR (livelli 0–10).
- `app.ts`: rimosso import non-funzionante `@clerk/shared/keys`; `clerkMiddleware`
  ora passa `publishableKey` direttamente da env (equivalente per mono-tenant).
- `replit.md` aggiornato a riflettere lo stato corrente.

### Non ancora iniziato (Phase 3+)
- Integrazione wearable avanzata (frequenza cardiaca come bonus score).
- Anti-cheat Play Integrity API (Android) / DeviceCheck (iOS).
- Analisi statistica server-side avanzata su pattern anomali.
