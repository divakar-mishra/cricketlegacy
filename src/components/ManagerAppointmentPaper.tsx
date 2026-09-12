import { Image, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { ContractMomentModal } from './ContractMomentModal';
import { formatClubCurrency } from '../game/finance';

export function ManagerAppointmentPaper({
  club,
  salary,
  year,
  onContinue,
}: {
  club: string;
  salary?: number;
  year?: number;
  onContinue: () => void;
}) {
  return (
    <ContractMomentModal onContinue={onContinue}>
      <View style={styles.paper}>
        <View style={styles.masthead}>
          <Text style={styles.brand}>CRICKET LEGACY</Text>
          <Text style={styles.publication}>THE CRICKET CHRONICLE</Text>
        </View>
        <Text style={styles.edition}>APPOINTMENT SPECIAL{year ? ` · ${year}` : ''}</Text>
        <Text style={styles.headline}>NEW MANAGER APPOINTED</Text>
        <View style={styles.banner}>
          <Text style={styles.club}>{club.toUpperCase()}</Text>
        </View>
        <Image
          source={require('../../assets/generated/season-pass-manager-office.png')}
          style={styles.art}
          resizeMode="cover"
          accessible={false}
        />
        <Text style={styles.caption}>THE BOARDROOM · EDITORIAL ILLUSTRATION</Text>
        <Text style={styles.deck}>A new chapter at {club}</Text>
        <Text style={styles.body}>
          Your appointment is confirmed. You take charge of {club} as the club’s manager.
        </Text>
        {salary !== undefined && (
          <View style={styles.terms}>
            <Text style={styles.label}>AGREED SEASON SALARY</Text>
            <Text style={styles.salary}>{formatClubCurrency(salary)}</Text>
          </View>
        )}
        <Text style={styles.footer}>CLUB CRICKET · THE NEXT CHAPTER STARTS HERE</Text>
      </View>
    </ContractMomentModal>
  );
}
const styles = StyleSheet.create({
  paper: {
    margin: 12,
    backgroundColor: '#f4eedf',
    padding: 14,
    borderBottomWidth: 4,
    borderColor: '#9a2027',
  },
  masthead: { backgroundColor: '#9a2027', padding: 12 },
  brand: { color: '#fff4df', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  publication: { color: '#fff', fontSize: 27, fontWeight: '900', marginTop: 5 },
  edition: {
    color: '#514a40',
    fontSize: 10,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderColor: '#292723',
  },
  headline: {
    color: '#171918',
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 41,
    marginVertical: 14,
  },
  banner: { backgroundColor: '#202522', padding: 12 },
  club: { color: '#fff8e7', fontSize: 22, fontWeight: '800' },
  art: { width: '100%', height: 170 },
  caption: { color: '#665d50', fontSize: 8, marginTop: 4 },
  deck: { color: '#262721', fontFamily: 'serif', fontSize: 24, fontWeight: '700', marginTop: 16 },
  body: { color: '#3c3c34', fontFamily: 'serif', fontSize: 16, lineHeight: 24, marginTop: 10 },
  terms: {
    borderTopWidth: 2,
    borderBottomWidth: 1,
    borderColor: '#38382e',
    paddingVertical: 12,
    marginTop: 18,
  },
  label: { color: '#665d50', fontSize: 10, letterSpacing: 1 },
  salary: { color: '#22271f', fontSize: 23, fontWeight: '800', marginTop: 4 },
  footer: { color: '#665d50', fontSize: 9, marginTop: 18 },
});
