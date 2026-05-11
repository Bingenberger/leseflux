declare module 'hypher' {
  export default class Hypher {
    constructor(language: Record<string, unknown>)
    hyphenate(word: string): string[]
    hyphenateText(text: string, hyphenChar?: string): string
  }
}

declare module 'hyphenation.de' {
  const patterns: Record<string, unknown>
  export default patterns
}
