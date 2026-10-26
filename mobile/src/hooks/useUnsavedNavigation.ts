import { useNavigation, useIsFocused, usePreventRemove } from 'expo-router';
import { Alert } from 'react-native';

export function useUnsavedNavigation(dirty: boolean, busy = false, completionRoute?: string) {
  const navigation = useNavigation();
  const focused = useIsFocused();
  usePreventRemove(focused && (dirty || busy), ({ data, repeat }) => {
    // A successful start may navigate through either the REST response or its server event.
    const payload = data?.action?.payload as { name?: string } | undefined;
    if (completionRoute && data?.action?.type === 'REPLACE' && payload?.name === completionRoute) {
      if (typeof repeat === 'function') repeat();
      else navigation.dispatch(data.action);
      return;
    }
    if (busy) {
      Alert.alert('Enregistrement en cours', 'Patiente un instant avant de quitter cet écran.');
      return;
    }
    Alert.alert('Modifications non enregistrées',
      'Quitter cet écran et abandonner les modifications ?', [
        { text: 'Rester', style: 'cancel' },
        {
          text: 'Abandonner',
          style: 'destructive',
          onPress: () => {
            if (typeof repeat === 'function') repeat();
            else navigation.dispatch(data.action);
          },
        },
      ]);
  });
}
