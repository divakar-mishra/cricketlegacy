import { GlassAlert } from '../components/GlassAlertModal';
import { formatClubCurrency } from '../game/finance';
import type { FacilityUpgradePaymentMethod } from '../game/manager';

export interface FacilityUpgradePromptInput {
  facilityLabel: string;
  currentLevel: number;
  cashCost: number;
  clubBalance: number;
  tokenCount: number;
}

export interface FacilityUpgradePromptCopy {
  title: string;
  message: string;
  cashButtonLabel: string;
  cashAvailable: boolean;
  tokenButtonLabel?: string;
}

/** One source of truth for the payment details shown on every facility screen. */
export function facilityUpgradePromptCopy(
  input: FacilityUpgradePromptInput,
): FacilityUpgradePromptCopy {
  const tokenCount = Math.max(0, Math.floor(input.tokenCount));
  const cashAvailable = input.clubBalance >= input.cashCost;
  const paymentInstruction =
    tokenCount > 0
      ? 'Choose Club Balance or one optional facility token.'
      : 'Confirm this Club Balance upgrade.';

  return {
    title: `Upgrade ${input.facilityLabel}`,
    message: [
      `${input.facilityLabel} · Level ${input.currentLevel} → ${input.currentLevel + 1}`,
      `Cash cost · ${formatClubCurrency(input.cashCost)}`,
      `Club Balance · ${formatClubCurrency(input.clubBalance)}`,
      `Facility tokens · ${tokenCount}`,
      '',
      paymentInstruction,
      'Normal seasonal upkeep still applies.',
    ].join('\n'),
    cashButtonLabel: cashAvailable
      ? `Pay ${formatClubCurrency(input.cashCost)} from Club Balance`
      : `Club Balance short by ${formatClubCurrency(input.cashCost - input.clubBalance)}`,
    cashAvailable,
    tokenButtonLabel: tokenCount > 0 ? 'Use 1 optional token' : undefined,
  };
}

/**
 * Present an explicit payment choice. An unavailable method stays visible but
 * disabled, and the selected method is passed through unchanged.
 */
export function confirmFacilityUpgrade(
  input: FacilityUpgradePromptInput,
  onSelect: (paymentMethod: FacilityUpgradePaymentMethod) => void,
): void {
  const copy = facilityUpgradePromptCopy(input);
  GlassAlert.alert(
    copy.title,
    copy.message,
    [
      { text: 'Cancel', style: 'cancel' },
      ...(copy.tokenButtonLabel
        ? [
            {
              text: copy.tokenButtonLabel,
              onPress: () => onSelect('TOKEN'),
            },
          ]
        : []),
      {
        text: copy.cashButtonLabel,
        disabled: !copy.cashAvailable,
        onPress: () => onSelect('CLUB_BUDGET'),
      },
    ],
    { cancelable: true },
  );
}
