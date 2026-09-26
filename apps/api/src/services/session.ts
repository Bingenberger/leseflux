import { randomUUID } from 'crypto'
import type { ExerciseType, FlashWord, PrismaClient } from '@prisma/client'
import { calculateFadingTiming } from '@leseflux/shared'
import { adaptiveConfig } from '../config.js'
import { selectNextText } from '../modules/training/textSelector.js'
import { chooseTextLevel } from '../modules/training/textLevel.js'
import { formatManualCloze, generateAutoCloze, mazePoolFromTexts } from './cloze.js'
import { shuffleQuestionOptions } from './quizOptions.js'

const DEFAULT_TEMPLATE_ID = 'standard-12-min'
const CLASSIC_FADING_TEMPLATE_ID = 'fading-classic'
const MEASUREMENT_TEMPLATE_ID = 'measurement-day'
const FLASH_WORD_COUNT = 12
/** Anzahl Texte derselben Stufe, aus denen Maze-Ablenker gezogen werden */
const MAZE_POOL_TEXTS = 40

/** Übungstypen, die einen Lesetext mit Verständnisfragen haben */
const READING_TYPES: ExerciseType[] = ['FADING', 'SELF_PACED', 'REPEATED_READING']

export function isReadingType(type: ExerciseType) {
  return READING_TYPES.includes(type)
}

type SessionBlock = {
  type: ExerciseType
  targetDurationSec: number
}

type TextWithQuestions = NonNullable<Awaited<ReturnType<typeof selectNextText>>>

/** System-Vorlagen (ohne Lehrkraft). Standard ist das wiederholte Lesen im Dreischritt;
 *  das klassische einmalige Fading-Lesen bleibt als Vorlage wählbar. */
const SYSTEM_TEMPLATES = [
  {
    id: DEFAULT_TEMPLATE_ID,
    name: 'Standard 12 Min',
    isDefault: true,
    blocks: [
      { type: 'FLASH_WORD', targetDurationSec: 120 },
      { type: 'REPEATED_READING', targetDurationSec: 600 },
      { type: 'CLOZE', targetDurationSec: 180 },
    ],
  },
  {
    id: CLASSIC_FADING_TEMPLATE_ID,
    name: 'Fading klassisch 12 Min',
    isDefault: false,
    blocks: [
      { type: 'FLASH_WORD', targetDurationSec: 120 },
      { type: 'FADING', targetDurationSec: 600 },
      { type: 'CLOZE', targetDurationSec: 180 },
    ],
  },
  {
    id: MEASUREMENT_TEMPLATE_ID,
    name: 'Messtag',
    isDefault: false,
    blocks: [
      { type: 'FLASH_WORD', targetDurationSec: 120 },
      { type: 'SELF_PACED', targetDurationSec: 600 },
      { type: 'CLOZE', targetDurationSec: 180 },
    ],
  },
] as const

export async function ensureDefaultSessionTemplate(prisma: PrismaClient) {
  for (const { id, name, isDefault, blocks } of SYSTEM_TEMPLATES) {
    const data = { name, isDefault, blocks: blocks.map((block) => ({ ...block })) }
    await prisma.sessionTemplate.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    })
  }
  return prisma.sessionTemplate.findUniqueOrThrow({ where: { id: DEFAULT_TEMPLATE_ID } })
}

export async function selectSessionTemplate(prisma: PrismaClient, userId: string, totalSessions: number) {
  await ensureDefaultSessionTemplate(prisma)
  const nextSessionNumber = totalSessions + 1
  if (!(nextSessionNumber > 1 && nextSessionNumber % 5 === 0)) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        sessionTemplateId: true,
        class: { select: { sessionTemplateId: true } },
      },
    })
    if (user?.sessionTemplateId) {
      return prisma.sessionTemplate.findUniqueOrThrow({
        where: { id: user.sessionTemplateId },
      })
    }
    if (user?.class?.sessionTemplateId) {
      return prisma.sessionTemplate.findUniqueOrThrow({
        where: { id: user.class.sessionTemplateId },
      })
    }
  }
  const templateId = nextSessionNumber > 1 && nextSessionNumber % 5 === 0
    ? MEASUREMENT_TEMPLATE_ID
    : DEFAULT_TEMPLATE_ID
  return prisma.sessionTemplate.findUniqueOrThrow({ where: { id: templateId } })
}

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = copy[i]!
    copy[i] = copy[j]!
    copy[j] = current
  }
  return copy
}

async function selectFlashWords(prisma: PrismaClient, level: number) {
  const words = await prisma.flashWord.findMany({
    where: { difficultyLevel: { lte: level } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return shuffle(words).slice(0, FLASH_WORD_COUNT)
}

function formatFlashWord(word: FlashWord) {
  const distractors = (Array.isArray(word.distractors) ? word.distractors : []) as string[]
  const options = shuffle([word.word, ...distractors]).slice(0, 3)
  if (!options.includes(word.word)) options[0] = word.word
  return {
    id: word.id,
    word: word.word,
    syllables: word.syllables,
    difficultyLevel: word.difficultyLevel,
    options: shuffle(options),
  }
}

/** Textstufe für ein Kind: Klassenstufe (bzw. Klassenname) + Textverständnis, siehe chooseTextLevel. */
export async function resolveTextLevel(
  prisma: PrismaClient,
  userId: string,
  progress: { fadingTargetWpm: number; averageQuizAccuracy: number | null },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { class: { select: { gradeLevel: true, name: true } } },
  })
  return chooseTextLevel({
    gradeLevel: user?.class?.gradeLevel ?? null,
    className: user?.class?.name ?? null,
    averageQuizAccuracy: progress.averageQuizAccuracy,
    targetWpm: progress.fadingTargetWpm,
  })
}

/** Lückentext als Maze-Aufgabe an einem ANDEREN Text als dem Lesetext – sonst prüft er das
 *  Gedächtnis statt das Leseverstehen. Ablenker stammen aus weiteren Texten derselben Stufe. */
async function getClozeExercise(
  prisma: PrismaClient,
  userId: string,
  level: number,
  readingTextId: string,
) {
  const selected = await selectNextText(prisma, userId, level, [readingTextId])
  if (!selected) return null
  const text = await prisma.text.findUnique({
    where: { id: selected.id },
    include: { clozeTemplate: { include: { gaps: { orderBy: { wordIndex: 'asc' } } } } },
  })
  if (!text) return null

  const template = text.clozeTemplate
  let cloze
  if (template && template.strategy === 'MANUAL') {
    cloze = formatManualCloze(text, template.gaps)
  } else {
    const poolTexts = await prisma.text.findMany({
      where: { targetLevel: text.targetLevel, id: { notIn: [text.id, readingTextId] } },
      select: { content: true },
      take: MAZE_POOL_TEXTS,
    })
    cloze = generateAutoCloze(
      text,
      template?.gapInterval ?? undefined,
      mazePoolFromTexts(poolTexts.map((t) => t.content)),
    )
  }

  if (cloze.gaps.length === 0) return null
  return {
    text: {
      id: text.id,
      title: text.title,
      content: text.content,
      wordCount: text.wordCount,
      estimatedSec: text.estimatedSec,
    },
    words: cloze.words,
    gaps: cloze.gaps,
  }
}

function formatText(text: TextWithQuestions) {
  return {
    id: text.id,
    title: text.title,
    content: text.content,
    wordCount: text.wordCount,
    estimatedSec: text.estimatedSec,
  }
}

function formatQuestions(text: TextWithQuestions, runId: string) {
  return text.questions.map((q) => {
    const options = (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) as string[]
    return {
      id: q.id,
      question: q.question,
      ...shuffleQuestionOptions(runId, q.id, options, q.correctIndex),
    }
  })
}

function getBlockDuration(blocks: SessionBlock[], orderIndex: number, fallbackSec: number) {
  return blocks[orderIndex]?.targetDurationSec ?? fallbackSec
}

/** Antwort-Payload für eine Lese-Übung (Fading, Eigentempo oder wiederholtes Lesen). */
function formatReadingExercise(
  run: { id: string; exerciseType: ExerciseType },
  text: TextWithQuestions,
  targetWpm: number,
  targetDurationSec: number,
) {
  const base = {
    runId: run.id,
    targetDurationSec,
    text: formatText(text),
    questions: formatQuestions(text, run.id),
  }
  if (run.exerciseType === 'SELF_PACED') {
    return { ...base, type: 'SELF_PACED' as const }
  }
  if (run.exerciseType === 'REPEATED_READING') {
    return {
      ...base,
      type: 'REPEATED_READING' as const,
      fadingTargetWpm: targetWpm,
      passConfig: {
        passFactors: [...adaptiveConfig.repeatedReading.passFactors],
        baseMinFactor: adaptiveConfig.repeatedReading.baseMinFactor,
        baseMaxFactor: adaptiveConfig.repeatedReading.baseMaxFactor,
      },
    }
  }
  const { displayMs: fadingMsBase, fadeOutMs: fadingMsPerChar } = calculateFadingTiming(
    targetWpm,
    'Beispiel',
  )
  return {
    ...base,
    type: 'FADING' as const,
    fadingTargetWpm: targetWpm,
    fadingMsBase,
    fadingMsPerChar,
  }
}

export async function createNextReadingExercise(
  prisma: PrismaClient,
  userId: string,
  previousRunId: string,
  fallbackDurationSec = 600,
) {
  const previousRun = await prisma.exerciseRun.findUnique({
    where: { id: previousRunId },
    include: { session: { include: { template: true } } },
  })

  if (!previousRun || previousRun.session.userId !== userId) return null
  if (previousRun.finishedAt === null) return null
  if (previousRun.session.completed) return null
  if (!isReadingType(previousRun.exerciseType)) return null

  let progress = await prisma.userProgress.findUnique({ where: { userId } })
  if (!progress) {
    progress = await prisma.userProgress.create({
      data: { userId, fadingTargetWpm: previousRun.targetWpm ?? 60 },
    })
  }

  const targetWpm = progress.fadingTargetWpm
  const level = await resolveTextLevel(prisma, userId, progress)
  const text = await selectNextText(prisma, userId, level)
  if (!text) return null

  const runCount = await prisma.exerciseRun.count({ where: { sessionId: previousRun.sessionId } })

  const run = await prisma.exerciseRun.create({
    data: {
      sessionId: previousRun.sessionId,
      exerciseType: previousRun.exerciseType,
      orderIndex: runCount,
      startedAt: new Date(),
      textId: text.id,
      targetWpm: previousRun.exerciseType === 'SELF_PACED' ? null : targetWpm,
      responses: [],
    },
  })

  const templateBlocks = previousRun.session.template && Array.isArray(previousRun.session.template.blocks)
    ? (previousRun.session.template.blocks as SessionBlock[])
    : []
  const targetDurationSec = getBlockDuration(templateBlocks, previousRun.orderIndex, fallbackDurationSec)

  return formatReadingExercise(run, text, targetWpm, targetDurationSec)
}

export async function buildTrainingSession(
  prisma: PrismaClient,
  userId: string,
  durationMinutes: 10 | 15 = 10,
  trainingUnitId?: string,
) {
  let progress = await prisma.userProgress.findUnique({ where: { userId } })
  if (!progress) {
    progress = await prisma.userProgress.create({
      data: { userId, fadingTargetWpm: 60 },
    })
  }

  const template = await selectSessionTemplate(prisma, userId, progress.totalSessions)
  const templateBlocks = Array.isArray(template.blocks)
    ? (template.blocks as SessionBlock[])
    : []
  const flashWords = await selectFlashWords(prisma, progress.flashWordLevel)
  const level = await resolveTextLevel(prisma, userId, progress)
  const text = await selectNextText(prisma, userId, level)
  if (!text) return null
  const clozeExercise = templateBlocks.some((block) => block.type === 'CLOZE')
    ? await getClozeExercise(prisma, userId, level, text.id)
    : null

  const unitId = trainingUnitId ?? randomUUID()
  const blocks = templateBlocks.filter((block) =>
    block.type === 'FLASH_WORD'
      ? flashWords.length > 0
      : block.type === 'CLOZE'
        ? clozeExercise !== null
        : isReadingType(block.type),
  )
  if (blocks.length === 0) blocks.push({ type: 'FADING', targetDurationSec: durationMinutes * 60 })

  const session = await prisma.trainingSession.create({
    data: {
      userId,
      templateId: template.id,
      startedAt: new Date(),
      trainingUnitId: unitId,
      exerciseRuns: {
        create: blocks.map((block, orderIndex) => ({
          exerciseType: block.type,
          orderIndex,
          startedAt: new Date(),
          textId: block.type === 'CLOZE'
            ? clozeExercise?.text.id ?? null
            : isReadingType(block.type) ? text.id : null,
          targetWpm: block.type === 'FADING' || block.type === 'REPEATED_READING'
            ? progress.fadingTargetWpm
            : null,
          flashDurationMs: block.type === 'FLASH_WORD' ? progress.flashWordDurationMs : null,
          flashDifficulty: block.type === 'FLASH_WORD' ? progress.flashWordLevel : null,
          itemsTotal: block.type === 'FLASH_WORD'
            ? flashWords.length
            : block.type === 'CLOZE'
              ? (clozeExercise?.gaps.length ?? 0)
              : 0,
          responses: [],
        })),
      },
    },
    include: { exerciseRuns: true },
  })

  return {
    sessionId: session.id,
    templateName: template.name,
    trainingUnitId: unitId,
    exercises: session.exerciseRuns
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((run) => {
        const block = blocks[run.orderIndex] ?? { type: run.exerciseType, targetDurationSec: durationMinutes * 60 }
        if (run.exerciseType === 'FLASH_WORD') {
          return {
            runId: run.id,
            type: 'FLASH_WORD' as const,
            targetDurationSec: block.targetDurationSec,
            flashDurationMs: progress.flashWordDurationMs,
            flashDifficulty: progress.flashWordLevel,
            words: flashWords.map(formatFlashWord),
          }
        }
        if (run.exerciseType === 'CLOZE' && clozeExercise) {
          return {
            runId: run.id,
            type: 'CLOZE' as const,
            targetDurationSec: block.targetDurationSec,
            text: clozeExercise.text,
            words: clozeExercise.words,
            gaps: clozeExercise.gaps,
          }
        }
        return formatReadingExercise(run, text, progress.fadingTargetWpm, block.targetDurationSec)
      }),
  }
}
