import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { isMockAuthAvailable } from '@/lib/authMode';
import { isAuthConfigured, supabase } from '@/lib/supabase';
import { toBangladeshE164 } from '@/lib/phone';

type Step = 'phone' | 'otp';

export default function LoginModal() {
  const { loginOpen, closeLogin, signInWithMockPhone } = useAuth();
  const mockAuthOn = isMockAuthAvailable();
  const [step, setStep] = useState<Step>('phone');
  const [localPhone, setLocalPhone] = useState('');
  const [e164, setE164] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const reset = useCallback(() => {
    setStep('phone');
    setLocalPhone('');
    setE164(null);
    setOtp('');
    setError(null);
    setSending(false);
    setVerifying(false);
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

  const sendOtp = async () => {
    setError(null);
    if (!isAuthConfigured || !supabase) {
      if (mockAuthOn) {
        setError(
          'SMS login is not configured. Use “Continue without SMS (dev)” below, or add Supabase keys in .env and enable Phone auth.'
        );
        return;
      }
      setError(
        'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to a .env file, restart Expo, and enable Phone auth + SMS in your Supabase project.'
      );
      return;
    }

    const phone = toBangladeshE164(localPhone);
    if (!phone) {
      setError('Enter a valid Bangladesh mobile number (e.g. 01712345678 or 1712345678).');
      return;
    }

    setSending(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    setSending(false);

    if (err) {
      setError(err.message);
      return;
    }

    setE164(phone);
    setStep('otp');
    setOtp('');
    Alert.alert('Code sent', 'Check your SMS for the one-time code.');
  };

  const verifyOtp = async () => {
    setError(null);
    if (!supabase || !e164) {
      setError('Session expired. Request a new code.');
      setStep('phone');
      return;
    }

    const code = otp.replace(/\D/g, '');
    if (code.length < 6) {
      setError('Enter the 6-digit code from SMS.');
      return;
    }

    setVerifying(true);
    const { error: err } = await supabase.auth.verifyOtp({
      phone: e164,
      token: code,
      type: 'sms',
    });
    setVerifying(false);

    if (err) {
      setError(err.message);
      return;
    }

    reset();
    closeLogin();
  };

  const resend = async () => {
    if (!supabase || !e164) return;
    setError(null);
    setSending(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: e164 });
    setSending(false);
    if (err) setError(err.message);
    else Alert.alert('Code sent', 'A new SMS code has been sent.');
  };

  const continueWithoutSms = async () => {
    setError(null);
    const phone = toBangladeshE164(localPhone);
    if (!phone) {
      setError('Enter a valid Bangladesh mobile number (e.g. 01712345678).');
      return;
    }
    try {
      await signInWithMockPhone(phone);
      reset();
      closeLogin();
    } catch {
      setError('Could not save dev session.');
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
              <Text style={styles.title}>Login/Register</Text>
              <Text style={styles.subtitle}>Log in to check out more offers</Text>

              {!isAuthConfigured && mockAuthOn && (
                <View style={styles.configBanner}>
                  <Text style={styles.configBannerText}>
                    No Supabase keys in .env yet — real SMS will not send. You can still use{' '}
                    <Text style={{ fontWeight: '800' }}>Continue without SMS (dev)</Text> after
                    entering a valid BD number (saved only on this device).
                  </Text>
                </View>
              )}
              {!isAuthConfigured && !mockAuthOn && (
                <View style={styles.configBanner}>
                  <Text style={styles.configBannerText}>
                    Supabase env vars missing. Add EXPO_PUBLIC_SUPABASE_URL and
                    EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env.example), restart Expo, and enable Phone
                    auth in Supabase. For local UI testing only, set EXPO_PUBLIC_DEV_MOCK_AUTH=true.
                  </Text>
                </View>
              )}
              {isAuthConfigured && mockAuthOn && (
                <View style={[styles.configBanner, styles.devOnlyBanner]}>
                  <Text style={styles.configBannerText}>
                    Dev mock auth is on (EXPO_PUBLIC_DEV_MOCK_AUTH). You can skip SMS; do not ship
                    this flag to production.
                  </Text>
                </View>
              )}

              {step === 'phone' && (
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
                      placeholder="Please enter phone number"
                      placeholderTextColor="#9E9E9E"
                      keyboardType="phone-pad"
                      style={styles.phoneInput}
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                    />
                  </View>

                  <Pressable
                    style={[styles.primaryBtn, sending && styles.primaryBtnDisabled]}
                    onPress={sendOtp}
                    disabled={sending}>
                    {sending ? (
                      <ActivityIndicator color="#333" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Get OTP</Text>
                    )}
                  </Pressable>

                  {mockAuthOn ? (
                    <Pressable style={styles.devMockBtn} onPress={continueWithoutSms}>
                      <Text style={styles.devMockBtnText}>Continue without SMS (dev)</Text>
                    </Pressable>
                  ) : null}
                </>
              )}

              {step === 'otp' && (
                <>
                  <Text style={styles.otpHint}>Enter the code sent to {e164}</Text>
                  <TextInput
                    value={otp}
                    onChangeText={(t) => {
                      setOtp(t.replace(/\D/g, '').slice(0, 8));
                      setError(null);
                    }}
                    placeholder="6-digit code"
                    placeholderTextColor="#9E9E9E"
                    keyboardType="number-pad"
                    style={styles.otpInput}
                    maxLength={8}
                  />

                  <Pressable
                    style={[styles.primaryBtn, verifying && styles.primaryBtnDisabled]}
                    onPress={verifyOtp}
                    disabled={verifying}>
                    {verifying ? (
                      <ActivityIndicator color="#333" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Verify & log in</Text>
                    )}
                  </Pressable>

                  <View style={styles.otpActions}>
                    <Pressable onPress={() => { setStep('phone'); setOtp(''); setError(null); }}>
                      <Text style={styles.link}>Change number</Text>
                    </Pressable>
                    <Pressable onPress={resend} disabled={sending}>
                      <Text style={[styles.link, sending && { opacity: 0.5 }]}>Resend code</Text>
                    </Pressable>
                  </View>
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
  configBanner: {
    backgroundColor: Brand.yellowMuted,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  configBannerText: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  devOnlyBanner: {
    backgroundColor: '#E8F5E9',
  },
  devMockBtn: {
    borderWidth: 2,
    borderColor: '#2E7D32',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  devMockBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1B5E20',
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
  otpHint: {
    fontSize: 14,
    color: Brand.grey,
    marginBottom: 10,
  },
  otpInput: {
    backgroundColor: Brand.greyLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    color: Brand.black,
    marginBottom: 16,
    textAlign: 'center',
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
  otpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
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
