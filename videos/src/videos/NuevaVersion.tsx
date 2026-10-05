import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Highlight, Screen, ScreenFlow, shot, Tap} from '../components/Phone';
import {colors, font, s} from '../theme';
import {Scene, Scenes, totalDuration} from './shared';
import {VerticalOutro, VerticalScene, VerticalTitle} from './vertical';

/** 9:16 · intro to the new version for people coming from the old FamBank. */

/** A generic "touch the sensor" sheet: the fingerprint turns green when it is read. */
const FingerprintSheet: React.FC<{at: number; okAt: number; until: number}> = ({at, okAt, until}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (frame < at || frame > until) return null;
	const enter = spring({frame: frame - at, fps, config: {damping: 200}, durationInFrames: 12});
	const leave = interpolate(frame, [until - 8, until], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const ok = frame >= okAt;
	const scan = ok ? 1 : interpolate((frame - at) % 30, [0, 30], [0, 1]);
	const color = ok ? colors.emerald : '#64748b';
	const pop = ok ? spring({frame: frame - okAt, fps, config: {damping: 10}}) : 1;
	return (
		<>
			<div style={{position: 'absolute', inset: 0, background: `rgba(15,23,42,${0.35 * enter * (1 - leave)})`}} />
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					bottom: 0,
					height: 300,
					background: 'white',
					borderRadius: '28px 28px 0 0',
					boxShadow: '0 -10px 40px rgba(15,23,42,0.2)',
					transform: `translateY(${(1 - enter + leave) * 320}px)`,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					paddingTop: 34,
					gap: 18,
					fontFamily: font,
				}}
			>
				<div style={{fontSize: 19, fontWeight: 600, color: colors.ink}}>{ok ? 'Huella reconocida' : 'Tocá el sensor de huella'}</div>
				<div
					style={{
						width: 120,
						height: 120,
						borderRadius: 120,
						background: ok ? colors.mint : '#f1f5f9',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						transform: `scale(${pop})`,
						boxShadow: ok ? `0 0 0 6px ${colors.emerald}33` : `0 0 0 ${6 + 10 * scan}px rgba(100,116,139,${0.25 * (1 - scan)})`,
					}}
				>
					<Fingerprint color={color} size={76} />
				</div>
				<div style={{fontSize: 15, color: colors.muted}}>FamBank · Desbloquear la app</div>
			</div>
		</>
	);
};

const Fingerprint: React.FC<{color: string; size: number}> = ({color, size}) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
		<path d="M6.5 5.4A8.5 8.5 0 0 1 20.5 12v1" />
		<path d="M3.5 9.5a8.5 8.5 0 0 1 1-2.3" />
		<path d="M3.5 13.5v-1.5" />
		<path d="M7 18.5c.6-1.6.9-3.3.9-5.1V12a4.1 4.1 0 0 1 8.2 0v1.2" />
		<path d="M12 12v1.4c0 2.8-.7 5.4-2 7.6" />
		<path d="M15.9 16.5c-.2 1.6-.6 3.1-1.2 4.5" />
		<path d="M19.8 16.2a17 17 0 0 1-.6 2.6" />
		<path d="M4.6 16.8c.6-1.1.9-2.3.9-3.6V12a6.5 6.5 0 0 1 2-4.7" />
	</svg>
);

/** "NUEVO" sticker that pops onto a button. */
const NewBadge: React.FC<{x: number; y: number; at: number}> = ({x, y, at}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (frame < at) return null;
	const pop = spring({frame: frame - at, fps, config: {damping: 9}});
	const wobble = Math.sin((frame - at) / 4) * 4;
	return (
		<div
			style={{
				position: 'absolute',
				left: x,
				top: y,
				padding: '5px 12px',
				borderRadius: 999,
				background: colors.red,
				color: 'white',
				fontFamily: font,
				fontWeight: 800,
				fontSize: 15,
				letterSpacing: 1,
				boxShadow: '0 6px 16px rgba(220,38,38,0.4)',
				transform: `scale(${pop}) rotate(${8 + wobble}deg)`,
			}}
		>
			NUEVO
		</div>
	);
};

const Login: React.FC = () => (
	<VerticalScene caption="Entrás con tu email y contraseña, **como siempre**.">
		<ScreenFlow
			steps={[
				{at: 0, src: shot('intro-login-empty')},
				{at: 30, src: shot('intro-login-filled')},
			]}
		/>
		<Highlight x={41} y={404} w={308} h={50} at={34} until={70} color={colors.emerald} />
		<Highlight x={41} y={492} w={308} h={50} at={58} until={95} color={colors.emerald} />
		<Tap x={195} y={580} at={102} />
	</VerticalScene>
);

const EnableFingerprint: React.FC = () => (
	<VerticalScene caption="**Nuevo:** activá tu huella en Mi cuenta.">
		<ScreenFlow
			steps={[
				{at: 0, src: shot('intro-home')},
				{at: 20, src: shot('intro-account')},
				{at: 88, src: shot('intro-account-on')},
			]}
		/>
		<Tap x={267} y={80} at={8} />
		<Highlight x={21} y={341} w={348} h={131} at={36} color={colors.emerald} radius={16} />
		<Tap x={195} y={436} at={78} />
	</VerticalScene>
);

const UnlockWithFingerprint: React.FC = () => (
	<VerticalScene caption="La próxima vez, **entrás con tu huella**. Sin escribir la contraseña." captionSize={62}>
		<ScreenFlow
			steps={[
				{at: 0, src: shot('intro-lock')},
				{at: 112, src: shot('intro-home')},
			]}
		/>
		<Tap x={195} y={487} at={20} />
		<FingerprintSheet at={28} okAt={72} until={108} />
	</VerticalScene>
);

const HomeTour: React.FC = () => (
	<VerticalScene caption="Tu pantalla de siempre: **ahorros** en dólares y pesos, y **la cotización** del día." captionSize={58}>
		<Screen src={shot('intro-home')} />
		<Highlight x={20} y={150} w={350} h={225} at={10} until={50} color={colors.emerald} radius={24} />
		<Highlight x={20} y={391} w={350} h={44} at={48} until={88} color={colors.emerald} radius={14} />
		<Highlight x={20} y={504} w={350} h={285} at={86} until={135} color={colors.emerald} radius={24} />
	</VerticalScene>
);

const NewFeature: React.FC = () => (
	<VerticalScene caption="…y **una función nueva**." accent="#d97706">
		<Screen src={shot('intro-home')} />
		<Highlight x={20} y={443} w={350} h={44} at={8} color={colors.amber} radius={14} />
		<NewBadge x={300} y={425} at={16} />
	</VerticalScene>
);

const SameAsBefore: React.FC = () => (
	<VerticalScene caption="Depositar y retirar: **igual que antes**.">
		<ScreenFlow
			steps={[
				{at: 0, src: shot('intro-home')},
				{at: 14, src: shot('client-deposit-usd')},
				{at: 46, src: shot('intro-home')},
				{at: 60, src: shot('intro-withdraw')},
			]}
			fade={6}
		/>
		<Tap x={105} y={413} at={6} />
		<Tap x={285} y={413} at={52} />
	</VerticalScene>
);

const WhatIsAnExpense: React.FC = () => (
	<VerticalScene caption="**Pedir plata para un gasto:** la paga el banco, **no sale de tus ahorros**." accent="#d97706" captionSize={60}>
		<ScreenFlow
			steps={[
				{at: 0, src: shot('intro-home')},
				{at: 20, src: shot('client-expense-empty')},
			]}
		/>
		<Tap x={195} y={465} at={10} />
		<Highlight x={21} y={539} w={348} h={58} at={42} color={colors.amber} radius={14} />
	</VerticalScene>
);

const ExpenseForm: React.FC = () => (
	<VerticalScene caption="Poné el monto y **contá para qué es**: útiles, farmacia, una salida…" accent="#d97706" captionSize={60}>
		<ScreenFlow
			steps={[
				{at: 0, src: shot('client-expense-empty')},
				{at: 22, src: shot('client-expense-filled')},
			]}
		/>
		<Highlight x={21} y={631} w={348} h={50} at={26} until={75} color={colors.amber} />
		<Highlight x={21} y={715} w={348} h={50} at={60} until={125} color={colors.amber} />
		<Tap x={284} y={800} at={128} />
	</VerticalScene>
);

const Tracking: React.FC = () => (
	<VerticalScene caption="El banco lo revisa y lo aprueba. Lo seguís en **Mis movimientos**." captionSize={60}>
		<ScreenFlow
			steps={[
				{at: 0, src: shot('client-movements'), scrollY: 790},
				{at: 70, src: shot('intro-movements'), scrollY: 800},
			]}
		/>
		<Highlight x={20} y={62} w={350} h={112} at={12} until={66} color={colors.amber} />
		<Highlight x={20} y={196} w={350} h={104} at={84} color={colors.emerald} />
	</VerticalScene>
);

const scenes: Scene[] = [
	{duration: s(3.5), render: () => <VerticalTitle title="**FamBank** se renovó" subtitle="Te mostramos lo nuevo" />},
	{duration: s(4.5), render: () => <Login />},
	{duration: s(4.5), render: () => <EnableFingerprint />},
	{duration: s(5), render: () => <UnlockWithFingerprint />},
	{duration: s(5), render: () => <HomeTour />},
	{duration: s(3), render: () => <NewFeature />},
	{duration: s(3.5), render: () => <SameAsBefore />},
	{duration: s(5), render: () => <WhatIsAnExpense />},
	{duration: s(5), render: () => <ExpenseForm />},
	{duration: s(5), render: () => <Tracking />},
	{duration: s(3.5), render: () => <VerticalOutro line="Probá la nueva FamBank" />},
];

export const NUEVA_VERSION_DURATION = totalDuration(scenes);

export const NuevaVersion: React.FC = () => <Scenes scenes={scenes} />;
