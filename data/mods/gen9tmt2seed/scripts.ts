import { Catalog } from './catalog';

export const Scripts: ModdedBattleScriptsData = {
	inherit: 'gen9',
	gen: 9,
	init() {
		// Own the dictionaries before pruning; never mutate the parent Dex.
		const allowed: { [table: string]: Set<string> } = {
			Pokedex: new Set(Catalog.seed.species.map(s => s.id)),
			Learnsets: new Set(Catalog.seed.species.map(s => s.id)),
			FormatsData: new Set(Catalog.seed.species.map(s => s.id)),
			Moves: new Set(Catalog.seed.moves.map(m => m.id)),
			Abilities: new Set(Catalog.seed.abilities.map(a => a.id)),
			Items: new Set(Catalog.seed.items.map(i => i.id)),
			TypeChart: new Set(Catalog.seed.types.map(t => t.id)),
		};
		for (const table of ['Pokedex', 'Learnsets', 'FormatsData', 'Moves', 'Abilities', 'Items', 'TypeChart'] as const) {
			for (const id in this.data[table]) {
				if (!allowed[table].has(id)) delete this.data[table][id];
			}
		}
		const typeNames = Object.fromEntries(Catalog.seed.types.map(t => [t.id, t.name]));
		const abilityNames = Object.fromEntries(Catalog.seed.abilities.map(a => [a.id, a.name]));
		for (const record of Catalog.seed.species) {
			const species = this.modData('Pokedex', record.id);
			species.types = record.types.map(id => typeNames[id]);
			species.baseStats = { ...record.baseStats };
			species.abilities = { 0: abilityNames[record.abilities[0]] };
			// Forms/evolutions outside this bounded catalog are not supported.
			species.prevo = '';
			species.evos = [];
			delete species.otherFormes;
			delete species.cosmeticFormes;
			const learned = this.modData('Learnsets', record.id);
			learned.learnset = Object.fromEntries(record.learnset.map(id => [id, learned.learnset![id]]));
			this.data.FormatsData[record.id] = {};
		}
		// Ordinary move/ability callbacks remain inherited, not generated from prose.
		for (const type of Catalog.seed.types) {
			this.data.TypeChart[type.id] = { damageTaken: { ...Catalog.table.types[type.id].damageTaken } };
		}
		this.data.Items.none = { name: 'No item', num: 0 };
	},
};
