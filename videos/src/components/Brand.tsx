import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, font} from '../theme';

export const clientIcon = staticFile('brand/client-icon.svg');
export const bankIcon = staticFile('brand/bank-icon.svg');

/** Soft mint background with slow drifting blobs. */
export const Backdrop: React.FC<{dark?: boolean}> = ({dark}) => {
	const frame = useCurrentFrame();
	const drift = Math.sin(frame / 60) * 40;
	if (dark) {
		return (
			<AbsoluteFill style={{background: `linear-gradient(135deg, ${colors.emeraldLight} 0%, ${colors.emerald} 55%, ${colors.emeraldDark} 100%)`}}>
				<Blob color="rgba(255,255,255,0.12)" size={900} left={-200 + drift} top={-300} />
				<Blob color="rgba(255,255,255,0.08)" size={700} right={-150 - drift} bottom={-250} />
			</AbsoluteFill>
		);
	}
	return (
		<AbsoluteFill style={{background: `linear-gradient(160deg, #ffffff 0%, ${colors.mint} 60%, #d1fae5 100%)`}}>
			<Blob color="rgba(52,211,153,0.18)" size={900} left={-300 + drift} top={-350} />
			<Blob color="rgba(5,150,105,0.10)" size={800} right={-250 - drift} bottom={-300} />
		</AbsoluteFill>
	);
};

const Blob: React.FC<{color: string; size: number} & React.CSSProperties> = ({color, size, ...pos}) => (
	<div style={{position: 'absolute', width: size, height: size, borderRadius: size, background: color, filter: 'blur(40px)', ...pos}} />
);

/** FamBank icon + wordmark. */
export const Logo: React.FC<{size: number; light?: boolean; at?: number}> = ({size, light, at = 0}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const pop = spring({frame: frame - at, fps, config: {damping: 12}});
	return (
		<div style={{display: 'flex', alignItems: 'center', gap: size * 0.3, transform: `scale(${pop})`, fontFamily: font}}>
			<Img
				src={clientIcon}
				style={{width: size, height: size, borderRadius: size * 0.22, boxShadow: light ? '0 0 0 6px rgba(255,255,255,0.35)' : '0 10px 30px rgba(5,150,105,0.35)'}}
			/>
			<span style={{fontSize: size * 0.72, fontWeight: 800, letterSpacing: -size * 0.02, color: light ? 'white' : colors.ink}}>FamBank</span>
		</div>
	);
};

/**
 * Text that springs in. Wrap words in **double asterisks** to paint them with the accent color.
 */
export const Caption: React.FC<{
	text: string;
	size: number;
	at?: number;
	accent?: string;
	color?: string;
	align?: 'left' | 'center';
	weight?: number;
	style?: React.CSSProperties;
}> = ({text, size, at = 0, accent = colors.emerald, color = colors.ink, align = 'center', weight = 800, style}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const enter = spring({frame: frame - at, fps, config: {damping: 200}, durationInFrames: 18});
	const parts = text.split(/(\*\*[^*]+\*\*)/g);
	return (
		<div
			style={{
				fontFamily: font,
				fontSize: size,
				fontWeight: weight,
				lineHeight: 1.18,
				letterSpacing: -size * 0.015,
				color,
				textAlign: align,
				opacity: enter,
				transform: `translateY(${interpolate(enter, [0, 1], [size * 0.6, 0])}px)`,
				textWrap: 'balance',
				...style,
			}}
		>
			{parts.map((part, i) =>
				part.startsWith('**') ? (
					<span key={i} style={{color: accent}}>
						{part.slice(2, -2)}
					</span>
				) : (
					<React.Fragment key={i}>{part}</React.Fragment>
				),
			)}
		</div>
	);
};

/** A small rounded label ("App del banco"). */
export const Pill: React.FC<{children: React.ReactNode; color: string; size: number; at?: number}> = ({children, color, size, at = 0}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const pop = spring({frame: frame - at, fps, config: {damping: 14}});
	return (
		<div
			style={{
				fontFamily: font,
				fontSize: size,
				fontWeight: 600,
				color: 'white',
				background: color,
				borderRadius: 999,
				padding: `${size * 0.35}px ${size * 0.9}px`,
				transform: `scale(${pop})`,
				boxShadow: '0 8px 20px rgba(15,23,42,0.15)',
				whiteSpace: 'nowrap',
			}}
		>
			{children}
		</div>
	);
};

/** Push notification banner that slides down from the top. */
export const PushBanner: React.FC<{title: string; body: string; at: number; width: number}> = ({title, body, at, width}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const enter = spring({frame: frame - at, fps, config: {damping: 15}});
	const k = width / 360;
	return (
		<div
			style={{
				width,
				display: 'flex',
				gap: 12 * k,
				alignItems: 'center',
				padding: `${12 * k}px ${14 * k}px`,
				borderRadius: 22 * k,
				background: 'rgba(255,255,255,0.96)',
				boxShadow: '0 18px 50px rgba(15,23,42,0.28)',
				fontFamily: font,
				transform: `translateY(${interpolate(enter, [0, 1], [-160 * k, 0])}px)`,
				opacity: enter,
			}}
		>
			<Img src={bankIcon} style={{width: 40 * k, height: 40 * k, borderRadius: 10 * k}} />
			<div style={{flex: 1, minWidth: 0}}>
				<div style={{display: 'flex', justifyContent: 'space-between', fontSize: 12 * k, color: colors.muted}}>
					<span style={{fontWeight: 600, letterSpacing: 0.5}}>FAMBANK</span>
					<span>ahora</span>
				</div>
				<div style={{fontSize: 15 * k, fontWeight: 600, color: colors.ink}}>{title}</div>
				<div style={{fontSize: 14 * k, color: colors.muted}}>{body}</div>
			</div>
		</div>
	);
};

/** Desktop browser window for 1280x800 captures. */
export const BrowserWindow: React.FC<{width: number; src: string; scrollY?: number; children?: React.ReactNode; style?: React.CSSProperties}> = ({
	width,
	src,
	scrollY = 0,
	children,
	style,
}) => {
	const k = width / 1280;
	const bar = 40 * k;
	return (
		<div
			style={{
				width,
				borderRadius: 18 * k,
				overflow: 'hidden',
				background: 'white',
				boxShadow: `0 ${30 * k}px ${90 * k}px rgba(6,78,59,0.25), 0 0 0 1px rgba(15,23,42,0.06)`,
				...style,
			}}
		>
			<div style={{height: bar, background: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 * k, padding: `0 ${16 * k}px`}}>
				{['#f87171', '#fbbf24', '#34d399'].map((c) => (
					<div key={c} style={{width: 12 * k, height: 12 * k, borderRadius: 12 * k, background: c}} />
				))}
				<div
					style={{
						marginLeft: 16 * k,
						display: 'flex',
						alignItems: 'center',
						gap: 8 * k,
						background: 'white',
						borderRadius: 8 * k,
						padding: `${4 * k}px ${12 * k}px`,
						fontFamily: font,
						fontSize: 14 * k,
						color: colors.muted,
					}}
				>
					<Img src={bankIcon} style={{width: 16 * k, height: 16 * k, borderRadius: 4 * k}} />
					FamBank · Administración
				</div>
			</div>
			<div style={{position: 'relative', width, height: 800 * k, overflow: 'hidden', background: '#f9fafb'}}>
				<Img src={src} style={{width, display: 'block', transform: `translateY(${-scrollY * k}px)`}} />
				<div style={{position: 'absolute', inset: 0, transform: `scale(${k})`, transformOrigin: 'top left', width: 1280, height: 800}}>{children}</div>
			</div>
		</div>
	);
};
