import React from 'react';
import { Image, type ImageResizeMode } from 'react-native';

type AppImageProps = React.ComponentProps<typeof Image> & {
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
};

const resizeModeMap: Record<NonNullable<AppImageProps['contentFit']>, ImageResizeMode> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'stretch',
  none: 'center',
  'scale-down': 'contain',
};

export function AppImage({ contentFit = 'cover', resizeMode, ...props }: AppImageProps) {
  return <Image resizeMode={resizeMode || resizeModeMap[contentFit]} {...props} />;
}
