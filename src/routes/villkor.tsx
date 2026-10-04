import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/LegalPage";
import { COMPANY } from "@/components/SiteFooter";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/villkor")({
  head: () => ({
    meta: [
      { title: "Användarvillkor – Barnmappen" },
      { name: "description", content: "Användar- och köpvillkor för Barnmappen, inklusive ångerrätt och ansvarsbegränsning." },
      { property: "og:title", content: "Användarvillkor – Barnmappen" },
      { property: "og:description", content: "Villkor, ångerrätt och ansvarsbegränsning för Barnmappen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { lang } = usePrefs();
  const sv = lang === "sv";
  const sections = sv
    ? [
        { h: "1. Tjänsten", p: [`Barnmappen tillhandahålls av ${COMPANY.name}, org.nr ${COMPANY.orgNr}, ${COMPANY.address}. Tjänsten är ett digitalt hjälpmedel där vårdnadshavare kan samla och organisera information om sina barn.`] },
        { h: "2. Konto och behörighet", p: ["Du måste vara minst 18 år och vårdnadshavare (eller ha vårdnadshavarens uppdrag) för de barn du lägger in. Kontot är personligt; du ansvarar för att skydda lösenord och PIN-kod.", "Vid vårdnadstvist eller oenighet mellan vårdnadshavare ger vi inte ut information till någon annan än kontoinnehavaren, utom när lag eller myndighetsbeslut kräver det."] },
        { h: "3. Skyddade personuppgifter", p: ["Du får inte lägga in uppgifter om personer med skyddade personuppgifter (sekretessmarkering, skyddad folkbokföring eller fingerade personuppgifter), t.ex. adress, skola eller kontaktuppgifter. Om sådan uppgift finns ska du radera den."] },
        { h: "4. AI-assistenten – ingen medicinsk rådgivning", p: ["AI-assistenten är ett organisatoriskt minnesstöd som söker i den information du själv har lagt in. Den kan ge ofullständiga eller felaktiga svar.", "Assistenten ersätter aldrig läkare, apotek, vårdpersonal eller akutsjukvård. Kontrollera alltid uppgifter om allergier, mediciner och doser mot originalkällan. Vid akut fara ring 112, för sjukvårdsrådgivning ring 1177."] },
        { h: "5. Pris och betalning", p: ["Priset anges på köpsidan och är inklusive 25 % moms. Abonnemanget gäller i ett år."] },
        { h: "6. Ångerrätt", p: ["Som konsument har du enligt distansavtalslagen 14 dagars ångerrätt. Om du uttryckligen samtycker till att tjänsten börjar levereras direkt och bekräftar att ångerrätten därmed upphör, gäller ingen ångerrätt efter att tjänsten aktiverats."] },
        { h: "7. Ditt ansvar för innehållet", p: ["Du ansvarar för att informationen du lägger in är korrekt och att du har rätt att behandla den. Du bör regelbundet exportera en säkerhetskopia."] },
        { h: "8. Ansvarsbegränsning", p: ["Vi ansvarar inte för indirekta skador, driftavbrott eller förlust av data utöver vad som följer av tvingande lag. Ansvarsbegränsningen gäller inte vid uppsåt eller grov vårdslöshet."] },
        { h: "9. Uppsägning och radering", p: ["Du kan när som helst radera dina uppgifter. Vid avslutat abonnemang raderas innehållet efter en informerad övergångsperiod."] },
        { h: "10. Tvister", p: [`Svensk lag gäller. Kontakta oss först på ${COMPANY.email}. Du kan även vända dig till Allmänna reklamationsnämnden (ARN) eller EU:s plattform för tvistlösning online.`] },
      ]
    : [
        { h: "1. The service", p: [`Barnmappen is provided by ${COMPANY.name}, reg. no ${COMPANY.orgNr}, ${COMPANY.address}. It is a digital tool for guardians to organise information about their children.`] },
        { h: "2. Account", p: ["You must be 18+ and a guardian of the children you add. You are responsible for protecting your password and PIN. In custody disputes we only disclose data to the account holder unless required by law."] },
        { h: "3. Protected identities", p: ["Do not add details about persons with protected personal data (e.g. protected address, school or contacts)."] },
        { h: "4. AI assistant – no medical advice", p: ["The AI assistant is an organisational memory aid that searches only your own entries and may be incomplete or wrong. It never replaces doctors, pharmacists or emergency care. Always verify allergies, medication and doses. In an emergency call 112."] },
        { h: "5. Price", p: ["Prices include 25% Swedish VAT. The subscription runs for one year."] },
        { h: "6. Right of withdrawal", p: ["Consumers have a 14-day right of withdrawal. If you expressly consent to immediate delivery and acknowledge losing that right, it no longer applies once the service is activated."] },
        { h: "7. Your content", p: ["You are responsible for the accuracy and lawfulness of what you add. Export backups regularly."] },
        { h: "8. Limitation of liability", p: ["We are not liable for indirect damage, downtime or data loss beyond mandatory law. This does not apply in case of intent or gross negligence."] },
        { h: "9. Termination", p: ["You can delete your data at any time."] },
        { h: "10. Disputes", p: [`Swedish law applies. Contact ${COMPANY.email} first; you may also turn to the Swedish National Board for Consumer Disputes (ARN).`] },
      ];
  return (
    <LegalPage
      title={sv ? "Användar- och köpvillkor" : "Terms of service"}
      updated={sv ? "Senast uppdaterad: oktober 2026" : "Last updated: October 2026"}
      note={sv ? "Utkast – ska granskas av jurist innan lansering." : "Draft – to be reviewed by a lawyer before launch."}
      sections={sections}
    />
  );
}
