/**
 * Name Extractor Utility
 *
 * Extracts speaker names from transcribed text, handling both:
 * 1. Phonetic names: "John", "Sarah"
 * 2. Spelled names: "J-O-H-N", "J O H N", "jay oh aitch en"
 * 3. Combined: "John, J-O-H-N" or "My name is Xiaowei, X-I-A-O-W-E-I"
 */

// Phonetic alphabet mappings (NATO and common alternatives)
const PHONETIC_ALPHABET: Record<string, string> = {
  // NATO phonetic alphabet
  'alpha': 'A', 'alfa': 'A',
  'bravo': 'B',
  'charlie': 'C',
  'delta': 'D',
  'echo': 'E',
  'foxtrot': 'F',
  'golf': 'G',
  'hotel': 'H',
  'india': 'I',
  'juliet': 'J', 'juliett': 'J',
  'kilo': 'K',
  'lima': 'L',
  'mike': 'M',
  'november': 'N',
  'oscar': 'O',
  'papa': 'P',
  'quebec': 'Q',
  'romeo': 'R',
  'sierra': 'S',
  'tango': 'T',
  'uniform': 'U',
  'victor': 'V',
  'whiskey': 'W', 'whisky': 'W',
  'xray': 'X', 'x-ray': 'X',
  'yankee': 'Y',
  'zulu': 'Z',

  // Common phonetic alternatives people use (no duplicates from NATO)
  'apple': 'A', 'adam': 'A', 'able': 'A',
  'boy': 'B', 'baker': 'B', 'bob': 'B',
  'cat': 'C', 'carol': 'C',
  'dog': 'D', 'david': 'D',
  'edward': 'E', 'easy': 'E', 'egg': 'E',
  'frank': 'F', 'fox': 'F', 'freddy': 'F',
  'george': 'G', 'girl': 'G',
  'henry': 'H', 'harry': 'H', 'how': 'H',
  'ida': 'I', 'item': 'I', 'ice': 'I',
  'john': 'J', 'jack': 'J', 'james': 'J',
  'king': 'K', 'kate': 'K', 'kevin': 'K',
  'larry': 'L', 'love': 'L', 'london': 'L',
  'mary': 'M', 'mother': 'M', 'michael': 'M',
  'nancy': 'N', 'nora': 'N', 'nick': 'N',
  'ocean': 'O', 'oliver': 'O', 'orange': 'O',
  'peter': 'P', 'paul': 'P', 'pink': 'P',
  'queen': 'Q',
  'robert': 'R', 'roger': 'R', 'red': 'R',
  'sam': 'S', 'sugar': 'S', 'steve': 'S',
  'tom': 'T', 'tommy': 'T', 'tiger': 'T',
  'uncle': 'U', 'union': 'U',
  'victory': 'V', 'vincent': 'V',
  'william': 'W', 'walter': 'W',
  'xerox': 'X',
  'yellow': 'Y', 'young': 'Y', 'yoke': 'Y',
  'zebra': 'Z', 'zero': 'Z', 'zoo': 'Z',
};

// Letter pronunciation mappings (how letters sound when spoken)
const LETTER_PRONUNCIATIONS: Record<string, string> = {
  // Standard letter sounds
  'ay': 'A', 'aye': 'A', 'eh': 'A',
  'bee': 'B', 'be': 'B',
  'see': 'C', 'sea': 'C', 'cee': 'C',
  'dee': 'D', 'de': 'D',
  'ee': 'E', 'e': 'E',
  'eff': 'F', 'ef': 'F',
  'gee': 'G', 'jee': 'G',
  'aitch': 'H', 'ach': 'H', 'haitch': 'H', 'h': 'H',
  'eye': 'I', 'i': 'I',
  'jay': 'J', 'jey': 'J',
  'kay': 'K', 'key': 'K', 'k': 'K',
  'el': 'L', 'ell': 'L',
  'em': 'M',
  'en': 'N',
  'oh': 'O', 'o': 'O',
  'pee': 'P', 'pe': 'P',
  'cue': 'Q', 'queue': 'Q', 'kew': 'Q',
  'ar': 'R', 'are': 'R',
  'ess': 'S', 'es': 'S',
  'tee': 'T', 'te': 'T',
  'you': 'U', 'yu': 'U',
  'vee': 'V', 've': 'V',
  'double you': 'W', 'double u': 'W', 'doubleyou': 'W',
  'ex': 'X',
  'why': 'Y', 'wy': 'Y', 'wye': 'Y',
  'zee': 'Z', 'zed': 'Z', 'zet': 'Z',
};

export interface NameExtractionResult {
  /** The extracted name (best guess) */
  name: string;
  /** Confidence level: 'high' (spelled), 'medium' (phonetic clear), 'low' (unclear) */
  confidence: 'high' | 'medium' | 'low';
  /** The method used to extract the name */
  method: 'spelled' | 'phonetic' | 'nato' | 'combined';
  /** The original transcript */
  originalText: string;
  /** Debug info about what was detected */
  debug?: {
    spelledName?: string;
    phoneticName?: string;
    natoName?: string;
  };
}

/**
 * Extract a name from transcribed text
 * Handles spoken names, spelled names, and combinations
 */
export function extractName(transcript: string): NameExtractionResult {
  const originalText = transcript.trim();
  const normalized = originalText.toLowerCase();

  const debug: NameExtractionResult['debug'] = {};

  // Try to extract spelled name (highest priority)
  const spelledName = extractSpelledName(normalized);
  if (spelledName) {
    debug.spelledName = spelledName;
  }

  // Try to extract NATO phonetic spelling
  const natoName = extractNatoPhoneticName(normalized);
  if (natoName) {
    debug.natoName = natoName;
  }

  // Extract phonetic (spoken) name
  const phoneticName = extractPhoneticName(normalized);
  if (phoneticName) {
    debug.phoneticName = phoneticName;
  }

  // Determine best result
  // Priority: spelled > nato > phonetic
  if (spelledName && spelledName.length >= 2) {
    return {
      name: capitalizeFirst(spelledName),
      confidence: 'high',
      method: 'spelled',
      originalText,
      debug,
    };
  }

  if (natoName && natoName.length >= 2) {
    return {
      name: capitalizeFirst(natoName),
      confidence: 'high',
      method: 'nato',
      originalText,
      debug,
    };
  }

  if (phoneticName) {
    return {
      name: capitalizeFirst(phoneticName),
      confidence: 'medium',
      method: 'phonetic',
      originalText,
      debug,
    };
  }

  // Fallback: clean up the original text
  const cleaned = cleanTranscript(originalText);
  return {
    name: capitalizeFirst(cleaned),
    confidence: 'low',
    method: 'phonetic',
    originalText,
    debug,
  };
}

/**
 * Extract spelled name from patterns like:
 * - "J O H N"
 * - "J-O-H-N"
 * - "J, O, H, N"
 * - "jay oh aitch en"
 */
function extractSpelledName(text: string): string | null {
  // Pattern 1: Single letters separated by spaces, hyphens, or commas
  // Match sequences like "j o h n" or "j-o-h-n" or "j, o, h, n"
  const letterPattern = /\b([a-z])\s*[-,.\s]\s*([a-z])\s*[-,.\s]\s*([a-z])(?:\s*[-,.\s]\s*([a-z]))*\b/gi;

  // Pattern 2: Letters spoken as sounds (jay oh aitch en)
  const pronunciationPattern = buildPronunciationPattern();

  // Try letter pattern first
  let match = text.match(letterPattern);
  if (match) {
    // Extract all single letters from the match
    const letters = match[0].match(/[a-z]/gi);
    if (letters && letters.length >= 2) {
      return letters.join('').toUpperCase();
    }
  }

  // Try pronunciation pattern
  const pronunciationMatch = text.match(pronunciationPattern);
  if (pronunciationMatch) {
    const result = convertPronunciationsToLetters(pronunciationMatch[0]);
    if (result && result.length >= 2) {
      return result;
    }
  }

  // Pattern 3: Look for sequences at the end after "spelled" or similar cues
  const spellingCuePattern = /(?:spelled?|that'?s?|it'?s?)\s+([a-z](?:\s*[-,.\s]\s*[a-z])+)/i;
  match = text.match(spellingCuePattern);
  if (match) {
    const letters = match[1].match(/[a-z]/gi);
    if (letters && letters.length >= 2) {
      return letters.join('').toUpperCase();
    }
  }

  return null;
}

/**
 * Build regex pattern for letter pronunciations
 */
function buildPronunciationPattern(): RegExp {
  const pronunciations = Object.keys(LETTER_PRONUNCIATIONS)
    .sort((a, b) => b.length - a.length) // Sort by length descending to match longer first
    .join('|');

  // Match 2 or more consecutive letter pronunciations
  return new RegExp(`\\b((?:${pronunciations})\\s*){2,}\\b`, 'gi');
}

/**
 * Convert pronunciation sounds to letters
 */
function convertPronunciationsToLetters(text: string): string {
  const words = text.toLowerCase().split(/\s+/);
  let result = '';

  for (const word of words) {
    // Check direct letter (single character)
    if (word.length === 1 && /[a-z]/i.test(word)) {
      result += word.toUpperCase();
      continue;
    }

    // Check pronunciation mappings
    if (LETTER_PRONUNCIATIONS[word]) {
      result += LETTER_PRONUNCIATIONS[word];
      continue;
    }

    // Check phonetic alphabet
    if (PHONETIC_ALPHABET[word]) {
      result += PHONETIC_ALPHABET[word];
    }
  }

  return result;
}

/**
 * Extract NATO phonetic alphabet spelling
 * e.g., "Juliet Oscar Hotel November" → "JOHN"
 */
function extractNatoPhoneticName(text: string): string | null {
  const words = text.toLowerCase().split(/\s+/);
  let result = '';
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  let bestResult = '';

  for (const word of words) {
    const cleaned = word.replace(/[^a-z]/g, '');
    if (PHONETIC_ALPHABET[cleaned]) {
      result += PHONETIC_ALPHABET[cleaned];
      consecutiveMatches++;
      if (consecutiveMatches > maxConsecutive) {
        maxConsecutive = consecutiveMatches;
        bestResult = result;
      }
    } else {
      // Reset if non-NATO word found (allow for small gaps)
      if (consecutiveMatches > 0 && result.length >= 2) {
        // Keep the current result if it's substantial
      }
      consecutiveMatches = 0;
      result = '';
    }
  }

  // Return only if we found at least 2 consecutive NATO letters
  return maxConsecutive >= 2 ? bestResult : null;
}

/**
 * Extract the phonetic (spoken) name from common patterns
 */
function extractPhoneticName(text: string): string | null {
  // Remove common filler phrases
  let cleaned = text
    .replace(/^(my name is|i'm|i am|this is|it's|call me|they call me)\s+/i, '')
    .replace(/\s+(here|speaking|and|that's|spelled).*$/i, '')
    .trim();

  // If there's a comma, take the first part (name before spelling)
  if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[0].trim();
  }

  // Extract first word(s) that look like a name
  const nameMatch = cleaned.match(/^([a-z]+(?:\s+[a-z]+)?)/i);
  if (nameMatch) {
    return nameMatch[1];
  }

  return cleaned || null;
}

/**
 * Clean transcript of common phrases
 */
function cleanTranscript(text: string): string {
  return text
    .replace(/^(my name is|i'm|i am|this is|it's|call me|they call me)\s+/i, '')
    .replace(/\s+(here|speaking)$/i, '')
    .replace(/[.,!?]+$/g, '')
    .trim();
}

/**
 * Capitalize first letter of each word
 */
function capitalizeFirst(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Validate if a string looks like a reasonable name
 */
export function isValidName(name: string): boolean {
  // Name should be 1-50 characters, contain only letters/spaces/hyphens
  if (!name || name.length < 1 || name.length > 50) {
    return false;
  }

  // Should contain at least one letter
  if (!/[a-zA-Z]/.test(name)) {
    return false;
  }

  // Should only contain valid name characters
  if (!/^[a-zA-Z\s'-]+$/.test(name)) {
    return false;
  }

  return true;
}
