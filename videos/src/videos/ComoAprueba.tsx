import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {PushBanner} from '../components/Brand';
import {Highlight, Screen, ScreenFlow, shot, Tap} from '../components/Phone';
import {colors, s} from '../theme';
import {Scene, Scenes, totalDuration} from './shared';
import {BigCheck, VerticalOutro, VerticalScene, VerticalTitle} from './vertical';

/** 9:16 · how the bank reviews and confirms a request, then checks the monthly report. */

const Notification: React.FC = () => {
	const frame = useCurrentFrame();
	const dim = interpolate(frame, [0, 20], [0, 0.35], {extrapolateRight: 'clamp'});
	return (
		<VerticalScene caption="Llega un **pedido nuevo**…">
			<Screen src={shot('bank-pending')} />
			<AbsoluteFill style={{background: `rgba(15,23,42,${dim})`}} />
			<div style={{position: 'absolute', top: 50, left: 15}}>
				<PushBanner title="Nuevo pedido de Jacinta Luis" body="Gasto · $ 30.000 · Útiles del colegio" at={14} width={360} />
			</div>
			<Tap x={195} y={90} at={70} />
		</VerticalScene>
	);
};

const Pending: React.FC = () => (
	<VerticalScene caption="Los pedidos **pendientes**, a la vista.">
		<Screen src={shot('bank-pending')} />
		<Highlight x={20} y={410} w={350} h={235} at={14} color={colors.amber} radius={22} />
	</VerticalScene>
);

const Review: React.FC = () => (
	<VerticalScene caption="Lo revisás y, si hace falta, **lo ajustás**.">
		<ScreenFlow
			steps={[
				{at: 0, src: shot('bank-pending')},
				{at: 20, src: shot('bank-review')},
			]}
		/>
		<Tap x={66} y={610} at={10} />
		<Highlight x={21} y={375} w={348} h={20} at={44} color={colors.amber} until={90} radius={8} />
		<Highlight x={21} y={515} w={348} h={138} at={80} color={colors.emerald} radius={16} />
	</VerticalScene>
);

const Confirm: React.FC = () => (
	<VerticalScene caption="Confirmás… **¡y listo!**">
		<ScreenFlow
			steps={[
				{at: 0, src: shot('bank-review')},
				{at: 50, src: shot('bank-after-confirm')},
			]}
		/>
		<Highlight x={258} y={777} w={111} h={46} at={6} color={colors.emerald} until={26} radius={14} />
		<Tap x={313} y={800} at={24} />
		<BigCheck at={30} />
	</VerticalScene>
);

const UpToDate: React.FC = () => (
	<VerticalScene caption="Todo queda **al día**, al instante.">
		<Screen src={shot('bank-after-confirm')} />
		<Highlight x={20} y={718} w={350} h={117} at={12} color={colors.amber} radius={22} />
	</VerticalScene>
);

const MonthlyReport: React.FC = () => {
	const frame = useCurrentFrame();
	const scroll = interpolate(frame, [80, 140], [0, 926], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<VerticalScene caption="Y a fin de mes, **el reporte** con todo.">
			<ScreenFlow
				steps={[
					{at: 0, src: shot('bank-report')},
					{at: 30, src: shot('bank-month-jacinta'), scrollY: scroll},
				]}
			/>
			<Tap x={195} y={240} at={20} />
			<Highlight x={21} y={677 - scroll} w={348} h={38} at={52} until={90} color={colors.muted} radius={12} />
			<Highlight x={21} y={1661 - scroll} w={348} h={87} at={142} color={colors.emerald} radius={16} />
		</VerticalScene>
	);
};

const scenes: Scene[] = [
	{duration: s(2.5), render: () => <VerticalTitle title="¿Cómo aprueba **el banco**?" subtitle="Pedidos, confirmación y reporte" />},
	{duration: s(3.5), render: () => <Notification />},
	{duration: s(3), render: () => <Pending />},
	{duration: s(4.5), render: () => <Review />},
	{duration: s(3.5), render: () => <Confirm />},
	{duration: s(3), render: () => <UpToDate />},
	{duration: s(6.5), render: () => <MonthlyReport />},
	{duration: s(3), render: () => <VerticalOutro line="Gratis por tiempo limitado" />},
];

export const COMO_APRUEBA_DURATION = totalDuration(scenes);

export const ComoAprueba: React.FC = () => <Scenes scenes={scenes} />;
