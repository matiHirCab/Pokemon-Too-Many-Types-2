import { Catalog } from '../data/mods/gen9tmt2seed/catalog';
import { premadeProblems, fillPremadeDefaults } from '../data/mods/gen9tmt2seed/rules';

export const TMT2Formats: import('../sim/dex-formats').FormatList = [{
	name: '[Gen 9] TMT2 Seed',
	section: 'TMT2 Experimental',
	mod: 'gen9tmt2seed',
	gameType: 'singles',
	rated: false,
	searchShow: false,
	challengeShow: false,
	tournamentShow: false,
	desc: 'Private bounded Gen9 adaptation: catalog premade, level 50, IV31, EV0, Hardy, only catalog-listed items and Mega forms; no other transformations. Not exact ROM fidelity.',
	ruleset: ['Terastal Clause', 'Team Preview', 'Min Team Size = 3', 'Max Team Size = 3', 'Min Level = 50', 'Default Level = 50', 'Max Level = 50', 'EV Limit = 0'],
	validateTeam(team, options) {
		if (this.format.customRules?.length) return ['TMT2 does not support custom rule overrides.'];
		const problems = premadeProblems(team);
		if (problems.length) return problems;
		fillPremadeDefaults(team);
		return this.baseValidateTeam(team, options) || undefined;
	},
	onBegin() {
		if (this.format.customRules?.length) throw new Error('Unsupported TMT2 custom rules.');
		for (const side of this.sides) {
			const problems = premadeProblems(side.pokemon.map(p => p.set));
			if (problems.length) throw new Error(`Invalid TMT2 premade: ${problems.join(' ')}`);
			for (const pokemon of side.pokemon) pokemon.canTerastallize = null;
		}
	},
	onValidateSet(set) {
		const record = Catalog.seed.species.find(s => s.id === this.dex.toID(set.species));
		if (!record) return ['Species outside the bounded TMT2 seed.'];
		if (!record.abilities.includes(this.dex.toID(set.ability))) return ['Ability outside the selected TMT2 set.'];
		const expected = Catalog.seed.teams.flatMap(t => t.sets).find(s => s.species === record.id);
		if ((this.dex.toID(set.item) || 'none') !== expected?.item) return ['Item outside the selected TMT2 set.'];
		if (set.moves.some(m => !record.learnset.includes(this.dex.toID(m)))) {
			return ['Move outside the selected TMT2 learnset.'];
		}
	},
	onBattleStart() {
		this.add('tmt2data', Catalog.metadata.version, Catalog.metadata.datasetHash, Catalog.metadata.catalogHash);
	},
}];
