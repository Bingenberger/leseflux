import { randomUUID } from 'crypto'
import type { ExerciseType, FlashWord, PrismaClient } from '@prisma/client'
import { calculateFadingTiming } from '@leseflux/shared'
import { selectNextText } from '../modules/training/textSelector.js'
import { formatManualCloze, generateAutoCloze } from './cloze.js'

const DEFAULT_TEMPLATE_ID = 'standard-12-min'
const MEASUREMENT_TEMPLATE_ID = 'measurement-day'
const FLASH_WORD_COUNT = 12

type SessionBlock = {
  type: ExerciseType
  targetDurationSec: number
}

type TextWithQuestions = NonNullable<Awaited<ReturnType<typeof selectNextText>>>

export async function ensureDefaultSessionTemplate(prisma: PrismaClient) {
  const standard = await prisma.sessionTemplate.upsert({
    where: { id: DEFAULT_TEMPLATE_ID },
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
      id: DEFAULT_TEMPLATE_ID,
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
    where: { id: MEASUREMENT_TEMPLATE_ID },
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
      id: MEASUREMENT_TEMPLATE_ID,
      name: 'Messtag',
      isDefault: false,
      blocks: [
        { type: 'FLASH_WORD', targetDurationSec: 120 },
        { type: 'SELF_PACED', targetDurationSec: 600 },
        { type: 'CLOZE', targetDurationSec: 180 },
      ],
    },
  })

  return standard
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

async function getClozeExercise(prisma: PrismaClient, textId: string) {
  const text = await prisma.text.findUnique({
    where: { id: textId },
    include: { clozeTemplate: { include: { gaps: { orderBy: { wordIndex: 'asc' } } } } },
  })
  if (!text) return null

  const template = text.clozeTemplate
  const cloze = template && template.strategy === 'MANUAL'
    ? formatManualCloze(text, template.gaps)
    : generateAutoCloze(text, template?.gapInterval ?? undefined)

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

function formatQuestions(text: TextWithQuestions) {
  return text.questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) as string[],
    correctIndex: q.correctIndex,
  }))
}

function getBlockDuration(blocks: SessionBlock[], orderIndex: number, fallbackSec: number) {
  return blocks[orderIndex]?.targetDurationSec ?? fallbackSec
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
  if (previousRun.exerciseType !== 'FADING' && previousRun.exerciseType !== 'SELF_PACED') return null

  let progress = await prisma.userProgress.findUnique({ where: { userId } })
  if (!progress) {
    progress = await prisma.userProgress.create({
      data: { userId, fadingTargetWpm: previousRun.targetWpm ?? 60 },
    })
  }

  const targetWpm = previousRun.exerciseType === 'FADING'
    ? progress.fadingTargetWpm
    : previousRun.targetWpm ?? progress.fadingTargetWpm
  const text = await selectNextText(prisma, userId, targetWpm)
  if (!text) return null

  const runCount = await prisma.exerciseRun.count({ where: { sessionId: previousRun.sessionId } })

  const run = await prisma.exerciseRun.create({
    data: {
      sessionId: previousRun.sessionId,
      exerciseType: previousRun.exerciseType,
      orderIndex: runCount,
      startedAt: new Date(),
      textId: text.id,
      targetWpm: previousRun.exerciseType === 'FADING' ? targetWpm : null,
      responses: [],
    },
  })

  const templateBlocks = previousRun.session.template && Array.isArray(previousRun.session.template.blocks)
    ? (previousRun.session.template.blocks as SessionBlock[])
    : []
  const targetDurationSec = getBlockDuration(templateBlocks, previousRun.orderIndex, fallbackDurationSec)

  if (run.exerciseType === 'SELF_PACED') {
    return {
      runId: run.id,
      type: 'SELF_PACED' as const,
      targetDurationSec,
      text: formatText(text),
      questions: formatQuestions(text),
    }
  }

  const { displayMs: fadingMsBase, fadeOutMs: fadingMsPerChar } = calculateFadingTiming(
    targetWpm,
    'Beispiel',
  )
  return {
    runId: run.id,
    type: 'FADING' as const,
    targetDurationSec,
    fadingTargetWpm: targetWpm,
    fadingMsBase,
    fadingMsPerChar,
    text: formatText(text),
    questions: formatQuestions(text),
  }
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
  const text = await selectNextText(prisma, userId, progress.fadingTargetWpm)
  if (!text) return null
  const clozeExercise = await getClozeExercise(prisma, text.id)

  const unitId = trainingUnitId ?? randomUUID()
  const blocks = templateBlocks.filter((block) =>
    block.type === 'FLASH_WORD'
      ? flashWords.length > 0
        : block.type === 'CLOZE'
        ? clozeExercise !== null
        : block.type === 'FADING' || block.type === 'SELF_PACED',
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
          textId: block.type === 'FADING' || block.type === 'SELF_PACED' || block.type === 'CLOZE'
            ? text.id
            : null,
          targetWpm: block.type === 'FADING' ? progress.fadingTargetWpm : null,
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

  const { displayMs: fadingMsBase, fadeOutMs: fadingMsPerChar } = calculateFadingTiming(
    progress.fadingTargetWpm,
    'Beispiel',
  )

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
        if (run.exerciseType === 'SELF_PACED') {
          return {
            runId: run.id,
            type: 'SELF_PACED' as const,
            targetDurationSec: block.targetDurationSec,
            text: formatText(text),
            questions: formatQuestions(text),
          }
        }
        return {
          runId: run.id,
          type: 'FADING' as const,
          targetDurationSec: block.targetDurationSec,
          fadingTargetWpm: progress.fadingTargetWpm,
          fadingMsBase,
          fadingMsPerChar,
          text: formatText(text),
          questions: formatQuestions(text),
        }
      }),
  }
}
