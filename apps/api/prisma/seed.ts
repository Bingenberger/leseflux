import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'
import { hashQrToken, generateQrToken, generateLoginCode } from '../src/lib/qr.js'

const prisma = new PrismaClient()

async function main() {
  // Admin-Account
  const adminPw = await argon2.hash('Admin1234!')
  const admin = await prisma.user.upsert({
    where: { email: 'admin@leseflux.schule' },
    update: {},
    create: {
      role: 'ADMIN',
      displayName: 'Administrator',
      email: 'admin@leseflux.schule',
      passwordHash: adminPw,
    },
  })

  // Demo-Lehrerin
  const teacherPw = await argon2.hash('Lehrer1234!')
  const teacher = await prisma.user.upsert({
    where: { email: 'demo@leseflux.schule' },
    update: {},
    create: {
      role: 'TEACHER',
      displayName: 'Frau Musterfrau',
      email: 'demo@leseflux.schule',
      passwordHash: teacherPw,
    },
  })

  // Demo-Klasse
  const demoClass = await prisma.class.upsert({
    where: { id: 'demo-class-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'demo-class-0000-0000-0000-000000000001',
      name: '3a',
      schoolYear: '2025/26',
      teacherId: teacher.id,
    },
  })

  // Demo-Schüler
  const demoQrToken = generateQrToken()
  const demoQrHash = hashQrToken(demoQrToken)
  const demoLoginCode = generateLoginCode()
  const demoStudent = await prisma.user.upsert({
    where: { email: 'demo-schueler@leseflux.intern' },
    update: {},
    create: {
      role: 'CHILD',
      displayName: 'Mia',
      email: 'demo-schueler@leseflux.intern',
      classId: demoClass.id,
      qrTokenHash: demoQrHash,
      loginCode: demoLoginCode,
    },
  })
  await prisma.userProgress.upsert({
    where: { userId: demoStudent.id },
    update: {},
    create: { userId: demoStudent.id, fadingTargetWpm: 60 },
  })

  await prisma.sessionTemplate.upsert({
    where: { id: 'standard-12-min' },
    update: {
      name: 'Standard 12 Min',
      isDefault: true,
      blocks: [
        { type: 'FLASH_WORD', targetDurationSec: 120 },
        { type: 'FADING', targetDurationSec: 600 },
        { type: 'CLOZE', targetDurationSec: 180 },
      ],
    },
    create: {
      id: 'standard-12-min',
      name: 'Standard 12 Min',
      isDefault: true,
      blocks: [
        { type: 'FLASH_WORD', targetDurationSec: 120 },
        { type: 'FADING', targetDurationSec: 600 },
        { type: 'CLOZE', targetDurationSec: 180 },
      ],
    },
  })

  await prisma.sessionTemplate.upsert({
    where: { id: 'measurement-day' },
    update: {
      name: 'Messtag',
      isDefault: false,
      blocks: [
        { type: 'FLASH_WORD', targetDurationSec: 120 },
        { type: 'SELF_PACED', targetDurationSec: 600 },
        { type: 'CLOZE', targetDurationSec: 180 },
      ],
    },
    create: {
      id: 'measurement-day',
      name: 'Messtag',
      isDefault: false,
      blocks: [
        { type: 'FLASH_WORD', targetDurationSec: 120 },
        { type: 'SELF_PACED', targetDurationSec: 600 },
        { type: 'CLOZE', targetDurationSec: 180 },
      ],
    },
  })

  const FLASH_WORDS = [
    { word: 'Haus', syllables: 1, difficultyLevel: 1, distractors: ['Hans', 'Hase'] },
    { word: 'Baum', syllables: 1, difficultyLevel: 1, distractors: ['Bauch', 'Bahn'] },
    { word: 'Kind', syllables: 1, difficultyLevel: 1, distractors: ['Wind', 'Kino'] },
    { word: 'Schule', syllables: 2, difficultyLevel: 1, distractors: ['Schale', 'Spule'] },
    { word: 'Blume', syllables: 2, difficultyLevel: 1, distractors: ['Blase', 'Biene'] },
    { word: 'Garten', syllables: 2, difficultyLevel: 1, distractors: ['Karten', 'Warten'] },
    { word: 'Lesen', syllables: 2, difficultyLevel: 1, distractors: ['Leben', 'Leise'] },
    { word: 'Wasser', syllables: 2, difficultyLevel: 1, distractors: ['Wiese', 'Wolke'] },
    { word: 'Fenster', syllables: 2, difficultyLevel: 1, distractors: ['Fester', 'Feuer'] },
    { word: 'Morgen', syllables: 2, difficultyLevel: 1, distractors: ['Magen', 'Sorgen'] },
    { word: 'Abenteuer', syllables: 4, difficultyLevel: 2, distractors: ['Abendrot', 'Ameise'] },
    { word: 'Bibliothek', syllables: 4, difficultyLevel: 2, distractors: ['Bilderbuch', 'Bleistift'] },
  ]

  for (const word of FLASH_WORDS) {
    await prisma.flashWord.upsert({
      where: { word: word.word },
      update: word,
      create: word,
    })
  }

  // Eingangsdiagnostik — 24 Sätze (8 pro Schwierigkeitsstufe)
  const existingEntry = await prisma.diagnostic.findFirst({ where: { type: 'ENTRY' } })
  if (!existingEntry) {
    await prisma.diagnostic.create({
      data: {
        type: 'ENTRY',
        name: 'Eingangsdiagnostik',
        durationSec: 90,
        itemCount: 24,
        items: {
          create: [
            // Leicht (difficulty 1)
            { sentence: 'Im Winter liegt Schnee.', isNonsense: false, orderIndex: 0, difficulty: 1 },
            { sentence: 'Hunde können sprechen.', isNonsense: true, orderIndex: 1, difficulty: 1 },
            { sentence: 'Wasser ist nass.', isNonsense: false, orderIndex: 2, difficulty: 1 },
            { sentence: 'Vögel haben Federn.', isNonsense: false, orderIndex: 3, difficulty: 1 },
            { sentence: 'Autos wachsen auf Bäumen.', isNonsense: true, orderIndex: 4, difficulty: 1 },
            { sentence: 'Kinder gehen in die Schule.', isNonsense: false, orderIndex: 5, difficulty: 1 },
            { sentence: 'Die Nacht ist dunkel.', isNonsense: false, orderIndex: 6, difficulty: 1 },
            { sentence: 'Katzen fressen Kuchen zum Frühstück.', isNonsense: true, orderIndex: 7, difficulty: 1 },
            // Mittel (difficulty 2)
            { sentence: 'Im Sommer kann man im See schwimmen.', isNonsense: false, orderIndex: 8, difficulty: 2 },
            { sentence: 'Schmetterlinge leben unter dem Wasser.', isNonsense: true, orderIndex: 9, difficulty: 2 },
            { sentence: 'Bäume verlieren im Herbst ihre Blätter.', isNonsense: false, orderIndex: 10, difficulty: 2 },
            { sentence: 'Der Mond leuchtet nachts am Himmel.', isNonsense: false, orderIndex: 11, difficulty: 2 },
            { sentence: 'Hamster bauen große Vogelnester.', isNonsense: true, orderIndex: 12, difficulty: 2 },
            { sentence: 'In der Bäckerei kauft man frisches Brot.', isNonsense: false, orderIndex: 13, difficulty: 2 },
            { sentence: 'Regenwürmer spielen Fußball im Garten.', isNonsense: true, orderIndex: 14, difficulty: 2 },
            { sentence: 'Mit einem Fahrrad kann man schnell fahren.', isNonsense: false, orderIndex: 15, difficulty: 2 },
            // Schwer (difficulty 3)
            { sentence: 'Zugvögel fliegen im Winter in wärmere Länder.', isNonsense: false, orderIndex: 16, difficulty: 3 },
            { sentence: 'Spinnen spinnen ihre Netze aus Zuckerwatte.', isNonsense: true, orderIndex: 17, difficulty: 3 },
            { sentence: 'Bibliotheken sind Orte, an denen man Bücher ausleihen kann.', isNonsense: false, orderIndex: 18, difficulty: 3 },
            { sentence: 'Eisbären leben in der heißen Wüste Afrikas.', isNonsense: true, orderIndex: 19, difficulty: 3 },
            { sentence: 'Beim Kochen verwandelt sich Wasser in Dampf.', isNonsense: false, orderIndex: 20, difficulty: 3 },
            { sentence: 'Sonnenblumen drehen sich dem Licht entgegen.', isNonsense: false, orderIndex: 21, difficulty: 3 },
            { sentence: 'Mathematikaufgaben löst man am besten mit Kaugummi.', isNonsense: true, orderIndex: 22, difficulty: 3 },
            { sentence: 'Flüsse fließen immer bergab ins Tal.', isNonsense: false, orderIndex: 23, difficulty: 3 },
          ],
        },
      },
    })
  }

  // Zwischendiagnostik — 24 Sätze (8 pro Schwierigkeitsstufe)
  const existingIntermediate = await prisma.diagnostic.findFirst({ where: { type: 'INTERMEDIATE' } })
  if (!existingIntermediate) {
    await prisma.diagnostic.create({
      data: {
        type: 'INTERMEDIATE',
        name: 'Zwischendiagnostik',
        durationSec: 90,
        itemCount: 24,
        intervalSessions: 10,
        items: {
          create: [
            // Leicht (difficulty 1)
            { sentence: 'Die Sonne ist ein Stern.', isNonsense: false, orderIndex: 0, difficulty: 1 },
            { sentence: 'Fische können auf Bäume klettern.', isNonsense: true, orderIndex: 1, difficulty: 1 },
            { sentence: 'Mit den Augen kann man sehen.', isNonsense: false, orderIndex: 2, difficulty: 1 },
            { sentence: 'Im April gibt es manchmal Regen.', isNonsense: false, orderIndex: 3, difficulty: 1 },
            { sentence: 'Elefanten sind kleiner als Mäuse.', isNonsense: true, orderIndex: 4, difficulty: 1 },
            { sentence: 'Äpfel wachsen an Bäumen.', isNonsense: false, orderIndex: 5, difficulty: 1 },
            { sentence: 'Mit den Ohren kann man schmecken.', isNonsense: true, orderIndex: 6, difficulty: 1 },
            { sentence: 'Feuer ist heiß.', isNonsense: false, orderIndex: 7, difficulty: 1 },
            // Mittel (difficulty 2)
            { sentence: 'Igel rollen sich bei Gefahr zu einer Kugel zusammen.', isNonsense: false, orderIndex: 8, difficulty: 2 },
            { sentence: 'In der Nacht scheint die Sonne am hellsten.', isNonsense: true, orderIndex: 9, difficulty: 2 },
            { sentence: 'Aus Milch kann man Käse und Butter herstellen.', isNonsense: false, orderIndex: 10, difficulty: 2 },
            { sentence: 'Fledermäuse schlafen tagsüber und fliegen nachts.', isNonsense: false, orderIndex: 11, difficulty: 2 },
            { sentence: 'Im Frühling blühen viele bunte Blumen.', isNonsense: false, orderIndex: 12, difficulty: 2 },
            { sentence: 'Giraffen haben einen besonders kurzen Hals.', isNonsense: true, orderIndex: 13, difficulty: 2 },
            { sentence: 'Mit einem Kompass kann man die Himmelsrichtungen bestimmen.', isNonsense: false, orderIndex: 14, difficulty: 2 },
            { sentence: 'Tintenfische spritzen Milch, um sich zu schützen.', isNonsense: true, orderIndex: 15, difficulty: 2 },
            // Schwer (difficulty 3)
            { sentence: 'Schmetterlinge entstehen aus Raupen, die sich verpuppen.', isNonsense: false, orderIndex: 16, difficulty: 3 },
            { sentence: 'Im Mittelalter trugen Ritter Rüstungen aus Gummi.', isNonsense: true, orderIndex: 17, difficulty: 3 },
            { sentence: 'Vulkane entstehen, wo heiße Gesteinsmassen durch die Erdkruste dringen.', isNonsense: false, orderIndex: 18, difficulty: 3 },
            { sentence: 'Eulen können ihren Kopf fast vollständig im Kreis drehen.', isNonsense: false, orderIndex: 19, difficulty: 3 },
            { sentence: 'Wale sind die einzigen Tiere, die in Wolken leben.', isNonsense: true, orderIndex: 20, difficulty: 3 },
            { sentence: 'Pflanzen gewinnen aus Sonnenlicht Energie durch Fotosynthese.', isNonsense: false, orderIndex: 21, difficulty: 3 },
            { sentence: 'In der Antarktis wachsen große tropische Regenwälder.', isNonsense: true, orderIndex: 22, difficulty: 3 },
            { sentence: 'Manche Schildkröten können über hundert Jahre alt werden.', isNonsense: false, orderIndex: 23, difficulty: 3 },
          ],
        },
      },
    })
  }

  // Demo-Texte (je einer pro Niveau, damit der Selector immer etwas findet)
  const DEMO_TEXTS = [
    {
      title: 'Der Drache im Garten',
      content:
        'Mia lief durch den Garten. Plötzlich sah sie etwas Rotes hinter dem Busch. Es war ein kleiner Drache! Der Drache hatte grüne Augen und rote Flügel. Mia streckte die Hand aus. Der Drache schnüffelte daran. Dann leckte er ihr die Hand. „Du bist ja gar nicht gefährlich", sagte Mia. Der Drache wedelte mit dem Schwanz.',
      wordCount: 56,
      lixScore: 28,
      targetLevel: 2,
      estimatedSec: 42,
      questions: [
        { question: 'Was findet Mia im Garten?', options: ['Einen Drachen', 'Eine Katze', 'Einen Vogel'], correctIndex: 0 },
        { question: 'Welche Farbe haben die Flügel des Drachen?', options: ['Blau', 'Rot', 'Grün'], correctIndex: 1 },
        { question: 'Was macht der Drache, als Mia die Hand ausstreckt?', options: ['Er beißt sie', 'Er fliegt weg', 'Er leckt ihre Hand'], correctIndex: 2 },
      ],
    },
    {
      title: 'Das Baumhaus',
      content:
        'Leon und seine Schwester Jana hatten ein Baumhaus im alten Apfelbaum. Jeden Nachmittag kletterten sie die Holzleiter hinauf. Von dort oben konnten sie weit über die Felder sehen. An einem Herbsttag fanden sie eine kleine Eule in einer Ecke. Die Eule hatte ein verletztes Bein und konnte nicht fliegen. Leon holte eine Schachtel und etwas weiches Moos. Zusammen pflegten sie die Eule, bis sie wieder gesund war. Nach zwei Wochen flog sie in die Nacht davon.',
      wordCount: 82,
      lixScore: 38,
      targetLevel: 3,
      estimatedSec: 62,
      questions: [
        { question: 'Wo war das Baumhaus?', options: ['In einer Eiche', 'Im alten Apfelbaum', 'Am Fluss'], correctIndex: 1 },
        { question: 'Was fanden Leon und Jana in der Ecke?', options: ['Einen Igel', 'Eine Maus', 'Eine Eule'], correctIndex: 2 },
        { question: 'Wie lange dauerte es, bis die Eule wieder flog?', options: ['Eine Woche', 'Zwei Wochen', 'Einen Monat'], correctIndex: 1 },
      ],
    },
    {
      title: 'Die Sternenwarte',
      content:
        'Hoch oben auf dem Hügel stand die alte Sternenwarte des Dorfes. Frau Bergmann, die Astronomin, öffnete sie jeden klaren Freitagabend für Besucher. Das mächtige Teleskop zeigte nicht nur den Mond mit seinen Kratern, sondern auch weit entfernte Planeten. Eines Abends entdeckte die zwölfjährige Sophie durch das Okular einen hellen Lichtpunkt, den Frau Bergmann noch nicht kannte. Nach wochenlangen Berechnungen stellte sich heraus, dass Sophie einen neuen Asteroiden gefunden hatte. Er wurde nach ihr benannt: Asteroid Sophie.',
      wordCount: 89,
      lixScore: 52,
      targetLevel: 4,
      estimatedSec: 67,
      questions: [
        { question: 'Wann öffnete Frau Bergmann die Sternenwarte?', options: ['Jeden Morgen', 'Jeden klaren Freitagabend', 'Nur im Sommer'], correctIndex: 1 },
        { question: 'Was entdeckte Sophie durch das Teleskop?', options: ['Einen Kometen', 'Den Mars', 'Einen Asteroiden'], correctIndex: 2 },
        { question: 'Wie wurde der Asteroid benannt?', options: ['Nach Frau Bergmann', 'Nach dem Dorf', 'Nach Sophie'], correctIndex: 2 },
      ],
    },
  ]

  for (const t of DEMO_TEXTS) {
    const exists = await prisma.text.findFirst({ where: { title: t.title } })
    if (!exists) {
      const text = await prisma.text.create({
        data: {
          title: t.title,
          content: t.content,
          wordCount: t.wordCount,
          lixScore: t.lixScore,
          targetLevel: t.targetLevel,
          estimatedSec: t.estimatedSec,
          questions: {
            create: t.questions.map((q, i) => ({
              question: q.question,
              options: q.options,
              correctIndex: q.correctIndex,
              orderIndex: i,
            })),
          },
        },
      })
      await prisma.clozeTemplate.create({
        data: {
          textId: text.id,
          strategy: 'AUTO_EVERY_N',
          gapInterval: 7,
        },
      })
    } else {
      await prisma.clozeTemplate.upsert({
        where: { textId: exists.id },
        update: {},
        create: {
          textId: exists.id,
          strategy: 'AUTO_EVERY_N',
          gapInterval: 7,
        },
      })
    }
  }

  console.log('Seed abgeschlossen.')
  console.log(`Demo-Lehrer: demo@leseflux.schule / Lehrer1234!`)
  console.log(`Admin: admin@leseflux.schule / Admin1234!`)
  console.log(`Demo-Schüler QR-Token: ${demoQrToken}`)
  console.log(`Demo-Schüler Login-Code: ${demoLoginCode}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
