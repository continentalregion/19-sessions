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
- **Definizione definitiva dei 4 circuiti fissi** (sostituisce la bozza provvisoria in
  `artifacts/mobile/constants/circuits.ts`, ancora da aggiornare in fase di build):

  ### Circuito 1 — Muscle Tone (tono muscolare), 35 min totali, più forza / meno cardio puro

  | # | Esercizio | Durata | Categoria |
  |---|---|---|---|
  | 1 | Squat su BOSU (lato piatto su) | 4 min | Forza arti inferiori |
  | 2 | Push-up su BOSU (mani sulla cupola) | 4 min | Forza arti superiori |
  | 3 | Affondi alternati su BOSU | 4 min | Forza arti inferiori |
  | 4 | Plank con mani su BOSU | 3 min | Core/equilibrio |
  | 5 | Glute bridge su BOSU | 4 min | Forza arti inferiori |
  | 6 | Push-up + rotazione (mani su BOSU) | 4 min | Forza arti superiori |
  | 7 | Squat jump su BOSU (basso impatto) | 4 min | Forza/cardio |
  | 8 | Side plank su BOSU (dx/sx) | 4 min | Core/equilibrio |
  | — | Riscaldamento + defaticamento | 4 min | — |

  ### Circuito 2 — Posture (postura), 35 min totali, focus core/equilibrio/stabilizzazione

  | # | Esercizio | Durata | Categoria |
  |---|---|---|---|
  | 1 | Bird-dog su BOSU | 4 min | Core/equilibrio |
  | 2 | Plank frontale su BOSU | 4 min | Core |
  | 3 | Squat isometrico con reach overhead | 4 min | Postura/forza |
  | 4 | Single-leg stand su BOSU (dx/sx) | 4 min | Equilibrio |
  | 5 | Superman su BOSU | 4 min | Postura/schiena |
  | 6 | Wall angel + BOSU squat | 4 min | Postura spalle |
  | 7 | Side plank con rotazione | 4 min | Core/equilibrio |
  | 8 | Cat-cow su BOSU (mobilità) | 3 min | Mobilità |
  | — | Riscaldamento + defaticamento | 4 min | — |

  ### Circuito 3 — Cardio General, 30–35 min totali, meno pause, intensità continua

  | # | Esercizio | Durata | Categoria |
  |---|---|---|---|
  | 1 | Step-up su BOSU (alternato veloce) | 4 min | Cardio |
  | 2 | Mountain climber su BOSU | 3 min | Cardio |
  | 3 | Squat jump su BOSU | 4 min | Cardio/forza |
  | 4 | Burpee con BOSU (mani su cupola) | 3 min | Cardio |
  | 5 | Affondi laterali dinamici | 4 min | Cardio/forza |
  | 6 | Plank jack su BOSU | 3 min | Cardio/core |
  | 7 | Squat + press overhead (dinamico) | 4 min | Cardio/forza |
  | 8 | High knees vicino a BOSU (equilibrio) | 3 min | Cardio |
  | — | Riscaldamento + defaticamento | 3 min | — |

  ### Circuito 4 — Weight Loss (dimagrimento), 40 min totali, mix forza+cardio, intensità più alta

  | # | Esercizio | Durata | Categoria |
  |---|---|---|---|
  | 1 | Squat jump su BOSU | 4 min | Cardio/forza |
  | 2 | Push-up su BOSU | 4 min | Forza |
  | 3 | Mountain climber su BOSU | 4 min | Cardio |
  | 4 | Affondi alternati dinamici | 4 min | Forza/cardio |
  | 5 | Burpee con BOSU | 4 min | Cardio |
  | 6 | Plank + toccata spalla | 4 min | Core/cardio |
  | 7 | Step-up veloce | 4 min | Cardio |
  | 8 | Glute bridge + leg extension | 4 min | Forza |
  | — | Riscaldamento + defaticamento | 4 min | — |

  Nota: nomi esercizio, durate e categorie qui sono la fonte di verità definitiva; la
  fase di build dovrà tradurli nelle 4 lingue (it/en/es/zh) e nei rispettivi TTS cue,
  seguendo lo stesso pattern usato per l'onboarding.
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
- **Punteggio di validità** — score continuo pesato, non un semplice AND binario:
  `score = 0.50 × scatti_ratio + 0.35 × accelerometro_ratio + 0.15 × wearable_score`
  (termine wearable presente solo se un wearable è collegato). Se il wearable
  **non** è collegato, il peso 0.15 viene redistribuito proporzionalmente tra
  camera e accelerometro (camera 0.59, accelerometro 0.41), senza perdita di peso
  al denominatore. **Sessione valida SE `score >= 0.70`.**
- Il modello di pose estimation on-device è **MoveNet Lightning (TFLite)** via
  `react-native-fast-tflite` + `vision-camera-resize-plugin` — scelta definitiva,
  non provvisoria. Motivo: non esiste un binding MediaPipe Pose Landmarker
  maturo/mantenuto per React Native/Expo pronto all'uso (richiederebbe scrivere
  wrapper nativi Kotlin/Swift da zero); MoveNet+TFLite si integra invece con
  `react-native-vision-camera` come frame processor JS-side senza codice nativo
  aggiuntivo. Vincolo di compatibilità noto: richiede `react-native-vision-camera`
  nella linea `^4.x` (la v5, riscrittura Nitro, ha rimosso l'API classica
  `useFrameProcessor`/`frameProcessor` da cui dipendono questi plugin).
- **Limitazione nota v1**: i checkpoint camera ("scatti") sono posizionati a
  percentuale di tempo fissa della fase di lavoro (20% / 50% / 80%), uguali per
  tutti gli esercizi — non sulla fase di movimento effettivamente rilevata (es.
  minimo angolo ginocchio per il punto più basso dello squat). Da rivalutare dopo
  test su device reale se emergono troppi falsi negativi/positivi.
- Il backend riceve solo il riepilogo strutturato per esercizio (no video, no immagini).

### Livello 2 — opzionale, bonus di affidabilità

- Integrazione wearable (Apple Health / Google Health Connect / Fitbit API) per
  frequenza cardiaca durante la sessione.
- Se HR media durante l'esercizio supera soglia minima di sforzo (es. 60% frequenza
  cardiaca max stimata) → `wearable_score = 1` nel punteggio di validità sopra, e la
  sessione è marcata `verified_enhanced` invece di `verified_base` per il bonus di
  pricing (calcolo `reliability_score` separato, invariato: 1.0 base / 1.5 enhanced).
- Il collegamento wearable **non è mai obbligatorio** per validare una sessione
  (accessibilità, non tutti hanno un wearable) — quando assente, il punteggio di
  validità usa semplicemente i pesi redistribuiti camera/accelerometro (0.59/0.41).

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

## 7. Compliance — testo disclaimer prezzi (definitivo, da mostrare pre-checkout)

Testo finale approvato, da mostrare all'utente prima della sottoscrizione (e reso
disponibile in ogni momento dalle impostazioni). Va tradotto nelle 4 lingue
(it/en/es/zh) in fase di build, mantenendo lo stesso significato legale/numerico.

> ## Come funziona il prezzo del tuo abbonamento
>
> 19 Sessions è un sistema incentivante con un prezzo che cambia ogni mese in base a
> quante sessioni completi. Lo schema di sconto è tarato su un ciclo di **12
> mensilità**: se resti costante per un anno intero, il prezzo scende progressivamente
> fino al minimo.
>
> ### La regola
>
> Ogni mese devi completare **19 sessioni valide** (verificate tramite camera,
> movimento e — se colleghi uno smartwatch — battito cardiaco) per far scendere il tuo
> prezzo il mese successivo.
>
> - **Se completi 19 sessioni** → il mese dopo paghi meno (scendi di un livello)
> - **Se colleghi anche uno smartwatch e lo usi per la maggior parte delle sessioni** →
>   il mese dopo scendi di due livelli invece di uno
> - **Se NON completi 19 sessioni** → il mese dopo paghi di più (sali di un livello)
>
> ### Cosa ti serve per usare 19 Sessions
>
> - Uno smartphone compatibile con l'app
> - Un BOSU (da acquistare separatamente, non incluso nell'abbonamento)
> - Uno smartwatch è facoltativo: serve solo per il bonus di avanzamento più rapido, non
>   per usare l'app
>
> ### I 12 livelli di prezzo
>
> | Livello | Prezzo/mese |
> |---|---|
> | 1 (partenza) | 139€ |
> | 2 | 130€ |
> | 3 | 121€ |
> | 4 | 112€ |
> | 5 | 103€ |
> | 6 | 94€ |
> | 7 | 86€ |
> | 8 | 77€ |
> | 9 | 68€ |
> | 10 | 59€ |
> | 11 | 50€ |
> | 12 (minimo) | 41€ |
>
> **Parti sempre dal Livello 1 (139€) al primo mese.**
>
> ### Puoi cancellare quando vuoi
>
> - **Nessun vincolo di durata minima**: puoi cancellare l'abbonamento in qualsiasi
>   momento, anche prima che il ciclo di 12 mesi sia completo
> - Se cancelli, semplicemente **non prosegui più nella progressione di sconto** —
>   nessuna penale, nessun costo aggiuntivo per l'uscita anticipata
> - Hai comunque **14 giorni** dalla prima iscrizione per un rimborso completo, senza
>   dover spiegare il motivo (diritto di recesso di legge)
> - Lo schema a 12 livelli è pensato per chi vuole seguire il percorso fino in fondo, ma
>   non è un obbligo: resti libero di uscire quando vuoi, il prezzo che hai pagato fino
>   a quel momento resta quello che hai effettivamente pagato, nessun conguaglio
>   richiesto
>
> ### Quanto pagherai in un anno — i due scenari estremi
>
> - **Se completi sempre le 19 sessioni ogni mese**: pagherai circa **1.080€ nell'anno**
>   (arrivi al prezzo minimo e ci resti)
> - **Se non completi mai le 19 sessioni**: pagherai circa **1.668€ nell'anno** (resti
>   sempre al prezzo pieno o vicino)
> - La maggior parte delle persone si troverà in una via di mezzo tra questi due numeri,
>   in base a quanto è costante
>
> ### Cosa NON succede mai
>
> - Non ti chiediamo mai un pagamento anticipato o un deposito
> - Non tratteniamo mai il tuo denaro: paghi solo il prezzo del mese corrente, ogni mese
> - Non ci sono rimborsi da richiedere: se il prezzo scende, lo vedi scontato
>   direttamente sull'addebito successivo
>
> ### I tuoi diritti
>
> - Puoi cancellare l'abbonamento in qualsiasi momento
> - Hai **14 giorni** dalla prima iscrizione per cambiare idea e ottenere il rimborso
>   completo, senza dover spiegare il motivo
> - Il collegamento dello smartwatch è sempre facoltativo: senza, l'abbonamento
>   funziona comunque secondo la regola base (1 livello al mese)
>
> ### Dopo i 12 mesi: il ciclo ricomincia
>
> Se resti abbonato oltre il dodicesimo mese, lo schema riparte da capo: al
> **tredicesimo mese torni al Livello 1 (139€)**, e la progressione ricomincia
> esattamente come il primo anno — completa 19 sessioni al mese per scendere di nuovo
> verso il prezzo minimo.
>
> Questo vale a prescindere da dove eri arrivato: anche se al mese 12 avevi raggiunto
> il Livello 12 (41€), il mese 13 riparte comunque dal Livello 1. Il ciclo di 12 mesi si
> ripete allo stesso modo ogni anno di abbonamento.
>
> *Ultimo aggiornamento: [data]. In caso di modifiche a questo schema, te lo
> comunicheremo con almeno 30 giorni di anticipo prima che entri in vigore sul tuo
> abbonamento.*

Nota per la build — reset annuale: la state machine pricing (sezione 6) deve tracciare
non solo `current_level` ma anche il mese di anniversario dell'abbonamento, per
azzerare `current_level` a 0 (Livello 1) automaticamente all'inizio del tredicesimo
mese, indipendentemente dal livello raggiunto. Questo è un nuovo campo/logica rispetto
allo schema dati in sezione 5 (serve un `subscription_started_at` o
`cycle_month_counter` in `pricing_state`).

Nota di coerenza numerica per la build: la numerazione dei livelli qui è 1–12 (livello
1 = 139€, livello 12 = 41€) nel testo utente, mentre altrove nel piano (sezioni 4 e 6)
e nello schema dati si usa 0–11 (livello 0 = 139€, livello 11 = 41€) per indicizzazione
zero-based lato codice. Sono lo stesso schema di prezzi — la build dovrà scegliere una
convenzione unica lato dati e mappare la UI/testo utente sulla numerazione 1–12 per
chiarezza percepita.

## Aperture da chiudere prima della build

Nessuna aperta al momento — entrambi i punti precedenti (circuiti fissi, disclaimer
prezzi) sono stati chiusi. Prossimo passo: passare alla fase di build quando
l'utente lo richiede esplicitamente.

## Stato implementazione ad oggi

- Fatto (in `artifacts/mobile`): onboarding obiettivo (goal picker, lock 30 giorni),
  localizzazione it/en/es/zh (UI + TTS live via expo-speech), 4 circuiti placeholder,
  session runner con timer lavoro/riposo.
- Non ancora iniziato: EAS dev build, pose estimation reale, backend Fastify/Drizzle/
  Neon, integrazione wearable, Stripe pricing state machine, anti-cheat (Play Integrity/
  DeviceCheck), analisi statistica server-side.
