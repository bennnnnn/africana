import React from 'react';
import { Stack } from 'expo-router';

export default function LikesLayout() {
  return (
    <Stack
      initialRouteName="index"
      screenOptions={{ headerShown: false, animation: 'none' }}
    />
  );
}
