import { Catalog } from './catalog';

export const Scripts: ModdedBattleScriptsData = {
	inherit: 'gen9',
	gen: 9,
	init() {
		const speciesRecords = [...Catalog.seed.species, ...(Catalog.seed.forms || [])];
		// Own the dictionaries before pruning; never mutate the parent Dex.
		const allowed: { [table: string]: Set<string> } = {
			Pokedex: new Set(speciesRecords.map(s => s.id)),
			Learnsets: new Set(speciesRecords.map(s => s.id)),
			FormatsData: new Set(speciesRecords.map(s => s.id)),
			// Engine-only PP exhaustion fallback, never legal in an imported set/catalog.
			Moves: new Set([...Catalog.seed.moves.map(m => m.id), 'struggle']),
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
		for (const record of speciesRecords) {
			const species = this.modData('Pokedex', record.id);
			species.types = record.types.map(id => typeNames[id]);
			species.baseStats = { ...record.baseStats };
			species.abilities = { 0: abilityNames[record.abilities[0]] };
			// Forms/evolutions outside this bounded catalog are not supported.
			species.prevo = '';
			species.evos = [];
			const forms = (Catalog.seed.forms || []).filter(f => f.baseSpecies === record.id);
			if (forms.length) species.otherFormes = forms.map(f => f.name);
			else delete species.otherFormes;
			delete species.cosmeticFormes;
			const form = Catalog.seed.forms?.find(f => f.id === record.id);
			const baseLearnset = this.data.Learnsets[form?.baseSpecies || record.id]?.learnset;
			if (!baseLearnset) throw new Error(`Missing selected base learnset: ${record.id}`);
			// Mega forms have no own upstream learnset; create an owned dictionary.
			this.data.Learnsets[record.id] = {
				learnset: Object.fromEntries(record.learnset.map(id => [id, baseLearnset[id as ID]])),
			};
			this.data.FormatsData[record.id] = {};
		}
		// Ordinary move/ability callbacks remain inherited, not generated from prose.
		for (const type of Catalog.seed.types) {
			this.data.TypeChart[type.id] = { damageTaken: { ...Catalog.table.types[type.id].damageTaken } };
		}
		this.data.Items.none = { name: 'No item', num: 0 };
	},
};
