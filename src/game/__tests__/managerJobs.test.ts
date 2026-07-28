import { createManagerSave } from '../createGame';
import { acceptManagerJob, declineManagerJob, generateManagerJobOffer } from '../managerJobs';

function makeMgr() {
  return createManagerSave({ teamId: 'mumbai_sharks', difficulty: 'NORMAL', seed: 42 });
}

describe('manager headhunt', () => {
  it('a bigger club approaches a successful manager', () => {
    const save = makeMgr();
    save.teams[save.userTeamId!].reputation = 55;
    const otherId = save.divisions!.tier3!.find((id) => id !== save.userTeamId)!;
    save.teams[otherId].reputation = 85;
    save.boardConfidence = 82;

    const offer = generateManagerJobOffer(save, () => 0.1);
    expect(offer).not.toBeNull();
    expect(save.managerJobOffer).toBeTruthy();
    expect(offer!.reputation).toBeGreaterThanOrEqual(55 + 4);
    expect(offer!.salaryPromise).toBeGreaterThan(0);
  });

  it('does not headhunt when board confidence is low', () => {
    const save = makeMgr();
    save.boardConfidence = 40;
    expect(generateManagerJobOffer(save, () => 0.1)).toBeNull();
  });

  it('does not headhunt a sacked manager', () => {
    const save = makeMgr();
    save.boardConfidence = 90;
    save.flags = { ...(save.flags ?? {}), sacked: true };
    expect(generateManagerJobOffer(save, () => 0.1)).toBeNull();
  });

  it('accepting moves you to the new club', () => {
    const save = makeMgr();
    const fromId = save.userTeamId!;
    const otherId = save.divisions!.tier3!.find((id) => id !== fromId)!;
    save.managerJobOffer = {
      teamId: otherId,
      clubName: save.teams[otherId].name,
      reputation: 85,
      salaryPromise: 1_000_000,
      reason: 'x',
    };
    const res = acceptManagerJob(save);
    expect(res.ok).toBe(true);
    expect(save.userTeamId).toBe(otherId);
    expect(save.teams[otherId].isUserTeam).toBe(true);
    expect(save.teams[fromId].isUserTeam).toBe(false);
    expect(save.managerJobOffer).toBeUndefined();
  });

  it('declining is rewarded with a board-confidence boost', () => {
    const save = makeMgr();
    const otherId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    save.boardConfidence = 70;
    save.managerJobOffer = {
      teamId: otherId,
      clubName: 'X',
      reputation: 85,
      salaryPromise: 1,
      reason: 'x',
    };
    declineManagerJob(save);
    expect(save.boardConfidence).toBe(78);
    expect(save.managerJobOffer).toBeUndefined();
  });
});
