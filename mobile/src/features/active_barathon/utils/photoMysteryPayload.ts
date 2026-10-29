export type ChallengeInput = {
  question: string;
  options: string[];
  correctIndex: number;
};

export type ValidatedChallengePayload = {
  question: string;
  options: string[];
  correct_index: number;
};

export type PayloadValidationResult =
  | { success: true; payload: ValidatedChallengePayload }
  | { success: false; error: string };

/**
 * Normalise les options d'un défi Photo Mystère et recalcule correct_index.
 * Garantit :
 * - Question entre 3 et 180 caractères.
 * - Options non vides conservant l'association avec la bonne réponse choisie.
 * - Refus si la bonne réponse sélectionnée est un champ vide ou supprimé.
 * - Refus si moins de 2 options valides distinctes.
 * - Couvre les champs vides au début, au milieu ou à la fin.
 */
export function preparePhotoChallengePayload(input: ChallengeInput): PayloadValidationResult {
  const trimmedQ = (input.question || '').trim();
  if (trimmedQ.length < 3) {
    return { success: false, error: 'La question doit comporter au moins 3 caractères.' };
  }
  if (trimmedQ.length > 180) {
    return { success: false, error: 'La question ne peut pas dépasser 180 caractères.' };
  }

  const rawOptions = input.options || [];

  // Vérifier si l'index sélectionné est dans les bornes et correspond à une valeur non vide
  const selectedText = rawOptions[input.correctIndex];
  const trimmedSelectedText = (selectedText || '').trim();

  if (!trimmedSelectedText) {
    return { success: false, error: 'La bonne réponse sélectionnée ne peut pas être vide.' };
  }

  // Mapper avec l'indice d'origine
  const indexed = rawOptions.map((opt, originalIndex) => ({
    text: (opt || '').trim(),
    originalIndex,
  }));

  // Filtrer les entrées vides
  const nonEmpty = indexed.filter((item) => item.text.length > 0);

  if (nonEmpty.length < 2) {
    return { success: false, error: 'Veuillez renseigner au moins 2 propositions valides.' };
  }

  // Recalculer le nouvel index de la bonne réponse
  const newCorrectIndex = nonEmpty.findIndex(
    (item) => item.originalIndex === input.correctIndex
  );

  if (newCorrectIndex === -1) {
    return { success: false, error: 'La bonne réponse sélectionnée n’est pas valide.' };
  }

  const cleanOptions = nonEmpty.map((item) => item.text);

  // Vérifier les doublons
  const seen = new Set<string>();
  for (const opt of cleanOptions) {
    const lower = opt.toLowerCase();
    if (seen.has(lower)) {
      return { success: false, error: 'Les propositions doivent être distinctes.' };
    }
    seen.add(lower);
  }

  return {
    success: true,
    payload: {
      question: trimmedQ,
      options: cleanOptions,
      correct_index: newCorrectIndex,
    },
  };
}
