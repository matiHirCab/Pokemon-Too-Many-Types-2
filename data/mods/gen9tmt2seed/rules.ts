import { toID } from '../../../sim/dex-data';
import { Catalog } from './catalog';

const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const fields = new Set(['name', 'species', 'ability', 'item', 'moves', 'nature', 'level', 'evs', 'ivs',
	'gender', 'shiny', 'happiness', 'pokeball', 'teraType', 'dynamaxLevel', 'gigantamax']);

/** Raw input gate runs before Showdown can clamp levels or fill EVs. No ROM claim. */
export function premadeProblems(team: PokemonSet[]): string[] {
	if (!Array.isArray(team) || team.length !== 3) return ['TMT2 requires one complete alpha or beta premade (3 Pokémon).'];
	const problems: string[] = [];
	for (const set of team) {
		if (!set || typeof set !== 'object') return ['Invalid TMT2 set.'];
		const id = toID(set.species);
		const expected = Catalog.seed.teams.flatMap(t => t.sets).find(s => s.species === id);
		if (!expected) { problems.push('Species/form outside the TMT2 premades.'); continue; }
		const fail = (message: string) => problems.push(`${expected.species}: ${message}`);
		if (Object.keys(set).some(k => !fields.has(k))) fail('Unsupported set field.');
		if (set.level !== 50) fail('Level must be exactly 50.');
		if (toID(set.nature) !== toID(expected.nature)) fail('Nature must be Hardy.');
		if (toID(set.ability) !== expected.ability) fail('Ability must match the premade.');
		if ((toID(set.item) || 'none') !== expected.item) fail('Item must match the premade.');
		if (!Array.isArray(set.moves) || set.moves.length !== 4 || set.moves.some(m => typeof m !== 'string') ||
			set.moves.map(toID).sort().join() !== [...expected.moves].sort().join()) {
			fail('Use all four premade moves, without duplicates.');
		}
		for (const kind of ['evs', 'ivs'] as const) {
			const values = set[kind];
			const required = kind === 'evs' ? 0 : 31;
			if (values !== undefined && (!values || typeof values !== 'object' || Array.isArray(values) ||
				Object.keys(values).some(k => !stats.includes(k as StatID)))) {
				fail(`Invalid ${kind} fields.`); continue;
			}
			if (stats.some(s => values?.[s] !== undefined && values[s] !== required)) {
				fail(`${kind.toUpperCase()} must all be ${required}.`);
			}
		}
		if (set.teraType || set.gigantamax || (set.dynamaxLevel !== undefined && set.dynamaxLevel !== 10)) {
			fail('Transformations are not supported.');
		}
	}
	const roster = team.map(s => toID(s?.species)).sort().join();
	if (!Catalog.seed.teams.some(t => t.sets.map(s => s.species).sort().join() === roster)) {
		problems.push('Use the complete alpha or beta roster; mixed/duplicate species are not supported.');
	}
	return problems;
}

export function fillPremadeDefaults(team: PokemonSet[]) {
	for (const set of team) {
		if (toID(set.item) === 'none') set.item = '';
		else set.item = toID(set.item);
		set.evs = Object.fromEntries(stats.map(s => [s, 0])) as StatsTable;
		set.ivs = Object.fromEntries(stats.map(s => [s, 31])) as StatsTable;
	}
}
