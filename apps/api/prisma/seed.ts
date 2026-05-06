import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'
import { hashQrToken, generateQrToken } from '../src/lib/qr.js'

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
  await prisma.user.upsert({
    where: { qrTokenHash: demoQrHash },
    update: {},
    create: {
      role: 'CHILD',
      displayName: 'Mia',
      classId: demoClass.id,
      qrTokenHash: demoQrHash,
    },
  })

  // Beispiel-Diagnose
  const existing = await prisma.diagnostic.findFirst({ where: { type: 'ENTRY' } })
  if (!existing) {
    await prisma.diagnostic.create({
      data: {
        type: 'ENTRY',
        name: 'Eingangsdiagnostik',
        durationSec: 90,
        items: {
          create: [
            { sentence: 'Im Sommer ist es warm.', isNonsense: false, orderIndex: 0 },
            { sentence: 'Fische können fliegen.', isNonsense: true, orderIndex: 1 },
            { sentence: 'Katzen haben vier Beine.', isNonsense: false, orderIndex: 2 },
            { sentence: 'Mein Hund kocht das Mittagessen.', isNonsense: true, orderIndex: 3 },
            { sentence: 'Die Sonne scheint am Tag.', isNonsense: false, orderIndex: 4 },
            { sentence: 'Bäume trinken Milch.', isNonsense: true, orderIndex: 5 },
          ],
        },
      },
    })
  }

  // Demo-Text
  const textExists = await prisma.text.findFirst()
  if (!textExists) {
    await prisma.text.create({
      data: {
        title: 'Der Drache im Garten',
        content:
          'Mia lief durch den Garten. Plötzlich sah sie etwas Rotes hinter dem Busch. Es war ein kleiner Drache! Der Drache hatte grüne Augen und rote Flügel. Mia streckte die Hand aus. Der Drache schnüffelte daran. Dann leckte er ihr die Hand. „Du bist ja gar nicht gefährlich", sagte Mia. Der Drache wedelte mit dem Schwanz.',
        wordCount: 56,
        lixScore: 28,
        targetLevel: 2,
        estimatedSec: 42,
        questions: {
          create: [
            {
              question: 'Was findet Mia im Garten?',
              options: JSON.stringify(['Einen Drachen', 'Eine Katze', 'Einen Vogel']),
              correctIndex: 0,
              orderIndex: 0,
            },
            {
              question: 'Welche Farbe haben die Flügel des Drachen?',
              options: JSON.stringify(['Blau', 'Rot', 'Grün']),
              correctIndex: 1,
              orderIndex: 1,
            },
            {
              question: 'Was macht der Drache, als Mia die Hand ausstreckt?',
              options: JSON.stringify(['Er beißt sie', 'Er fliegt weg', 'Er leckt ihre Hand']),
              correctIndex: 2,
              orderIndex: 2,
            },
          ],
        },
      },
    })
  }

  console.log('Seed abgeschlossen.')
  console.log(`Demo-Lehrer: demo@leseflux.schule / Lehrer1234!`)
  console.log(`Admin: admin@leseflux.schule / Admin1234!`)
  console.log(`Demo-Schüler QR-Token: ${demoQrToken}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
