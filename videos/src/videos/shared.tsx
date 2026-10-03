import React from 'react';
import {linearTiming, TransitionSeries} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';

export const TRANSITION = 15;

export type Scene = {duration: number; render: () => React.ReactNode};

/** Total length of a scene list joined by TRANSITION-frame cross-fades. */
export const totalDuration = (scenes: Scene[]) => scenes.reduce((sum, sc) => sum + sc.duration, 0) - TRANSITION * (scenes.length - 1);

export const Scenes: React.FC<{scenes: Scene[]}> = ({scenes}) => (
	<TransitionSeries>
		{scenes.flatMap((scene, i) => [
			...(i > 0
				? [<TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={linearTiming({durationInFrames: TRANSITION})} />]
				: []),
			<TransitionSeries.Sequence key={`s${i}`} durationInFrames={scene.duration}>
				{scene.render()}
			</TransitionSeries.Sequence>,
		])}
	</TransitionSeries>
);
