import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop, bankIcon, BrowserWindow, Caption, clientIcon, Logo, Pill, PushBanner} from '../components/Brand';
import {Highlight, Phone, Screen, ScreenFlow, shot, Tap} from '../components/Phone';
import {colors, font, s} from '../theme';
import {Scene, Scenes, totalDuration} from './shared';

/** 16:9 · public page: what FamBank is. */

const Intro: React.FC = () => (
	<AbsoluteFill>
		<Backdrop dark />
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 40}}>
			<Logo size={170} light />
			<Caption text="El banco de tu familia" size={64} color="white" weight={600} at={14} />
		</AbsoluteFill>
	</AbsoluteFill>
);

const Member: React.FC<{initial: string; color: string; angle: number; at: number}> = ({initial, color, angle, at}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const pop = spring({frame: frame - at, fps, config: {damping: 12}});
	const r = 250;
	const x = Math.cos(angle) * r * pop;
	const y = Math.sin(angle) * r * pop;
	return (
		<>
			<div
				style={{
					position: 'absolute',
					left: '50%',
					top: '50%',
					width: r * pop,
					height: 4,
					background: `${colors.emerald}55`,
					transformOrigin: '0 50%',
					transform: `rotate(${angle}rad)`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: '50%',
					top: '50%',
					width: 120,
					height: 120,
					marginLeft: -60 + x,
					marginTop: -60 + y,
					borderRadius: 120,
					background: color,
					color: 'white',
					fontFamily: font,
					fontWeight: 800,
					fontSize: 52,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					transform: `scale(${pop})`,
					boxShadow: '0 12px 30px rgba(15,23,42,0.18)',
				}}
			>
				{initial}
			</div>
		</>
	);
};

const Family: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const pop = spring({frame, fps, config: {damping: 12}});
	return (
		<AbsoluteFill>
			<Backdrop />
			<div style={{position: 'absolute', left: 160, top: 0, bottom: 0, width: 760, display: 'flex', alignItems: 'center'}}>
				<Caption text="Una forma **simple** de manejar la plata en familia." size={84} align="left" at={6} />
			</div>
			<div style={{position: 'absolute', right: 180, top: 140, width: 800, height: 800}}>
				<Member initial="P" color={colors.emerald} angle={-Math.PI / 2} at={14} />
				<Member initial="J" color={colors.amber} angle={Math.PI / 6} at={20} />
				<Member initial="R" color="#0ea5e9" angle={(5 * Math.PI) / 6} at={26} />
				<Img
					src={bankIcon}
					style={{
						position: 'absolute',
						left: '50%',
						top: '50%',
						width: 180,
						height: 180,
						margin: -90,
						borderRadius: 40,
						transform: `scale(${pop})`,
						boxShadow: '0 20px 50px rgba(14,116,144,0.35)',
					}}
				/>
			</div>
		</AbsoluteFill>
	);
};

const TwoApps: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const left = spring({frame: frame - 4, fps, config: {damping: 200}});
	const right = spring({frame: frame - 34, fps, config: {damping: 200}});
	return (
		<AbsoluteFill>
			<Backdrop />
			<div style={{position: 'absolute', left: 140, top: 0, bottom: 0, width: 720, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 40}}>
				<Caption text="Quien administra la plata de la casa **hace de banco**…" size={68} align="left" at={4} />
				<Caption text="…y cada integrante tiene **su app**." size={68} align="left" at={34} />
			</div>
			<div style={{position: 'absolute', right: 470, top: 120, transform: `translateY(${(1 - left) * 900}px) rotate(-4deg)`}}>
				<Phone width={330}>
					<Screen src={shot('bank-home')} />
				</Phone>
				<div style={{display: 'flex', justifyContent: 'center', marginTop: 24}}>
					<Pill color="#0ea5e9" size={28} at={14}>
						App del banco
					</Pill>
				</div>
			</div>
			<div style={{position: 'absolute', right: 100, top: 160, transform: `translateY(${(1 - right) * 900}px) rotate(4deg)`}}>
				<Phone width={330}>
					<Screen src={shot('client-home')} />
				</Phone>
				<div style={{display: 'flex', justifyContent: 'center', marginTop: 24}}>
					<Pill color={colors.emerald} size={28} at={44}>
						App de cada integrante
					</Pill>
				</div>
			</div>
		</AbsoluteFill>
	);
};

/** Phone on the right, caption on the left. */
const PhoneScene: React.FC<{caption: string; accent?: string; children: React.ReactNode; zoom?: {scale: number; x: number; y: number}}> = ({
	caption,
	accent,
	children,
	zoom,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const enter = spring({frame, fps, config: {damping: 200}});
	return (
		<AbsoluteFill>
			<Backdrop />
			<div style={{position: 'absolute', left: 160, top: 0, bottom: 0, width: 860, display: 'flex', alignItems: 'center'}}>
				<Caption text={caption} size={76} align="left" at={8} accent={accent} />
			</div>
			<div style={{position: 'absolute', right: 230, top: 60, transform: `translateY(${(1 - enter) * 80}px)`, opacity: enter}}>
				<Phone width={420} zoom={zoom}>
					{children}
				</Phone>
			</div>
		</AbsoluteFill>
	);
};

const useZoom = (from: number, to: number, scale: number, x: number, y: number) => {
	const frame = useCurrentFrame();
	const t = interpolate(frame, [from, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return {scale: 1 + (scale - 1) * t, x, y};
};

const Savings: React.FC = () => (
	<PhoneScene caption="Cada uno ve **sus ahorros** en dólares y en pesos.">
		<Screen src={shot('client-home')} />
		<Highlight x={20} y={150} w={350} h={225} at={30} color={colors.emerald} radius={24} />
	</PhoneScene>
);

const Deposit: React.FC = () => {
	const zoom = useZoom(100, 130, 1.25, 195, 430);
	return (
		<PhoneScene caption="Depositá o retirá en pesos o en dólares, **con la cotización del blue a la vista**." zoom={zoom}>
			<ScreenFlow
				steps={[
					{at: 0, src: shot('client-home')},
					{at: 28, src: shot('client-deposit-usd')},
				]}
			/>
			<Tap x={105} y={412} at={18} />
			<Highlight x={21} y={389} w={348} h={90} at={60} color={colors.emerald} />
		</PhoneScene>
	);
};

const Expense: React.FC = () => (
	<PhoneScene caption="¿Hace falta plata para algo? **Pedila, contando para qué es.**" accent="#d97706">
		<ScreenFlow
			steps={[
				{at: 0, src: shot('client-home')},
				{at: 26, src: shot('client-expense-filled')},
			]}
		/>
		<Tap x={195} y={464} at={16} />
		<Highlight x={21} y={715} w={348} h={50} at={56} color={colors.amber} />
	</PhoneScene>
);

const BankDesktop: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const enter = spring({frame, fps, config: {damping: 200}});
	return (
		<AbsoluteFill>
			<Backdrop />
			<div style={{position: 'absolute', top: 70, left: 0, right: 0}}>
				<Caption text="El banco ve todo en un resumen y **confirma o rechaza** cada pedido." size={60} at={6} style={{padding: '0 200px'}} />
			</div>
			<div style={{position: 'absolute', left: 360, top: 280, transform: `translateY(${(1 - enter) * 100}px)`, opacity: enter}}>
				<BrowserWindow width={1200} src={shot('bank-desktop-dashboard')}>
					<Highlight x={355} y={308} w={309} h={40} at={45} color={colors.red} radius={12} />
					<Highlight x={673} y={308} w={309} h={40} at={55} color={colors.emerald} radius={12} />
				</BrowserWindow>
			</div>
		</AbsoluteFill>
	);
};

const Report: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const enter = spring({frame, fps, config: {damping: 200}});
	return (
		<AbsoluteFill>
			<Backdrop />
			<div style={{position: 'absolute', left: 140, top: 0, bottom: 0, width: 620, display: 'flex', alignItems: 'center'}}>
				<Caption text="**Reporte del mes**, historial y avisos al instante." size={72} align="left" at={6} />
			</div>
			<div style={{position: 'absolute', right: 110, top: 190, transform: `translateX(${(1 - enter) * 120}px)`, opacity: enter}}>
				<BrowserWindow width={1000} src={shot('bank-desktop-report')} scrollY={300} />
			</div>
			<div style={{position: 'absolute', right: 150, top: 60}}>
				<PushBanner title="Nuevo pedido de Jacinta Luis" body="Gasto · $ 30.000 · Útiles del colegio" at={40} width={560} />
			</div>
		</AbsoluteFill>
	);
};

const Offline: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const online = frame > 40;
	const sent = spring({frame: frame - 44, fps, config: {damping: 12}});
	const pop = spring({frame, fps, config: {damping: 12}});
	return (
		<AbsoluteFill>
			<Backdrop />
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 50}}>
				<div style={{display: 'flex', gap: 60, alignItems: 'center', transform: `scale(${pop})`}}>
					<Img src={clientIcon} style={{width: 150, height: 150, borderRadius: 34, boxShadow: '0 16px 40px rgba(5,150,105,0.35)'}} />
					<div
						style={{
							width: 150,
							height: 150,
							borderRadius: 150,
							background: online ? colors.emerald : '#94a3b8',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<svg width="86" height="86" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
							{online ? (
								<path d="M5 12.5l4.5 4.5L19 7.5" style={{transform: `scale(${sent})`, transformOrigin: '12px 12px'}} />
							) : (
								<>
									<path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16.1a5 5 0 0 1 7 0" />
									<path d="M3 3l18 18" />
								</>
							)}
						</svg>
					</div>
				</div>
				<Caption text="Se instala en el celular y **funciona sin conexión**." size={72} at={8} />
				<Caption
					text={online ? 'Al volver internet, el pedido se envía solo.' : 'Sin internet, el pedido queda guardado…'}
					size={40}
					weight={600}
					color={colors.muted}
					at={online ? 40 : 14}
				/>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

const Outro: React.FC = () => (
	<AbsoluteFill>
		<Backdrop dark />
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 36}}>
			<Logo size={150} light />
			<Caption text="Gratis por tiempo limitado" size={60} color="white" weight={600} at={10} />
			<Caption text="fambank.armage.tech" size={52} color="white" weight={800} at={18} style={{background: 'rgba(255,255,255,0.18)', borderRadius: 999, padding: '10px 40px'}} />
		</AbsoluteFill>
	</AbsoluteFill>
);

const scenes: Scene[] = [
	{duration: s(4.5), render: () => <Intro />},
	{duration: s(6), render: () => <Family />},
	{duration: s(6.5), render: () => <TwoApps />},
	{duration: s(6), render: () => <Savings />},
	{duration: s(7), render: () => <Deposit />},
	{duration: s(6.5), render: () => <Expense />},
	{duration: s(7), render: () => <BankDesktop />},
	{duration: s(6), render: () => <Report />},
	{duration: s(4), render: () => <Offline />},
	{duration: s(4), render: () => <Outro />},
];

export const QUE_ES_DURATION = totalDuration(scenes);

export const QueEsFamBank: React.FC = () => <Scenes scenes={scenes} />;
