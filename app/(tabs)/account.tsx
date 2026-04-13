import { StyleSheet, Pressable, ActivityIndicator } from 'react-native';

import { Text, View } from '@/components/Themed';
import { Brand } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { maskPhone } from '@/lib/phone';

export default function AccountScreen() {
  const { user, authLoading, openLogin, signOut } = useAuth();

  if (authLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Brand.yellow} />
      </View>
    );
  }

  const phoneLabel = user?.phone ? maskPhone(user.phone) : null;
  const mockNote = user?.isMock ? ' (dev — not a real server login)' : '';

  return (
    <View style={styles.container}>
      <View style={styles.header} lightColor={Brand.yellowMuted} darkColor="#2a2400">
        <View style={styles.avatar} />
        <View style={styles.greeting}>
          <Text style={styles.hi} lightColor={Brand.black} darkColor="#fff">
            Hi
          </Text>
          <Text style={styles.sub} lightColor={Brand.grey} darkColor="#aaa">
            {user
              ? `Signed in as ${phoneLabel ?? 'member'}${mockNote}`
              : 'You have not logged in yet'}
          </Text>
        </View>
      </View>
      <View style={styles.card} lightColor={Brand.white} darkColor="#1e1e1e">
        <Text style={styles.cardTitle}>Account</Text>
        {user ? (
          <>
            <Text style={styles.body}>
              You are logged in with SMS. Orders and profile options will connect here as we add them.
            </Text>
            <Pressable style={styles.outlineBtn} onPress={() => signOut()}>
              <Text style={styles.outlineBtnText}>Log out</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.body}>
              Log in with your Bangladesh mobile number. We will send a one-time code by SMS (via
              Supabase).
            </Text>
            <Pressable style={styles.primaryBtn} onPress={openLogin}>
              <Text style={styles.primaryBtnText}>Log in</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Brand.yellow,
  },
  greeting: {
    flex: 1,
  },
  hi: {
    fontSize: 22,
    fontWeight: '800',
  },
  sub: {
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    margin: 16,
    padding: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.85,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: Brand.yellow,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontWeight: '700',
    fontSize: 16,
    color: Brand.black,
  },
  outlineBtn: {
    borderWidth: 2,
    borderColor: Brand.black,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  outlineBtnText: {
    fontWeight: '700',
    fontSize: 16,
    color: Brand.black,
  },
});
