import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.avatarWrap}>
          <MaterialCommunityIcons name="account-circle" size={56} color="#E5D76A" />
        </View>
        <View style={styles.greetingBlock}>
          <Text style={styles.hi}>Hi</Text>
          <Text style={styles.sub}>
            {user ? `Signed in as ${phoneLabel ?? 'member'}` : "You haven't logged in yet"}
          </Text>
        </View>
      </View>

      <View style={styles.savingsCard}>
        <View style={styles.savingsHeader}>
          <Text style={styles.savingsHeaderText}>Start your savings journey with Qpon</Text>
        </View>
        <View style={styles.savingsBody}>
          <View style={styles.savingsCol}>
            <View style={styles.savingsLabelRow}>
              <Text style={styles.savingsLabel}>Qpon Coins</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#B0B0B0" />
            </View>
            <Text style={styles.savingsValue}>0</Text>
          </View>
          <View style={styles.vertDivider} />
          <View style={styles.savingsCol}>
            <View style={styles.savingsLabelRow}>
              <Text style={styles.savingsLabel}>Refund Balance</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#B0B0B0" />
            </View>
            <Text style={styles.savingsValue}>Rp0</Text>
          </View>
          <View style={styles.vertDivider} />
          <View style={styles.savingsCol}>
            <View style={styles.savingsLabelRow}>
              <Text style={styles.savingsLabel}>Coupons</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#B0B0B0" />
            </View>
            <Text style={styles.savingsValue}>0</Text>
          </View>
        </View>
      </View>

      <View style={styles.menuCard}>
        <MenuRow icon="bookmark-outline" label="My Favourites" />
        <MenuRow icon="star-outline" label="My Reviews" />
        <MenuRow icon="help-circle-outline" label="Help Center" />
        <MenuRow icon="cog-outline" label="Settings" />
      </View>

      <Text style={styles.versionText}>Version v2.26.0</Text>

      {!user ? (
        <Pressable style={styles.mainBtn} onPress={openLogin}>
          <Text style={styles.mainBtnText}>Open Qpon App</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.mainBtn} onPress={() => signOut()}>
          <Text style={styles.mainBtnText}>Log out</Text>
        </Pressable>
      )}
    </View>
  );
}

function MenuRow({ icon, label }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string }) {
  return (
    <Pressable style={styles.menuRow}>
      <View style={styles.menuLeft}>
        <MaterialCommunityIcons name={icon} size={20} color={Brand.black} />
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#9A9A9A" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    padding: 14,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    marginTop: 8,
    backgroundColor: '#FFFEE7',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFF2AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  greetingBlock: {
    flex: 1,
  },
  hi: {
    fontSize: 24,
    fontWeight: '800',
    color: Brand.black,
    lineHeight: 26,
  },
  sub: {
    marginTop: 2,
    fontSize: 11,
    color: '#8D8D8D',
    fontWeight: '500',
  },
  savingsCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Brand.yellow,
    overflow: 'hidden',
    marginBottom: 12,
  },
  savingsHeader: {
    backgroundColor: Brand.yellow,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  savingsHeaderText: {
    fontSize: 16,
    fontWeight: '900',
    color: Brand.black,
    lineHeight: 21,
  },
  savingsBody: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  savingsCol: {
    flex: 1,
    paddingHorizontal: 10,
  },
  savingsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savingsLabel: {
    fontSize: 11,
    color: '#3A3A3A',
    fontWeight: '600',
  },
  savingsValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '900',
    color: Brand.black,
  },
  vertDivider: {
    width: 1,
    backgroundColor: '#EDEDED',
  },
  menuCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.black,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#A0A0A0',
    marginTop: 14,
    marginBottom: 18,
  },
  mainBtn: {
    alignSelf: 'center',
    backgroundColor: Brand.yellow,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  mainBtnText: {
    color: Brand.black,
    fontWeight: '900',
    fontSize: 14,
  },
});
