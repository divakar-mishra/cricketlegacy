import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNT_PURCHASES_KEY = 'account:purchases:v1';

interface AccountPurchaseState {
  version: 1;
  starterPackBoughtAt?: number;
  starterPackPurchaseToken?: string;
}

let starterPackOwnedThisSession = false;

async function readState(): Promise<AccountPurchaseState> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_PURCHASES_KEY);
    if (!raw) return { version: 1 };
    const parsed = JSON.parse(raw) as Partial<AccountPurchaseState>;
    return {
      version: 1,
      starterPackBoughtAt:
        typeof parsed.starterPackBoughtAt === 'number' ? parsed.starterPackBoughtAt : undefined,
      starterPackPurchaseToken:
        typeof parsed.starterPackPurchaseToken === 'string'
          ? parsed.starterPackPurchaseToken
          : undefined,
    };
  } catch {
    return { version: 1 };
  }
}

export async function hasStarterPackPurchase(): Promise<boolean> {
  if (starterPackOwnedThisSession) return true;
  const state = await readState();
  const owned = Boolean(state.starterPackBoughtAt || state.starterPackPurchaseToken);
  if (owned) starterPackOwnedThisSession = true;
  return owned;
}

export async function markStarterPackPurchased(
  purchaseToken: string,
  boughtAt = Date.now(),
): Promise<void> {
  starterPackOwnedThisSession = true;
  const current = await readState();
  const next: AccountPurchaseState = {
    ...current,
    version: 1,
    starterPackBoughtAt: current.starterPackBoughtAt ?? boughtAt,
    starterPackPurchaseToken: current.starterPackPurchaseToken ?? purchaseToken,
  };
  try {
    await AsyncStorage.setItem(ACCOUNT_PURCHASES_KEY, JSON.stringify(next));
  } catch {
    // The verified purchase remains granted in the save. The in-memory guard
    // still prevents a duplicate checkout during this app session.
  }
}

