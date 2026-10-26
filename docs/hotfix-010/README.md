# HOTFIX-010 — Résolution du crash NavigationContainer sur iPhone à la création de barathon

**Verdict : FIXED**

## Cause racine

Dans `mobile/src/hooks/useUnsavedNavigation.ts` (introduit lors de UX-NAV-001) :
- Les hooks `useIsFocused` et `usePreventRemove` étaient importés depuis `@react-navigation/native` au lieu de `expo-router`.
- Dans l'environnement Expo Router (Expo SDK 58), la hiérarchie de navigation est gérée par les contextes internes d'Expo Router (`expo-router/build/react-navigation/core/NavigationContext.js`).
- Le module `@react-navigation/native` (qui réexporte `@react-navigation/core`) utilise une instance distincte de `NavigationContext` (non globale, non instanciée par Expo Router).
- En appelant `usePreventRemove(...)` depuis `@react-navigation/native`, celui-ci appelle `useNavigation()` de `@react-navigation/core`, constate que `NavigationContext === undefined` et lève immédiatement l'exception non gérée :
  `Error: Couldn't find a navigation object. Is your component inside NavigationContainer?`
  Stack : `CreateBarathonScreen → WrappedScreenComponent → Expo Router`.

## Correctifs appliqués

1. **`mobile/src/hooks/useUnsavedNavigation.ts`** :
   - Remplacement de l'import : `import { useNavigation, useIsFocused, usePreventRemove } from 'expo-router'`.
   - Prise en charge du callback `({ data, repeat })` conforme à Expo Router avec fallback sur `navigation.dispatch(data.action)`.
2. **`mobile/src/features/barathon_recap/screens/BarathonRecapScreen.tsx`** :
   - Remplacement de l'import de `usePreventRemove` depuis `expo-router` au lieu de `@react-navigation/native`.
   - Utilisation de `import type { NavigationProp, ParamListBase }` pour les types TypeScript.
3. **`mobile/src/features/create_barathon/screens/CreateBarathonMapScreen.tsx`** :
   - Remplacement de l'import de `useRoute` depuis `expo-router` au lieu de `@react-navigation/native`.
   - Conservation de `CommonActions` (fonction pure) et typage strict.
4. **Autres écrans (`ActiveBarathonScreen`, `BarathonStopSummaryScreen`, `LoginScreen`, `RegisterScreen`, `ResetPasswordScreen`)** :
   - Conversion des imports `@react-navigation/native` en `import type` pour éviter toute instanciation accidentelle au runtime.
5. **Tests de non-régression (`mobile/tests/hotfix-010.test.cjs`)** :
   - Reproduction de l'exception levée par `@react-navigation/native`.
   - Validation du montage réel de `CreateBarathonScreen` avec `useUnsavedNavigation` non mocké.
   - Validation du parcours complet : création → sélection des bars → récapitulatif → retour carte → retour création avec conservation des paramètres.
   - Validation du montage de `BarathonRecapScreen`.

## Validations

- **Backend** : 98/98 tests passants (`pytest`).
- **Mobile** : 68/68 tests passants (`node --test tests/*.test.cjs`).
- **TypeScript** : 0 erreur mobile et web (`tsc --noEmit`).
