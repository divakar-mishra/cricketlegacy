import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CelebrationOverlay } from '../CelebrationOverlay';
const mockStop = jest.fn();
const mockStart = jest.fn();
let mockReducedMotion = false;
jest.mock('react-native', () => ({
  View: 'View', Dimensions: {get:()=>({width:360,height:800})},
  StyleSheet: {create:(x:unknown)=>x,absoluteFill:{}},
  Animated: {
    View:'AnimatedView',
    Value:class { setValue() {} interpolate(x:unknown) { return x; } },
    parallel:()=>({start:mockStart,stop:mockStop}),
    timing:jest.fn(),delay:jest.fn(),sequence:jest.fn(),stagger:jest.fn(),
  },
}));
jest.mock('react-native-reanimated',()=>({useReducedMotion:()=>mockReducedMotion}));
jest.mock('@expo/vector-icons',()=>({Ionicons:'Ionicons'}));
jest.mock('../AppText',()=>({AppText:'Text'}));
jest.mock('../../state/settingsStore',()=>({useSettings:(select:(s:unknown)=>unknown)=>select({graphics:'low'})}));
jest.mock('../../theme',()=>({useColors:()=>({primary:'#20AA88',primaryLight:'#40CCAA',white:'#FFFFFF',accent:'#D5B56D',accentLight:'#EEDD99',danger:'#E5484D'})}));
describe('celebration overlay lifecycle',()=>{
  let tree:ReactTestRenderer;
  let warning:jest.SpyInstance;
  beforeEach(()=>{mockReducedMotion=false;mockStop.mockClear();warning=jest.spyOn(console,'error').mockImplementation(()=>{});});
  afterEach(()=>{act(()=>tree?.unmount());warning.mockRestore();});
  it('uses the selected motif and bounded particle budget, replacing rather than queuing bursts',()=>{
    act(()=>{tree=create(createElement(CelebrationOverlay,{trigger:1,kind:'six',cosmeticId:'cel_dance'}));});
    expect(tree.root.findAll(n=>n.props.testID==='celebration-particle')).toHaveLength(8);
    expect(tree.root.findAll(n=>n.type==='Ionicons' as any)[0].props.name).toBe('musical-notes-outline');
    act(()=>tree.update(createElement(CelebrationOverlay,{trigger:2,kind:'four',cosmeticId:'pass_celebration_ice'})));
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(tree.root.findAll(n=>n.type==='Ionicons' as any)[0].props.name).toBe('snow-outline');
  });
  it('keeps the readable result but omits particles for reduced motion',()=>{
    mockReducedMotion=true;
    act(()=>{tree=create(createElement(CelebrationOverlay,{trigger:1,kind:'six',cosmeticId:'cel_fist'}));});
    expect(tree.root.findAll(n=>n.props.testID==='celebration-particle')).toHaveLength(0);
    expect(tree.root.findAll(n=>n.type==='Text' as any).map(n=>n.props.children)).toContain('SIX');
  });
});
