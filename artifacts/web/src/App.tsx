import { useCallback, useEffect, useState } from "react";
import { SignIn, UserButton, useAuth } from "@clerk/react";
import {
  confirmCheckout,
  eur,
  getOffer,
  getStatus,
  startCheckout,
  type ContractStatus,
  type Offer,
} from "./api";

type View =
  | { kind: "loading" }
  | { kind: "offer" }
  | { kind: "pending" }
  | { kind: "active"; status: ContractStatus }
  | { kind: "error"; message: string };

export default function App() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [offer, setOffer] = useState<Offer | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { status, data } = await getStatus(getToken);
      if (status === 404) return setView({ kind: "offer" });
      if (status !== 200 || !data) return setView({ kind: "error", message: "Impossibile caricare il contratto." });
      if (data.contract.status === "pending_payment") return setView({ kind: "pending" });
      setView({ kind: "active", status: data });
    } catch {
      setView({ kind: "error", message: "Server non raggiungibile." });
    }
  }, [getToken]);

  useEffect(() => {
    void getOffer().then((r) => r.data && setOffer(r.data));
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    void (async () => {
      if (params.get("checkout") === "success" && sessionId) {
        const r = await confirmCheckout(getToken, sessionId);
        setNotice(r.status === 200 ? "Pagamento confermato: il tuo anno è iniziato." : "Pagamento non ancora confermato. Riprova tra qualche istante.");
        window.history.replaceState({}, "", window.location.pathname);
      } else if (params.get("checkout") === "cancel") {
        setNotice("Pagamento annullato.");
        window.history.replaceState({}, "", window.location.pathname);
      }
      await load();
    })();
  }, [isLoaded, isSignedIn, getToken, load]);

  if (!isLoaded) return <p className="center">Caricamento…</p>;

  return (
    <div className="page">
      <header className="top">
        <h1>19 Sessions</h1>
        {isSignedIn && <UserButton />}
      </header>
      {!isSignedIn ? (
        <div className="center">
          <p className="lead">Allenati 19 volte al mese e riprendi la tua quota, rata dopo rata.</p>
          <SignIn routing="hash" />
        </div>
      ) : (
        <main>
          {notice && <div className="notice">{notice}</div>}
          {view.kind === "loading" && <p className="center">Caricamento…</p>}
          {view.kind === "error" && <p className="error">{view.message}</p>}
          {(view.kind === "offer" || view.kind === "pending") && offer && (
            <OfferCard offer={offer} getToken={getToken} />
          )}
          {view.kind === "active" && <Dashboard s={view.status} />}
        </main>
      )}
    </div>
  );
}

function OfferCard({ offer, getToken }: { offer: Offer; getToken: () => Promise<string | null> }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const monthly = offer.installmentCents[0] ?? 0;

  async function pay() {
    setBusy(true);
    setErr(null);
    try {
      const r = await startCheckout(getToken);
      if (r.status === 200 && r.data?.url) window.location.assign(r.data.url);
      else setErr("Non è stato possibile avviare il pagamento.");
    } catch {
      setErr("Server non raggiungibile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Abbonamento annuale: {eur(offer.feeCents)}</h2>
      <ul className="facts">
        <li>Paghi la quota una volta all'inizio dell'anno.</li>
        <li>Commissione del servizio: {eur(offer.commissionCents)} (10%).</li>
        <li>
          Il restante {eur(offer.poolCents)} ti torna in 12 rate mensili da circa {eur(monthly)}.
        </li>
        <li>
          Ogni rata viene accreditata se nel mese completi almeno {offer.requiredSessionsPerMonth} sessioni da{" "}
          {offer.minMinutesPerSession} minuti, registrate dal tuo smartwatch e lette da Salute / Health Connect.
        </li>
      </ul>
      <div className="terms">
        <strong>Condizioni in sintesi.</strong> La rata di un mese in cui non raggiungi il numero di sessioni richiesto
        non viene restituita e resta a TRANTADS LTD come corrispettivo del servizio. Sono valide solo sessioni
        registrate da un dispositivo indossabile (non inserite a mano), di almeno {offer.minMinutesPerSession} minuti,
        con frequenza cardiaca rilevata, al massimo una al giorno. Il mese di contratto decorre dalla data di pagamento.
      </div>
      <label className="check">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        Ho letto e accetto le condizioni (versione {offer.termsVersion}).
      </label>
      <button className="primary" disabled={!accepted || busy} onClick={pay}>
        {busy ? "Attendi…" : `Paga ${eur(offer.feeCents)}`}
      </button>
      {err && <p className="error">{err}</p>}
    </section>
  );
}

function Dashboard({ s }: { s: ContractStatus }) {
  const cm = s.currentMonth;
  const pct = cm ? Math.min(100, Math.round((cm.validSessions / cm.requiredSessions) * 100)) : 0;
  const byIndex = new Map(s.ledger.map((l) => [l.installmentIndex, l]));
  const currentIdx = cm?.installmentIndex ?? 13;

  return (
    <>
      {cm && (
        <section className="card">
          <h2>
            Mese {cm.installmentIndex} di 12 · fino al {new Date(cm.end).toLocaleDateString("it-IT")}
          </h2>
          <div className="big">
            {cm.validSessions} <span>/ {cm.requiredSessions} sessioni</span>
          </div>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <p className="muted">
            Rata in gioco: {eur(cm.installmentCents)}
            {cm.minStrengthSessions > 0 && ` · di cui forza: ${cm.strengthSessions}/${cm.minStrengthSessions}`}
          </p>
        </section>
      )}

      <section className="card">
        <h2>Le tue 12 rate</h2>
        <div className="grid">
          {s.installmentCents.map((cents, i) => {
            const idx = i + 1;
            const l = byIndex.get(idx);
            const state = l ? (l.outcome === "forfeited" ? "lost" : "won") : idx === currentIdx ? "now" : "future";
            const label = state === "lost" ? "non maturata" : state === "won" ? "maturata" : state === "now" ? "in corso" : "futura";
            return (
              <div key={idx} className={`tile ${state}`}>
                <span className="n">Mese {idx}</span>
                <span className="amt">{eur(cents)}</span>
                <span className="lbl">{label}{l ? ` · ${l.validSessions} sess.` : ""}</span>
              </div>
            );
          })}
        </div>
        <p className="totals">
          Maturato: <strong>{eur(s.totals.earnedCents)}</strong> · Non maturato: <strong>{eur(s.totals.forfeitedCents)}</strong>
        </p>
      </section>
    </>
  );
}
