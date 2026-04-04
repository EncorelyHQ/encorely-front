import React from 'react';
import { Tabs, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet, Platform, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function TabIcon({ name, label, color, focused }: { name: any, label: string, color: string, focused: boolean }) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemActive]}>
      <Ionicons name={name} size={22} color={color} />
      <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// Reusable custom button that completely overrides React Navigation's default bounds
const CustomTabButton = (props: any, name: string, activeName: string, label: string, focused: boolean) => {
  const color = focused ? '#F366FF' : 'rgba(255,255,255,0.5)';
  
  return (
    <TouchableOpacity
      {...props}
      activeOpacity={0.8}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
    >
      <TabIcon name={focused ? activeName : name} label={label} color={color} focused={focused} />
    </TouchableOpacity>
  );
};

export default function MainTabsLayout() {
  const pathname = usePathname();

  const isTabFocused = (tabName: string) => {
    if (tabName === 'index') return pathname === '/' || pathname === '';
    return pathname.startsWith(`/${tabName}`);
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarBackground: () => (
          <View style={styles.blurContainer}>
             <BlurView 
               intensity={80} 
               tint="dark" 
               style={StyleSheet.absoluteFill} 
             />
             <View style={styles.darkOverlay} />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarButton: (props) => CustomTabButton(props, 'musical-notes-outline', 'musical-notes', 'Discover', isTabFocused('index')),
        }}
      />
      <Tabs.Screen
        name="swipe"
        options={{
          href: null, // hidden from tab bar — redirects to index
        }}
      />
      <Tabs.Screen
        name="radar"
        options={{
          tabBarButton: (props) => CustomTabButton(props, 'planet-outline', 'planet', 'Radar', isTabFocused('radar')),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          tabBarButton: (props) => CustomTabButton(props, 'chatbubbles-outline', 'chatbubbles', 'Matches', isTabFocused('matches')),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarButton: (props) => CustomTabButton(props, 'person-outline', 'person', 'Perfil', isTabFocused('profile')),
        }}
      />
    </Tabs>

  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: '6%',
    right: '6%',
    height: 64,
    borderRadius: 32,
    borderTopWidth: 0,
    elevation: 4,
    shadowColor: '#F366FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    backgroundColor: 'transparent',
    paddingBottom: 0,
    paddingTop: 0,
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(243, 102, 255, 0.15)',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24,24,24,0.5)',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    minWidth: 56,
    paddingHorizontal: 12,
    borderRadius: 99,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  tabItemActive: {
    backgroundColor: 'rgba(243, 102, 255, 0.15)',
  },
  tabLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  }
});
