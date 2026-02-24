import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="plan" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="setup" />
      <Stack.Screen name="destinations" />
      <Stack.Screen name="planner" />
      <Stack.Screen name="review" />
    </Stack>
  );
}
