import {Composition} from 'remotion';
import {FPS} from './theme';
import {COMO_APRUEBA_DURATION, ComoAprueba} from './videos/ComoAprueba';
import {COMO_PIDE_DURATION, ComoPide} from './videos/ComoPide';
import {QUE_ES_DURATION, QueEsFamBank} from './videos/QueEsFamBank';

export const Root: React.FC = () => {
	return (
		<>
			<Composition id="QueEsFamBank" component={QueEsFamBank} durationInFrames={QUE_ES_DURATION} fps={FPS} width={1920} height={1080} defaultProps={{}} />
			<Composition id="ComoPide" component={ComoPide} durationInFrames={COMO_PIDE_DURATION} fps={FPS} width={1080} height={1920} defaultProps={{}} />
			<Composition id="ComoAprueba" component={ComoAprueba} durationInFrames={COMO_APRUEBA_DURATION} fps={FPS} width={1080} height={1920} defaultProps={{}} />
		</>
	);
};
