# 19 Sessions — Piano architetturale complessivo

Stato: **PIANO / non ancora in build mode.** Questo documento raccoglie le decisioni
architetturali per la fase futura (CV, backend, pricing, anti-cheat). Non implementare
nulla di questo documento finché non viene esplicitamente richiesto di passare alla
build.

Contesto prodotto: terzo prodotto sotto TRANTADS LTD (CRN 17298502), separato da SGI e
TrantAds. App mobile fitness con validazione allenamenti BOSU tramite computer vision
on-device, abilitata da un meccanismo di pricing incentivante basato sul completamento
di 19 sessioni/mese.

## 1. Stack mobile

- Expo React Native, ma richiede **EAS dev build** (no Expo Go) per
  `react-native-vision-camera` + frame processor pose estimation in tempo reale
  (MediaPipe pose landmarker o alternativa TFLite/MoveNet).
- Verificare compatibilità versioni: vision-camera, MediaPipe/TFLite, Reanimated.

## 2. Backend

- Fastify + Drizzle ORM + Neon PostgreSQL (stesso pattern di SGI, database/progetto
  separato).
- Clerk per auth (stesso provider di SGI).

## 3. Struttura sessione di allenamento

- Ogni sessione è un **circuito fisso** di esercizi BOSU (stessa sequenza per tutti gli
  utenti, non randomizzata né adattiva in questa fase).
- Durata minima per considerare la sessione valida: 30–40 minuti totali.
- Il circuito deve includere varietà obbligatoria: esercizi da almeno 3 categorie
  diverse (es. equilibrio/core, forza arti inferiori, forza arti superiori/plank) — non
  ripetizione dello stesso esercizio.
- Esempio struttura (da raffinare con Francesco): 8–10 esercizi x 3–4 minuti ciascuno
  con transizioni/riposo guidato, sequenza fissa e pubblica (stessa per tutti).
- **TODO aperto:** i 4 circuiti fissi (esercizi specifici per obiettivo:
  muscle_tone / posture / cardio_general / weight_loss) non sono ancora definiti nel
  dettaglio — bozza attuale in `artifacts/mobile/constants/circuits.ts` è provvisoria e
  va validata/rifinita prima della build definitiva.
- L'app guida l'utente attraverso il circuito con feedback live (voce/testo: "prossimo
  esercizio", "mantieni la posizione", ecc.) — localizzato in 4 lingue (già implementato
  lato UI/TTS nella fase onboarding+localizzazione).
- Il video viene elaborato **solo in tempo reale on-device** (pose estimation) e MAI
  salvato, né su device né su server — nessuno storage video, nessun upload.

## 4. Validazione sessione — Sistema di verifica ibrido (sostituisce anti-cheat precedente)

### Livello 1 — obbligatorio per tutti

- **Pose estimation "a scatti"**: la camera valida solo i momenti chiave di ogni
  esercizio (es. punto più basso squat, apice affondo, tenuta plank a metà durata) — non
  tracking continuo, riduce il vincolo di spazio/inquadratura.
- **Accelerometro/giroscopio**: conferma movimento continuativo per tutta la durata
  della sessione (30–40 min), copre i momenti tra uno scatto camera e l'altro.
- **Sessione valida SE**: `scatti_camera_validi >= soglia` AND
  `pattern_accelerometro coerente con intensità attesa per l'esercizio`.
- Il backend riceve solo il riepilogo strutturato per esercizio (no video, no immagini).

### Livello 2 — opzionale, bonus di affidabilità

- Integrazione wearable (Apple Health / Google Health Connect / Fitbit API) per
  frequenza cardiaca durante la sessione.
- Se HR media durante l'esercizio supera soglia minima di sforzo (es. 60% frequenza
  cardiaca max stimata) → sessione marcata `verified_enhanced` invece di
  `verified_base`.
- Il collegamento wearable **non è mai obbligatorio** per validare una sessione
  (accessibilità, non tutti hanno un wearable) — è solo un moltiplicatore di
  progressione nel pricing.

### Anti-cheat aggiuntivo (invariato dal piano precedente)

- Play Integrity API (Android) / DeviceCheck (iOS) per attestazione dispositivo.
- Liveness check on-device in tempo reale (rilevamento pattern di movimento naturale vs
  video in loop).
- Analisi statistica lato server sui soli dati aggregati (durata, timing tra esercizi,
  varianza rep-to-rep) per flaggare pattern anomali — unico meccanismo anti-cheat
  possibile lato server senza video.
- Da considerare: firma/hash del riepilogo generato on-device con chiave legata
  all'attestazione dispositivo, per rendere più difficile falsificare il payload inviato
  al backend.

## 5. Schema dati (bozza)

- `workout_sessions`: user_id, exercise_type, reps_valid, reps_invalid,
  duration_seconds, avg_form_score, device_attestation_ok, verification_tier
  (`verified_base` | `verified_enhanced`), reliability_score, created_at.
- `pricing_state`: user_id, current_level (0–11), last_month_completed (bool),
  avg_reliability_score_month, updated_at.
- `subscriptions`: collegata a Stripe, nessun deposito, nessun rimborso — solo billing
  mensile con prezzo variabile.

## 6. Logica pricing (state machine) — aggiornata con bonus wearable

- 12 livelli fissi: `[139, 130, 121, 112, 103, 94, 86, 77, 68, 59, 50, 41]` EUR (livello
  0 = 139€, livello 11 = 41€). Floor/ceiling invariati.
- `reliability_score` per sessione: `1.0` se `verified_base`, `1.5` se
  `verified_enhanced` (wearable confermato).
- **Avanzamento livello mensile:**
  - SE `sessioni_completate_mese >= 19` E `media_reliability_score_mese >= 1.4` (cioè
    uso costante wearable) → avanza di **2 livelli** il mese successivo.
  - SE `sessioni_completate_mese >= 19` ma solo verifica base → avanza di **1 livello**
    come da schema precedente.
  - Max livello 11 in entrambi i casi.
- **Retrocessione per fallimento** (< 19 sessioni valide, indipendentemente dal tier di
  verifica usato): -1 livello, min livello 0.
- Nessun rimborso negativo, nessun deposito trattenuto — solo billing Stripe mensile con
  importo dal livello corrente.
- **TODO aperto:** testo del disclaimer prezzi (tabella prezzi completa e scenario
  peggiore/migliore da mostrare pre-checkout) non ancora definito.

## 7. Compliance (solo pianificato)

- Tabella prezzi completa e scenario peggiore/migliore da mostrare pre-checkout.
- Cooling-off 14 giorni.

## Aperture da chiudere prima della build

1. Definizione dettagliata dei 4 circuiti fissi (esercizi specifici per obiettivo).
2. Testo del disclaimer prezzi.

## Stato implementazione ad oggi

- Fatto (in `artifacts/mobile`): onboarding obiettivo (goal picker, lock 30 giorni),
  localizzazione it/en/es/zh (UI + TTS live via expo-speech), 4 circuiti placeholder,
  session runner con timer lavoro/riposo.
- Non ancora iniziato: EAS dev build, pose estimation reale, backend Fastify/Drizzle/
  Neon, integrazione wearable, Stripe pricing state machine, anti-cheat (Play Integrity/
  DeviceCheck), analisi statistica server-side.
