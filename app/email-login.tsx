import { StyleSheet, View, Text, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function EmailLoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      // Navigate to interests after successful authentication
      router.replace('/interests');
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      
      <View style={styles.contentContainer}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Sign up to get started' : 'Sign in to continue'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9EADB8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9EADB8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <Pressable 
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Text>
          </Pressable>

          <Pressable 
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading}
          >
            <Text style={styles.switchButtonText}>
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Text>
          </Pressable>
        </View>

        {/* Back Button */}
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>Back to Login Options</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121417',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  titleContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 16,
    color: '#9EADB8',
    textAlign: 'center',
  },
  formContainer: {
    gap: 16,
  },
  input: {
    backgroundColor: '#293338',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  submitButton: {
    backgroundColor: '#4DA6E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 16,
    color: '#121417',
  },
  switchButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  switchButtonText: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    color: '#9EADB8',
  },
  backButton: {
    marginTop: 32,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: 14,
    color: '#9EADB8',
  },
});
