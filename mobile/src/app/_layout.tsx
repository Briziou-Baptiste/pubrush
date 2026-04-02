import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="home" />
      <Stack.Screen name="planned"
          options={{ gestureEnabled: false }}
    />
      <Stack.Screen name="past" />
      <Stack.Screen name="create-barathon" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="create-barathon-map" />
      <Stack.Screen name="create-barathon-recap" />
          <Stack.Screen name="barathon-details" />
          <Stack.Screen name="active-barathon" />
          <Stack.Screen name="barathon-stop-summary" />
    </Stack>
  );
}
