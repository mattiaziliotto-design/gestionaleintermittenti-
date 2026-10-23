export interface EmployerConfig {
  codiceFiscale: string;
  email: string;
}

export interface InputRow {
  id: string;
  codiceFiscale: string;
  nominativo: string;
  giornoLavoro: string; // es. "SAB", "DOM", "LUN"
  rigaOriginale?: number;
}

export interface LavoratoreRaggruppato {
  codiceFiscale: string;
  nominativo: string;
  prestazioni: {
    giorno: string; // "SAB"
    data: string; // "DD/MM/YYYY"
  }[];
}

export interface ElaborazioneStorica {
  id: string;
  titolo: string;
  createdAt: string; // stringa ISO
  selectedDate: string; // YYYY-MM-DD
  employer: EmployerConfig;
  rawRows: InputRow[];
  lavoratoriElaborati: LavoratoreRaggruppato[];
  inputMethod: 'paste' | 'upload';
  pastedText: string;
}

export interface UserSession {
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'demo';
  loggedInAt: string;
}

