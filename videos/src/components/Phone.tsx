import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

/** Screens are captured at 390x844 CSS px; every overlay inside <Phone> uses that coordinate space. */
export const SCREEN_W = 390;
export const SCREEN_H = 844;

export const shot = (name: string) => staticFile(`shots/${name}.png`);

type Zoom = {scale: number; x: number; y: number};

/** A phone with a bezel; children are laid out in the 390x844 screen space. */
export const Phone: React.FC<{
	width: number;
	zoom?: Zoom;
	children: React.ReactNode;
	style?: React.CSSProperties;
}> = ({width, zoom, children, style}) => {
	const k = width / SCREEN_W;
	const bezel = 14 * k;
	return (
		<div
			style={{
				width: width + bezel * 2,
				height: SCREEN_H * k + bezel * 2,
				padding: bezel,
				borderRadius: 62 * k,
				background: '#0f172a',
				boxShadow: `0 ${30 * k}px ${80 * k}px rgba(6, 78, 59, 0.28), inset 0 0 0 ${2 * k}px #334155`,
				position: 'relative',
				...style,
			}}
		>
			<div style={{width, height: SCREEN_H * k, borderRadius: 48 * k, overflow: 'hidden', position: 'relative', background: '#f9fafb'}}>
				<div
					style={{
						width: SCREEN_W,
						height: SCREEN_H,
						transform: `scale(${k})`,
						transformOrigin: 'top left',
						position: 'absolute',
					}}
				>
					<div
						style={{
							position: 'absolute',
							inset: 0,
							transform: zoom ? `scale(${zoom.scale})` : undefined,
							transformOrigin: zoom ? `${zoom.x}px ${zoom.y}px` : undefined,
						}}
					>
						{children}
					</div>
				</div>
				<div
					style={{
						position: 'absolute',
						top: 10 * k,
						left: '50%',
						width: 110 * k,
						height: 30 * k,
						marginLeft: -55 * k,
						borderRadius: 20 * k,
						background: '#0f172a',
					}}
				/>
			</div>
		</div>
	);
};

/** A captured screen inside <Phone>, optionally scrolled (CSS px) and faded. */
export const Screen: React.FC<{src: string; scrollY?: number; opacity?: number}> = ({src, scrollY = 0, opacity = 1}) => (
	<AbsoluteFill style={{opacity, overflow: 'hidden'}}>
		<Img src={src} style={{width: SCREEN_W, position: 'absolute', top: -scrollY, left: 0}} />
	</AbsoluteFill>
);

/** Cross-fades a sequence of screens: each entry starts at its frame. */
export const ScreenFlow: React.FC<{steps: {at: number; src: string; scrollY?: number}[]; fade?: number}> = ({steps, fade = 8}) => {
	const frame = useCurrentFrame();
	return (
		<>
			{steps.map((step, i) => {
				const opacity = i === 0 ? 1 : interpolate(frame, [step.at, step.at + fade], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
				return <Screen key={i} src={step.src} scrollY={step.scrollY} opacity={opacity} />;
			})}
		</>
	);
};

/** A finger tap: a dot that presses in and leaves a ripple. */
export const Tap: React.FC<{x: number; y: number; at: number}> = ({x, y, at}) => {
	const frame = useCurrentFrame() - at;
	if (frame < 0 || frame > 24) return null;
	const press = interpolate(frame, [0, 5, 10], [1.4, 0.85, 1], {extrapolateRight: 'clamp'});
	const ripple = interpolate(frame, [4, 22], [0.6, 2.4], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const fade = interpolate(frame, [12, 24], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<>
			<div style={{...dot(x, y, 46), transform: `scale(${ripple})`, border: '3px solid rgba(255,255,255,0.9)', opacity: fade * 0.8}} />
			<div style={{...dot(x, y, 38), transform: `scale(${press})`, background: 'rgba(15,23,42,0.35)', border: '3px solid white', opacity: fade}} />
		</>
	);
};

const dot = (x: number, y: number, size: number): React.CSSProperties => ({
	position: 'absolute',
	left: x - size / 2,
	top: y - size / 2,
	width: size,
	height: size,
	borderRadius: size,
	boxSizing: 'border-box',
});

/** A glowing outline around a region of the screen. */
export const Highlight: React.FC<{x: number; y: number; w: number; h: number; at: number; color: string; until?: number; radius?: number}> = ({
	x,
	y,
	w,
	h,
	at,
	color,
	until = Infinity,
	radius = 16,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (frame < at || frame > until) return null;
	const pop = spring({frame: frame - at, fps, config: {damping: 14}});
	const pulse = 1 + 0.015 * Math.sin((frame - at) / 5);
	const out = until === Infinity ? 1 : interpolate(frame, [until - 6, until], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<div
			style={{
				position: 'absolute',
				left: x - 5,
				top: y - 5,
				width: w + 10,
				height: h + 10,
				borderRadius: radius,
				border: `4px solid ${color}`,
				boxShadow: `0 0 0 6px ${color}33, 0 0 24px ${color}88`,
				transform: `scale(${(0.9 + 0.1 * pop) * pulse})`,
				opacity: pop * out,
			}}
		/>
	);
};
