'use strict';
const assert = require('node:assert/strict');
const { Battle } = require('../../dist/sim/battle');
const { TeamValidator } = require('../../dist/sim/team-validator');
const catalog = require('../../data/mods/gen9tmt2seed/catalog.json');
const format = catalog.metadata.formatID;
const team = id => structuredClone(catalog.seed.teams.find(t => t.id === id).sets)
	.map(s => ({ ...s, item: s.item === 'none' ? '' : s.item }));

describe('TMT-09 selected Bird/Crab catalog (pinned adaptation, not ROM oracle)', () => {
	let b;
	afterEach(() => { b?.destroy(); b = null; });
	function create(lead = 1, opponent = 'alpha', opposingLead = 1) {
		b = new Battle({ formatid: format, seed: [1, 2, 3, 4],
			p1: { name: 'Gamma', team: team('gamma') }, p2: { name: 'Opponent', team: team(opponent) } });
		b.makeChoices(`team ${lead}`, `team ${opposingLead}`);
		return b;
	}
	it('resolves all additions with ordered types, pinned stats, ability and selected historical learnsets', () => {
		create();
		for (const [id, types] of Object.entries({ pidgey: ['Bird'], pidgeotto: ['Bird', 'Bird'], krabby: ['Crab'] })) {
			const p = b.p1.pokemon.find(q => q.species.id === id);
			assert.deepEqual(p.getTypes(), types);
			assert.deepEqual(p.species.baseStats, b.dex.mod('gen9').species.get(id).baseStats);
			for (const [stat, base] of Object.entries(p.species.baseStats)) {
				assert.equal(stat === 'hp' ? p.maxhp : p.storedStats[stat],
					Math.floor((2 * base + 31) / 2) + (stat === 'hp' ? 60 : 5));
			}
			const actual = b.dex.species.getLearnsetData(id).learnset;
			assert.deepEqual(Object.keys(actual).sort(), [...p.set.moves].sort());
			for (const move of p.set.moves) assert(b.dex.mod('gen9').species.getLearnsetData(id).learnset[move]?.length);
		}
		assert.equal(b.p1.pokemon.find(p => p.species.id === 'krabby').ability, 'shellarmor');
	});
	it('accepts gamma as a complete fixed premade and rejects mutations or mixed rosters', () => {
		assert.equal(TeamValidator.get(format).validateTeam(team('gamma').reverse()), null);
		for (const mutate of [s => { s[0].ability = 'noguard'; }, s => { s[2].ability = 'hypercutter'; },
			s => { s[0].moves[0] = 'leer'; }, s => { s[2].moves[0] = 'surf'; },
			s => { s[0] = team('alpha')[0]; }, s => { s[2].item = 'pidgeotite'; },
			s => { s[2].evs.atk = 252; }, s => { s[1].species = 'pidgeotmega'; }]) {
			const sets = team('gamma'); mutate(sets); assert(TeamValidator.get(format).validateTeam(sets)?.length);
		}
	});
	it('executes the selected damaging moves with fixed maximum-roll noncritical adaptation results', () => {
		create(); b.randomizer = n => n;
		const expected = { pidgey: { gust: 38, wingattack: 66, quickattack: 22 },
			pidgeotto: { tackle: 27, wingattack: 80, quickattack: 27 }, krabby: { visegrip: 57, waterpulse: 23 } };
		for (const p of b.p1.pokemon) for (const id of p.set.moves) {
			const move = b.dex.getActiveMove(id); move.willCrit = false;
			if (move.category !== 'Status') assert.equal(b.actions.getDamage(p, b.p2.active[0], move), expected[p.species.id][id]);
		}
		assert.equal(b.dex.moves.get('wingattack').category, 'Physical');
		assert.equal(b.dex.moves.get('waterpulse').category, 'Special');
	});
	it('multiplies double Bird defenses and applies all seven documented Crab defenses', () => {
		create();
		assert.equal(b.p1.pokemon[0].runEffectiveness(b.dex.getActiveMove('rockthrow')), 1);
		assert.equal(b.p1.pokemon[1].runEffectiveness(b.dex.getActiveMove('rockthrow')), 2);
		const crab = b.p1.pokemon[2];
		for (const [type, expected] of Object.entries({ Normal: 0, Dark: 0, Water: -1, Rock: 0, Electric: 0, Grass: -1, Flying: 1 })) {
			const move = b.dex.getActiveMove('tackle'); move.type = type;
			assert.equal(crab.runEffectiveness(move), expected, type);
		}
	});
	it('Leer lowers the actual opponent defense by one during a real turn', () => {
		create(3); b.makeChoices('move leer', 'move tackle');
		assert.equal(b.p2.active[0].boosts.def, -1);
		assert(b.log.some(l => l.startsWith('|-unboost|p2') && l.endsWith('|def|1')));
	});
	it('Water Pulse applies its inherited confusion secondary under explicit hit/miss controls', () => {
		for (const trigger of [true, false]) {
			if (b) b.destroy(); create(3);
			const random = b.random.bind(b);
			// This engine samples secondary effects with random(100), not randomChance.
			// Control that roll only; no production RNG change or ROM claim.
			b.random = (...args) => args.length === 1 && args[0] === 100 ? (trigger ? 0 : 99) : random(...args);
			b.makeChoices('move waterpulse', 'move tackle');
			assert.equal(!!b.p2.active[0].volatiles.confusion, trigger);
		}
	});
	it('Shell Armor blocks a forced critical hit without changing ordinary damage', () => {
		create(3, 'gamma', 1); b.randomizer = n => n;
		const source = b.p2.active[0], target = b.p1.active[0];
		const move = b.dex.getActiveMove('wingattack'); move.willCrit = false;
		const ordinary = b.actions.getDamage(source, target, move);
		move.willCrit = true; assert.equal(b.actions.getDamage(source, target, move), ordinary);
		target.setAbility('keeneye'); assert(b.actions.getDamage(source, target, move) > ordinary);
	});
	it('finishes a deterministic gamma battle and keeps ordinary Showdown records isolated', () => {
		create();
		for (let step = 0; !b.ended && step < 300; step++) b.makeChoices();
		assert.equal(b.ended, true);
		assert.deepEqual(b.dex.mod('gen9').species.get('krabby').types, ['Water']);
		assert.equal(b.dex.moves.get('surf').exists, false);
	});
});
