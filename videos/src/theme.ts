import {loadFont} from '@remotion/google-fonts/Inter';

const {fontFamily} = loadFont('normal', {weights: ['400', '600', '800'], subsets: ['latin']});

export const font = fontFamily;

export const colors = {
	emerald: '#059669',
	emeraldLight: '#34d399',
	emeraldDark: '#065f46',
	mint: '#ecfdf5',
	red: '#dc2626',
	amber: '#f59e0b',
	ink: '#0f172a',
	muted: '#475569',
	paper: '#f8fafc',
};

export const FPS = 30;
export const s = (seconds: number) => Math.round(seconds * FPS);
