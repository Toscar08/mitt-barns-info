import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/LegalPage";
import { COMPANY } from "@/components/SiteFooter";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/integritetspolicy")({
  head: () => ({
    meta: [
      { title: "Integritetspolicy – Barnmappen" },
      { name: "description", content: "Hur Barnmappen behandlar personuppgifter om dig och dina barn enligt GDPR." },
      { property: "og:title", content: "Integritetspolicy – Barnmappen" },
      { property: "og:description", content: "Personuppgifter, hälsodata, AI och dina rättigheter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { lang } = usePrefs();
  const sv = lang === "sv";
  const sections = sv
    ? [
        { h: "Personuppgiftsansvarig", p: [`${COMPANY.name}, Sverige. Kontakt: ${COMPANY.email}.`] },
        { h: "Vilka uppgifter vi behandlar", p: ["Kontouppgifter (e-post, inloggningsuppgifter), betalningsuppgifter samt det du själv lägger in om dina barn: namn, födelsedatum, personnummer, passuppgifter, skola, kontakter, kalender, dokument och anteckningar.", "Uppgifter om allergier, mediciner och blodgrupp är hälsouppgifter, en känslig kategori enligt GDPR artikel 9."] },
        { h: "Laglig grund", p: ["Kontot och tjänsten: fullgörande av avtal (art. 6.1 b). Hälsouppgifter: ditt uttryckliga samtycke som vårdnadshavare (art. 9.2 a), som du kan återkalla genom att radera uppgifterna. Bokföring: rättslig förpliktelse."] },
        { h: "AI-assistenten", p: ["När du ställer en fråga till assistenten, eller använder Lägg till snabbt, skickas innehållet i barnens mappar respektive det du skrivit till en AI-tjänst som formulerar svaret.", "Leverantörer: anropet går via Lovables AI-tjänst (Lovable, Sverige) till en språkmodell från OpenAI (USA).", "Innan något skickas byter vi ut barnens namn, telefonnummer, e-postadresser, personnummer och gatuadresser mot neutrala platshållare som [BARN1] och [TEL1]. Person- och passnummer skickas aldrig. De riktiga uppgifterna sätts tillbaka hos oss innan du ser svaret. Övrigt innehåll, till exempel allergier, mediciner och anteckningar, skickas utan koppling till namn.", "Vi begär att anropen inte sparas hos leverantören, och enligt leverantörernas villkor används de inte för att träna modeller. Vill du inte att något skickas, låt bli att använda assistenten och Lägg till snabbt – resten av appen fungerar utan AI."] },
        { h: "Mottagare och underbiträden", p: ["Vi anlitar följande leverantörer: Lovable (drift, databas och lagring via Lovable Cloud, samt AI-tjänsten), OpenAI (språkmodellen bakom assistenten) och Stripe (betalningar). Med dessa finns, eller ska finnas, personuppgiftsbiträdesavtal. Om uppgifter överförs utanför EU/EES sker det med stöd av standardavtalsklausuler eller EU-US Data Privacy Framework."] },
        { h: "Säkerhet", p: ["Inloggning krävs alltid, trafiken är krypterad och varje familjs uppgifter är åtskilda och kontrolleras på servern. Du kan lägga till PIN-kod. Ingen tjänst är helt riskfri."] },
        { h: "Lagring och radering", p: ["Uppgifterna sparas så länge du har kontot. Du kan radera barnmappar och dokument när som helst, och hela kontot under Inställningar → Radera konto. Då tas alla barnmappar, dokument, kalenderkopplingar och inloggningen bort direkt. Två saker sparas utan innehåll från mapparna: kvitto på eventuellt köp i 7 år enligt bokföringslagen, och ett saltat kontrollvärde (hash) av e-postadressen, som inte går att läsa tillbaka som hindrar att samma person tar en ny gratisperiod."] },
        { h: "Dina rättigheter", p: ["Du har rätt till tillgång, rättelse, radering, begränsning, invändning och dataportabilitet (via export-knappen). Du kan klaga hos Integritetsskyddsmyndigheten (IMY)."] },
        { h: "Lokal lagring", p: ["Vi använder endast nödvändig lokal lagring i webbläsaren för inloggning, språk, tema och PIN-upplåsning. Inga spårnings- eller reklamcookies."] },
      ]
    : [
        { h: "Controller", p: [`${COMPANY.name}, Sweden. Contact: ${COMPANY.email}.`] },
        { h: "Data we process", p: ["Account and payment data, plus what you add about your children, including health data (allergies, medication, blood type) – a special category under GDPR Art. 9."] },
        { h: "Legal basis", p: ["Contract (Art. 6.1 b); explicit consent for health data (Art. 9.2 a), withdrawn by deleting the data; legal obligation for bookkeeping."] },
        { h: "AI assistant", p: ["When you ask the assistant or use Quick add, folder content or your note is sent via Lovable's AI service (Lovable, Sweden) to a language model from OpenAI (USA). Children's names, phone numbers, e-mail addresses, ID numbers and street addresses are replaced with placeholders first, and ID and passport numbers are never sent. We ask for requests not to be stored; under the providers' terms they are not used for training. The rest of the app works without AI."] },
        { h: "Processors", p: ["Lovable (hosting, database, storage and the AI service), OpenAI (language model) and Stripe (payments), under data processing agreements; transfers outside the EU/EEA rely on SCCs or the EU-US Data Privacy Framework."] },
        { h: "Security", p: ["Sign-in is always required, traffic is encrypted, families are separated server-side, and you can add a PIN. No service is risk-free."] },
        { h: "Retention", p: ["Data is kept while you have an account; delete anytime. Bookkeeping records are kept 7 years."] },
        { h: "Your rights", p: ["Access, rectification, erasure, restriction, objection and portability (export button). You may complain to the Swedish Authority for Privacy Protection (IMY)."] },
        { h: "Local storage", p: ["Only essential browser storage for sign-in, language, theme and PIN unlock. No tracking cookies."] },
      ];
  return (
    <LegalPage
      title={sv ? "Integritetspolicy" : "Privacy policy"}
      updated={sv ? "Senast uppdaterad: oktober 2026" : "Last updated: October 2026"}
      note={sv ? "Utkast – ska granskas av jurist innan lansering." : "Draft – to be reviewed by a lawyer before launch."}
      sections={sections}
    />
  );
}
