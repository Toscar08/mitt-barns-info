import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "sv" | "en";
export type Theme = "light" | "dark";

export const LANG_KEY = "barnmappen.lang";
export const THEME_KEY = "barnmappen.theme";

const dict = {
  sv: {
    "app.name": "Barnmappen",
    "nav.myChildren": "Mina barn",
    "nav.signIn": "Logga in",
    "nav.signOut": "Logga ut",
    "theme.light": "Ljust tema",
    "theme.dark": "Mörkt tema",
    "lang.switch": "Byt språk",

    "landing.eyebrow": "Privat · Säkert · Enkelt",
    "landing.title1": "Allt om ditt barn,",
    "landing.title2": "samlat på ett ställe.",
    "landing.lead":
      "En egen digital mapp för varje barn – personuppgifter, kontakter, kalender, dokument och egen information. Fråga assistenten när du behöver svar snabbt.",
    "landing.ctaIn": "Öppna mina mappar",
    "landing.ctaOut": "Skapa konto gratis",
    "landing.privacy":
      "Bara du kommer åt din information. Exportera eller ta bort den när du vill.",
    "landing.heroAlt":
      "Barnkläder, små skor och ett dokument prydligt uppställda på ett ljust träbord",
    "landing.f1.title": "Personuppgifter",
    "landing.f1.text": "Namn, födelsedatum, allergier, mediciner och blodgrupp.",
    "landing.f2.title": "Kontaktuppgifter",
    "landing.f2.text": "Vårdcontakter, skola, tränare och andra viktiga nummer.",
    "landing.f3.title": "Kalender & dokument",
    "landing.f3.text": "Aktiviteter, uppgifter och viktiga filer i barnets privata mapp.",
    "landing.f4.title": "AI-assistent",
    "landing.f4.text": "”När börjar fotbollsträningen?” – svar direkt ur barnets mapp.",

    "auth.back": "← Tillbaka",
    "auth.welcome": "Välkommen tillbaka",
    "auth.create": "Skapa ditt konto",
    "auth.privacy": "Din information är privat och bara du kommer åt den.",
    "auth.sentEmail":
      "Vi har skickat ett bekräftelsemejl. Klicka på länken i mejlet för att aktivera ditt konto.",
    "auth.google": "Fortsätt med Google",
    "auth.googleError": "Kunde inte logga in med Google",
    "auth.or": "eller med e-post",
    "auth.email": "E-post",
    "auth.password": "Lösenord",
    "auth.loading": "Ett ögonblick…",
    "auth.signIn": "Logga in",
    "auth.signUp": "Skapa konto",
    "auth.toSignUp": "Har du inget konto? Skapa ett",
    "auth.toSignIn": "Har du redan ett konto? Logga in",
    "auth.encrypted": "Krypterad överföring och privat lagring",
    "auth.error": "Något gick fel",

    "children.title": "Mina barn",
    "children.lead": "Varje barn har sin egen mapp med information, dokument och uppgifter.",
    "children.restore": "Återställ från fil",
    "children.new": "Nytt barn",
    "children.name": "Barnets namn",
    "children.namePlaceholder": "T.ex. Elsa",
    "children.birth": "Födelsedatum",
    "children.createFolder": "Skapa mapp",
    "children.loading": "Hämtar dina mappar…",
    "children.emptyTitle": "Inga mappar än",
    "children.emptyText": "Skapa en mapp för ditt första barn för att komma igång.",
    "children.born": "Född",
    "children.noBirth": "Födelsedatum saknas",
    "children.privacy": "Din information är privat. Du kan säkerhetskopiera och exportera varje mapp.",
    "children.created": "Mappen är skapad",
    "children.restored": "Barnmappen är återställd",
    "children.restoreFail": "Kunde inte återställa filen",
    "children.mustSignIn": "Du måste vara inloggad",

    "folder.backup": "Säkerhetskopiera",
    "folder.delete": "Ta bort mapp",
    "folder.deleteConfirm": "Ta bort hela mappen och all information om barnet?",
    "folder.backupDone": "Säkerhetskopian är nedladdad",
    "folder.loading": "Hämtar…",
    "folder.missing": "Mappen finns inte",
    "folder.toChildren": "Till mina barn",
    "folder.saved": "Sparat",
    "folder.save": "Spara ändringar",

    "tab.person": "Personuppgifter",
    "tab.contacts": "Kontaktuppgifter",
    "tab.calendar": "Kalender & aktiviteter",
    "tab.documents": "Dokument",
    "tab.custom": "Egen information",

    "person.name": "Namn",
    "person.birth": "Födelsedatum",
    "person.personalNumber": "Personnummer",
    "person.blood": "Blodgrupp",
    "person.allergies": "Allergier",
    "person.allergiesPlaceholder": "T.ex. nötter, pollen",
    "person.medications": "Mediciner",
    "person.medicationsPlaceholder": "Namn, dos och när den ges",
    "person.summary": "Kort om barnet",
    "person.summaryPlaceholder": "Favoritmat, rutiner, annat bra att minnas",
    "person.practical": "Bra att ha till hands",
    "person.clothing": "Klädstorlek",
    "person.shoe": "Skostorlek",
    "person.school": "Skola / förskola",
    "person.class": "Klass / avdelning",
    "person.passport": "Passnummer",
    "person.passportExpiry": "Passet gäller till",

    "entry.title": "Rubrik",
    "entry.content": "Information",
    "entry.add": "Lägg till",
    "entry.saved": "Informationen är sparad",
    "entry.remove": "Ta bort",
    "entry.empty": "Inget tillagt än.",
    "contacts.titlePlaceholder": "T.ex. Vårdcentralen",
    "contacts.contentPlaceholder": "Namn, telefonnummer, adress",
    "calendar.titlePlaceholder": "T.ex. Fotbollsträning",
    "calendar.contentPlaceholder": "Tisdagar 17:30 på Vallens IP, tränare Anna 070-123 45 67",
    "custom.titlePlaceholder": "T.ex. Favoritmat",
    "custom.contentPlaceholder": "Spaghetti carbonara",

    "tasks.heading": "Uppgifter",
    "tasks.task": "Uppgift",
    "tasks.taskPlaceholder": "Boka tandläkartid",
    "tasks.due": "Senast",
    "tasks.dueShort": "Senast",
    "tasks.empty": "Inga uppgifter än.",
    "tasks.markDone": "Markera som klar",

    "docs.upload": "Ladda upp dokument",
    "docs.uploadHelp": "Intyg, betyg, kvitton eller foton. Max 25 MB per fil, lagras privat.",
    "docs.empty": "Inga filer än.",
    "docs.open": "Öppna",
    "docs.uploaded": "Filen är uppladdad",
    "docs.uploadFail": "Kunde inte ladda upp filen",
    "docs.openFail": "Kunde inte öppna filen",

    "ai.heading": "Fråga om",
    "ai.lead": "Assistenten svarar bara utifrån informationen i barnets mapp.",
    "ai.placeholder": "Vad var min sons träningstid?",
    "ai.ask": "Fråga",
    "ai.thinking": "Tänker…",
    "ai.error": "Assistenten kunde inte svara just nu",
  },
  en: {
    "app.name": "Barnmappen",
    "nav.myChildren": "My children",
    "nav.signIn": "Sign in",
    "nav.signOut": "Sign out",
    "theme.light": "Light theme",
    "theme.dark": "Dark theme",
    "lang.switch": "Change language",

    "landing.eyebrow": "Private · Secure · Simple",
    "landing.title1": "Everything about your child,",
    "landing.title2": "in one safe place.",
    "landing.lead":
      "A separate digital folder for every child – personal details, contacts, calendar, documents and your own notes. Ask the assistant whenever you need an answer fast.",
    "landing.ctaIn": "Open my folders",
    "landing.ctaOut": "Create a free account",
    "landing.privacy": "Only you can see your information. Export or delete it whenever you like.",
    "landing.heroAlt":
      "Children's clothes, small shoes and a document neatly arranged on a light wooden table",
    "landing.f1.title": "Personal details",
    "landing.f1.text": "Name, date of birth, allergies, medication and blood type.",
    "landing.f2.title": "Contacts",
    "landing.f2.text": "Clinics, school, coaches and other important numbers.",
    "landing.f3.title": "Calendar & documents",
    "landing.f3.text": "Activities, tasks and important files in the child's private folder.",
    "landing.f4.title": "AI assistant",
    "landing.f4.text": "\u201cWhen does football practice start?\u201d – answered from the folder.",

    "auth.back": "← Back",
    "auth.welcome": "Welcome back",
    "auth.create": "Create your account",
    "auth.privacy": "Your information is private and only you can access it.",
    "auth.sentEmail":
      "We sent you a confirmation email. Click the link in it to activate your account.",
    "auth.google": "Continue with Google",
    "auth.googleError": "Could not sign in with Google",
    "auth.or": "or with email",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.loading": "One moment…",
    "auth.signIn": "Sign in",
    "auth.signUp": "Create account",
    "auth.toSignUp": "No account yet? Create one",
    "auth.toSignIn": "Already have an account? Sign in",
    "auth.encrypted": "Encrypted transfer and private storage",
    "auth.error": "Something went wrong",

    "children.title": "My children",
    "children.lead": "Every child has their own folder with information, documents and tasks.",
    "children.restore": "Restore from file",
    "children.new": "New child",
    "children.name": "Child's name",
    "children.namePlaceholder": "e.g. Elsa",
    "children.birth": "Date of birth",
    "children.createFolder": "Create folder",
    "children.loading": "Loading your folders…",
    "children.emptyTitle": "No folders yet",
    "children.emptyText": "Create a folder for your first child to get started.",
    "children.born": "Born",
    "children.noBirth": "No date of birth",
    "children.privacy": "Your information is private. You can back up and export every folder.",
    "children.created": "Folder created",
    "children.restored": "Folder restored",
    "children.restoreFail": "Could not restore the file",
    "children.mustSignIn": "You need to be signed in",

    "folder.backup": "Back up",
    "folder.delete": "Delete folder",
    "folder.deleteConfirm": "Delete the whole folder and all information about the child?",
    "folder.backupDone": "Backup downloaded",
    "folder.loading": "Loading…",
    "folder.missing": "Folder not found",
    "folder.toChildren": "To my children",
    "folder.saved": "Saved",
    "folder.save": "Save changes",

    "tab.person": "Personal details",
    "tab.contacts": "Contacts",
    "tab.calendar": "Calendar & activities",
    "tab.documents": "Documents",
    "tab.custom": "Own information",

    "person.name": "Name",
    "person.birth": "Date of birth",
    "person.personalNumber": "Personal ID number",
    "person.blood": "Blood type",
    "person.allergies": "Allergies",
    "person.allergiesPlaceholder": "e.g. nuts, pollen",
    "person.medications": "Medication",
    "person.medicationsPlaceholder": "Name, dose and when it is given",
    "person.summary": "About the child",
    "person.summaryPlaceholder": "School, sizes, favourite food, anything worth remembering",

    "entry.title": "Title",
    "entry.content": "Information",
    "entry.add": "Add",
    "entry.saved": "Information saved",
    "entry.remove": "Remove",
    "entry.empty": "Nothing added yet.",
    "contacts.titlePlaceholder": "e.g. Health centre",
    "contacts.contentPlaceholder": "Name, phone number, address",
    "calendar.titlePlaceholder": "e.g. Football practice",
    "calendar.contentPlaceholder": "Tuesdays 17:30 at Vallen field, coach Anna 070-123 45 67",
    "custom.titlePlaceholder": "e.g. Favourite food",
    "custom.contentPlaceholder": "Spaghetti carbonara",

    "tasks.heading": "Tasks",
    "tasks.task": "Task",
    "tasks.taskPlaceholder": "Book a dentist appointment",
    "tasks.due": "Due",
    "tasks.dueShort": "Due",
    "tasks.empty": "No tasks yet.",
    "tasks.markDone": "Mark as done",

    "docs.upload": "Upload document",
    "docs.uploadHelp": "Certificates, grades, receipts or photos. Max 25 MB per file, stored privately.",
    "docs.empty": "No files yet.",
    "docs.open": "Open",
    "docs.uploaded": "File uploaded",
    "docs.uploadFail": "Could not upload the file",
    "docs.openFail": "Could not open the file",

    "ai.heading": "Ask about",
    "ai.lead": "The assistant only answers from the information in this child's folder.",
    "ai.placeholder": "What time is my son's practice?",
    "ai.ask": "Ask",
    "ai.thinking": "Thinking…",
    "ai.error": "The assistant could not answer right now",
  },
} as const;

export type TranslationKey = keyof (typeof dict)["sv"];

type PrefsValue = {
  lang: Lang;
  theme: Theme;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  toggleTheme: () => void;
  t: (key: TranslationKey) => string;
  locale: string;
};

const PrefsContext = createContext<PrefsValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("sv");
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const storedLang = localStorage.getItem(LANG_KEY);
    if (storedLang === "sv" || storedLang === "en") setLangState(storedLang);
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme === "light" || storedTheme === "dark") setThemeState(storedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(LANG_KEY, next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === "sv" ? "en" : "sv";
      localStorage.setItem(LANG_KEY, next);
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback((key: TranslationKey) => dict[lang][key] ?? dict.sv[key], [lang]);

  return (
    <PrefsContext.Provider
      value={{
        lang,
        theme,
        setLang,
        toggleLang,
        toggleTheme,
        t,
        locale: lang === "sv" ? "sv-SE" : "en-GB",
      }}
    >
      {children}
    </PrefsContext.Provider>
  );
}

export function usePrefs() {
  const value = useContext(PrefsContext);
  if (!value) throw new Error("usePrefs must be used inside PrefsProvider");
  return value;
}
