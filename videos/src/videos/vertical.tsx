import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop, Caption, Logo} from '../components/Brand';
import {Phone} from '../components/Phone';
import {colors, font} from '../theme';

/** 9:16 layout: caption on top, a big phone below. */
export const VerticalScene: React.FC<{
	caption: string;
	accent?: string;
	captionSize?: number;
	zoom?: {scale: number; x: number; y: number};
	children: React.ReactNode;
}> = ({caption, accent, captionSize = 70, zoom, children}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const enter = spring({frame, fps, config: {damping: 200}});
	return (
		<AbsoluteFill>
			<Backdrop />
			<div style={{position: 'absolute', top: 120, left: 70, right: 70, height: 290, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
				<Caption text={caption} size={captionSize} at={4} accent={accent} />
			</div>
			<div style={{position: 'absolute', top: 450, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: enter, transform: `translateY(${(1 - enter) * 60}px)`}}>
				<Phone width={600} zoom={zoom}>
					{children}
				</Phone>
			</div>
		</AbsoluteFill>
	);
};

/** Eases a zoom in between two frames (and optionally back out). */
export const useZoom = (from: number, to: number, scale: number, x: number, y: number, outFrom?: number) => {
	const frame = useCurrentFrame();
	const opts = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
	let t = interpolate(frame, [from, to], [0, 1], opts);
	if (outFrom !== undefined) t *= interpolate(frame, [outFrom, outFrom + (to - from)], [1, 0], opts);
	return {scale: 1 + (scale - 1) * t, x, y};
};

export const VerticalTitle: React.FC<{title: string; subtitle: string}> = ({title, subtitle}) => (
	<AbsoluteFill>
		<Backdrop dark />
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 70, padding: 80}}>
			<Logo size={130} light />
			<Caption text={title} size={92} color="white" accent="#fef3c7" at={10} />
			<Caption text={subtitle} size={46} color="rgba(255,255,255,0.9)" weight={600} at={18} />
		</AbsoluteFill>
	</AbsoluteFill>
);

export const VerticalOutro: React.FC<{line: string}> = ({line}) => (
	<AbsoluteFill>
		<Backdrop dark />
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 50}}>
			<Logo size={140} light />
			<Caption text={line} size={56} color="white" weight={600} at={8} />
			<Caption
				text="fambank.armage.tech"
				size={52}
				color="white"
				at={14}
				style={{background: 'rgba(255,255,255,0.18)', borderRadius: 999, padding: '12px 44px'}}
			/>
		</AbsoluteFill>
	</AbsoluteFill>
);

/** In-app style toast, drawn in the 390-wide phone space. */
export const Toast: React.FC<{at: number; title: string; detail: string; tone: string}> = ({at, title, detail, tone}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const enter = spring({frame: frame - at, fps, config: {damping: 14}});
	return (
		<div
			style={{
				position: 'absolute',
				left: 20,
				right: 20,
				bottom: 40,
				padding: '14px 16px',
				borderRadius: 18,
				background: 'white',
				boxShadow: '0 14px 40px rgba(15,23,42,0.25)',
				border: `2px solid ${tone}`,
				display: 'flex',
				alignItems: 'center',
				gap: 12,
				fontFamily: font,
				transform: `translateY(${interpolate(enter, [0, 1], [140, 0])}px)`,
				opacity: enter,
			}}
		>
			<div style={{width: 38, height: 38, borderRadius: 38, background: tone, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
					<path d="M5 12.5l4.5 4.5L19 7.5" />
				</svg>
			</div>
			<div>
				<div style={{fontSize: 16, fontWeight: 800, color: colors.ink}}>{title}</div>
				<div style={{fontSize: 14, color: colors.muted}}>{detail}</div>
			</div>
		</div>
	);
};

/** Big check mark that pops over the phone screen. */
export const BigCheck: React.FC<{at: number}> = ({at}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (frame < at) return null;
	const pop = spring({frame: frame - at, fps, config: {damping: 10}});
	const out = interpolate(frame - at, [28, 38], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', background: `rgba(255,255,255,${0.55 * out})`, opacity: out}}>
			<div
				style={{
					width: 150,
					height: 150,
					borderRadius: 150,
					background: colors.emerald,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					transform: `scale(${pop})`,
					boxShadow: '0 20px 50px rgba(5,150,105,0.45)',
				}}
			>
				<svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
					<path d="M5 12.5l4.5 4.5L19 7.5" />
				</svg>
			</div>
		</AbsoluteFill>
	);
};
