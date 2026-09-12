import { Image, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { AppText as Text } from './AppText';
import type { ContractOffer } from '../game/career';
import { fonts } from '../theme/fonts';

/** Presentation only: signing and all financial effects remain in the store. */
export function ContractSheet({
  club,
  player,
  offer,
  signed = false,
}: {
  club: string;
  player: string;
  offer: ContractOffer;
  signed?: boolean;
}) {
  return (
    <View style={styles.folder}>
      <Image
        source={require('../../assets/generated/season-pass-manager-office.png')}
        style={styles.office}
        resizeMode="cover"
        accessible={false}
        fadeDuration={0}
      />
      <View style={styles.paper}>
        <Text style={styles.eyebrow}>CRICKET LEGACY · CLUB CONTRACT</Text>
        <Text style={styles.club}>{club}</Text>
        <View style={styles.rule} />
        <Text style={styles.title}>
          {signed ? 'An agreement. A new chapter.' : 'Your next chapter'}
        </Text>
        <Text style={styles.address}>Prepared for {player}</Text>
        <Text style={styles.copy}>
          {signed
            ? 'The following terms have been signed.'
            : 'The club offers the following terms for your cricket career.'}
        </Text>
        {[
          ['Season salary', `${Math.round(offer.wage).toLocaleString()} coins / season`],
          ['Contract length', `${offer.years} year${offer.years === 1 ? '' : 's'}`],
          ['Signing bonus', `${offer.signingBonus.toLocaleString()} coins`],
        ].map(([label, value]) => (
          <View key={label} style={styles.term}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
        <View style={styles.signatureBlock}>
          {signed && (
            <View
              pointerEvents="none"
              style={{ alignSelf: 'flex-end' }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Svg width={100} height={36} viewBox="0 0 100 36">
                <Path d="M4 30 L17 13 L27 23 Z" fill="#c6a34a" />
                <Path d="M4 30 L18 21" stroke="#28231a" strokeWidth={1} />
                <Path d="M17 13 L73 1 Q81 -1 83 8 L86 16 L27 23 Z" fill="#19232c" />
                <Path d="M27 11 L30 22 M70 2 L74 18" stroke="#d7b65d" strokeWidth={3} />
                <Rect
                  x={43}
                  y={8}
                  width={28}
                  height={2}
                  rx={1}
                  fill="#d7b65d"
                  transform="rotate(-12 43 8)"
                />
              </Svg>
            </View>
          )}
          <Text
            accessibilityLabel={signed ? `Signed by ${player}` : 'Awaiting your signature'}
            style={signed ? styles.signature : styles.awaitingSignature}
          >
            {signed ? player : 'Awaiting your signature'}
          </Text>
          {signed && (
            <>
              <View
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Svg width="100%" height={20} viewBox="0 0 300 20">
                  <Path
                    d="M12 12 C70 2 166 2 266 8 C286 10 274 16 240 13 M40 16 C110 10 197 9 252 12"
                    fill="none"
                    stroke="#293b46"
                    strokeWidth={1.2}
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
              <Text style={styles.printedName}>{player}</Text>
            </>
          )}
          <Text style={styles.status}>
            {signed ? 'SIGNED · PLAYER AGREEMENT' : 'PROPOSED TERMS · NOT YET SIGNED'}
          </Text>
        </View>
        <Text style={styles.footnote}>
          In-game contract · All amounts are fictional Wallet Coins.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  folder: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#28251f',
    borderRadius: 12,
    overflow: 'hidden',
    paddingBottom: 12,
  },
  office: { width: '100%', height: 100 },
  paper: {
    marginHorizontal: 10,
    marginTop: -16,
    padding: 20,
    backgroundColor: '#f6eedc',
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#8e2929',
  },
  eyebrow: { color: '#705b3e', fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  club: { color: '#252722', fontSize: 23, fontWeight: '800', marginTop: 8 },
  rule: {
    height: 3,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#b6a580',
    marginVertical: 16,
  },
  title: { fontFamily: 'serif', fontSize: 25, color: '#262721', fontWeight: '700' },
  address: { color: '#433e32', fontSize: 15, marginTop: 14, fontWeight: '700' },
  copy: { color: '#625a4b', fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 14 },
  term: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#d8cbb0' },
  label: { color: '#665c4b', fontSize: 12 },
  value: { color: '#262721', fontSize: 19, fontWeight: '700', marginTop: 4 },
  signatureBlock: {
    marginTop: 26,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#978669',
  },
  signature: {
    fontFamily: fonts.signature,
    fontWeight: '400',
    color: '#293b46',
    fontSize: 42,
    lineHeight: 62,
    paddingHorizontal: 8,
    paddingTop: 6,
    flexShrink: 1,
  },
  awaitingSignature: { fontFamily: 'serif', fontStyle: 'italic', color: '#293b46', fontSize: 23 },
  printedName: { color: '#625a4b', fontSize: 12, marginTop: 6 },
  status: { color: '#7d342b', fontSize: 10, letterSpacing: 1, fontWeight: '700', marginTop: 10 },
  footnote: { color: '#726754', fontSize: 10, lineHeight: 15, marginTop: 14 },
});
