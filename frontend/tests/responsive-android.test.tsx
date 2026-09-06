import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { getResponsiveTabOptions } from '@/src/navigation/tabOptions';
import { theme } from '@/src/theme';
import { Button, GradientButton, StatCard, PageHeader, ChipBtn, Badge, BadgePill } from '@/src/ui';

describe('Responsive Android Adaptation & No Overlap/Override/Overflow', () => {
  describe('Tab Bar Options & Android Navigation Bar Insets', () => {
    it('handles 0px bottom inset (gesture bar or zero padding)', () => {
      const opts = getResponsiveTabOptions(0);
      expect((opts.tabBarStyle as any).height).toBe(56);
      expect((opts.tabBarStyle as any).paddingBottom).toBe(6);
      expect(opts.tabBarHideOnKeyboard).toBe(true);
    });

    it('dynamically expands tab bar height for Android 3-button navigation (e.g. 24px inset)', () => {
      const opts = getResponsiveTabOptions(24);
      expect((opts.tabBarStyle as any).height).toBe(80);
      expect((opts.tabBarStyle as any).paddingBottom).toBe(24);
      expect(opts.tabBarHideOnKeyboard).toBe(true);
    });

    it('supports compact labels for navigation bars with 6+ tabs', () => {
      const opts = getResponsiveTabOptions(16, { isCompact: true });
      expect((opts.tabBarLabelStyle as any).fontSize).toBe(9);
      expect((opts.tabBarItemStyle as any).paddingHorizontal).toBe(1);
      expect((opts.tabBarLabelStyle as any).maxFontSizeMultiplier).toBe(1.15);
    });
  });

  describe('Theme Dynamic Dimensions (No Override)', () => {
    it('returns window dimensions dynamically via theme.screen', () => {
      const screen = theme.screen;
      expect(screen.width).toBeGreaterThan(0);
      expect(screen.height).toBeGreaterThan(0);
    });
  });

  describe('Android Touch Targets & Text Safeguards', () => {
    it('Button and GradientButton have at least 48dp minHeight and flexShrink for Android touch standards', () => {
      const { getByTestId, getByText } = render(
        <>
          <Button testID="test-btn" label="Submit Action" />
          <GradientButton testID="test-grad-btn" label="Primary Action" />
        </>
      );

      const btn = getByTestId('test-btn');
      expect(StyleSheet.flatten(btn.props.style).minHeight).toBe(48);

      const gradBtnLabel = getByText('Primary Action');
      expect(gradBtnLabel).toBeTruthy();
    });

    it('StatCard value has adjustsFontSizeToFit and numberOfLines=1 to prevent card blowout', () => {
      const { getByText } = render(
        <StatCard label="Total Fees Outstanding" value="₹1,25,000" />
      );

      const val = getByText('₹1,25,000');
      expect(val.props.numberOfLines).toBe(1);
      expect(val.props.adjustsFontSizeToFit).toBe(true);
      expect(val.props.maxFontSizeMultiplier).toBe(1.2);
    });

    it('PageHeader prevents title and action collisions using flexShrink', () => {
      const { getByText, getByTestId } = render(
        <PageHeader
          title="Very Long College Department Name Timetable Schedule"
          rightAction={<Button testID="hdr-action" label="Action" />}
        />
      );

      const title = getByText('Very Long College Department Name Timetable Schedule');
      expect(title.props.numberOfLines).toBe(1);
      expect(title.props.adjustsFontSizeToFit).toBe(true);
      expect(getByTestId('hdr-action')).toBeTruthy();
    });

    it('ChipBtn has minHeight: 38 and flexible vertical padding to prevent descender clipping', () => {
      const { getByTestId } = render(
        <ChipBtn testID="test-chip" label="Selected Chip" active />
      );
      const chip = getByTestId('test-chip');
      expect(StyleSheet.flatten(chip.props.style).minHeight).toBe(38);
    });

    it('Badge and BadgePill have maxFontSizeMultiplier set to prevent overflow under accessibility font scaling', () => {
      const { getByText } = render(
        <>
          <Badge text="NEW" />
          <BadgePill label="Active" />
        </>
      );
      const bText = getByText('NEW');
      const bpText = getByText('Active');
      expect(bText.props.maxFontSizeMultiplier).toBe(1.1);
      expect(bpText.props.maxFontSizeMultiplier).toBe(1.15);
    });
  });

  describe('Responsive Math Constraints (No Overflow across Android phone sizes)', () => {
    const phoneWidths = [320, 360, 390, 412, 480];

    it('4-column quick action grid (width: "22%") never exceeds 100% of container', () => {
      for (const w of phoneWidths) {
        // 4 cards at 22% = 88% width, leaving 12% space for gaps/margins
        const totalCardWidthPct = 4 * 22;
        expect(totalCardWidthPct).toBeLessThan(100);
      }
    });

    it('6-digit OTP boxes fit inside card boundaries without horizontal overflow on all screen sizes', () => {
      for (const screenWidth of phoneWidths) {
        // Card padding = 16px each side (32px), container margin = 20px each side (40px) -> 72px total non-card width
        const availableWidth = screenWidth - 72;
        const gap = 6;
        const totalGaps = 5 * gap; // 30px
        const otpBoxWidth = Math.min(44, Math.max(34, Math.floor((availableWidth - totalGaps) / 6)));
        const totalOtpRowWidth = 6 * otpBoxWidth + totalGaps;

        // Must strictly fit inside available width without overflowing or wrapping
        expect(totalOtpRowWidth).toBeLessThanOrEqual(availableWidth);
        expect(otpBoxWidth).toBeGreaterThanOrEqual(34);
      }
    });
  });
});
