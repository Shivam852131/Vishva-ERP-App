import React from 'react';
import { render } from '@testing-library/react-native';
import { SectionTitle, ProgressBar } from '@/src/ui';

describe('SectionTitle', () => {
  it('renders the title prop', () => {
    const { getByText } = render(<SectionTitle title="Quick Actions" />);
    expect(getByText('Quick Actions')).toBeTruthy();
  });

  // 38 call sites across 17 screens use the children form; before this was
  // supported they rendered a blank heading row.
  it('renders children when no title prop is given', () => {
    const { getByText } = render(<SectionTitle>Recent Alerts</SectionTitle>);
    expect(getByText('Recent Alerts')).toBeTruthy();
  });
});

describe('ProgressBar', () => {
  const widthOf = (tree: any) => {
    const json = JSON.stringify(tree.toJSON());
    const m = json.match(/"width":"([^"]+)"/);
    return m ? m[1] : null;
  };

  it('clamps to 0% when max is 0 instead of rendering NaN%', () => {
    const tree = render(<ProgressBar value={0} max={0} />);
    expect(widthOf(tree)).toBe('0%');
  });

  it('clamps over-100 values to 100%', () => {
    const tree = render(<ProgressBar value={150} max={100} />);
    expect(widthOf(tree)).toBe('100%');
  });

  it('handles a normal ratio', () => {
    const tree = render(<ProgressBar value={25} max={100} />);
    expect(widthOf(tree)).toBe('25%');
  });

  it('does not emit NaN for a non-numeric value', () => {
    const tree = render(<ProgressBar value={undefined} max={100} />);
    expect(widthOf(tree)).toBe('0%');
  });
});
