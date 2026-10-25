import { createElement } from 'react';
// For unrelated screen tests only. The real pointer engine has its own mounted tests.
export const GuideTarget = ({ children, ...props }: any) =>
  createElement('GuideTarget', props, children);
export const CareerGuide = ({ children, ...props }: any) =>
  createElement('CareerGuide', props, children);
export const GuideScrollView = ({ children, ...props }: any) =>
  createElement('ScrollView', props, children);
export const GuideReplayButton = 'GuideReplayButton';
export const useGuidePending = () => false;
export const replayCareerGuide = () => {};
