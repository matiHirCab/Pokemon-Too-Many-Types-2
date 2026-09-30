import { Catalog } from '../data/mods/gen9tmt2seed/catalog';

export const TMT2Formats: import('../sim/dex-formats').FormatList = [{
	name: '[Gen 9] TMT2 Seed',
	section: 'TMT2 Experimental',
	mod: 'gen9tmt2seed',
	gameType: 'singles',
	rated: false,
	searchShow: false,
	challengeShow: false,
	tournamentShow: false,
	desc: 'Hidden bounded Gen9 adaptation. TMT-05 integration only; battle legality/fidelity is not certified.',
	ruleset: ['Team Preview', 'Min Team Size = 3', 'Max Team Size = 3', 'Default Level = 50', 'Max Level = 50'],
	onValidateSet(set) {
		const record = Catalog.seed.species.find(s => s.id === this.dex.toID(set.species));
		if (!record) return ['Species outside the bounded TMT2 seed.'];
		if (!record.abilities.includes(this.dex.toID(set.ability))) return ['Ability outside the selected TMT2 set.'];
		if (set.item && this.dex.toID(set.item) !== 'none') return ['Held items outside the TMT2 seed.'];
		if (set.moves.some(m => !record.learnset.includes(this.dex.toID(m)))) {
			return ['Move outside the selected TMT2 learnset.'];
		}
	},
	onBattleStart() {
		this.add('tmt2data', Catalog.metadata.version, Catalog.metadata.datasetHash, Catalog.metadata.catalogHash);
	},
}];
