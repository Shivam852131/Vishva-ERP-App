import React from 'react';
import { render } from '@testing-library/react-native';
import { EmptyState } from '@/src/ui';
import { Bus, BookOpen, Building2 } from 'lucide-react-native';

describe('EmptyState Component Safety', () => {
  it('renders safely when icon is passed as a React component constructor (forwardRef)', () => {
    const { getByText } = render(
      <EmptyState icon={Bus} title="No Routes" sub="Testing forwardRef icon" />
    );
    expect(getByText('No Routes')).toBeTruthy();
    expect(getByText('Testing forwardRef icon')).toBeTruthy();
  });

  it('renders safely when icon is passed as a JSX element', () => {
    const { getByText } = render(
      <EmptyState icon={<BookOpen size={48} />} title="No Books" sub="Testing JSX element icon" />
    );
    expect(getByText('No Books')).toBeTruthy();
    expect(getByText('Testing JSX element icon')).toBeTruthy();
  });

  it('renders safely when icon is an emoji string', () => {
    const { getByText } = render(
      <EmptyState icon="🏢" title="No Hostels" sub="Testing string emoji" />
    );
    expect(getByText('No Hostels')).toBeTruthy();
    expect(getByText('🏢')).toBeTruthy();
  });

  it('renders safely when icon is omitted', () => {
    const { getByText } = render(
      <EmptyState title="Nothing here" sub="Default icon fallback" />
    );
    expect(getByText('Nothing here')).toBeTruthy();
    expect(getByText('📭')).toBeTruthy();
  });
});
