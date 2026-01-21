// oxlint-disable no-unreadable-array-destructuring, unicorn/prefer-math-trunc, unicorn/prefer-spread
/* eslint-disable complexity, no-continue, no-bitwise, max-statements */
/** biome-ignore-all lint/nursery/noReturnAssign: x */
/** biome-ignore-all lint/nursery/noContinue: x */
/** biome-ignore-all lint/performance/useTopLevelRegex: x */
/** biome-ignore-all lint/nursery/useMaxParams: x */
/** biome-ignore-all lint/suspicious/noBitwiseOperators: x */
type AccentStyle = 'new' | 'old'
type Action =
  | { family: string; modification: LetterModification; type: 'modify-family' }
  | { modification: LetterModification; type: 'modify' }
  | { tone: Tone; type: 'tone' }
  | { type: 'insert-u' }
  | { type: 'remove-tone' }
  | { type: 'reset-u' }

interface Engine {
  getProcessedString: () => string
  processKey: (key: string, mode: Mode) => void
  processString: (text: string, mode: Mode) => void
  reset: () => void
}
type LetterModification = 'breve' | 'circumflex' | 'dyet' | 'horn'
type Mode = number
interface Syllable {
  accent: AccentStyle
  final: string
  initial: string
  letterModifications: [number, LetterModification][]
  tone: Tone
  vowel: string
}
type Tone = 0 | 1 | 2 | 3 | 4 | 5
type Transformation = 'AddMod' | 'AddTone' | 'DelMod' | 'DelTone' | 'Ignored' | 'SwapMod' | 'SwapTone'

const ToneEnum = { ToneAcute: 2, ToneDot: 5, ToneGrave: 1, ToneHook: 3, ToneNone: 0, ToneTilde: 4 } as const,
  MarkEnum = { MarkBreve: 2, MarkDash: 4, MarkHat: 1, MarkHorn: 3, MarkNone: 0, MarkRaw: 5 } as const,
  ModeFlags = { EnglishMode: 1 << 1, FullText: 1 << 5, LowerCase: 1 << 4, MarkLess: 1 << 3, ToneLess: 1 << 2 } as const,
  allowedInputTypes = 'email|password|search|tel|text|url'.split('|'),
  punctuationMarks = new Set(' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'),
  baseVowels = 'aeiouyAEIOUY',
  specialVowelPairs = 'oa|oe|oo|ie|uo|uy'.split('|'),
  validVowels =
    'a|ai|ao|au|ay|e|eo|eu|i|ia|ie|ieu|io|iu|o|oa|oai|oao|oay|oe|oeo|oi|oo|u|ua|uay|ue|ui|uo|uoi|uou|uu|uy|uya|uye|uyu|y|ye|yeu'.split(
      '|'
    ),
  singleInitialConsonants = 'bcdđghklmnpqrstvx',
  digraphInitialConsonants = 'ch|gh|gi|kh|ng|nh|ph|qu|th|tr'.split('|'),
  finalConsonants = 'c|ch|m|n|ng|nh|p|t'.split('|'),
  toneMarks: Record<Tone, string> = { 0: '', 1: '̀', 2: '́', 3: '̉', 4: '̃', 5: '̣' },
  modRegex = /[̛̂̆]/gu,
  modMarks: Record<Exclude<LetterModification, 'dyet'>, string> = { breve: '̆', circumflex: '̂', horn: '̛' },
  toneType = (tone: Tone) => ({ tone, type: 'tone' as const }),
  modify = (modification: LetterModification) => ({ modification, type: 'modify' as const }),
  modifyFamily = (family: string) => ({ family, modification: 'circumflex' as const, type: 'modify-family' as const }),
  telexActions: Record<string, Action[]> = {
    a: [modifyFamily('a')],
    d: [modify('dyet')],
    e: [modifyFamily('e')],
    f: [toneType(ToneEnum.ToneGrave)],
    j: [toneType(ToneEnum.ToneDot)],
    o: [modifyFamily('o')],
    r: [toneType(ToneEnum.ToneHook)],
    s: [toneType(ToneEnum.ToneAcute)],
    w: [{ type: 'reset-u' }, modify('horn'), modify('breve'), { type: 'insert-u' }],
    x: [toneType(ToneEnum.ToneTilde)],
    z: [{ type: 'remove-tone' }]
  },
  lower = (char: string) => char.toLowerCase(),
  isAlpha = (char: string) => (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z'),
  isWordBreakSymbol = (key: string) => punctuationMarks.has(key) || (key >= '0' && key <= '9'),
  cleanChar = (char: string) => {
    const base = char.normalize('NFD').replaceAll(/[̀-ͯ]/gu, '')
    return base === 'đ' ? 'd' : base === 'Đ' ? 'D' : base
  },
  cleanString = (value: string) => value.replaceAll(/./gu, cleanChar),
  cleanVowel = (value: string) => cleanString(value).toLowerCase(),
  isVowel = (char: string) => baseVowels.includes(cleanChar(char)),
  stripTone = (char: string) => char.normalize('NFD').replaceAll(/[̣̀́̃̉]/gu, '').normalize('NFC'),
  stripMarks = (char: string) => cleanChar(stripTone(char).normalize('NFD').replace(modRegex, '').normalize('NFC')),
  findToneFromChar = (char: string): Tone => {
    const nfd = char.normalize('NFD')
    if (nfd.includes(toneMarks[2])) return ToneEnum.ToneAcute
    if (nfd.includes(toneMarks[1])) return ToneEnum.ToneGrave
    if (nfd.includes(toneMarks[3])) return ToneEnum.ToneHook
    if (nfd.includes(toneMarks[4])) return ToneEnum.ToneTilde
    if (nfd.includes(toneMarks[5])) return ToneEnum.ToneDot
    return ToneEnum.ToneNone
  },
  addToneToChar = (char: string, tone: Tone) => {
    if (!isVowel(char)) return char
    const base = stripTone(char).normalize('NFD')
    return (base + toneMarks[tone]).normalize('NFC')
  },
  addModificationChar = (char: string, modification: LetterModification) => {
    if (modification === 'dyet') {
      if (char === 'd') return 'đ'
      if (char === 'D') return 'Đ'
      return char
    }
    const base = char.normalize('NFD').replace(modRegex, '').normalize('NFC')
    return (base.normalize('NFD') + modMarks[modification]).normalize('NFC')
  },
  addMarkToChar = (char: string, mark: number) => {
    if (mark === MarkEnum.MarkRaw) return char
    const tone = findToneFromChar(char),
      base = stripMarks(char)
    if (mark === MarkEnum.MarkNone) return addToneToChar(base, tone)
    if (mark === MarkEnum.MarkDash) return addToneToChar(addModificationChar(base, 'dyet'), tone)
    if (mark === MarkEnum.MarkHat) return addToneToChar(addModificationChar(base, 'circumflex'), tone)
    if (mark === MarkEnum.MarkBreve) return addToneToChar(addModificationChar(base, 'breve'), tone)
    if (mark === MarkEnum.MarkHorn) return addToneToChar(addModificationChar(base, 'horn'), tone)
    return addToneToChar(base, tone)
  },
  isValidInitialConsonant = (consonant: string) => {
    const value = consonant.toLowerCase()
    return value.length === 1
      ? singleInitialConsonants.includes(value)
      : value.length === 2
        ? digraphInitialConsonants.includes(value)
        : value === 'ngh'
  },
  isValidFinalConsonant = (consonant: string) => finalConsonants.includes(consonant.toLowerCase()),
  parseSyllable = (input: string) => {
    const chars = input.split(''),
      lowerInput = input.toLowerCase()
    let start = 0
    if (lowerInput.startsWith('gi') && !(chars[2] && isVowel(chars[2]))) start = 1
    else if (lowerInput.startsWith('gi') || lowerInput.startsWith('qu')) start = 2
    else while (start < chars.length && !isVowel(chars[start] ?? '')) start += 1

    let end = start
    while (end < chars.length && isVowel(chars[end] ?? '')) end += 1
    return {
      final: chars.slice(end).join(''),
      initial: chars.slice(0, start).join(''),
      vowel: chars.slice(start, end).join('')
    }
  },
  extractLetterModifications = (input: string) => {
    const mods: [number, LetterModification][] = []
    for (const [index, ch] of input.split('').entries()) {
      if (ch === 'đ' || ch === 'Đ') {
        mods.push([index, 'dyet'])
        continue
      }
      const nfd = ch.normalize('NFD')
      if (nfd.includes(modMarks.horn)) mods.push([index, 'horn'])
      else if (nfd.includes(modMarks.breve)) mods.push([index, 'breve'])
      else if (nfd.includes(modMarks.circumflex)) mods.push([index, 'circumflex'])
    }
    return mods
  },
  extractTone = (input: string): Tone => {
    for (const ch of input) {
      const tone = findToneFromChar(ch)
      if (tone) return tone
    }
    return ToneEnum.ToneNone
  },
  syllableLength = (s: Syllable) => `${s.initial}${s.vowel}${s.final}`.length,
  getToneMarkPlacement = (raw: string, accent: AccentStyle) => {
    const { final, initial, vowel } = parseSyllable(raw),
      vowelLen = vowel.length,
      vowelIndex = initial.length,
      lowerVowel = vowel.toLowerCase()
    if (vowelLen === 1) return vowelIndex
    const specialIndex = lowerVowel.search(/[ơêâ]/u)
    if (specialIndex !== -1) return vowelIndex + specialIndex
    if (!(initial || final) && lowerVowel === 'uo') return vowelIndex
    if (accent === 'old') {
      if (vowelLen === 3 || (vowelLen === 2 && final)) return vowelIndex + 1
      return vowelIndex
    }
    if (specialVowelPairs.some(pair => lowerVowel.includes(pair))) return vowelIndex + 1
    if (!final && vowelLen === 2) return vowelIndex
    return vowelIndex + 1
  },
  getModificationPositions = (syllable: Syllable, modification: LetterModification) => {
    if (modification === 'dyet') return [0]
    const vowelIndex = syllable.initial.length,
      vowel = syllable.vowel.toLowerCase()
    if (modification === 'circumflex') {
      const indices = [vowel.indexOf('a'), vowel.indexOf('o'), vowel.indexOf('e')].filter(i => i >= 0)
      if (indices.length !== 1) return []
      return [vowelIndex + (indices[0] ?? 0)]
    }
    if (modification === 'breve') {
      const index = vowel.indexOf('a')
      return index === -1 ? [] : [vowelIndex + index]
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (modification === 'horn') {
      if (vowel === 'oa') return []
      if (vowel === 'uo' && syllable.initial && !syllable.final) return [vowelIndex + 1]
      if (vowel === 'uo' || vowel === 'uoi' || vowel === 'uou') return [vowelIndex, vowelIndex + 1]
      const index = vowel.indexOf('u')
      if (index !== -1) return [vowelIndex + index]
      const oIndex = vowel.indexOf('o')
      return oIndex === -1 ? [] : [vowelIndex + oIndex]
    }
    return []
  },
  isValidSyllable = (input: string) => {
    const { final, initial, vowel } = parseSyllable(input)
    if (initial && !isValidInitialConsonant(initial)) return false
    if (!vowel) return true
    const cleanedVowel = cleanVowel(vowel)
    return validVowels.includes(cleanedVowel) && (!final || isValidFinalConsonant(final))
  },
  newSyllable = (): Syllable => ({
    accent: 'new',
    final: '',
    initial: '',
    letterModifications: [],
    tone: ToneEnum.ToneNone,
    vowel: ''
  }),
  formatSyllable = (syllable: Syllable) => {
    const chars = `${syllable.initial}${syllable.vowel}${syllable.final}`.split('')
    for (const [position, modification] of syllable.letterModifications) {
      const char = chars[position]
      if (char) chars[position] = addModificationChar(char, modification)
    }
    if (syllable.tone) {
      const toneIndex = getToneMarkPlacement(chars.join(''), syllable.accent),
        char = chars[toneIndex]
      if (char) chars[toneIndex] = addToneToChar(char, syllable.tone)
    }
    return chars.join('')
  },
  setSyllable = (syllable: Syllable, raw: string) => {
    const { final, initial, vowel } = parseSyllable(raw)
    syllable.initial = cleanString(initial)
    syllable.vowel = cleanString(vowel)
    syllable.final = final
    syllable.letterModifications = extractLetterModifications(raw)
    syllable.tone = extractTone(raw)
  },
  containsModification = (syllable: Syllable, modification: LetterModification) =>
    syllable.letterModifications.some(([, mod]) => mod === modification),
  modifyLetter = (syllable: Syllable, modification: LetterModification): Transformation => {
    if (!syllableLength(syllable) || syllableLength(syllable) > 7) return 'Ignored'
    if (containsModification(syllable, modification)) {
      if (modification === 'horn') {
        const lowerVowel = syllable.vowel.toLowerCase(),
          vowelIndex = syllable.initial.length,
          positions = getModificationPositions(syllable, modification),
          existingPositions = new Set(syllable.letterModifications.filter(([, mod]) => mod === 'horn').map(([pos]) => pos))
        if (lowerVowel === 'uo' && syllable.initial && !syllable.final) {
          const both = [vowelIndex, vowelIndex + 1]
          if (existingPositions.has(vowelIndex + 1) && !existingPositions.has(vowelIndex)) {
            syllable.letterModifications.push([vowelIndex, modification])
            return 'AddMod'
          }
          if (both.every(pos => existingPositions.has(pos))) {
            syllable.letterModifications = syllable.letterModifications.filter(([, mod]) => mod !== 'horn')
            return 'DelMod'
          }
        }
        const next = positions.find(pos => !existingPositions.has(pos))
        if (next !== undefined) {
          syllable.letterModifications.push([next, modification])
          return 'AddMod'
        }
      }
      const index = syllable.letterModifications.findIndex(([, mod]) => mod === modification)
      if (index !== -1) syllable.letterModifications.splice(index, 1)
      return 'DelMod'
    }
    if (modification === 'dyet') {
      const [first] = syllable.initial
      if (first && (first === 'd' || first === 'D')) {
        syllable.letterModifications.push([0, modification])
        return 'AddMod'
      }
      return 'Ignored'
    }
    if (modification === 'horn' && syllable.vowel.toLowerCase() === 'oa') return 'Ignored'
    const positions = getModificationPositions(syllable, modification)
    if (positions.length === 0) return 'Ignored'
    if (
      syllable.letterModifications.length === 0 ||
      (syllable.letterModifications.length === 1 && containsModification(syllable, 'dyet'))
    ) {
      for (const position of positions) syllable.letterModifications.push([position, modification])
      return 'AddMod'
    }
    syllable.letterModifications = syllable.letterModifications.filter(([, mod]) => mod === 'dyet')
    for (const position of positions) syllable.letterModifications.push([position, modification])
    return 'SwapMod'
  },
  recalcModifications = (syllable: Syllable) => {
    const lowerVowel = syllable.vowel.toLowerCase(),
      hasHorn = syllable.letterModifications.some(([, mod]) => mod === 'horn'),
      lowerFinal = syllable.final.toLowerCase()
    if (!(syllable.initial || syllable.final) && lowerVowel !== 'uoi' && !(hasHorn && lowerVowel === 'uou')) return
    if (lowerVowel === 'uo' && syllable.initial && !syllable.final) return
    if (lowerVowel === 'uo' && hasHorn && 'sfrxj'.includes(lowerFinal)) return
    const seen = new Set(syllable.letterModifications.map(([, mod]) => mod))
    syllable.letterModifications = []
    for (const modification of seen) modifyLetter(syllable, modification)
  },
  pushChar = (syllable: Syllable, ch: string) => {
    const raw = `${syllable.initial}${syllable.vowel}${syllable.final}${ch}`,
      { final, initial, vowel } = parseSyllable(raw)
    syllable.initial = cleanString(initial)
    syllable.vowel = cleanString(vowel)
    syllable.final = final
    recalcModifications(syllable)
  },
  replaceLastChar = (syllable: Syllable, ch: string) => {
    const raw = formatSyllable(syllable)
    if (!raw) return
    setSyllable(syllable, raw.slice(0, -1) + ch)
  },
  addTone = (syllable: Syllable, tone: Tone): Transformation => {
    if (!syllable.vowel || syllableLength(syllable) > 7) return 'Ignored'
    if (syllable.tone === tone) {
      syllable.tone = ToneEnum.ToneNone
      return 'DelTone'
    }
    if (syllable.tone) {
      syllable.tone = tone
      return 'SwapTone'
    }
    syllable.tone = tone
    return 'AddTone'
  },
  removeTone = (syllable: Syllable): Transformation => {
    if (syllableLength(syllable) > 7) return 'Ignored'
    if (!syllable.tone) return 'Ignored'
    syllable.tone = ToneEnum.ToneNone
    return 'DelTone'
  },
  createEngine = (): Engine => {
    const state = {
        buffer: '',
        lastAction: null as Action | null,
        syllable: newSyllable(),
        wHold: 0
      },
      push = (key: string) => {
        pushChar(state.syllable, key)
        state.lastAction = null
      },
      commit = (key: string) => {
        state.buffer += formatSyllable(state.syllable) + key
        state.syllable = newSyllable()
        state.lastAction = null
        state.wHold = 0
      },
      applyAction = (action: Action, ch: string): Transformation => {
        if (action.type === 'tone') return addTone(state.syllable, action.tone)
        if (action.type === 'modify') return modifyLetter(state.syllable, action.modification)
        if (action.type === 'modify-family')
          return state.syllable.vowel.toLowerCase().includes(action.family)
            ? modifyLetter(state.syllable, action.modification)
            : 'Ignored'
        if (action.type === 'remove-tone') return removeTone(state.syllable)
        if (action.type === 'insert-u') {
          if (!state.syllable.vowel || formatSyllable(state.syllable) === 'gi') {
            const initial = state.syllable.initial.toLowerCase()
            if (initial === 'q' || initial === 'qu') return 'Ignored'
            const insert = ch === ch.toLowerCase() ? 'u' : 'U'
            pushChar(state.syllable, insert)
            state.syllable.letterModifications.push([syllableLength(state.syllable) - 1, 'horn'])
            return 'AddMod'
          }
          return 'Ignored'
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (action.type === 'reset-u' && state.lastAction?.type === 'insert-u') {
          replaceLastChar(state.syllable, ch)
          return 'DelMod'
        }
        return 'Ignored'
      },
      processKey = (key: string, mode: Mode) => {
        if (key.trim() === '') {
          commit(key)
          return
        }
        if (isWordBreakSymbol(key)) {
          commit(key)
          return
        }
        if (mode & ModeFlags.EnglishMode) {
          push(key)
          state.wHold = 0
          return
        }
        const lowerKey = lower(key),
          raw = formatSyllable(state.syllable)
        if (lowerKey !== 'w') state.wHold = 0
        if (lowerKey === 'w') {
          const { final, initial, vowel } = parseSyllable(raw),
            cleaned = cleanVowel(vowel)
          if (!(initial || final) && cleaned === 'uo') {
            const hornPositions = new Set(
              state.syllable.letterModifications.filter(([, mod]) => mod === 'horn').map(([pos]) => pos)
            )
            if (hornPositions.has(0) && hornPositions.has(1)) {
              if (!state.wHold) {
                state.wHold = 1
                state.lastAction = null
                return
              }
              state.wHold = 0
              state.syllable.letterModifications = state.syllable.letterModifications.filter(([, mod]) => mod !== 'horn')
              push(key)
              return
            }
          }
        }
        const actions = telexActions[lowerKey]
        if (!actions) {
          push(key)
          return
        }
        const fallback = raw + key
        for (const action of actions) {
          const transformation = applyAction(action, key)
          if (transformation === 'Ignored') continue
          if (transformation === 'DelTone' && action.type === 'tone') {
            const { final, initial, vowel } = parseSyllable(formatSyllable(state.syllable)),
              cleaned = cleanVowel(vowel)
            if (!(final || initial) && cleaned === 'uo') {
              const pos = initial.length
              state.syllable.letterModifications = state.syllable.letterModifications.filter(
                ([p, mod]) => !(mod === 'horn' && p === pos)
              )
            }
          }
          if (action.type === 'reset-u') {
            state.lastAction = action
            return
          }
          const actionPerformed =
            transformation !== 'DelMod' && (transformation !== 'DelTone' || action.type === 'remove-tone')
          if (!actionPerformed) {
            push(key)
            return
          }
          if (isValidSyllable(formatSyllable(state.syllable))) state.lastAction = action
          else {
            setSyllable(state.syllable, fallback)
            state.lastAction = null
          }
          return
        }
        push(key)
      }
    return {
      getProcessedString: () => state.buffer + formatSyllable(state.syllable),
      processKey,
      processString: (text: string, mode: Mode) => {
        for (const ch of text) processKey(ch, mode)
      },
      reset: () => {
        state.buffer = ''
        state.syllable = newSyllable()
        state.lastAction = null
        state.wHold = 0
      }
    }
  }

export { addMarkToChar, addToneToChar, allowedInputTypes, createEngine, isAlpha, isWordBreakSymbol, lower, ModeFlags }
export type { Engine }
