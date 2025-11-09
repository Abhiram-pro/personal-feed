import { StyleSheet, View, Text, Pressable, ImageBackground, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    Alert.alert(
      'Google Sign-In Setup Required',
      'Google Sign-In requires additional configuration in Google Cloud Console.\n\nFor now, please use:\n• Email authentication\n• Guest mode\n\nSee GOOGLE_SIGNIN_FIX.md for setup instructions.',
      [
        { text: 'Use Email Instead', onPress: handleEmailLogin },
        { text: 'OK', style: 'cancel' }
      ]
    );
    
    // Uncomment this when Google Sign-In is properly configured:
    /*
    setLoading(true);
    try {
      await signInWithGoogle();
      // Navigation will be handled by auth state change
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
    */
  };

  const handleEmailLogin = () => {
    router.push('/email-login');
  };

  const handleGuestLogin = () => {
    router.replace('/interests');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Background Image Section */}
      <ImageBackground
        source={require('@/assets/images/login-background.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Content Section */}
      <View style={styles.contentContainer}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Personal Feed</Text>
        </View>

        {/* Google Button */}
        <View style={styles.buttonWrapper}>
          <Pressable 
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            android_ripple={{ color: 'rgba(255, 255, 255, 0.1)' }}
          >
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </Pressable>
        </View>

        {/* Email Button */}
        <View style={styles.buttonWrapper}>
          <Pressable 
            style={styles.emailButton}
            onPress={handleEmailLogin}
            android_ripple={{ color: 'rgba(255, 255, 255, 0.1)' }}
          >
            <Text style={styles.emailButtonText}>Continue with Email</Text>
          </Pressable>
        </View>

        {/* Or Divider */}
        <View style={styles.dividerContainer}>
          <Text style={styles.dividerText}>or</Text>
        </View>

        {/* Guest Login */}
        <View style={styles.guestContainer}>
          <Pressable onPress={handleGuestLogin}>
            <Text style={styles.guestText}>Continue as Guest</Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom Spacer */}
      <View style={styles.bottomSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121417',
  },
  backgroundImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#121417',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
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
  buttonWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  googleButton: {
    backgroundColor: '#4DA6E5',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 200,
  },
  googleButtonText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 21,
    color: '#121417',
    textAlign: 'center',
  },
  emailButton: {
    backgroundColor: '#293338',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 200,
  },
  emailButtonText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  dividerContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    alignItems: 'center',
  },
  dividerText: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#9EADB8',
    textAlign: 'center',
  },
  guestContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    alignItems: 'center',
  },
  guestText: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#9EADB8',
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 20,
  },
});
