const STOP_WORDS = new Set([
  'for',
  'and',
  'the',
  'with',
  'from',
  'class',
  'book',
  'books',
  'need',
  'looking',
  'want',
  'item',
  'this',
  'that',
  'your',
  'have',
  'has',
  'you',
  'are',
]);

export const normalizeText = (value) => {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const extractKeywords = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const unique = new Set();
  normalized.split(' ').forEach((token) => {
    if (token.length < 3) return;
    if (STOP_WORDS.has(token)) return;
    unique.add(token);
  });

  return Array.from(unique);
};

export const isLikelyMatch = (sourceText, targetText, sourceKeywords = [], targetKeywords = []) => {
  const source = normalizeText(sourceText);
  const target = normalizeText(targetText);
  if (!source || !target) return false;

  if (source.length >= 5 && target.includes(source)) return true;
  if (target.length >= 5 && source.includes(target)) return true;

  const sourceSet = new Set(sourceKeywords.length ? sourceKeywords : extractKeywords(source));
  const targetSet = new Set(targetKeywords.length ? targetKeywords : extractKeywords(target));

  let overlap = 0;
  sourceSet.forEach((token) => {
    if (targetSet.has(token)) overlap += 1;
  });

  return overlap >= 2;
};
