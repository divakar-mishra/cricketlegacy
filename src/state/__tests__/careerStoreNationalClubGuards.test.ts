import type { SaveGame } from '../../domain/types';

jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (callback: () => void) => {
      callback();
      return { cancel: jest.fn() };
    },
  },
  Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;

const { makeManagerSave } = jest.requireActual<typeof import('../../game/__tests__/_depthHelpers')>(
  '../../game/__tests__/_depthHelpers',
);
const { useCareer } = jest.requireActual<typeof import('../careerStore')>('../careerStore');
const { purchases } = jest.requireActual<typeof import('../../services')>('../../services');

const originalPersist = useCareer.getState().persist;
const originalPersistCritical = useCareer.getState().persistCritical;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('National Manager retained-club action guards', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useCareer.setState({
      save: null,
      ref: null,
      pendingAchievementIds: [],
      lastPromotion: null,
      persistenceError: null,
      persist: originalPersist,
      persistCritical: originalPersistCritical,
    });
  });

  it('rejects club mutations while preserving the retained club and paid tokens', async () => {
    const save = makeManagerSave(9_201) as SaveGame;
    save.managerCareerLevel = 'NATIONAL';
    save.inventory = {
      ...(save.inventory ?? {}),
      facility_upgrade_token: 1,
      squad_recovery_token: 1,
    };
    useCareer.getState().setActive(save, 'manager', 1);
    useCareer.setState({ persist: jest.fn(async () => undefined) });

    const active = useCareer.getState().save!;
    const clubId = active.userTeamId!;
    const playerId = active.teams[clubId].playerIds[0];
    const targetId = active.freeAgents?.[0] ?? playerId;
    const before = clone({
      team: active.teams[clubId],
      players: active.players,
      club: active.managerClubs?.[clubId],
      facilities: active.facilities,
      academy: active.academy,
      staff: active.staff,
      reports: active.scoutReports,
      sponsor: active.sponsorship,
      inventory: active.inventory,
    });

    expect(useCareer.getState().signPlayer(targetId).ok).toBe(false);
    expect(useCareer.getState().releasePlayer(playerId).ok).toBe(false);
    expect(useCareer.getState().investStaff('HEAD_COACH').ok).toBe(false);
    expect(useCareer.getState().upgradeFacilityLevel('training', 'TOKEN').ok).toBe(false);
    expect(useCareer.getState().upgradeFacilityLevel('training', 'CLUB_BUDGET').ok).toBe(false);
    expect(useCareer.getState().scout(targetId).ok).toBe(false);
    expect(useCareer.getState().renewDeal(playerId).ok).toBe(false);
    expect(useCareer.getState().loanPlayer(playerId).ok).toBe(false);
    expect(useCareer.getState().recallLoan(playerId)).toBe(false);
    expect(useCareer.getState().offerFreeAgentContract(targetId).ok).toBe(false);
    expect(useCareer.getState().useFullScoutReveal(targetId, 'token').ok).toBe(false);
    expect(useCareer.getState().applySquadRecovery('token').ok).toBe(false);
    expect(useCareer.getState().acceptEarnedSponsorOffer('manager-all-formats').ok).toBe(false);
    expect(useCareer.getState().useManagerResource('ELITE_STAFF_SEARCH').ok).toBe(false);
    await expect(useCareer.getState().purchaseProduct('transfer_budget_sm')).resolves.toEqual({
      ok: false,
      error: 'club_operations_paused',
    });
    await expect(useCareer.getState().purchaseProduct('manager_legend_pack')).resolves.toEqual({
      ok: false,
      error: 'club_operations_paused',
    });

    const after = useCareer.getState().save!;
    expect({
      team: after.teams[clubId],
      players: after.players,
      club: after.managerClubs?.[clubId],
      facilities: after.facilities,
      academy: after.academy,
      staff: after.staff,
      reports: after.scoutReports,
      sponsor: after.sponsorship,
      inventory: after.inventory,
    }).toEqual(before);
  });

  it('defers restoring club-changing Legend backing until a domestic job is active', async () => {
    const save = makeManagerSave(9_202) as SaveGame;
    save.managerCareerLevel = 'NATIONAL';
    useCareer.getState().setActive(save, 'manager', 1);
    useCareer.setState({ persist: jest.fn(async () => undefined) });
    const active = useCareer.getState().save!;
    const clubId = active.userTeamId!;
    const before = clone({
      reputation: active.teams[clubId].reputation,
      boardConfidence: active.boardConfidence,
      inventory: active.inventory,
      progression: active.managerProgression,
    });
    jest.spyOn(purchases, 'restore').mockResolvedValue({
      status: 'RESTORED',
      purchases: [
        {
          ok: true,
          productId: 'manager_legend_pack',
          purchaseToken: 'national-restore',
          purchaseState: 'PURCHASED',
          verificationState: 'VERIFIED',
        },
      ],
    });

    await expect(useCareer.getState().restorePurchases()).resolves.toEqual({
      status: 'NOTHING_APPLICABLE',
      count: 0,
      productIds: [],
    });
    const after = useCareer.getState().save!;
    expect({
      reputation: after.teams[clubId].reputation,
      boardConfidence: after.boardConfidence,
      inventory: after.inventory,
      progression: after.managerProgression,
    }).toEqual(before);
  });
});
