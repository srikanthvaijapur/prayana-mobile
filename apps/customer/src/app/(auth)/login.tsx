import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Button, TextInput } from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth } from '@prayana/shared-services/src/firebase';

// Required for auth redirect to complete properly in Expo Go
WebBrowser.maybeCompleteAuthSession();

/**
 * Google Sign-In Setup Instructions:
 *
 * 1. Go to Firebase Console > Authentication > Sign-in method > Google > Enable
 * 2. Note the "Web client ID" shown there (auto-created by Firebase)
 * 3. Go to Google Cloud Console > APIs & Credentials > OAuth 2.0 Client IDs
 * 4. Create an iOS OAuth Client with bundle ID: com.prayanaai.customer
 * 5. Set both env vars:
 *    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>
 *    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>
 *
 * Until configured, Google Sign-In will show an info alert.
 */

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

// Check if Google auth can work (needs at least iOS client ID on iOS)
const isGoogleConfigured = Platform.select({
  ios: !!GOOGLE_IOS_CLIENT_ID,
  android: !!GOOGLE_WEB_CLIENT_ID,
  default: !!GOOGLE_WEB_CLIENT_ID,
});

export default function LoginScreen() {
  const { setUser, setIsAuthenticated, syncWithBackend } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const signInWithGoogleToken = async (idToken: string) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseUser = userCredential.user;

      setUser(firebaseUser);
      setIsAuthenticated(true);

      try {
        await syncWithBackend(firebaseUser, 'google');
      } catch (syncErr: any) {
        console.warn('[Login] Backend sync failed (non-fatal):', syncErr.message);
      }

      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('[Login] Google Firebase auth error:', error);
      let message = 'Google Sign-In failed. Please try again.';
      if (error.code === 'auth/account-exists-with-different-credential') {
        message = 'An account already exists with this email using a different sign-in method.';
      } else if (error.code === 'auth/invalid-credential') {
        message = 'Invalid credential. Please try again.';
      } else if (error.code === 'auth/user-disabled') {
        message = 'This account has been disabled.';
      }
      Alert.alert('Sign-In Failed', message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isGoogleConfigured) {
      Alert.alert(
        'Google Sign-In Not Configured',
        'To enable Google Sign-In:\n\n' +
        '1. Go to Firebase Console > Auth > Google\n' +
        '2. Get your Web Client ID\n' +
        '3. Create an iOS OAuth Client ID\n' +
        '4. Add to .env:\n' +
        '   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...\n' +
        '   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...\n\n' +
        'Use email or phone login for now.',
      );
      return;
    }

    setIsGoogleLoading(true);
    try {
      // Dynamic import to avoid hook crash when IDs are missing
      const Google = await import('expo-auth-session/providers/google');
      const AuthSession = await import('expo-auth-session');

      const config: any = {};
      if (GOOGLE_WEB_CLIENT_ID) config.clientId = GOOGLE_WEB_CLIENT_ID;
      if (GOOGLE_IOS_CLIENT_ID) config.iosClientId = GOOGLE_IOS_CLIENT_ID;

      // Use AuthSession.makeRedirectUri for proper redirect
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'prayana' });

      const discovery = Google.discovery;
      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
        redirectUri,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.IdToken,
      });

      const result = await request.promptAsync(discovery);

      if (result.type === 'success' && result.params?.id_token) {
        await signInWithGoogleToken(result.params.id_token);
      } else if (result.type === 'error') {
        Alert.alert('Google Sign-In Failed', result.error?.message || 'An error occurred.');
        setIsGoogleLoading(false);
      } else {
        // dismissed/cancelled
        setIsGoogleLoading(false);
      }
    } catch (error: any) {
      console.error('[Login] Google Sign-In error:', error);
      setIsGoogleLoading(false);
      Alert.alert('Error', error.message || 'Could not open Google Sign-In.');
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      setUser(userCredential.user);
      setIsAuthenticated(true);

      try {
        await syncWithBackend(userCredential.user, 'email');
      } catch (syncErr: any) {
        console.warn('[Login] Backend sync failed (non-fatal):', syncErr.message);
      }

      router.replace('/(tabs)');
    } catch (error: any) {
      let message = 'An unexpected error occurred. Please try again.';
      switch (error.code) {
        case 'auth/invalid-email':
          message = 'Please enter a valid email address.';
          break;
        case 'auth/user-disabled':
          message = 'This account has been disabled.';
          break;
        case 'auth/user-not-found':
          message = 'No account found with this email. Try signing up first.';
          break;
        case 'auth/wrong-password':
          message = 'Incorrect password. Please try again.';
          break;
        case 'auth/invalid-credential':
          message = 'Invalid email or password. Please try again.';
          break;
        case 'auth/too-many-requests':
          message = 'Too many failed attempts. Please try again later.';
          break;
      }
      Alert.alert('Sign In Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLogin = () => {
    router.push('/(auth)/phone-login');
  };

  const handleSignUp = () => {
    router.push('/(auth)/signup');
  };

  const handleGuestLogin = () => {
    setUser({
      uid: 'guest-user',
      displayName: 'Guest User',
      email: 'guest@prayana.ai',
      photoURL: null,
      phoneNumber: null,
      getIdToken: async () => 'guest-token',
    });
    setIsAuthenticated(true);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Header */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoIcon}>P</Text>
              </View>
            </View>
            <Text style={styles.brandName}>Prayana AI</Text>
            <Text style={styles.brandSubtitle}>Your Intelligent Journey Companion</Text>
          </View>

          {/* Social Login Options */}
          <View style={styles.formSection}>
            <Button
              title="Continue with Google"
              onPress={handleGoogleLogin}
              variant="outline"
              size="lg"
              fullWidth
              loading={isGoogleLoading}
              icon={<Text style={styles.googleIcon}>G</Text>}
              style={styles.socialButton}
              textStyle={styles.socialButtonText}
            />

            <Button
              title="Continue with Phone"
              onPress={handlePhoneLogin}
              variant="outline"
              size="lg"
              fullWidth
              icon={<Text style={styles.phoneIcon}>📱</Text>}
              style={styles.socialButton}
              textStyle={styles.socialButtonText}
            />

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email Login Form */}
            <TextInput
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />

            <TextInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
            />

            <Button
              title="Sign In"
              onPress={handleEmailLogin}
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              style={styles.signInButton}
            />

            {/* Guest Login for Testing */}
            <TouchableOpacity style={styles.guestButton} onPress={handleGuestLogin} activeOpacity={0.7}>
              <Text style={styles.guestButtonText}>Continue as Guest</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={handleSignUp}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },

  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoIcon: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  brandName: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6b7280',
  },

  // Form Section
  formSection: {
    marginBottom: 32,
  },
  socialButton: {
    marginBottom: 12,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  socialButtonText: {
    color: '#1a1a1a',
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
    marginRight: 4,
  },
  phoneIcon: {
    fontSize: 18,
    marginRight: 4,
  },

  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    fontWeight: '500',
    color: '#9ca3af',
    textTransform: 'lowercase',
  },

  // Sign In Button
  signInButton: {
    marginTop: 4,
  },

  // Guest Button
  guestButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  guestButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#9ca3af',
    textDecorationLine: 'underline',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
});
