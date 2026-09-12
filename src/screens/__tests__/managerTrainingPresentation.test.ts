import fs from 'fs';
import path from 'path';

const managerTraining = fs.readFileSync(
  path.join(__dirname, '..', 'ManagerTrainingScreen.tsx'),
  'utf8',
);

describe('manager training presentation', () => {
  it('uses the cricket coach-board presentation without a currency dashboard', () => {
    expect(managerTraining).toContain('COACH&apos;S BOARD');
    expect(managerTraining).toContain('kind="training"');
    expect(managerTraining).toContain('level={club.facilities.training}');
    expect(managerTraining).toContain('SESSION FOCUS');
    expect(managerTraining).not.toContain('Wallet');
    expect(managerTraining).not.toContain('coins');
    expect(managerTraining).not.toContain('gems');
  });

  it('uses green for selection and qualitative workload consequences', () => {
    expect(managerTraining).toContain('borderColor: colors.success');
    expect(managerTraining).toContain('More recovery · Slower development');
    expect(managerTraining).toContain('Balanced workload');
    expect(managerTraining).toContain('Faster development · Higher fatigue risk');
    expect(managerTraining).not.toContain('0.08%');
    expect(managerTraining).not.toContain('0.30%');
  });

  it('keeps player overrides collapsed and requires an explicit save', () => {
    expect(managerTraining).toContain('const [overridesOpen, setOverridesOpen] = useState(false)');
    expect(managerTraining).toContain('PLAYER OVERRIDES');
    expect(managerTraining).toContain("label={planChanged ? 'SAVE TRAINING PLAN' : 'PLAN SAVED'}");
    expect(managerTraining).toContain(
      'setPlan({ focus: selectedFocus, intensity: selectedIntensity })',
    );
  });
});
