const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '../..');
const modalPath = path.resolve(rootDir, 'mobile/src/features/active_barathon/components/PhotoMysteryModal.tsx');
const webCapturePath = path.resolve(rootDir, 'web/src/app/photo-capture/page.tsx');

test('P1-D: PhotoMysteryModal does not pass ?code= query parameter in web camera URL', () => {
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  // Doit ouvrir l'URL fixe sans insérer de paramètre ?code= ou &code=
  assert.ok(
    !modalCode.includes('?code='),
    'PhotoMysteryModal ne doit pas contenir ?code='
  );
  assert.ok(
    !modalCode.includes('&code='),
    'PhotoMysteryModal ne doit pas contenir &code='
  );
  assert.ok(
    modalCode.includes('const webUrl = baseUrl;'),
    'PhotoMysteryModal doit utiliser directement l URL fixe baseUrl'
  );
});

test('P1-D: web/photo-capture does not read code from window.location.search', () => {
  const webCode = fs.readFileSync(webCapturePath, 'utf8');

  // Pas de lecture de URLSearchParams ou location.search pour le code
  assert.ok(
    !webCode.includes('location.search'),
    'photo-capture ne doit pas lire window.location.search'
  );
  assert.ok(
    !webCode.includes('URLSearchParams'),
    'photo-capture ne doit pas instancier URLSearchParams'
  );
});

test('P1-B: PhotoMysteryModal listens to AppState to reload state on foreground return', () => {
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert.ok(
    modalCode.includes("AppState.addEventListener('change'"),
    'PhotoMysteryModal doit enregistrer un écouteur AppState'
  );
  assert.ok(
    modalCode.includes("nextAppState === 'active'"),
    'L écouteur doit vérifier le retour en mode active'
  );
  assert.ok(
    modalCode.includes('subscription.remove()'),
    'L écouteur doit nettoyer la souscription au démontage'
  );
});

test('P1-B: PhotoMysteryModal auto-switches to VIEW mode when draft has photo_available', () => {
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert.ok(
    modalCode.includes("i.state === 'draft' && i.photo_available"),
    'loadState doit détecter si le brouillon a sa photo disponible'
  );
  assert.ok(
    modalCode.includes("setMode('VIEW')"),
    'loadState doit basculer en mode VIEW dès que la photo est reçue'
  );
});

test('P1-B: PhotoMysteryModal guards against double-tap on challenge publication', () => {
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert.ok(
    modalCode.includes('if (publishing) return;'),
    'handlePublish doit rejeter les appuis multiples pendant la publication'
  );
});

test('P1-B: web/photo-capture SUCCESS screen provides explicit return instructions', () => {
  const webCode = fs.readFileSync(webCapturePath, 'utf8');

  assert.ok(
    webCode.includes('Retournez maintenant dans'),
    'L écran SUCCESS doit indiquer explicitement de retourner dans l application'
  );
  assert.ok(
    webCode.includes('PubRush'),
    'L écran SUCCESS doit citer PubRush'
  );
});
