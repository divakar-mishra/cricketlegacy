import { useId } from 'react';
import { Image } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { kitColorHex, kitDesign } from '../data/cosmetics';
import { kitThumbnailArtwork } from '../avatar/layeredPortraits';

/** Shared chest artwork keeps shop thumbnails and the full shirt consistent. */
export function KitDesignLayer({ kitId }: { kitId?: string }) {
  const { pattern, trim } = kitDesign(kitId);
  return (
    <G testID={`kit-pattern-${pattern}`} fill={trim} opacity={0.72}>
      {pattern === 'chevron' && <Path d="M99 88 160 118 221 88v14l-61 31-61-31Z" />}
      {pattern === 'sash' && <Path d="M221 76h-23L99 186v26L221 101Z" />}
      {pattern === 'pinstripe' && [108, 128, 148, 168, 188, 208].map((x) => <Rect key={x} x={x} y={75} width={2} height={142} />)}
      {pattern === 'hoops' && [100, 133, 166, 199].map((y) => <Rect key={y} x={99} y={y} width={122} height={9} />)}
      {pattern === 'split' && <Path d="M160 68h61v149h-61Z" opacity={0.35} />}
      {pattern === 'lightning' && <Path d="M187 72h-23l-39 77h32l-23 66 57-92h-32Z" />}
      {pattern === 'classic' && <Path d="M99 204h122v4H99Z" />}
    </G>
  );
}

export function KitThumbnail({ kitId }: { kitId: string }) {
  const artwork = kitThumbnailArtwork(kitId);
  if (artwork) return <Image source={artwork} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessibilityLabel="Kit design" />;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 260" accessibilityLabel="Kit design">
      <Path d="M110 34 73 49 28 92l29 38 29-23v119h148V107l29 23 29-38-45-43-37-15c-8 17-25 26-50 26s-42-9-50-26Z" fill={kitColorHex(kitId)} stroke={kitDesign(kitId).trim} strokeWidth={4} />
      <KitDesignLayer kitId={kitId} />
      <Path d="M110 34q50 52 100 0" fill="none" stroke={kitDesign(kitId).trim} strokeWidth={8} />
    </Svg>
  );
}

/** Jersey layer below the face; original neck/collar and hair remain above it. */
export function PortraitKit({ kitId }: { kitId: string }) {
  const clipId = `jersey${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const shape = 'M0 225 98 185Q115 214 150 226Q185 214 202 185L300 225V300H0Z';
  return (
    <Svg width="100%" height="100%" viewBox="0 0 300 300" testID={`portrait-kit-${kitId}`}>
      <Defs><ClipPath id={clipId}><Path d={shape} /></ClipPath></Defs>
      <Path d={shape} fill={kitColorHex(kitId)} />
      <G clipPath={`url(#${clipId})`}><G transform="translate(-230 170) scale(2.375 .6)">
        <KitDesignLayer kitId={kitId} />
      </G></G>
    </Svg>
  );
}
