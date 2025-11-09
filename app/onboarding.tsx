import { StyleSheet, View, Text, Pressable, ImageBackground, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Prevent back navigation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true;
    });

    return () => backHandler.remove();
  }, []);

  const handleGetStarted = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.contentContainer}>
        {/* Background Image Section */}
        <View style={styles.imageSection}>
          <ImageBackground
            source={require('@/assets/images/onboarding-background.png')}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
        </View>

        {/* Text Content */}
        <View style={[styles.textSection, { paddingTop: insets.top || 20 }]}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Focus on What Matters</Text>
          </View>
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitle}>
              No clutter, no noise. Just meaningful reading.
            </Text>
          </View>
        </View>
      </View>

      {/* Get Started Button */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom || 20 }]}>
        <View style={styles.buttonWrapper}>
          <Pressable
            style={styles.getStartedButton}
            onPress={handleGetStarted}
            android_ripple={{ color: 'rgba(255, 255, 255, 0.1)' }}
          >
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121417',
  },
  contentContainer: {
    flex: 1,
  },
  imageSection: {
    flex: 1,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#121417',
  },
  textSection: {
    alignSelf: 'stretch',
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 35,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitleContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#121417',
  },
  buttonWrapper: {
    alignSelf: 'stretch',
  },
  getStartedButton: {
    backgroundColor: '#4DA6E5',
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  getStartedButtonText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#121417',
    textAlign: 'center',
  },
});
