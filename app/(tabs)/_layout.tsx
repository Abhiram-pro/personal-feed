import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: 'feed',
};

export default function TabLayout() {
  const colorScheme = useColorScheme();

  // Prevent back button from exiting the app (Android)
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior (exiting app)
      return true;
    });

    return () => backHandler.remove();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#94B2C7',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#1A2933',
          borderTopColor: '#243847',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: 'System',
          fontWeight: '500',
          fontSize: 12,
        },
      }}>
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="doc.text.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null, // Hide this tab for now
        }}
      />
    </Tabs>
  );
}
