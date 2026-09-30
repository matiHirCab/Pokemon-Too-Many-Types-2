'use strict';
const assert = require('node:assert/strict');
const { Dex } = require('../../dist/sim/dex');
const { Battle } = require('../../dist/sim/battle');
const { TeamValidator } = require('../../dist/sim/team-validator');
const catalog = require('../../data/mods/gen9tmt2seed/catalog.json');

describe('TMT-05 hidden catalog integration (not battle fidelity)', () => {
	it('constructs isolated hidden format and preserves base formats', () => {
		const format = Dex.formats.get(catalog.metadata.formatID);
		assert.equal(format.mod, catalog.metadata.modID);
		for (const field of ['searchShow', 'challengeShow', 'tournamentShow', 'rated']) assert.equal(format[field], false);
		const battle = new Battle({ formatid: format.id });
		assert.equal(battle.dex.currentMod, 'gen9tmt2seed');
		battle.destroy();
		assert.deepEqual(Dex.forFormat('gen9ou').species.get('Pidgeot').types, ['Normal', 'Flying']);
	});
	it('resolves every selected record and rejects upstream-only catalog leakage', () => {
		const dex = Dex.forFormat(catalog.metadata.formatID);
		assert.equal(dex.species.all().length, 6);
		for (const s of catalog.seed.species) {
			assert.deepEqual(dex.species.get(s.id).types, catalog.table.species[s.id].types);
			assert.deepEqual(dex.species.get(s.id).baseStats, s.baseStats);
			assert.deepEqual(Object.keys(dex.species.getLearnsetData(s.id).learnset).sort(), [...s.learnset].sort());
		}
		for (const m of catalog.seed.moves) {
			const actual = dex.moves.get(m.id);
			for (const field of ['name', 'basePower', 'accuracy', 'pp', 'priority', 'category']) assert.equal(actual[field], m[field]);
			assert.equal(actual.type, catalog.table.moves[m.id].type);
		}
		for (const a of catalog.seed.abilities) assert.equal(dex.abilities.get(a.id).name, a.name);
		assert.equal(dex.items.get('none').name, 'No item');
		for (const p of catalog.seed.chart) assert.equal(dex.types.get(p.defender).damageTaken[catalog.table.types[p.attacker].name], ({ 0: 3, 0.5: 2, 1: 0, 2: 1 })[p.multiplier]);
		assert.equal(dex.species.get('Mew').exists, false);
		assert.equal(dex.moves.get('Surf').exists, false);
		assert.equal(dex.abilities.get('Protean').exists, false);
		assert.equal(dex.items.get('Leftovers').exists, false);
	});
	it('guards selected references and emits a dataset compatibility protocol record', () => {
		const validator = TeamValidator.get(catalog.metadata.formatID);
		const sets = catalog.seed.teams[0].sets.map(s => ({ ...s, item: '' }));
		assert.equal(validator.validateTeam(sets), null);
		const bad = catalog.seed.teams[0].sets.map(s => ({ ...s, item: '' }));
		bad[0].moves = ['surf'];
		assert.ok(validator.validateTeam(bad));
		let record;
		Dex.formats.get(catalog.metadata.formatID).onBattleStart.call({ add(...args) { record = args; } });
		assert.deepEqual(record, ['tmt2data', catalog.metadata.version, catalog.metadata.datasetHash, catalog.metadata.catalogHash]);
	});
});
