const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '../..');
const srcDir = path.resolve(rootDir, 'mobile/src');
const modalPath = path.resolve(srcDir, 'features/active_barathon/components/PhotoMysteryModal.tsx');
const webCapturePath = path.resolve(rootDir, 'web/src/app/photo-capture/page.tsx');

function loadModule(relativePath, mocks = {}) {
  const file = path.resolve(srcDir, relativePath);
  const mod = new Module(file, module);
  mod.paths = module.paths;
  mod.require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name);
      const found = ['.ts', '.tsx'].find((ext) => fs.existsSync(target + ext));
      if (found) return loadModule(path.relative(srcDir, target + found), mocks);
    }
    return require(name);
  };
  const sourceCode = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(sourceCode, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  mod._compile(compiled, file);
  return mod.exports;
}

// ============================================================================
// P1-A: Correspondance entre choix et bonne réponse (Tests comportementaux)
// ============================================================================

test('P1-A: Contre-test obligatoire - Choix [vide, A, B] avec A sélectionné -> options [A, B] et correct_index = 0', () => {
  const { preparePhotoChallengePayload } = loadModule('features/active_barathon/utils/photoMysteryPayload.ts');

  const input = {
    question: 'Quel est cet objet insolite ?',
    options: ['', 'Bière blonde', 'Cidre brut'],
    correctIndex: 1, // "Bière blonde"
  };

  const result = preparePhotoChallengePayload(input);
  assert.equal(result.success, true, 'La validation doit réussir');
  assert.deepEqual(result.payload.options, ['Bière blonde', 'Cidre brut']);
  assert.equal(
    result.payload.correct_index,
    0,
    'correct_index doit être recalculé à 0 pour correspondre à Bière blonde'
  );
});

test('P1-A: Couvre les champs vides au milieu et à la fin', () => {
  const { preparePhotoChallengePayload } = loadModule('features/active_barathon/utils/photoMysteryPayload.ts');

  // Champ vide au milieu : ["A", "", "B"] avec "B" sélectionné (index 2)
  const inputMiddle = {
    question: 'De quelle marque est le sous-bock ?',
    options: ['Guinness', '   ', 'Heineken'],
    correctIndex: 2, // "Heineken"
  };
  const resMiddle = preparePhotoChallengePayload(inputMiddle);
  assert.equal(resMiddle.success, true);
  assert.deepEqual(resMiddle.payload.options, ['Guinness', 'Heineken']);
  assert.equal(resMiddle.payload.correct_index, 1, 'correct_index doit être 1 pour Heineken');

  // Champ vide à la fin : ["A", "B", ""] avec "A" sélectionné (index 0)
  const inputEnd = {
    question: 'De quelle couleur est le comptoir ?',
    options: ['Brun acajou', 'Zinc argenté', ''],
    correctIndex: 0,
  };
  const resEnd = preparePhotoChallengePayload(inputEnd);
  assert.equal(resEnd.success, true);
  assert.deepEqual(resEnd.payload.options, ['Brun acajou', 'Zinc argenté']);
  assert.equal(resEnd.payload.correct_index, 0, 'correct_index doit être 0 pour Brun acajou');
});

test('P1-A: Refus d une bonne réponse vide ou supprimée', () => {
  const { preparePhotoChallengePayload } = loadModule('features/active_barathon/utils/photoMysteryPayload.ts');

  const input = {
    question: 'Quelle est la tireuse ?',
    options: ['', 'Chouffe', 'Duvel'],
    correctIndex: 0, // Option vide sélectionnée
  };

  const res = preparePhotoChallengePayload(input);
  assert.equal(res.success, false);
  assert.match(res.error, /bonne réponse.*vide/i);
});

test('P1-A: Refus si moins de 2 propositions valides ou question hors limites', () => {
  const { preparePhotoChallengePayload } = loadModule('features/active_barathon/utils/photoMysteryPayload.ts');

  // Moins de 2 propositions non vides
  const notEnough = preparePhotoChallengePayload({
    question: 'Question valide ?',
    options: ['Seule option', '', '   '],
    correctIndex: 0,
  });
  assert.equal(notEnough.success, false);
  assert.match(notEnough.error, /au moins 2 propositions/i);

  // Question trop courte
  const shortQ = preparePhotoChallengePayload({
    question: 'Ab',
    options: ['Choix 1', 'Choix 2'],
    correctIndex: 0,
  });
  assert.equal(shortQ.success, false);
  assert.match(shortQ.error, /au moins 3 caractères/i);

  // Options dupliquées
  const dup = preparePhotoChallengePayload({
    question: 'Question valide ?',
    options: ['Choix identique', 'choix identique'],
    correctIndex: 0,
  });
  assert.equal(dup.success, false);
  assert.match(dup.error, /distinctes/i);
});

// ============================================================================
// Mission 1: Réponse de mutation POST obsolète après CLOSED v3
// ============================================================================

test('Mission 1: POST PUBLISHED v2 différé arrivant après CLOSED v3 -> reste CLOSED et préserve les résultats', () => {
  const { reconcileSingleItemIntoState } = loadModule('features/active_barathon/utils/photoMysteryState.ts');

  const challengeId = 'chal-post-race';
  const barathonId = 42;

  // L'état en cours est déjà CLOSED v3 avec résultats calculés (via WebSocket)
  const currentState = {
    server_time: '2026-10-28T09:00:15Z',
    enabled: true,
    can_create: true,
    pending_count: 0,
    unseen_results_count: 1,
    items: [
      {
        id: challengeId,
        version: 3,
        state: 'closed',
        question: 'Quel est ce cocktail ?',
        options: ['Mojito', 'Spritz'],
        correct_index: 0,
        expires_at: '2026-10-28T09:03:00Z',
        my_submission: { choice_index: 0, passed: false, submitted_at: '2026-10-28T09:01:00Z' },
        can_answer: false,
        photo_available: true,
        results: {
          closed_at: '2026-10-28T09:01:30Z',
          reason: 'all_handled',
          expected_count: 2,
          correct_count: 2,
          incorrect_count: 0,
          passed_count: 0,
          creator_dare: true,
          my_dare_assigned: null,
        },
      },
    ],
  };

  // La réponse du POST submitPhotoAnswer arrive enfin mais date de la version 2 (PUBLISHED)
  const delayedPostResponse = {
    id: challengeId,
    version: 2,
    state: 'published',
    question: 'Quel est ce cocktail ?',
    options: ['Mojito', 'Spritz'],
    correct_index: null,
    expires_at: '2026-10-28T09:03:00Z',
    my_submission: { choice_index: 0, passed: false, submitted_at: '2026-10-28T09:01:00Z' },
    can_answer: false,
    photo_available: true,
    results: null,
  };

  const { nextState, shouldUpdate } = reconcileSingleItemIntoState(
    currentState,
    delayedPostResponse,
    barathonId,
    barathonId
  );

  assert.equal(shouldUpdate, false, 'Le POST obsolète ne doit pas modifier l état en cours');
  const item = nextState.items.find((i) => i.id === challengeId);
  assert.equal(item.version, 3, 'La version 3 doit être préservée');
  assert.equal(item.state, 'closed', 'Le défi doit rester CLOSED');
  assert.ok(item.results, 'Les résultats du défi doivent être préservés');
  assert.equal(item.results.correct_count, 2);
  assert.equal(nextState.pending_count, 0, 'pending_count doit rester 0');
});

// ============================================================================
// Mission 2: Isolation des barathons (Transition, Rejet hors barathon, Suppression)
// ============================================================================

test('Mission 2: Passage du barathon A avec défi vers B vide avec compteurs identiques -> état vidé', () => {
  const { reconcilePhotoMysteryState } = loadModule('features/active_barathon/utils/photoMysteryState.ts');

  // Barathon A (id: 10) possède un défi
  const stateBarathonA = {
    server_time: '2026-10-28T09:00:00Z',
    enabled: true,
    can_create: true,
    pending_count: 0,
    unseen_results_count: 0,
    items: [
      {
        id: 'chal-from-A',
        version: 1,
        state: 'published',
        question: 'Défi barathon A',
        options: ['A', 'B'],
        correct_index: 0,
        expires_at: null,
        my_submission: null,
        can_answer: false,
        photo_available: true,
        results: null,
      },
    ],
  };

  // Barathon B (id: 20) est vide avec compteurs identiques
  const stateBarathonB = {
    server_time: '2026-10-28T09:00:01Z',
    enabled: true,
    can_create: true,
    pending_count: 0,
    unseen_results_count: 0,
    items: [],
  };

  // L'utilisateur passe sur le barathon 20 et reçoit le snapshot vide de B
  const { nextState, shouldUpdate } = reconcilePhotoMysteryState(
    stateBarathonA,
    stateBarathonB,
    20, // currentBarathonId
    20  // incomingBarathonId
  );

  assert.equal(shouldUpdate, true, 'Le passage vers le barathon B vide doit mettre à jour l état');
  assert.equal(nextState.items.length, 0, 'Les défis du barathon A ne doivent pas être conservés');
});

test('Mission 2: Réponse retardée du barathon A après navigation vers le barathon B -> rejetée', () => {
  const { reconcilePhotoMysteryState } = loadModule('features/active_barathon/utils/photoMysteryState.ts');

  // Utilisateur actuellement sur le barathon B (id: 20)
  const stateB = {
    server_time: '2026-10-28T09:00:10Z',
    enabled: true,
    can_create: true,
    pending_count: 0,
    unseen_results_count: 0,
    items: [],
  };

  // Une réponse HTTP retardée appartenant au barathon A (id: 10) arrive
  const delayedResponseA = {
    server_time: '2026-10-28T09:00:05Z',
    enabled: true,
    can_create: false,
    pending_count: 1,
    unseen_results_count: 0,
    items: [
      {
        id: 'chal-barathon-A',
        version: 2,
        state: 'published',
        question: 'Question barathon A',
        options: ['X', 'Y'],
        correct_index: 0,
        expires_at: null,
        my_submission: null,
        can_answer: true,
        photo_available: true,
        results: null,
      },
    ],
  };

  const { nextState, shouldUpdate } = reconcilePhotoMysteryState(
    stateB,
    delayedResponseA,
    20, // barathon B
    10  // réponse issue de barathon A
  );

  assert.equal(shouldUpdate, false, 'La réponse du barathon A doit être strictement rejetée');
  assert.equal(nextState.items.length, 0, 'Aucun défi étranger ne doit s injecter');
});

// ============================================================================
// Mission 3: Cohérence globale des compteurs et du snapshot
// ============================================================================

test('Mission 3: CLOSED v3 suivi d une réponse PUBLISHED v2 -> conserve résultats ET compteurs cohérents', () => {
  const { reconcilePhotoMysteryState } = loadModule('features/active_barathon/utils/photoMysteryState.ts');

  const challengeId = 'chal-counters-test';
  const barathonId = 42;

  // État actuel : CLOSED v3 avec pending_count=0 et unseen_results_count=1
  const currentState = {
    server_time: '2026-10-28T09:00:20Z',
    enabled: true,
    can_create: true,
    pending_count: 0,
    unseen_results_count: 1,
    items: [
      {
        id: challengeId,
        version: 3,
        state: 'closed',
        question: 'Quel est ce gin ?',
        options: ['Bombay', 'Hendricks'],
        correct_index: 1,
        expires_at: '2026-10-28T09:03:00Z',
        my_submission: { choice_index: 1, passed: false, submitted_at: '2026-10-28T09:01:00Z' },
        can_answer: false,
        photo_available: true,
        results: {
          closed_at: '2026-10-28T09:01:30Z',
          reason: 'all_handled',
          expected_count: 2,
          correct_count: 2,
          incorrect_count: 0,
          passed_count: 0,
          creator_dare: true,
          my_dare_assigned: null,
        },
      },
    ],
  };

  // Snapshot entrant obsolète : v2 PUBLISHED avec compteurs anciens (pending_count=1, can_create=false)
  const staleIncomingSnapshot = {
    server_time: '2026-10-28T09:00:10Z',
    enabled: true,
    can_create: false, // Compteur ancien
    pending_count: 1,  // Compteur ancien
    unseen_results_count: 0,
    items: [
      {
        id: challengeId,
        version: 2,
        state: 'published',
        question: 'Quel est ce gin ?',
        options: ['Bombay', 'Hendricks'],
        correct_index: null,
        expires_at: '2026-10-28T09:03:00Z',
        my_submission: null,
        can_answer: true,
        photo_available: true,
        results: null,
      },
    ],
  };

  const { nextState, shouldUpdate } = reconcilePhotoMysteryState(
    currentState,
    staleIncomingSnapshot,
    barathonId,
    barathonId
  );

  assert.equal(shouldUpdate, false, 'Le snapshot obsolète ne doit pas altérer l état valide');
  assert.equal(nextState.pending_count, 0, 'pending_count ne doit PAS régresser à 1');
  assert.equal(nextState.can_create, true, 'can_create ne doit PAS régresser à false');
  assert.equal(nextState.unseen_results_count, 1, 'unseen_results_count doit rester à 1');

  const item = nextState.items.find((i) => i.id === challengeId);
  assert.equal(item.state, 'closed');
  assert.ok(item.results);
});

// ============================================================================
// Mission 4: Déduplication des événements WebSocket et gestion des listeners
// ============================================================================

test('Mission 4: Déduplication des événements reçus simultanément par /ws/me et la room barathon', () => {
  const {
    subscribePhotoMysteryEvents,
    emitPhotoMysteryEvent,
    resetPhotoEventsDedup,
  } = loadModule('features/active_barathon/services/photoMysteryEvents.ts');

  resetPhotoEventsDedup();

  const received = [];
  const unsubscribe = subscribePhotoMysteryEvents((evt) => {
    received.push(evt);
  });

  const evt = {
    type: 'PHOTO_MYSTERY_UPDATE',
    barathon_id: 15,
    challenge_id: 'chal-dup-1',
    version: 2,
    action: 'published',
  };

  // Simuler une réception quasi-simultanée depuis /ws/me et la room barathon (10ms d intervalle)
  emitPhotoMysteryEvent(evt);
  emitPhotoMysteryEvent(evt);

  assert.equal(
    received.length,
    1,
    'L événement dupliqué dans la fenêtre de 350ms doit être dédupliqué'
  );

  unsubscribe();
  resetPhotoEventsDedup();
});

test('Mission 4: Nettoyage des listeners après désabonnement', () => {
  const {
    subscribePhotoMysteryEvents,
    emitPhotoMysteryEvent,
    resetPhotoEventsDedup,
  } = loadModule('features/active_barathon/services/photoMysteryEvents.ts');

  resetPhotoEventsDedup();

  let callCount = 0;
  const unsubscribe = subscribePhotoMysteryEvents(() => {
    callCount++;
  });

  emitPhotoMysteryEvent({
    type: 'PHOTO_MYSTERY_UPDATE',
    barathon_id: 15,
    challenge_id: 'c1',
    action: 'published',
  });
  assert.equal(callCount, 1);

  // Nettoyage
  unsubscribe();

  emitPhotoMysteryEvent({
    type: 'PHOTO_MYSTERY_UPDATE',
    barathon_id: 15,
    challenge_id: 'c2',
    action: 'closed',
  });
  assert.equal(callCount, 1, 'Le listener désabonné ne doit plus recevoir d événements');

  resetPhotoEventsDedup();
});

// ============================================================================
// Phase 2: Finition UX/UI (Format d'image, Touch targets, Badges)
// ============================================================================

test('Phase 2: PhotoMystereModal affiche les images avec contentFit contain sans rogner', () => {
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert.ok(
    modalCode.includes('contentFit="contain"'),
    'PhotoMysteryModal doit utiliser contentFit="contain" pour préserver l intégralité de la photo'
  );
  assert.ok(
    !modalCode.includes('contentFit="cover"'),
    'PhotoMysteryModal ne doit plus utiliser contentFit="cover" qui tronque les photos'
  );
});

test('Phase 2: Aperçu web photo-capture utilise object-contain', () => {
  const webCode = fs.readFileSync(webCapturePath, 'utf8');

  assert.ok(
    webCode.includes('object-contain'),
    'web/photo-capture doit utiliser object-contain pour l aperçu photo'
  );
});

test('Phase 2: Bouton Coller sur le web respecte la zone tactile minimale de 44px', () => {
  const webCode = fs.readFileSync(webCapturePath, 'utf8');

  assert.ok(
    webCode.includes('min-h-[44px]'),
    'Le bouton Coller doit définir une hauteur tactile minimale de 44px'
  );
});

test('Phase 2: États EXPIRED et CANCELLED disposent de libellés et badges explicites', () => {
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert.ok(modalCode.includes("'Défi expiré'"), 'Libellé Défi expiré requis');
  assert.ok(modalCode.includes("'Défi annulé'"), 'Libellé Défi annulé requis');
  assert.ok(modalCode.includes('badgeExpired'), 'Style badgeExpired requis');
  assert.ok(modalCode.includes('badgeCancelled'), 'Style badgeCancelled requis');
  assert.ok(modalCode.includes('expiredBox'), 'Encadré explicatif expiré requis');
  assert.ok(modalCode.includes('cancelledBox'), 'Encadré explicatif annulé requis');
});

test('Phase 2: N affiche Code copié qu après validation réelle de setStringAsync', () => {
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert.ok(
    modalCode.includes('const ok = await Clipboard.setStringAsync(code)'),
    'handleCopyCode doit vérifier le retour de setStringAsync'
  );
  assert.ok(
    modalCode.includes('if (ok !== false)'),
    'Ne doit activer copiedCode que si ok !== false'
  );
});

test('Phase 2: Safe areas et KeyboardAvoidingView protègent la saisie sur petit écran', () => {
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert.ok(
    modalCode.includes('<KeyboardAvoidingView'),
    'PhotoMysteryModal doit utiliser KeyboardAvoidingView'
  );
  assert.ok(
    modalCode.includes("Platform.OS === 'ios' ? 'padding' : undefined"),
    'KeyboardAvoidingView doit adapter le comportement padding sur iOS'
  );
});

// ============================================================================
// Phase 3: Robustesse Réseau et Anti-Doublons
// ============================================================================

test('Phase 3: PhotoMysteryModal intègre les protections anti-double action et relecture', () => {
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert.ok(
    modalCode.includes('if (publishing) return;'),
    'Anti-double publication requis'
  );
  assert.ok(
    modalCode.includes('if (!activeChallenge || submittingAnswer) return;'),
    'Anti-double réponse requis'
  );
  // Request/session isolation is exercised on mounted React components in
  // photo-sync-mounted.test.cjs, rather than by asserting implementation names.
});
