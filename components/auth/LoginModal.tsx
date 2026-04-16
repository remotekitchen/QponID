import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { PRIVACY_URL, TERMS_URL } from '@/constants/legalUrls';
import { Brand } from '@/constants/Colors';
import { sendFcmTokenAfterLogin } from '@/lib/fcm';
import { loginWithEmail, loginWithGoogle, loginWithPhone } from '@/lib/login';
import { registerUser } from '@/lib/register';

type AuthMode = 'login' | 'register';
type LoginMethod = 'phone' | 'email' | 'google';

export default function LoginModal() {
  const { loginOpen, closeLogin, signInWithBackend } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('phone');
  const [localPhone, setLocalPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const reset = useCallback(() => {
    setMode('login');
    setLoginMethod('phone');
    setLocalPhone('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setReferredBy('');
    setError(null);
    setRegistering(false);
    setLoggingIn(false);
    setGoogleBusy(false);
  }, []);

  useEffect(() => {
    if (loginOpen) reset();
  }, [loginOpen, reset]);

  const handleClose = useCallback(() => {
    reset();
    closeLogin();
  }, [closeLogin, reset]);

  const openTerms = () => WebBrowser.openBrowserAsync(TERMS_URL);
  const openPrivacy = () => WebBrowser.openBrowserAsync(PRIVACY_URL);

  const finalizeLogin = async (token: string, user_info: unknown) => {
    await signInWithBackend(token, user_info);
    const id =
      user_info && typeof user_info === 'object'
        ? ((user_info as any).id ?? (user_info as any).user_id ?? (user_info as any).uuid)
        : null;
    if (typeof id === 'string' && id) {
      await sendFcmTokenAfterLogin(id, token);
    }
    reset();
    closeLogin();
    Alert.alert('Welcome', 'Login successful.');
  };

  const login = async () => {
    setError(null);
    setLoggingIn(true);
    try {
      if (loginMethod === 'phone') {
        const { token, user_info } = await loginWithPhone({ phoneLocal: localPhone, password });
        await finalizeLogin(token, user_info);
      } else if (loginMethod === 'email') {
        const { token, user_info } = await loginWithEmail({ email, password });
        await finalizeLogin(token, user_info);
      } else {
        setError('Use the Google button to sign in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not login now.');
    } finally {
      setLoggingIn(false);
    }
  };

  const googleLogin = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      // NOTE: This uses "Google OAuth via AuthSession" without extra config screens.
      // You must set the correct redirect/Google client IDs in your Expo project for production.
      const redirectUri = AuthSession.makeRedirectUri();
      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
      };

      const request = new AuthSession.AuthRequest({
        clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',
        redirectUri,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.Token,
        extraParams: { prompt: 'select_account' },
      });

      await request.makeAuthUrlAsync(discovery);
      const result = await request.promptAsync(discovery);
      if (result.type !== 'success') {
        if (result.type !== 'dismiss' && result.type !== 'cancel') setError('Google login cancelled.');
        return;
      }
      const accessToken =
        (result.params && typeof (result.params as any).access_token === 'string'
          ? (result.params as any).access_token
          : null) ?? null;
      if (!accessToken) {
        setError('Google login failed: no access token returned.');
        return;
      }
      const { token, user_info } = await loginWithGoogle({ accessToken, idToken: '' });
      await finalizeLogin(token, user_info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const register = async () => {
    setError(null);

    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (confirmPassword !== password) {
      setError('Confirm password does not match.');
      return;
    }

    setRegistering(true);
    try {
      await registerUser({
        firstName,
        lastName,
        email,
        password,
        phoneLocal: localPhone,
        referredBy,
      });
      setMode('login');
      setError(null);
      setPassword('');
      setConfirmPassword('');
      Alert.alert('Registration successful', 'Your account was created. Please log in now.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register now.');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <Modal
      visible={loginOpen}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Dismiss" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ width: 36 }} />
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={handleClose}
                style={styles.closeBtn}
                hitSlop={12}
                accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={22} color={Brand.black} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetBody}>
              <Text style={styles.title}>Login / Register</Text>
              <Text style={styles.subtitle}>Use your account to unlock more offers</Text>

              <View style={styles.switchWrap}>
                <Pressable
                  style={[styles.switchBtn, mode === 'login' && styles.switchBtnActive]}
                  onPress={() => {
                    setMode('login');
                    setError(null);
                  }}>
                  <Text style={[styles.switchText, mode === 'login' && styles.switchTextActive]}>Login</Text>
                </Pressable>
                <Pressable
                  style={[styles.switchBtn, mode === 'register' && styles.switchBtnActive]}
                  onPress={() => {
                    setMode('register');
                    setError(null);
                  }}>
                  <Text style={[styles.switchText, mode === 'register' && styles.switchTextActive]}>Register</Text>
                </Pressable>
              </View>

              {mode === 'login' && (
                <>
                  <View style={styles.methodWrap}>
                    <Pressable
                      style={[styles.methodBtn, loginMethod === 'phone' && styles.methodBtnActive]}
                      onPress={() => {
                        setLoginMethod('phone');
                        setError(null);
                      }}>
                      <Text style={[styles.methodText, loginMethod === 'phone' && styles.methodTextActive]}>Phone</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.methodBtn, loginMethod === 'email' && styles.methodBtnActive]}
                      onPress={() => {
                        setLoginMethod('email');
                        setError(null);
                      }}>
                      <Text style={[styles.methodText, loginMethod === 'email' && styles.methodTextActive]}>Email</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.methodBtn, loginMethod === 'google' && styles.methodBtnActive]}
                      onPress={() => {
                        setLoginMethod('google');
                        setError(null);
                      }}>
                      <Text style={[styles.methodText, loginMethod === 'google' && styles.methodTextActive]}>Google</Text>
                    </Pressable>
                  </View>

                  {loginMethod === 'phone' ? (
                    <>
                      <View style={styles.phoneRow}>
                        <Pressable
                          style={styles.country}
                          onPress={() =>
                            Alert.alert('Country', 'Hungry Tiger currently supports Bangladesh (+880) only.')
                          }>
                          <Text style={styles.countryText}>+880</Text>
                          <MaterialCommunityIcons name="chevron-down" size={18} color={Brand.black} />
                        </Pressable>
                        <View style={styles.divider} />
                        <TextInput
                          value={localPhone}
                          onChangeText={(t) => {
                            setLocalPhone(t);
                            setError(null);
                          }}
                          placeholder="Phone number (e.g. 01712345678)"
                          placeholderTextColor="#9E9E9E"
                          keyboardType="phone-pad"
                          style={styles.phoneInput}
                        />
                      </View>
                      <TextInput
                        value={password}
                        onChangeText={(t) => {
                          setPassword(t);
                          setError(null);
                        }}
                        placeholder="Password"
                        placeholderTextColor="#9E9E9E"
                        secureTextEntry
                        style={styles.input}
                      />
                      <Pressable
                        style={[styles.primaryBtn, (loggingIn || registering) && styles.primaryBtnDisabled]}
                        onPress={login}
                        disabled={loggingIn || registering}>
                        {loggingIn ? (
                          <ActivityIndicator color="#333" />
                        ) : (
                          <Text style={styles.primaryBtnText}>Login</Text>
                        )}
                      </Pressable>
                    </>
                  ) : null}

                  {loginMethod === 'email' ? (
                    <>
                      <TextInput
                        value={email}
                        onChangeText={(t) => {
                          setEmail(t);
                          setError(null);
                        }}
                        placeholder="Email"
                        placeholderTextColor="#9E9E9E"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={styles.input}
                      />
                      <TextInput
                        value={password}
                        onChangeText={(t) => {
                          setPassword(t);
                          setError(null);
                        }}
                        placeholder="Password"
                        placeholderTextColor="#9E9E9E"
                        secureTextEntry
                        style={styles.input}
                      />
                      <Pressable
                        style={[styles.primaryBtn, (loggingIn || registering) && styles.primaryBtnDisabled]}
                        onPress={login}
                        disabled={loggingIn || registering}>
                        {loggingIn ? (
                          <ActivityIndicator color="#333" />
                        ) : (
                          <Text style={styles.primaryBtnText}>Login</Text>
                        )}
                      </Pressable>
                    </>
                  ) : null}

                  {loginMethod === 'google' ? (
                    <>
                      <Pressable
                        style={[styles.googleBtn, googleBusy && styles.primaryBtnDisabled]}
                        onPress={googleLogin}
                        disabled={googleBusy}>
                        {googleBusy ? (
                          <ActivityIndicator color="#333" />
                        ) : (
                          <Text style={styles.googleBtnText}>Continue with Google</Text>
                        )}
                      </Pressable>
                      {!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ? (
                        <Text style={styles.helper}>
                          Set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in `.env` to enable Google login.
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}

              {mode === 'register' && (
                <>
                  <View style={styles.rowTwo}>
                    <TextInput
                      value={firstName}
                      onChangeText={(t) => {
                        setFirstName(t);
                        setError(null);
                      }}
                      placeholder="First name"
                      placeholderTextColor="#9E9E9E"
                      style={[styles.input, styles.flexOne]}
                      autoCapitalize="words"
                    />
                    <TextInput
                      value={lastName}
                      onChangeText={(t) => {
                        setLastName(t);
                        setError(null);
                      }}
                      placeholder="Last name"
                      placeholderTextColor="#9E9E9E"
                      style={[styles.input, styles.flexOne]}
                      autoCapitalize="words"
                    />
                  </View>

                  <TextInput
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      setError(null);
                    }}
                    placeholder="Email"
                    placeholderTextColor="#9E9E9E"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />

                  <View style={styles.phoneRow}>
                    <Pressable
                      style={styles.country}
                      onPress={() =>
                        Alert.alert('Country', 'Hungry Tiger currently supports Bangladesh (+880) only.')
                      }>
                      <Text style={styles.countryText}>+880</Text>
                      <MaterialCommunityIcons name="chevron-down" size={18} color={Brand.black} />
                    </Pressable>
                    <View style={styles.divider} />
                    <TextInput
                      value={localPhone}
                      onChangeText={(t) => {
                        setLocalPhone(t);
                        setError(null);
                      }}
                      placeholder="Phone number"
                      placeholderTextColor="#9E9E9E"
                      keyboardType="phone-pad"
                      style={styles.phoneInput}
                    />
                  </View>

                  <TextInput
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      setError(null);
                    }}
                    placeholder="Password"
                    placeholderTextColor="#9E9E9E"
                    secureTextEntry
                    style={styles.input}
                  />

                  <TextInput
                    value={confirmPassword}
                    onChangeText={(t) => {
                      setConfirmPassword(t);
                      setError(null);
                    }}
                    placeholder="Confirm password"
                    placeholderTextColor="#9E9E9E"
                    secureTextEntry
                    style={styles.input}
                  />

                  <TextInput
                    value={referredBy}
                    onChangeText={(t) => {
                      setReferredBy(t);
                      setError(null);
                    }}
                    placeholder="Referral code (optional)"
                    placeholderTextColor="#9E9E9E"
                    autoCapitalize="characters"
                    style={styles.input}
                  />

                  <Pressable
                    style={[styles.primaryBtn, registering && styles.primaryBtnDisabled]}
                    onPress={register}
                    disabled={registering}>
                    {registering ? (
                      <ActivityIndicator color="#333" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Create account</Text>
                    )}
                  </Pressable>
                </>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Text style={styles.legal}>
                Continuing this process means you agree to the{' '}
                <Text style={styles.legalLink} onPress={openTerms}>
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text style={styles.legalLink} onPress={openPrivacy}>
                  Privacy Policy
                </Text>
                .
              </Text>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  kav: {
    maxHeight: '88%',
  },
  sheet: {
    backgroundColor: Brand.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginTop: 8,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.greyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Brand.black,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Brand.grey,
    marginBottom: 20,
  },
  switchWrap: {
    flexDirection: 'row',
    backgroundColor: Brand.greyLight,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  switchBtnActive: {
    backgroundColor: Brand.yellow,
  },
  switchText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.grey,
  },
  switchTextActive: {
    color: Brand.black,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  flexOne: {
    flex: 1,
    marginBottom: 0,
  },
  input: {
    backgroundColor: Brand.greyLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: Brand.black,
    marginBottom: 12,
  },
  methodWrap: {
    flexDirection: 'row',
    backgroundColor: Brand.greyLight,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 6,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  methodBtnActive: {
    backgroundColor: Brand.yellow,
  },
  methodText: {
    fontSize: 13,
    fontWeight: '800',
    color: Brand.grey,
  },
  methodTextActive: {
    color: Brand.black,
  },
  googleBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: Brand.yellow,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: Brand.black,
  },
  helper: {
    fontSize: 12,
    color: Brand.grey,
    marginBottom: 10,
    lineHeight: 18,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.greyLight,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 52,
    marginBottom: 16,
  },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 8,
  },
  countryText: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.black,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#D0D0D0',
    marginRight: 10,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: Brand.black,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  primaryBtn: {
    backgroundColor: Brand.yellowMuted,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.black,
  },
  error: {
    color: '#C62828',
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  legal: {
    fontSize: 11,
    color: Brand.grey,
    lineHeight: 16,
    marginTop: 8,
  },
  legalLink: {
    textDecorationLine: 'underline',
    color: '#1565C0',
    fontWeight: '600',
  },
});
