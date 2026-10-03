import React from 'react';
import {Highlight, Screen, ScreenFlow, shot, Tap} from '../components/Phone';
import {colors, s} from '../theme';
import {Scene, Scenes, totalDuration} from './shared';
import {Toast, useZoom, VerticalOutro, VerticalScene, VerticalTitle} from './vertical';

/** 9:16 · how a family member deposits dollars and asks for money for an expense. */

const Savings: React.FC = () => (
	<VerticalScene caption="Acá ves **tus ahorros**, en dólares y en pesos.">
		<Screen src={shot('client-home')} />
		<Highlight x={20} y={150} w={350} h={225} at={18} color={colors.emerald} radius={24} />
	</VerticalScene>
);

const Deposit: React.FC = () => {
	const zoom = useZoom(110, 135, 1.3, 195, 430, 160);
	return (
		<VerticalScene caption="Depositá en dólares… **la cotización queda grabada**." zoom={zoom}>
			<ScreenFlow
				steps={[
					{at: 0, src: shot('client-home')},
					{at: 22, src: shot('client-deposit-empty')},
					{at: 70, src: shot('client-deposit-usd')},
				]}
			/>
			<Tap x={105} y={412} at={12} />
			<Tap x={280} y={514} at={52} />
			<Highlight x={21} y={389} w={348} h={90} at={112} color={colors.emerald} until={165} />
		</VerticalScene>
	);
};

const Sent: React.FC = () => (
	<VerticalScene caption="Listo, **el banco lo recibe**.">
		<ScreenFlow
			steps={[
				{at: 0, src: shot('client-deposit-usd')},
				{at: 14, src: shot('client-home')},
			]}
		/>
		<Tap x={284} y={800} at={4} />
		<Toast at={20} title="Depósito pedido" detail="USD 50,00 · Pendiente de aprobación" tone={colors.emerald} />
	</VerticalScene>
);

const Expense: React.FC = () => (
	<VerticalScene caption="¿Un gasto? Pedí la plata y **contá para qué es**." accent="#d97706">
		<ScreenFlow
			steps={[
				{at: 0, src: shot('client-home')},
				{at: 22, src: shot('client-expense-empty')},
				{at: 64, src: shot('client-expense-filled')},
			]}
		/>
		<Tap x={195} y={465} at={12} />
		<Highlight x={21} y={631} w={348} h={50} at={74} color={colors.amber} until={120} />
		<Highlight x={21} y={715} w={348} h={50} at={100} color={colors.amber} until={175} />
		<Tap x={284} y={800} at={178} />
	</VerticalScene>
);

const Tracking: React.FC = () => (
	<VerticalScene caption="Seguís **cada pedido** desde la app.">
		<Screen src={shot('client-movements')} scrollY={790} />
		<Highlight x={20} y={62} w={350} h={112} at={16} color={colors.amber} />
		<Highlight x={20} y={185} w={350} h={122} at={26} color={colors.emerald} />
	</VerticalScene>
);

const scenes: Scene[] = [
	{duration: s(3), render: () => <VerticalTitle title="¿Cómo pido plata en **FamBank**?" subtitle="Paso a paso" />},
	{duration: s(3.5), render: () => <Savings />},
	{duration: s(6.5), render: () => <Deposit />},
	{duration: s(2.5), render: () => <Sent />},
	{duration: s(7), render: () => <Expense />},
	{duration: s(3.5), render: () => <Tracking />},
	{duration: s(3), render: () => <VerticalOutro line="La plata de la familia, en orden." />},
];

export const COMO_PIDE_DURATION = totalDuration(scenes);

export const ComoPide: React.FC = () => <Scenes scenes={scenes} />;
