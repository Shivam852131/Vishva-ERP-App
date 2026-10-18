import React from 'react';
import { render } from '@testing-library/react-native';
import { AnimatedViLogo } from '@/src/components/AnimatedViLogo';

// The logo plays a native-driver intro + idle loop on mount. In the jest
// environment the native driver is stubbed, so we only assert the DOM shape:
// it must render a single accessible group with the SVG mark and never throw.

describe('AnimatedViLogo', () => {
  it('renders the animated mark with an accessible label', () => {
    const { getByLabelText } = render(<AnimatedViLogo size={72} />);
    expect(getByLabelText('Vishva ERP logo')).toBeTruthy();
  });

  it('renders statically without running animations when animate is false', () => {
    const { toJSON } = render(<AnimatedViLogo size={72} animate={false} />);
    expect(toJSON()).toBeTruthy();
  });

  it('accepts a custom accessibility label', () => {
    const { getByLabelText } = render(
      <AnimatedViLogo size={48} accessibilityLabel="Custom logo label" />,
    );
    expect(getByLabelText('Custom logo label')).toBeTruthy();
  });

  it('does not crash at small sizes', () => {
    const { toJSON } = render(<AnimatedViLogo size={24} />);
    expect(toJSON()).toBeTruthy();
  });
});
