/** Parst eine CSV-Datei (Semikolon oder Komma als Trennzeichen).
 *  Erste Zeile wird als Header interpretiert.
 *  Gibt ein Array von Objekten zurück, Schlüssel sind Header-Werte (lowercase, trimmed). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  const delimiter = lines[0]!.includes(';') ? ';' : ','
  const headers = lines[0]!.split(delimiter).map((h) => h.trim().toLowerCase().replace(/^"(.*)"$/, '$1'))

  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((c) => c.trim().replace(/^"(.*)"$/, '$1'))
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
    return obj
  })
}

/** Normalisiert Spaltennamen-Varianten zu kanonischen Schlüsseln für den Anton-Import. */
export function normalizeAntonRow(row: Record<string, string>) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = row[k.toLowerCase()]
      if (val !== undefined && val !== '') return val
    }
    return ''
  }
  return {
    vorname: get('vorname', 'firstname', 'first_name', 'first name', 'name'),
    nachname: get('nachname', 'lastname', 'last_name', 'last name', 'surname'),
    klasse: get('klasse', 'class', 'gruppe', 'group'),
    antonCode: get('antoncode', 'anton_code', 'anton-code', 'code', 'logincode', 'login_code'),
    schuljahr: get('schuljahr', 'school_year', 'year'),
  }
}

/** Normalisiert Spaltennamen für den Lehrer-Import. */
export function normalizeTeacherRow(row: Record<string, string>) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = row[k.toLowerCase()]
      if (val !== undefined && val !== '') return val
    }
    return ''
  }
  return {
    displayName: get('name', 'displayname', 'display_name', 'anzeigename'),
    email: get('email', 'e-mail', 'mail'),
    password: get('passwort', 'password', 'pw', 'kennwort'),
  }
}
